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
  date_applied?: string | null;
  interview_date?: string | null;
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

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "Need to Apply":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Applied":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "Got Response":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "Interview Call":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "Need Review":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "Rejected":
      return "bg-red-50 text-red-700 border-red-200";
    case "Offer":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function HomePage() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSignupMode, setIsSignupMode] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("Need to Apply");
  const [jobLink, setJobLink] = useState("");
  const [location, setLocation] = useState("");
  const [salary, setSalary] = useState("");
  const [notes, setNotes] = useState("");
  const [jdText, setJdText] = useState("");
  const [dateApplied, setDateApplied] = useState("");
  const [interviewDate, setInterviewDate] = useState("");

  const [extracting, setExtracting] = useState(false);

  const [defaultCvFile, setDefaultCvFile] = useState<File | null>(null);
  const [defaultCvText, setDefaultCvText] = useState("");
  const [defaultCvName, setDefaultCvName] = useState("");
  const [uploadingDefaultCv, setUploadingDefaultCv] = useState(false);

  const [overrideCvFile, setOverrideCvFile] = useState<File | null>(null);
  const [overrideCvText, setOverrideCvText] = useState("");
  const [parsingOverrideCv, setParsingOverrideCv] = useState(false);

  const [atsLoading, setAtsLoading] = useState(false);
  const [atsResult, setAtsResult] = useState<{
    match_score: number;
    missing_keywords: string[];
    strengths: string[];
    improvements: string[];
    summary: string;
  } | null>(null);

  const [generatingDocs, setGeneratingDocs] = useState(false);
  const [generatedResume, setGeneratedResume] = useState("");
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");
  const [generatedKeywords, setGeneratedKeywords] = useState<string[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchJobs();
      fetchDefaultCv();
    } else {
      setJobs([]);
      setDefaultCvText("");
      setDefaultCvName("");
      setOverrideCvText("");
      setGeneratedResume("");
      setGeneratedCoverLetter("");
      setGeneratedKeywords([]);
      setAtsResult(null);
    }
  }, [session]);

  async function authHeaders() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;

    if (!token) {
      throw new Error("No access token found");
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }

  async function signUp() {
    if (!fullName.trim()) {
      alert("Please enter your full name.");
      return;
    }

    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      alert("Please fill in all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      alert("Password and confirm password do not match.");
      return;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
      options: {
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (error) {
      alert(error.message);
      return;
    }

    showToast("Signup successful. Check your email if confirmation is enabled.");
  }

  async function signIn() {
    if (!email.trim() || !password.trim()) {
      alert("Please enter both email and password.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    });

    if (error) {
      alert(error.message);
      return;
    }

    showToast("Signed in successfully.");
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      alert(error.message);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setJobs([]);
    setDefaultCvText("");
    setDefaultCvName("");
    setOverrideCvText("");
    setGeneratedResume("");
    setGeneratedCoverLetter("");
    setGeneratedKeywords([]);
    setAtsResult(null);
    showToast("Logged out.");
  }

  async function fetchJobs() {
    try {
      setLoading(true);
      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/jobs`, {
        cache: "no-store",
        headers,
      });

      const data = await res.json();
      setJobs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchDefaultCv() {
    try {
      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/default-cv`, {
        cache: "no-store",
        headers,
      });

      const data = await res.json();

      if (data?.default_cv) {
        setDefaultCvText(data.default_cv.parsed_text || "");
        setDefaultCvName(data.default_cv.original_filename || "Default CV");
      } else {
        setDefaultCvText("");
        setDefaultCvName("");
      }
    } catch (error) {
      console.error("Failed to fetch default CV:", error);
    }
  }

  async function addJob(e: React.FormEvent) {
    e.preventDefault();

    try {
      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/jobs`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company,
          title,
          status,
          job_link: jobLink || null,
          location: location || null,
          salary: salary || null,
          notes: notes || null,
          jd_text: jdText || null,
          date_applied: dateApplied || null,
          interview_date: interviewDate || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || "Failed to add job");
        return;
      }

      setCompany("");
      setTitle("");
      setStatus("Need to Apply");
      setJobLink("");
      setLocation("");
      setSalary("");
      setNotes("");
      setJdText("");
      setDateApplied("");
      setInterviewDate("");
      await fetchJobs();
      showToast("Job added successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to add job");
    }
  }

  async function updateStatus(jobId: string, newStatus: string) {
    try {
      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/jobs/${jobId}/status`, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || "Failed to update status");
        return;
      }

      await fetchJobs();
      showToast("Job status updated.");
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
    }
  }

  async function deleteJob(jobId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this job?");
    if (!confirmed) return;

    try {
      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/jobs/${jobId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.detail || "Failed to delete job");
        return;
      }

      await fetchJobs();
      showToast("Job deleted.");
    } catch (error) {
      console.error(error);
      alert("Failed to delete job");
    }
  }

  async function autoFillFromJD() {
    if (!jdText.trim()) {
      alert("Please paste a job description first.");
      return;
    }

    try {
      setExtracting(true);
      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/extract-job-details`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jd_text: jdText }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Failed to extract job details");
        return;
      }

      if (data.company) setCompany(data.company);
      if (data.title) setTitle(data.title);
      if (data.location) setLocation(data.location);
      if (data.salary) setSalary(data.salary);

      if (data.summary) {
        setNotes((prev) => (prev.trim() ? prev : data.summary));
      }

      showToast("Job details extracted.");
    } catch (error) {
      console.error(error);
      alert("AI extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  async function uploadDefaultCv() {
    if (!defaultCvFile) {
      alert("Please choose a default CV file first.");
      return;
    }

    try {
      setUploadingDefaultCv(true);
      const headers = await authHeaders();

      const formData = new FormData();
      formData.append("file", defaultCvFile);

      const res = await fetch(`${apiBase}/api/upload-default-cv`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Failed to upload default CV");
        return;
      }

      setDefaultCvText(data.parsed_text || "");
      setDefaultCvName(data.document?.[0]?.original_filename || defaultCvFile.name);
      showToast("Default CV uploaded and saved.");
    } catch (error) {
      console.error(error);
      alert("Failed to upload default CV");
    } finally {
      setUploadingDefaultCv(false);
    }
  }

  async function parseOverrideCv() {
    if (!overrideCvFile) {
      alert("Please choose a CV file first.");
      return;
    }

    try {
      setParsingOverrideCv(true);
      const headers = await authHeaders();

      const formData = new FormData();
      formData.append("file", overrideCvFile);

      const res = await fetch(`${apiBase}/api/parse-cv`, {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Failed to parse uploaded CV");
        return;
      }

      setOverrideCvText(data.parsed_text || "");
      showToast("Temporary CV parsed successfully.");
    } catch (error) {
      console.error(error);
      alert("Failed to parse temporary CV");
    } finally {
      setParsingOverrideCv(false);
    }
  }

  const activeCvText = overrideCvText.trim() ? overrideCvText : defaultCvText;

  async function analyzeATS() {
    if (!activeCvText.trim() || !jdText.trim()) {
      alert("Please provide a CV (default or uploaded) and Job Description.");
      return;
    }

    try {
      setAtsLoading(true);
      setAtsResult(null);

      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/analyze-ats`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cv_text: activeCvText,
          jd_text: jdText,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "ATS analysis failed");
        return;
      }

      setAtsResult(data);
      showToast("ATS analysis completed.");
    } catch (error) {
      console.error(error);
      alert("Failed to analyze ATS match");
    } finally {
      setAtsLoading(false);
    }
  }

  async function generateApplicationDocs() {
    if (!jdText.trim()) {
      alert("Please paste a job description first.");
      return;
    }

    try {
      setGeneratingDocs(true);
      setGeneratedResume("");
      setGeneratedCoverLetter("");
      setGeneratedKeywords([]);

      const headers = await authHeaders();

      const res = await fetch(`${apiBase}/api/generate-application-docs`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jd_text: jdText,
          cv_text: activeCvText || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "Failed to generate application documents");
        return;
      }

      setGeneratedResume(data.tailored_resume_text || "");
      setGeneratedCoverLetter(data.cover_letter_text || "");
      setGeneratedKeywords(data.ats_keywords || []);
      showToast("Resume and cover letter generated.");
    } catch (error) {
      console.error(error);
      alert("Failed to generate application documents");
    } finally {
      setGeneratingDocs(false);
    }
  }

  const counts = useMemo(() => {
    return {
      total: jobs.length,
      needToApply: jobs.filter((j) => j.status === "Need to Apply").length,
      applied: jobs.filter((j) => j.status === "Applied").length,
      interview: jobs.filter((j) => j.status === "Interview Call").length,
      offers: jobs.filter((j) => j.status === "Offer").length,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchesSearch =
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        filterStatus === "All" ? true : job.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [jobs, searchTerm, filterStatus]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-slate-100 p-8">
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
          <p className="text-slate-700">Loading authentication...</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200 flex items-center justify-center p-6">
        {toast && (
          <div className="fixed right-5 top-5 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
            {toast}
          </div>
        )}

        <div className="grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl md:grid-cols-2">
          <div className="hidden md:flex flex-col justify-between bg-slate-900 p-10 text-white">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
                Agentic AI Job Platform
              </p>
              <h1 className="mt-5 text-5xl font-bold leading-tight">
                Smarter job tracking
                <br />
                starts here.
              </h1>
              <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
                Save your default CV, track applications, analyze ATS compatibility,
                and generate tailored resumes and cover letters from one modern dashboard.
              </p>
            </div>

            <div className="grid gap-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 transition hover:bg-slate-800">
                <p className="text-sm font-medium text-slate-200">Track every application stage</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 transition hover:bg-slate-800">
                <p className="text-sm font-medium text-slate-200">Keep a default resume ready</p>
              </div>
              <div className="rounded-2xl border border-slate-700 bg-slate-800/80 p-5 transition hover:bg-slate-800">
                <p className="text-sm font-medium text-slate-200">Generate ATS-friendly documents instantly</p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12">
            <div className="mx-auto max-w-md">
              <h2 className="text-3xl font-bold text-slate-900">
                {isSignupMode ? "Create your account" : "Welcome back"}
              </h2>
              <p className="mt-3 text-slate-600 leading-7">
                {isSignupMode
                  ? "Create an account to save jobs, documents, and personalized application materials."
                  : "Sign in to continue to your AI-powered job tracking dashboard."}
              </p>

              <div className="mt-8 grid gap-4">
                {isSignupMode && (
                  <input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  />
                )}

                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                />

                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                />

                {isSignupMode && (
                  <input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  />
                )}

                <button
                  type="button"
                  onClick={isSignupMode ? signUp : signIn}
                  className="rounded-2xl bg-slate-900 px-4 py-4 text-white font-medium transition duration-200 hover:bg-slate-800 hover:shadow-lg active:scale-[0.99]"
                >
                  {isSignupMode ? "Create Account" : "Sign In"}
                </button>

                <button
                  type="button"
                  onClick={signInWithGoogle}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-medium text-slate-800 transition duration-200 hover:bg-slate-50 hover:shadow-md active:scale-[0.99]"
                >
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={() => setIsSignupMode((prev) => !prev)}
                  className="text-sm font-medium text-slate-600 underline underline-offset-4 transition hover:text-slate-900"
                >
                  {isSignupMode
                    ? "Already have an account? Sign in"
                    : "Don’t have an account? Create one"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-slate-200">
      {toast && (
        <div className="fixed right-5 top-5 z-50 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl">
          {toast}
        </div>
      )}

      <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
        <aside className="border-r border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Job Tracker</h1>
            <p className="mt-2 text-sm text-slate-500">
              {session.user.user_metadata?.full_name || session.user.email}
            </p>
          </div>

          <nav className="mt-8 grid gap-3">
            <button className="rounded-2xl bg-slate-900 px-4 py-3 text-left text-white transition hover:bg-slate-800">
              Dashboard
            </button>
            <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50">
              Default CV
            </button>
            <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50">
              ATS Analysis
            </button>
            <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50">
              Generated Docs
            </button>
          </nav>

          <button
            type="button"
            onClick={signOut}
            className="mt-8 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-medium transition hover:bg-slate-50 hover:shadow-md"
          >
            Logout
          </button>
        </aside>

        <section className="p-6 md:p-8">
          <section className="grid gap-4 md:grid-cols-5 mb-8">
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <p className="text-sm text-slate-500">Total Jobs</p>
              <h2 className="mt-3 text-4xl font-bold text-slate-900">{counts.total}</h2>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <p className="text-sm text-slate-500">Need to Apply</p>
              <h2 className="mt-3 text-4xl font-bold text-amber-600">{counts.needToApply}</h2>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <p className="text-sm text-slate-500">Applied</p>
              <h2 className="mt-3 text-4xl font-bold text-blue-600">{counts.applied}</h2>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <p className="text-sm text-slate-500">Interview Call</p>
              <h2 className="mt-3 text-4xl font-bold text-purple-600">{counts.interview}</h2>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <p className="text-sm text-slate-500">Offers</p>
              <h2 className="mt-3 text-4xl font-bold text-emerald-600">{counts.offers}</h2>
            </div>
          </section>

          <section className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-8">
              <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-slate-900">Default CV</h2>
                <p className="mt-2 text-slate-600">
                  Save one main CV and use it automatically across applications.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50 hover:shadow-md">
                    <span className="font-medium text-slate-800">Choose Default CV</span>
                    <span className="max-w-[60%] truncate text-sm text-slate-500">
                      {defaultCvFile ? defaultCvFile.name : "No file chosen"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setDefaultCvFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={uploadDefaultCv}
                    disabled={uploadingDefaultCv}
                    className="rounded-2xl bg-slate-900 px-4 py-4 text-white font-medium transition duration-200 hover:bg-slate-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingDefaultCv ? "Uploading Default CV..." : "Upload and Save as Default CV"}
                  </button>

                  <div className="md:col-span-2 rounded-2xl bg-slate-50 p-5">
                    <p className="font-medium text-slate-800">
                      Saved Default CV: {defaultCvName || "None uploaded yet"}
                    </p>
                    <p className="mt-2 text-sm text-slate-600 leading-6">
                      This CV will be used automatically unless you upload a temporary CV for the current job.
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-slate-900">Temporary CV Override</h2>
                <p className="mt-2 text-slate-600">
                  Upload a different CV only for the current job workflow.
                </p>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:bg-slate-50 hover:shadow-md">
                    <span className="font-medium text-slate-800">Choose Temporary CV</span>
                    <span className="max-w-[60%] truncate text-sm text-slate-500">
                      {overrideCvFile ? overrideCvFile.name : "No file chosen"}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={(e) => setOverrideCvFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={parseOverrideCv}
                    disabled={parsingOverrideCv}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-medium text-slate-800 transition duration-200 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {parsingOverrideCv ? "Parsing CV..." : "Use Uploaded CV for This Job"}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  Current source:{" "}
                  <span className="font-medium text-slate-800">
                    {overrideCvText
                      ? "Temporary uploaded CV"
                      : defaultCvText
                      ? "Saved default CV"
                      : "No CV available"}
                  </span>
                </div>
              </section>

              <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-slate-900">Add Job</h2>
                <p className="mt-2 text-slate-600">
                  Add a new job manually or let AI extract fields from the job description.
                </p>

                <form onSubmit={addJob} className="mt-6 grid gap-4 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                    required
                  />

                  <input
                    type="text"
                    placeholder="Job Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                    required
                  />

                  <input
                    type="url"
                    placeholder="Job Link"
                    value={jobLink}
                    onChange={(e) => setJobLink(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  />

                  <input
                    type="text"
                    placeholder="Location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  />

                  <input
                    type="text"
                    placeholder="Salary"
                    value={salary}
                    onChange={(e) => setSalary(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  />

                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  >
                    {STATUSES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>

                  <input
                    type="date"
                    value={dateApplied}
                    onChange={(e) => setDateApplied(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  />

                  <input
                    type="datetime-local"
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                    className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                  />

                  <textarea
                    placeholder="Notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-28 rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300 md:col-span-2"
                  />

                  <textarea
                    placeholder="Paste Job Description"
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    className="min-h-44 rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300 md:col-span-2"
                  />

                  <button
                    type="button"
                    onClick={autoFillFromJD}
                    disabled={extracting}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-medium text-slate-800 transition duration-200 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                  >
                    {extracting ? "Extracting..." : "Auto Fill from JD"}
                  </button>

                  <button
                    type="button"
                    onClick={analyzeATS}
                    disabled={atsLoading}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-4 font-medium text-slate-800 transition duration-200 hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                  >
                    {atsLoading ? "Analyzing ATS Match..." : "Analyze ATS Match"}
                  </button>

                  <button
                    type="button"
                    onClick={generateApplicationDocs}
                    disabled={generatingDocs}
                    className="rounded-2xl bg-slate-900 px-4 py-4 text-white font-medium transition duration-200 hover:bg-slate-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2"
                  >
                    {generatingDocs ? "Generating Resume + Cover Letter..." : "Generate Tailored Resume + Cover Letter"}
                  </button>

                  <button
                    type="submit"
                    className="rounded-2xl bg-emerald-600 px-4 py-4 text-white font-medium transition duration-200 hover:bg-emerald-700 hover:shadow-lg active:scale-[0.99] md:col-span-2"
                  >
                    Add Job
                  </button>
                </form>
              </section>
            </div>

            <div className="space-y-8">
              {atsResult && (
                <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-lg">
                  <h2 className="text-2xl font-bold text-slate-900">ATS Analysis Result</h2>

                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-6">
                    <p className="text-sm text-slate-500">Match Score</p>
                    <h3 className="mt-3 text-5xl font-bold text-slate-900">
                      {atsResult.match_score}%
                    </h3>
                  </div>

                  <div className="mt-6 grid gap-6">
                    <div className="rounded-2xl bg-slate-50 p-5">
                      <h3 className="font-semibold text-slate-900">Missing Keywords</h3>
                      <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-1">
                        {atsResult.missing_keywords?.length ? (
                          atsResult.missing_keywords.map((item, idx) => <li key={idx}>{item}</li>)
                        ) : (
                          <li>No major missing keywords detected.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-5">
                      <h3 className="font-semibold text-slate-900">Strengths</h3>
                      <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-1">
                        {atsResult.strengths?.length ? (
                          atsResult.strengths.map((item, idx) => <li key={idx}>{item}</li>)
                        ) : (
                          <li>No strengths listed.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-5">
                      <h3 className="font-semibold text-slate-900">Improvements</h3>
                      <ul className="mt-3 list-disc pl-5 text-sm text-slate-700 space-y-1">
                        {atsResult.improvements?.length ? (
                          atsResult.improvements.map((item, idx) => <li key={idx}>{item}</li>)
                        ) : (
                          <li>No improvements listed.</li>
                        )}
                      </ul>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-700 leading-7">
                      <span className="font-semibold text-slate-900">Summary:</span> {atsResult.summary}
                    </div>
                  </div>
                </section>
              )}

              {(generatedResume || generatedCoverLetter) && (
                <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-lg">
                  <h2 className="text-2xl font-bold text-slate-900">Generated Application Documents</h2>

                  <div className="mt-6 rounded-2xl bg-slate-50 p-5">
                    <p className="font-medium text-slate-900">ATS Keywords Emphasized</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {generatedKeywords.length ? (
                        generatedKeywords.map((item, idx) => (
                          <span
                            key={idx}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No keywords returned.</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6">
                    <div>
                      <h3 className="mb-2 font-semibold text-slate-900">Tailored Resume</h3>
                      <textarea
                        value={generatedResume}
                        onChange={(e) => setGeneratedResume(e.target.value)}
                        className="min-h-[320px] w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
                      />
                    </div>

                    <div>
                      <h3 className="mb-2 font-semibold text-slate-900">Cover Letter</h3>
                      <textarea
                        value={generatedCoverLetter}
                        onChange={(e) => setGeneratedCoverLetter(e.target.value)}
                        className="min-h-[320px] w-full rounded-2xl border border-slate-200 p-4 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
                      />
                    </div>
                  </div>
                </section>
              )}

              <section className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-lg">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">My Jobs</h2>
                      <p className="mt-1 text-slate-600">Track and manage all saved applications.</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                      {filteredJobs.length} items
                    </span>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                    <input
                      type="text"
                      placeholder="Search by company or job title"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                    />

                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="rounded-2xl border border-slate-200 p-4 outline-none transition focus:ring-2 focus:ring-slate-300"
                    >
                      <option>All</option>
                      {STATUSES.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  {loading ? (
                    <p className="text-slate-600">Loading...</p>
                  ) : filteredJobs.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 p-6 text-slate-600">
                      No matching jobs found.
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredJobs.map((job) => (
                        <div
                          key={job.id}
                          className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"
                        >
                          <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div>
                                <div className="flex flex-wrap items-center gap-3">
                                  <h3 className="text-xl font-semibold text-slate-900">{job.title}</h3>
                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusBadgeClass(
                                      job.status
                                    )}`}
                                  >
                                    {job.status}
                                  </span>
                                </div>

                                <p className="mt-1 text-slate-600">{job.company}</p>

                                {job.location && (
                                  <p className="mt-3 text-sm text-slate-500">Location: {job.location}</p>
                                )}

                                {job.salary && (
                                  <p className="text-sm text-slate-500">Salary: {job.salary}</p>
                                )}

                                {job.job_link && (
                                  <a
                                    href={job.job_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-block text-sm font-medium text-blue-600 underline underline-offset-4 transition hover:text-blue-800"
                                  >
                                    Open Job Link
                                  </a>
                                )}
                              </div>

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <select
                                  value={job.status}
                                  onChange={(e) => updateStatus(job.id, e.target.value)}
                                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:ring-2 focus:ring-slate-300"
                                >
                                  {STATUSES.map((item) => (
                                    <option key={item}>{item}</option>
                                  ))}
                                </select>

                                <button
                                  onClick={() => deleteJob(job.id)}
                                  className="rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-medium text-red-600 transition duration-200 hover:bg-red-50 hover:shadow-md"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {job.notes && (
                              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700 leading-6">
                                <span className="font-medium text-slate-900">Notes:</span> {job.notes}
                              </div>
                            )}

                            {job.jd_text && (
                              <details className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                                <summary className="cursor-pointer font-medium text-slate-900 transition hover:text-slate-700">
                                  View Job Description
                                </summary>
                                <p className="mt-3 whitespace-pre-wrap leading-6">{job.jd_text}</p>
                              </details>
                            )}

                            <div className="grid gap-1 text-sm text-slate-500">
                              {job.date_applied && <p>Date Applied: {job.date_applied}</p>}
                              {job.interview_date && <p>Interview Date: {job.interview_date}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}