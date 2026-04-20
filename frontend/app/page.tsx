"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Job = {
  id: string;
  company: string;
  title: string;
  status: string;
  created_at: string;
  job_link?: string | null;
  location?: string | null;
  salary?: string | null;
  notes?: string | null;
  jd_text?: string | null;
};

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type DialogState = {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
  onConfirm?: (() => void) | null;
};

const STATUSES = [
  "Need to Apply",
  "Applied",
  "Got Response",
  "Interview Call",
  "Need Review",
  "Rejected",
  "Offer",
];

const NAV_ITEMS = [
  { id: "overview",       label: "Overview",      icon: "⚡" },
  { id: "cv-upload",      label: "Upload CV",      icon: "📄" },
  { id: "job-form",       label: "Add Job",        icon: "➕" },
  { id: "ats-analysis",   label: "ATS Analysis",   icon: "🎯" },
  { id: "generated-docs", label: "Generated Docs", icon: "✨" },
  { id: "jobs-list",      label: "My Jobs",        icon: "💼" },
];

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "Need to Apply":  return "border-amber-300  bg-amber-50  text-amber-700";
    case "Applied":        return "border-blue-300   bg-blue-50   text-blue-700";
    case "Got Response":   return "border-cyan-300   bg-cyan-50   text-cyan-700";
    case "Interview Call": return "border-violet-300 bg-violet-50 text-violet-700";
    case "Need Review":    return "border-orange-300 bg-orange-50 text-orange-700";
    case "Rejected":       return "border-red-300    bg-red-50    text-red-700";
    case "Offer":          return "border-emerald-300 bg-emerald-50 text-emerald-700";
    default:               return "border-slate-200  bg-slate-50  text-slate-700";
  }
}

function getStatusLeft(status: string) {
  switch (status) {
    case "Need to Apply":  return "border-l-4 border-l-amber-400";
    case "Applied":        return "border-l-4 border-l-blue-500";
    case "Got Response":   return "border-l-4 border-l-cyan-500";
    case "Interview Call": return "border-l-4 border-l-violet-500";
    case "Need Review":    return "border-l-4 border-l-orange-400";
    case "Rejected":       return "border-l-4 border-l-red-500";
    case "Offer":          return "border-l-4 border-l-emerald-500";
    default:               return "border-l-4 border-l-slate-300";
  }
}

function ATSScoreRing({ score }: { score: number }) {
  const size = 130, sw = 11, r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const off  = circ - (score / 100) * circ;
  const color = score >= 75 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const bg    = score >= 75 ? "#d1fae5" : score >= 50 ? "#fef3c7" : "#fee2e2";
  const label = score >= 75 ? "Strong Match" : score >= 50 ? "Decent Fit" : "Needs Work";
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={sw} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeDasharray={`${circ} ${circ}`} strokeDashoffset={off} strokeLinecap="round"
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{ transition: "stroke-dashoffset 1.2s ease-in-out" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-extrabold" style={{ color }}>{score}%</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">score</span>
        </div>
      </div>
      <span className="rounded-full px-4 py-1.5 text-xs font-bold" style={{ background: bg, color }}>{label}</span>
    </div>
  );
}

