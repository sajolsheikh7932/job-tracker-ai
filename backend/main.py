import io
import json
import uuid
import requests
from fastapi import Depends, Header
from os import getenv
from typing import Optional

from dotenv import load_dotenv
from docx import Document
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from pydantic import BaseModel
from pypdf import PdfReader
from supabase import Client, create_client

load_dotenv()

OPENAI_API_KEY = getenv("OPENAI_API_KEY")
SUPABASE_URL = getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = getenv("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_BUCKET = getenv("SUPABASE_BUCKET", "documents")
SUPABASE_PUBLISHABLE_KEY = getenv("SUPABASE_PUBLISHABLE_KEY")

if not SUPABASE_PUBLISHABLE_KEY:
    raise RuntimeError("Missing SUPABASE_PUBLISHABLE_KEY in backend/.env")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")

if not OPENAI_API_KEY:
    raise RuntimeError("Missing OPENAI_API_KEY in backend/.env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
openai_client = OpenAI(api_key=OPENAI_API_KEY)

app = FastAPI(title="AI Job Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://job-tracker-ai-git-main-sajolsheikh7932s-projects.vercel.app/",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- MODELS ----------

class JobCreate(BaseModel):
    company: str
    title: str
    job_link: Optional[str] = None
    jd_text: Optional[str] = None
    status: str = "Need to Apply"
    location: Optional[str] = None
    salary: Optional[str] = None
    notes: Optional[str] = None
    date_applied: Optional[str] = None
    interview_date: Optional[str] = None


class JobUpdateStatus(BaseModel):
    status: str


class JDExtractRequest(BaseModel):
    jd_text: str


class ATSAnalysisRequest(BaseModel):
    cv_text: str
    jd_text: str


class GenerateDocsRequest(BaseModel):
    jd_text: str
    job_id: Optional[str] = None
    cv_text: Optional[str] = None


# ---------- HELPERS ----------

def verify_supabase_token(access_token: str):
    url = f"{SUPABASE_URL}/auth/v1/user"
    response = requests.get(
        url,
        headers={
            "apikey": SUPABASE_PUBLISHABLE_KEY,
            "Authorization": f"Bearer {access_token}",
        },
        timeout=20,
    )

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return response.json()


def get_current_user(authorization: Optional[str] = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.split(" ", 1)[1].strip()
    user = verify_supabase_token(token)

    if not user or not user.get("id"):
        raise HTTPException(status_code=401, detail="Unable to identify user")

    return user


def parse_uploaded_file(filename: str, file_bytes: bytes) -> str:
    lower = filename.lower()

    if lower.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        for page in reader.pages:
            text_parts.append(page.extract_text() or "")
        return "\n".join(text_parts).strip()

    if lower.endswith(".docx"):
        doc = Document(io.BytesIO(file_bytes))
        return "\n".join([p.text for p in doc.paragraphs]).strip()

    if lower.endswith(".txt"):
        return file_bytes.decode("utf-8", errors="ignore").strip()

    raise ValueError("Unsupported file type. Please upload PDF, DOCX, or TXT.")


def upload_to_supabase_storage(filename: str, file_bytes: bytes, content_type: str) -> str:
    unique_name = f"{uuid.uuid4()}-{filename}"
    path = f"uploads/{unique_name}"

    try:
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            path=path,
            file=file_bytes,
            file_options={
                "content-type": content_type,
                "upsert": "false",
            },
        )
    except Exception:
        # If storage upload fails for client version mismatch, still keep DB workflow usable
        path = f"local-skip/{unique_name}"

    return path


def get_latest_default_cv_text(user_id: str) -> Optional[dict]:
    response = (
        supabase.table("candidate_documents")
        .select("*")
        .eq("user_id", user_id)
        .eq("document_kind", "cv")
        .eq("is_default", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if response.data:
        return response.data[0]
    return None


def extract_job_details_with_ai(jd_text: str):
    response = openai_client.responses.create(
        model="gpt-5.4-mini",
        input=[
            {
                "role": "system",
                "content": "You extract structured job information from job descriptions. Return only valid JSON.",
            },
            {
                "role": "user",
                "content": (
                    "Extract these fields from the job description:\n"
                    "company, title, location, salary, summary.\n"
                    "If missing, use null.\n"
                    "summary should be 1-2 sentences.\n\n"
                    f"Job Description:\n{jd_text}"
                ),
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "job_extract",
                "schema": {
                    "type": "object",
                    "properties": {
                        "company": {"type": ["string", "null"]},
                        "title": {"type": ["string", "null"]},
                        "location": {"type": ["string", "null"]},
                        "salary": {"type": ["string", "null"]},
                        "summary": {"type": ["string", "null"]},
                    },
                    "required": ["company", "title", "location", "salary", "summary"],
                    "additionalProperties": False,
                },
            }
        },
    )
    return response.output_text


def analyze_ats_with_ai(cv_text: str, jd_text: str):
    response = openai_client.responses.create(
        model="gpt-5.4-mini",
        input=[
            {
                "role": "system",
                "content": "You are an ATS resume analysis assistant. Return only valid JSON.",
            },
            {
                "role": "user",
                "content": (
                    "Compare the resume text against the job description.\n"
                    "Return:\n"
                    "- match_score (0 to 100)\n"
                    "- missing_keywords (array)\n"
                    "- strengths (array)\n"
                    "- improvements (array)\n"
                    "- summary (2-3 sentences)\n\n"
                    "Do not invent experience not present in the resume.\n\n"
                    f"Resume Text:\n{cv_text}\n\n"
                    f"Job Description:\n{jd_text}"
                ),
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "ats_analysis",
                "schema": {
                    "type": "object",
                    "properties": {
                        "match_score": {"type": "integer"},
                        "missing_keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "strengths": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "improvements": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "summary": {"type": "string"},
                    },
                    "required": [
                        "match_score",
                        "missing_keywords",
                        "strengths",
                        "improvements",
                        "summary",
                    ],
                    "additionalProperties": False,
                },
            }
        },
    )
    return response.output_text


def generate_application_docs_with_ai(cv_text: str, jd_text: str):
    response = openai_client.responses.create(
        model="gpt-5.4-mini",
        input=[
            {
                "role": "system",
                "content": (
                    "You are a professional ATS resume and cover letter writer. "
                    "Return only valid JSON. "
                    "Never fabricate experience, employers, dates, degrees, certifications, tools, or metrics. "
                    "You may improve wording, ordering, formatting, summaries, and keyword alignment only when supported by the candidate's actual background."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Using the candidate resume and job description, create:\n"
                    "1. a complete ATS-friendly tailored resume text\n"
                    "2. a tailored cover letter\n"
                    "3. a list of ATS keywords that were emphasized\n\n"
                    "Resume rewriting rules:\n"
                    "- Keep it truthful.\n"
                    "- Improve ATS alignment.\n"
                    "- Include relevant keywords only if supported by the existing resume.\n"
                    "- Return a complete rewritten resume, not bullet suggestions only.\n"
                    "- Use clear section headings.\n\n"
                    "Cover letter rules:\n"
                    "- Professional and concise.\n"
                    "- Tailored to the role.\n"
                    "- No fake claims.\n\n"
                    f"Resume Text:\n{cv_text}\n\n"
                    f"Job Description:\n{jd_text}"
                ),
            },
        ],
        text={
            "format": {
                "type": "json_schema",
                "name": "generated_application_docs",
                "schema": {
                    "type": "object",
                    "properties": {
                        "tailored_resume_text": {"type": "string"},
                        "cover_letter_text": {"type": "string"},
                        "ats_keywords": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                    },
                    "required": [
                        "tailored_resume_text",
                        "cover_letter_text",
                        "ats_keywords",
                    ],
                    "additionalProperties": False,
                },
            }
        },
    )
    return response.output_text


# ---------- CORE ROUTES ----------

@app.get("/")
def read_root():
    return {"message": "Backend is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/jobs")
def get_jobs(current_user=Depends(get_current_user)):
    try:
        response = (
            supabase.table("jobs")
            .select("*")
            .eq("user_id", current_user["id"])
            .order("created_at", desc=True)
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/jobs")
def create_job(job: JobCreate, current_user=Depends(get_current_user)):
    try:
        payload = {
            "user_id": current_user["id"],
            "company": job.company,
            "title": job.title,
            "job_link": job.job_link,
            "jd_text": job.jd_text,
            "status": job.status,
            "location": job.location,
            "salary": job.salary,
            "notes": job.notes,
            "date_applied": job.date_applied if job.date_applied else None,
            "interview_date": job.interview_date if job.interview_date else None,
        }

        response = supabase.table("jobs").insert(payload).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/jobs/{job_id}/status")
def update_job_status(job_id: str, payload: JobUpdateStatus, current_user=Depends(get_current_user)):
    try:
        response = (
            supabase.table("jobs")
            .update({"status": payload.status})
            .eq("id", job_id)
            .eq("user_id", current_user["id"])
            .execute()
        )
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str, current_user=Depends(get_current_user)):
    try:
        response = (
            supabase.table("jobs")
            .delete()
            .eq("id", job_id)
            .eq("user_id", current_user["id"])
            .execute()
        )
        return {"success": True, "deleted": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------- AI ROUTES ----------

@app.post("/api/extract-job-details")
def extract_job_details(payload: JDExtractRequest):
    try:
        raw_text = extract_job_details_with_ai(payload.jd_text)
        parsed = json.loads(raw_text)
        return parsed
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI extraction failed: {str(e)}")


@app.post("/api/analyze-ats")
def analyze_ats(payload: ATSAnalysisRequest):
    try:
        raw_text = analyze_ats_with_ai(payload.cv_text, payload.jd_text)
        parsed = json.loads(raw_text)
        return parsed
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ATS analysis failed: {str(e)}")


@app.post("/api/generate-application-docs")
def generate_application_docs(payload: GenerateDocsRequest, current_user=Depends(get_current_user)):
    try:
        cv_text = payload.cv_text

        if not cv_text:
            default_cv = get_latest_default_cv_text(current_user["id"])
            if not default_cv or not default_cv.get("parsed_text"):
                raise HTTPException(
                    status_code=400,
                    detail="No CV provided and no default CV found. Please upload a default CV or upload one for this application.",
                )
            cv_text = default_cv["parsed_text"]

        raw_text = generate_application_docs_with_ai(cv_text, payload.jd_text)
        parsed = json.loads(raw_text)

        saved = (
            supabase.table("generated_applications")
            .insert(
                {
                    "user_id": current_user["id"],
                    "job_id": payload.job_id,
                    "tailored_resume_text": parsed["tailored_resume_text"],
                    "cover_letter_text": parsed["cover_letter_text"],
                    "ats_keywords": parsed["ats_keywords"],
                }
            )
            .execute()
        )

        return {
            "tailored_resume_text": parsed["tailored_resume_text"],
            "cover_letter_text": parsed["cover_letter_text"],
            "ats_keywords": parsed["ats_keywords"],
            "saved_record": saved.data,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Document generation failed: {str(e)}")


# ---------- DOCUMENT ROUTES ----------

@app.get("/api/default-cv")
def get_default_cv(current_user=Depends(get_current_user)):
    try:
        doc = get_latest_default_cv_text(current_user["id"])
        return {"default_cv": doc}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload-default-cv")
async def upload_default_cv(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    try:
        file_bytes = await file.read()
        parsed_text = parse_uploaded_file(file.filename, file_bytes)

        storage_path = upload_to_supabase_storage(
            filename=file.filename,
            file_bytes=file_bytes,
            content_type=file.content_type or "application/octet-stream",
        )

        (
            supabase.table("candidate_documents")
            .update({"is_default": False})
            .eq("user_id", current_user["id"])
            .eq("document_kind", "cv")
            .eq("is_default", True)
            .execute()
        )

        inserted = (
            supabase.table("candidate_documents")
            .insert(
                {
                    "user_id": current_user["id"],
                    "document_kind": "cv",
                    "original_filename": file.filename,
                    "storage_path": storage_path,
                    "parsed_text": parsed_text,
                    "is_default": True,
                }
            )
            .execute()
        )

        return {
            "message": "Default CV uploaded successfully",
            "document": inserted.data,
            "parsed_text": parsed_text,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Default CV upload failed: {str(e)}")


@app.post("/api/parse-cv")
async def parse_cv(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        parsed_text = parse_uploaded_file(file.filename, file_bytes)
        return {
            "filename": file.filename,
            "parsed_text": parsed_text,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CV parsing failed: {str(e)}")