function StatCard({ label, value, accent, icon }: { label: string; value: number; accent: string; icon: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur transition hover:-translate-y-1 hover:shadow-md">
      <div className="absolute -right-2 -top-2 select-none text-5xl opacity-[0.09]">{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <h3 className={`mt-3 text-4xl font-extrabold ${accent}`}>{value}</h3>
    </div>
  );
}

function SectionCard({ id, title, description, children, bar = "from-blue-500 to-indigo-500" }: {
  id: string; title: string; description?: string; children: React.ReactNode; bar?: string;
}) {
  return (
    <section id={id} className="relative overflow-hidden rounded-3xl border border-white/70 bg-white/92 shadow-[0_4px_28px_rgba(15,23,42,0.07)] backdrop-blur">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${bar}`} />
      <div className="p-6 md:p-8">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>}
        </div>
        {children}
      </div>
    </section>
  );
}

function FilePicker({ label, fileName, onChange, accept }: {
  label: string; fileName: string; accept: string; onChange: (f: File | null) => void;
}) {
  return (
    <label className="group flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-4 transition hover:border-blue-400 hover:bg-blue-50/30">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm transition group-hover:bg-blue-50">📎</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{fileName || "PDF, DOCX, or TXT — click to browse"}</p>
      </div>
      <span className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm transition group-hover:bg-blue-600 group-hover:text-white">Browse</span>
      <input type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} className="hidden" />
    </label>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  if (!toast) return null;
  const s = { success: "from-emerald-600 to-teal-600", error: "from-red-600 to-rose-600", info: "from-slate-700 to-slate-900" }[toast.type];
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  return (
    <div className={`fixed right-5 top-5 z-50 flex items-center gap-3 rounded-2xl bg-gradient-to-r ${s} px-5 py-3 text-sm font-semibold text-white shadow-2xl`}>
      <span>{icons[toast.type]}</span>{toast.message}
    </div>
  );
}

const inputCls = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100";

export default function HomePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName]               = useState("");
  const [session, setSession]                 = useState<any>(null);
  const [authLoading, setAuthLoading]         = useState(true);
  const [isSignupMode, setIsSignupMode]       = useState(false);

  const [jobs, setJobs]       = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [company, setCompany]         = useState("");
  const [title, setTitle]             = useState("");
  const [status, setStatus]           = useState("Need to Apply");
  const [jobLink, setJobLink]         = useState("");
  const [location, setLocation]       = useState("");
  const [salary, setSalary]           = useState("");
  const [notes, setNotes]             = useState("");
  const [jdText, setJdText]           = useState("");
  const [dateApplied, setDateApplied]     = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [extracting, setExtracting]   = useState(false);

  // legacy cv states — kept for backward compat
  const [defaultCvFile, setDefaultCvFile]           = useState<File | null>(null);
  const [defaultCvText, setDefaultCvText]           = useState("");
  const [defaultCvName, setDefaultCvName]           = useState("");
  const [uploadingDefaultCv, setUploadingDefaultCv] = useState(false);
  const [overrideCvFile, setOverrideCvFile]         = useState<File | null>(null);
  const [overrideCvText, setOverrideCvText]         = useState("");
  const [parsingOverrideCv, setParsingOverrideCv]   = useState(false);

  // new unified cv states
  const [cvFile, setCvFile]             = useState<File | null>(null);
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [uploadingCv, setUploadingCv]   = useState(false);

  const [atsLoading, setAtsLoading] = useState(false);
  const [atsResult, setAtsResult]   = useState<{
    match_score: number; missing_keywords: string[]; improvements: string[];
  } | null>(null);

  const [generatingDocs, setGeneratingDocs]             = useState(false);
  const [generatedResume, setGeneratedResume]           = useState("");
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");

  const [searchTerm, setSearchTerm]     = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [toast, setToast]               = useState<ToastState>(null);
  const [dialog, setDialog]             = useState<DialogState>({
    open: false, title: "", message: "", confirmText: "OK",
    cancelText: "Cancel", tone: "default", onConfirm: null,
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function showToast(type: "success" | "error" | "info", message: string) {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 2800);
  }

  function openDialog({ title, message, confirmText = "OK", cancelText = "Cancel", tone = "default", onConfirm = null }: Omit<DialogState, "open">) {
    setDialog({ open: true, title, message, confirmText, cancelText, tone, onConfirm });
  }

  function closeDialog() {
    setDialog((p) => ({ ...p, open: false, onConfirm: null }));
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session ?? null); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) { fetchJobs(); fetchDefaultCv(); }
    else {
      setJobs([]); setDefaultCvText(""); setDefaultCvName(""); setOverrideCvText("");
      setGeneratedResume(""); setGeneratedCoverLetter(""); setAtsResult(null);
    }
  }, [session]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("No access token found");
    return { Authorization: `Bearer ${token}` };
  }

  async function signUp() {
    if (!fullName.trim()) { openDialog({ title: "Full name required", message: "Please enter your full name." }); return; }
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) { openDialog({ title: "Missing info", message: "Please fill all fields." }); return; }
    if (password !== confirmPassword) { openDialog({ title: "Password mismatch", message: "Passwords do not match." }); return; }
    if (password.length < 8) { openDialog({ title: "Weak password", message: "At least 8 characters required." }); return; }
    const { error } = await supabase.auth.signUp({ email: email.trim(), password: password.trim(), options: { data: { full_name: fullName.trim() } } });
    if (error) { openDialog({ title: "Signup failed", message: error.message }); return; }
    showToast("success", "Account created! Check your email.");
  }

  async function signIn() {
    if (!email.trim() || !password.trim()) { openDialog({ title: "Missing credentials", message: "Enter email and password." }); return; }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password.trim() });
    if (error) { openDialog({ title: "Sign in failed", message: error.message }); return; }
    showToast("success", "Signed in successfully.");
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) openDialog({ title: "Google sign-in failed", message: error.message });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setJobs([]); setDefaultCvText(""); setDefaultCvName(""); setOverrideCvText("");
    setGeneratedResume(""); setGeneratedCoverLetter(""); setAtsResult(null);
    showToast("info", "Logged out.");
  }

  async function fetchJobs() {
    try {
      setLoading(true);
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/jobs`, { cache: "no-store", headers });
      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }

  async function fetchDefaultCv() {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/default-cv`, { cache: "no-store", headers });
      const data = await res.json();
      if (data?.default_cv) { setDefaultCvText(data.default_cv.parsed_text || ""); setDefaultCvName(data.default_cv.original_filename || "Default CV"); }
      else { setDefaultCvText(""); setDefaultCvName(""); }
    } catch (e) { console.error(e); }
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/jobs`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ company, title, status, job_link: jobLink || null, location: location || null, salary: salary || null, notes: notes || null, jd_text: jdText || null, date_applied: dateApplied || null, interview_date: interviewDate || null }),
      });
      if (!res.ok) { const d = await res.json(); openDialog({ title: "Could not add job", message: d.detail || "Failed." }); return; }
      setCompany(""); setTitle(""); setStatus("Need to Apply"); setJobLink(""); setLocation(""); setSalary(""); setNotes(""); setJdText(""); setDateApplied(""); setInterviewDate("");
      await fetchJobs(); showToast("success", "Job added successfully.");
    } catch (e) { console.error(e); openDialog({ title: "Request failed", message: "Could not add the job." }); }
  }

  async function updateStatus(jobId: string, newStatus: string) {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/jobs/${jobId}/status`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      if (!res.ok) { const d = await res.json(); openDialog({ title: "Update failed", message: d.detail || "Failed." }); return; }
      await fetchJobs(); showToast("success", "Status updated.");
    } catch (e) { console.error(e); openDialog({ title: "Request failed", message: "Could not update status." }); }
  }

  async function confirmDeleteJob(jobId: string) {
    openDialog({
      title: "Delete this job?", message: "This will permanently remove the job.",
      confirmText: "Delete", cancelText: "Cancel", tone: "danger",
      onConfirm: async () => {
        closeDialog();
        try {
          const headers = await authHeaders();
          const res = await fetch(`${apiBase}/api/jobs/${jobId}`, { method: "DELETE", headers });
          if (!res.ok) { const d = await res.json(); openDialog({ title: "Delete failed", message: d.detail || "Failed." }); return; }
          await fetchJobs(); showToast("success", "Job deleted.");
        } catch (e) { console.error(e); openDialog({ title: "Request failed", message: "Could not delete." }); }
      },
    });
  }

  async function autoFillFromJD() {
    if (!jdText.trim()) { openDialog({ title: "JD needed", message: "Paste a job description first." }); return; }
    try {
      setExtracting(true);
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/extract-job-details`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ jd_text: jdText }) });
      const data = await res.json();
      if (!res.ok) { openDialog({ title: "Extraction failed", message: data.detail || "Failed." }); return; }
      if (data.company)  setCompany(data.company);
      if (data.title)    setTitle(data.title);
      if (data.location) setLocation(data.location);
      if (data.salary)   setSalary(data.salary);
      if (data.summary)  setNotes((p) => (p.trim() ? p : data.summary));
      showToast("success", "Job details extracted.");
    } catch (e) { console.error(e); openDialog({ title: "Extraction failed", message: "Could not extract details." }); }
    finally { setExtracting(false); }
  }

  // legacy functions kept unchanged
  async function uploadDefaultCv() {
    if (!defaultCvFile) { openDialog({ title: "No file", message: "Choose a file first." }); return; }
    try {
      setUploadingDefaultCv(true);
      const headers = await authHeaders();
      const fd = new FormData(); fd.append("file", defaultCvFile);
      const res = await fetch(`${apiBase}/api/upload-default-cv`, { method: "POST", headers, body: fd });
      let data: any = null; try { data = await res.json(); } catch { data = null; }
      if (!res.ok) { openDialog({ title: "Upload failed", message: data?.detail || "Failed." }); return; }
      setDefaultCvText(data.parsed_text || ""); setDefaultCvName(data.document?.[0]?.original_filename || defaultCvFile.name);
      setDefaultCvFile(null); showToast("success", "Default CV saved.");
    } catch (e: any) { openDialog({ title: "Upload failed", message: e?.message || "Unknown error" }); }
    finally { setUploadingDefaultCv(false); }
  }

  async function parseOverrideCv() {
    if (!overrideCvFile) { openDialog({ title: "No file", message: "Choose a file first." }); return; }
    try {
      setParsingOverrideCv(true);
      const headers = await authHeaders();
      const fd = new FormData(); fd.append("file", overrideCvFile);
      const res = await fetch(`${apiBase}/api/parse-cv`, { method: "POST", headers, body: fd });
      let data: any = null; try { data = await res.json(); } catch { data = null; }
      if (!res.ok) { openDialog({ title: "Parse failed", message: data?.detail || "Failed." }); return; }
      setOverrideCvText(data.parsed_text || ""); showToast("success", "CV loaded for this session.");
    } catch (e: any) { openDialog({ title: "Parse failed", message: e?.message || "Unknown error" }); }
    finally { setParsingOverrideCv(false); }
  }

  // new unified cv handler
  async function handleCvUpload() {
    if (!cvFile) { openDialog({ title: "No file chosen", message: "Please select a CV file first." }); return; }
    try {
      setUploadingCv(true);
      const headers = await authHeaders();
      const fd = new FormData(); fd.append("file", cvFile);
      if (setAsDefault) {
        const res = await fetch(`${apiBase}/api/upload-default-cv`, { method: "POST", headers, body: fd });
        let data: any = null; try { data = await res.json(); } catch { data = null; }
        if (!res.ok) { openDialog({ title: "Upload failed", message: data?.detail || "Failed." }); return; }
        setDefaultCvText(data.parsed_text || ""); setDefaultCvName(data.document?.[0]?.original_filename || cvFile.name);
        setOverrideCvText(""); showToast("success", "CV uploaded and set as default.");
      } else {
        const res = await fetch(`${apiBase}/api/parse-cv`, { method: "POST", headers, body: fd });
        let data: any = null; try { data = await res.json(); } catch { data = null; }
        if (!res.ok) { openDialog({ title: "Parse failed", message: data?.detail || "Failed." }); return; }
        setOverrideCvText(data.parsed_text || ""); showToast("success", "CV loaded for this session.");
      }
      setCvFile(null);
    } catch (e: any) { openDialog({ title: "Upload failed", message: e?.message || "Unknown error" }); }
    finally { setUploadingCv(false); }
  }

  const activeCvText = overrideCvText.trim() ? overrideCvText : defaultCvText;

  async function analyzeATS() {
    if (!activeCvText.trim() || !jdText.trim()) { openDialog({ title: "Missing content", message: "Upload a CV and paste a job description first." }); return; }
    try {
      setAtsLoading(true); setAtsResult(null);
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/analyze-ats`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ cv_text: activeCvText, jd_text: jdText }) });
      const data = await res.json();
      if (!res.ok) { openDialog({ title: "ATS failed", message: data.detail || "Failed." }); return; }
      setAtsResult({ match_score: data.match_score, missing_keywords: (data.missing_keywords || []).slice(0, 5), improvements: data.improvements || [] });
      showToast("success", "ATS analysis complete."); scrollToSection("ats-analysis");
    } catch (e) { console.error(e); openDialog({ title: "ATS failed", message: "Could not analyze." }); }
    finally { setAtsLoading(false); }
  }

  async function generateApplicationDocs() {
    if (!jdText.trim()) { openDialog({ title: "JD needed", message: "Paste a job description first." }); return; }
    try {
      setGeneratingDocs(true); setGeneratedResume(""); setGeneratedCoverLetter("");
      const headers = await authHeaders();
      const res = await fetch(`${apiBase}/api/generate-application-docs`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ jd_text: jdText, cv_text: activeCvText || null }) });
      const data = await res.json();
      if (!res.ok) { openDialog({ title: "Generation failed", message: data.detail || "Failed." }); return; }
      setGeneratedResume(data.tailored_resume_text || ""); setGeneratedCoverLetter(data.cover_letter_text || "");
      showToast("success", "Resume and cover letter generated."); scrollToSection("generated-docs");
    } catch (e) { console.error(e); openDialog({ title: "Generation failed", message: "Could not generate documents." }); }
    finally { setGeneratingDocs(false); }
  }

  const counts = useMemo(() => ({
    total: jobs.length,
    needToApply: jobs.filter((j) => j.status === "Need to Apply").length,
    applied: jobs.filter((j) => j.status === "Applied").length,
    interview: jobs.filter((j) => j.status === "Interview Call").length,
    offers: jobs.filter((j) => j.status === "Offer").length,
  }), [jobs]);

  const filteredJobs = useMemo(() => jobs.filter((job) => {
    const match = job.title.toLowerCase().includes(searchTerm.toLowerCase()) || job.company.toLowerCase().includes(searchTerm.toLowerCase());
    return match && (filterStatus === "All" || job.status === filterStatus);
  }), [jobs, searchTerm, filterStatus]);

  /* ══ AUTH LOADING ══ */
  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-blue-400" />
          </div>
          <p className="text-sm font-medium tracking-wide text-white/40">Loading workspace…</p>
        </div>
      </main>
    );
  }

  /* ══ LOGIN ══ */
  if (!session) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-[#0c1a3a] to-indigo-950 p-6">
        <div className="animate-blob pointer-events-none absolute -left-56 -top-56 h-[520px] w-[520px] rounded-full bg-blue-700/18 blur-[90px]" />
        <div className="animate-blob animation-delay-2000 pointer-events-none absolute -right-56 top-10 h-[520px] w-[520px] rounded-full bg-indigo-600/18 blur-[90px]" />
        <div className="animate-blob animation-delay-4000 pointer-events-none absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/12 blur-[80px]" />
        <Toast toast={toast} />
        {dialog.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-900">{dialog.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{dialog.message}</p>
              <div className="mt-6 flex justify-end">
                <button type="button" onClick={closeDialog} className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800">{dialog.confirmText || "OK"}</button>
              </div>
            </div>
          </div>
        )}
        <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/8 shadow-[0_32px_80px_rgba(0,0,0,0.55)] md:grid-cols-2">
          <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#0f1f4a] via-blue-900 to-indigo-900 p-10 text-white md:flex">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.12),transparent_60%)]" />
            <div className="relative">
              <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-2">
                <span className="text-lg">🚀</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-sky-300">AI Job Tracker</span>
              </div>
              <h1 className="mt-2 text-4xl font-extrabold leading-tight">
                Land your dream job<br />
                <span className="bg-gradient-to-r from-sky-300 to-blue-300 bg-clip-text text-transparent">smarter & faster.</span>
              </h1>
              <p className="mt-5 text-sm leading-7 text-slate-300/80">Upload your CV once, analyze ATS compatibility, and generate tailored resumes and cover letters in seconds.</p>
            </div>
            <div className="relative grid gap-3">
              {[{ icon: "📊", text: "Track applications through every hiring stage" }, { icon: "🎯", text: "Instant ATS match score and keyword gaps" }, { icon: "✨", text: "AI-generated tailored resumes and cover letters" }].map((i) => (
                <div key={i.text} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10">
                  <span className="mt-0.5 text-lg">{i.icon}</span>
                  <p className="text-sm font-medium text-slate-200">{i.text}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-8 md:p-12">
            <div className="mx-auto max-w-sm">
              <div className="mb-8">
                <h2 className="text-2xl font-extrabold text-slate-900">{isSignupMode ? "Create account" : "Welcome back 👋"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{isSignupMode ? "Join to manage applications with AI." : "Sign in to your job tracking dashboard."}</p>
              </div>
              <div className="grid gap-3.5">
                {isSignupMode && <input type="text" placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />}
                <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                {isSignupMode && <input type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />}
                <button type="button" onClick={isSignupMode ? signUp : signIn} className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-4 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:-translate-y-0.5 hover:shadow-xl">{isSignupMode ? "Create Account" : "Sign In"}</button>
                <div className="flex items-center gap-3"><div className="h-px flex-1 bg-slate-100" /><span className="text-xs text-slate-400">or</span><div className="h-px flex-1 bg-slate-100" /></div>
                <button type="button" onClick={signInWithGoogle} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-md">🌐 Continue with Google</button>
                <button type="button" onClick={() => setIsSignupMode((p) => !p)} className="text-sm font-medium text-blue-600 transition hover:text-blue-800">
                  {isSignupMode ? "Already have an account? Sign in →" : "No account? Create one →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ══ DASHBOARD ══ */
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.07),transparent_55%),radial-gradient(ellipse_at_bottom-right,rgba(168,85,247,0.06),transparent_50%),linear-gradient(180deg,#eef2ff_0%,#f0f4ff_100%)]">
      <Toast toast={toast} />

      {dialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{dialog.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{dialog.message}</p>
              </div>
              <button type="button" onClick={closeDialog} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700">✕</button>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              {dialog.onConfirm && <button type="button" onClick={closeDialog} className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">{dialog.cancelText || "Cancel"}</button>}
              <button type="button" onClick={dialog.onConfirm || closeDialog} className={`rounded-2xl px-5 py-2.5 text-sm font-bold text-white transition hover:shadow-lg ${dialog.tone === "danger" ? "bg-gradient-to-r from-red-600 to-rose-600" : "bg-gradient-to-r from-slate-800 to-slate-900"}`}>{dialog.confirmText || "OK"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[256px_1fr]">

        {/* ── Sidebar ── */}
        <aside className="hidden border-r border-white/60 bg-white/82 shadow-[4px_0_20px_rgba(15,23,42,0.05)] backdrop-blur lg:flex lg:flex-col">
          <div className="m-4 rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-5 text-white shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 text-xl">🚀</div>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-sky-300/80">Workspace</p>
                <p className="text-base font-extrabold leading-tight">AI Job Tracker</p>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-white/8 px-3 py-2">
              <p className="truncate text-xs font-medium text-slate-300">{session.user.user_metadata?.full_name || session.user.email}</p>
            </div>
          </div>
          <nav className="flex-1 px-3 py-2">
            <p className="mb-1.5 px-2 text-[9px] font-bold uppercase tracking-[0.24em] text-slate-400">Navigate</p>
            <div className="grid gap-0.5">
              {NAV_ITEMS.map((item) => (
                <button key={item.id} type="button" onClick={() => scrollToSection(item.id)} className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                  <span className="text-base transition group-hover:scale-110">{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </nav>
          <div className="mx-4 mb-3 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Active CV</p>
            <p className="mt-1 truncate text-xs font-semibold text-blue-900">{overrideCvText ? "Session CV (override)" : defaultCvName || "None uploaded"}</p>
            <p className="mt-1 text-[10px] text-blue-600/70">💡 Upload CV → paste JD → Generate</p>
          </div>
          <div className="px-4 pb-5">
            <button type="button" onClick={signOut} className="w-full rounded-2xl border border-red-100 bg-red-50 py-3 text-sm font-bold text-red-600 transition hover:bg-red-600 hover:text-white">🚪 Sign Out</button>
          </div>
        </aside>

        {/* ── Mobile nav ── */}
        <div className="sticky top-0 z-30 border-b border-white/60 bg-white/88 px-4 py-3.5 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-sm text-white">🚀</div>
              <p className="text-sm font-bold text-slate-900">{session.user.user_metadata?.full_name || "Dashboard"}</p>
            </div>
            <button type="button" onClick={() => setMobileNavOpen((p) => !p)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">{mobileNavOpen ? "✕" : "☰ Menu"}</button>
          </div>
          {mobileNavOpen && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {NAV_ITEMS.map((item) => (
                <button key={item.id} type="button" onClick={() => scrollToSection(item.id)} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:text-blue-700">
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
              <button type="button" onClick={signOut} className="col-span-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-500 py-2.5 text-sm font-bold text-white">🚪 Sign Out</button>
            </div>
          )}
        </div>

        {/* ══ Main Content ══ */}
        <section className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">

            {/* Overview Hero */}
            <section id="overview" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6 text-white shadow-[0_16px_56px_rgba(15,23,42,0.22)] md:p-10">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-500/12 blur-[56px]" />
              <div className="pointer-events-none absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-indigo-500/12 blur-[56px]" />
              <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5">
                    <span>⚡</span><span className="text-[10px] font-bold uppercase tracking-[0.26em] text-sky-300">Hiring Workspace</span>
                  </div>
                  <h2 className="text-3xl font-extrabold leading-tight md:text-4xl">
                    Track, analyze & land<br />
                    <span className="bg-gradient-to-r from-sky-300 to-blue-300 bg-clip-text text-transparent">your next role.</span>
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-7 text-slate-300/80">One intelligent workspace — manage job applications, check ATS fit, and generate tailored documents powered by AI.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 xl:w-[320px]">
                  {[
                    { label: "Default CV",    value: defaultCvName || "Not uploaded" },
                    { label: "Active Source", value: overrideCvText ? "Session CV" : defaultCvText ? "Default CV" : "None" },
                    { label: "Total Jobs",    value: String(counts.total) },
                    { label: "Offers",        value: String(counts.offers) },
                  ].map((c) => (
                    <div key={c.label} className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-sky-300/70">{c.label}</p>
                      <p className="mt-1.5 truncate text-sm font-bold text-white">{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Stats */}
            <section className="grid gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <StatCard label="Total"     value={counts.total}       accent="text-slate-900"   icon="💼" />
              <StatCard label="To Apply"  value={counts.needToApply} accent="text-amber-600"   icon="📋" />
              <StatCard label="Applied"   value={counts.applied}     accent="text-blue-600"    icon="📨" />
              <StatCard label="Interview" value={counts.interview}   accent="text-violet-600"  icon="🎤" />
              <StatCard label="Offers"    value={counts.offers}      accent="text-emerald-600" icon="🏆" />
            </section>

            {/* ── CV Upload (unified, centered) ── */}
            <div className="mx-auto max-w-xl">
              <SectionCard id="cv-upload" title="📄 Upload Your CV" description="Upload your CV to enable ATS analysis and AI document generation." bar="from-blue-500 to-sky-500">
                <div className="grid gap-4">
                  <FilePicker label="Select CV file" fileName={cvFile?.name || ""} accept=".pdf,.docx,.txt" onChange={setCvFile} />

                  {/* Default checkbox */}
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 transition hover:border-blue-300 hover:bg-blue-50/40">
                    <div className="relative flex-shrink-0">
                      <input type="checkbox" checked={setAsDefault} onChange={(e) => setSetAsDefault(e.target.checked)} className="peer sr-only" />
                      <div className="flex h-5 w-5 items-center justify-center rounded-md border-2 border-slate-300 bg-white transition peer-checked:border-blue-600 peer-checked:bg-blue-600">
                        <svg className="hidden h-3 w-3 text-white peer-checked:block" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Save as my default CV</p>
                      <p className="text-xs text-slate-500">{setAsDefault ? "This CV will be remembered and reused across sessions." : "CV will be used only for this session — not saved permanently."}</p>
                    </div>
                  </label>

                  <button type="button" onClick={handleCvUpload} disabled={uploadingCv}
                    className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                    {uploadingCv ? "⏳ Uploading…" : setAsDefault ? "☁️ Upload & Save as Default" : "📂 Load for This Session"}
                  </button>

                  {(defaultCvName || overrideCvText) && (
                    <div className="grid grid-cols-2 gap-3">
                      {defaultCvName && (
                        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5">
                          <span>✅</span>
                          <div><p className="text-[10px] font-bold text-emerald-700">Default CV</p><p className="truncate text-xs text-emerald-600">{defaultCvName}</p></div>
                        </div>
                      )}
                      {overrideCvText && (
                        <div className="flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2.5">
                          <span>🔄</span>
                          <div><p className="text-[10px] font-bold text-violet-700">Session CV</p><p className="text-xs text-violet-600">Active override</p></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* ── Add Job (centered) ── */}
            <div className="mx-auto max-w-2xl">
              <SectionCard id="job-form" title="➕ Add New Job" description="Paste the job description to unlock Auto-Fill, ATS Analysis, and Resume Generation." bar="from-amber-400 to-orange-500">
                <form onSubmit={addJob} className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Company *</label>
                    <input type="text" placeholder="e.g. Google" value={company} onChange={(e) => setCompany(e.target.value)} className={inputCls} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Title *</label>
                    <input type="text" placeholder="e.g. Software Engineer" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} required />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Link</label>
                    <input type="url" placeholder="https://..." value={jobLink} onChange={(e) => setJobLink(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Location</label>
                    <input type="text" placeholder="e.g. Remote / New York" value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Salary</label>
                    <input type="text" placeholder="e.g. $80,000" value={salary} onChange={(e) => setSalary(e.target.value)} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {/* Date fields with labels */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date Applied</label>
                    <input type="date" value={dateApplied} onChange={(e) => setDateApplied(e.target.value)} className={inputCls} />
                    <p className="text-[10px] text-slate-400">When you submitted the application</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Interview Date & Time</label>
                    <input type="datetime-local" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className={inputCls} />
                    <p className="text-[10px] text-slate-400">Scheduled interview date and time</p>
                  </div>
                  {/* Job description */}
                  <div className="col-span-2 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Job Description</label>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">Paste JD to unlock AI</span>
                    </div>
                    <textarea placeholder="Paste the full job description here to unlock AI features…" value={jdText} onChange={(e) => setJdText(e.target.value)} className={`${inputCls} min-h-40 resize-y`} />
                  </div>
                  {/* AI buttons */}
                  <div className="col-span-2 grid gap-3 sm:grid-cols-3">
                    <button type="button" onClick={autoFillFromJD} disabled={extracting}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                      {extracting ? "⏳ Extracting…" : "🪄 Auto Fill from JD"}
                    </button>
                    <button type="button" onClick={analyzeATS} disabled={atsLoading}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                      {atsLoading ? "⏳ Analyzing…" : "🎯 Analyze ATS Match"}
                    </button>
                    <button type="button" onClick={generateApplicationDocs} disabled={generatingDocs}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60">
                      {generatingDocs ? "⏳ Generating…" : "✨ Generate Resume + Cover Letter"}
                    </button>
                  </div>
                  <button type="submit" className="col-span-2 flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:shadow-xl">
                    ➕ Save to My Jobs
                  </button>
                </form>
              </SectionCard>
            </div>

            {/* ── ATS Analysis — only missing keywords + improvements ── */}
            {atsResult && (
              <SectionCard id="ats-analysis" title="🎯 ATS Analysis" description="Critical keyword gaps and actionable improvements based on the job description." bar="from-emerald-500 to-teal-500">
                <div className="grid gap-5 md:grid-cols-[180px_1fr]">
                  <div className="flex flex-col items-center rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-6">
                    <p className="mb-4 text-[10px] font-bold uppercase tracking-widest text-emerald-700">Match Score</p>
                    <ATSScoreRing score={atsResult.match_score} />
                  </div>
                  <div className="grid gap-4">
                    {/* Missing keywords — max 5, no strengths, no summary */}
                    <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50/80 to-rose-50/60 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <span>⚠️</span>
                        <h3 className="font-bold text-slate-900">Missing Keywords</h3>
                        <span className="ml-auto rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">{atsResult.missing_keywords.length} critical</span>
                      </div>
                      {atsResult.missing_keywords.length ? (
                        <div className="flex flex-wrap gap-2">
                          {atsResult.missing_keywords.map((kw, i) => (
                            <span key={i} className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm">{kw}</span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">No critical keywords missing. Great fit! 🎉</p>
                      )}
                    </div>
                    {/* Improvements */}
                    <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-indigo-50/60 p-5">
                      <div className="mb-3 flex items-center gap-2">
                        <span>💡</span>
                        <h3 className="font-bold text-slate-900">Actionable Improvements</h3>
                      </div>
                      {atsResult.improvements.length ? (
                        <ul className="grid gap-2.5">
                          {atsResult.improvements.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">{i + 1}</span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-slate-500">No improvements suggested.</p>
                      )}
                    </div>
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ── Generated Docs — CV + Cover Letter only ── */}
            {(generatedResume || generatedCoverLetter) && (
              <SectionCard id="generated-docs" title="✨ Generated Application Documents" description="AI-tailored resume and cover letter — fully editable before you send." bar="from-violet-500 to-purple-600">
                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="flex flex-col rounded-2xl border border-violet-100 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-violet-100 px-5 py-3.5">
                      <div className="flex items-center gap-2"><span className="text-lg">📝</span><h3 className="font-bold text-slate-900">Tailored Resume</h3></div>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Editable</span>
                    </div>
                    <textarea value={generatedResume} onChange={(e) => setGeneratedResume(e.target.value)} className="min-h-[560px] flex-1 resize-none rounded-b-2xl bg-slate-50/50 p-5 text-sm leading-6 text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-violet-200" />
                  </div>
                  <div className="flex flex-col rounded-2xl border border-violet-100 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-violet-100 px-5 py-3.5">
                      <div className="flex items-center gap-2"><span className="text-lg">✉️</span><h3 className="font-bold text-slate-900">Cover Letter</h3></div>
                      <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Editable</span>
                    </div>
                    <textarea value={generatedCoverLetter} onChange={(e) => setGeneratedCoverLetter(e.target.value)} className="min-h-[560px] flex-1 resize-none rounded-b-2xl bg-slate-50/50 p-5 text-sm leading-6 text-slate-800 outline-none transition focus:bg-white focus:ring-2 focus:ring-violet-200" />
                  </div>
                </div>
              </SectionCard>
            )}

            {/* ── My Jobs ── */}
            <SectionCard id="jobs-list" title="💼 My Jobs" description="Search, filter, and manage all your saved applications." bar="from-slate-500 to-slate-700">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                  💼 {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""}
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:w-[480px]">
                  <input type="text" placeholder="🔍  Search company or title…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={`${inputCls} flex-1`} />
                  <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={`${inputCls} sm:w-40`}>
                    <option>All</option>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="grid gap-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</div>
              ) : filteredJobs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl bg-slate-50 py-14 text-center">
                  <span className="text-4xl">🔍</span>
                  <p className="font-bold text-slate-700">No matching jobs found</p>
                  <p className="text-sm text-slate-400">Try adjusting your search or filter.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {filteredJobs.map((job) => (
                    <div key={job.id} className={`rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${getStatusLeft(job.status)}`}>
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{job.title}</h3>
                            <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${getStatusBadgeClass(job.status)}`}>{job.status}</span>
                          </div>
                          <p className="mt-0.5 text-sm font-medium text-slate-600">{job.company}</p>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                            {job.location && <span className="text-xs text-slate-400">📍 {job.location}</span>}
                            {job.salary   && <span className="text-xs text-slate-400">💰 {job.salary}</span>}
                            {job.job_link && <a href={job.job_link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:text-blue-800">🔗 View Posting</a>}
                          </div>
                          {job.notes && <div className="mt-3 rounded-xl bg-slate-50 px-4 py-2.5 text-xs leading-5 text-slate-600"><span className="font-bold text-slate-800">Notes:</span> {job.notes}</div>}
                          {job.jd_text && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-800">📄 View Job Description</summary>
                              <p className="mt-2 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-6 whitespace-pre-wrap text-slate-600">{job.jd_text}</p>
                            </details>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <select value={job.status} onChange={(e) => updateStatus(job.id, e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                          <button onClick={() => confirmDeleteJob(job.id)} className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-500 transition hover:bg-red-600 hover:text-white">🗑️</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

          </div>
        </section>
      </div>
    </main>
  );
}
