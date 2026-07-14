"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Image from "next/image";
import { safeCallbackUrl } from "@/lib/security";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Plane,
  FileCheck,
  AlertCircle,
  Clock,
} from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"), "/dashboard");
  const timedOut = searchParams.get("reason") === "timeout";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", { email, password, redirect: false });
      if (!result?.ok || result.error) {
        setError("Invalid email or password. Please try again.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {timedOut && !error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <Clock className="h-4 w-4 shrink-0" />
          You were signed out due to inactivity. Please sign in again.
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-heading">
          Login ID
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your ID"
            autoComplete="email"
            required
            className="az-login-input"
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-heading">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            className="az-login-input"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 transition-colors hover:text-az-teal"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="az-shimmer-btn group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-az-teal to-az-teal-light px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-az-teal/25 transition-all hover:shadow-xl hover:shadow-az-teal/30 focus:outline-none focus:ring-4 focus:ring-az-teal/25 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            Signing in...
          </>
        ) : (
          <>
            Sign In to Portal
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </>
        )}
      </button>
    </form>
  );
}

const FEATURES = [
  { icon: GraduationCap, label: "Student lifecycle management" },
  { icon: Plane, label: "Admission & visa processing" },
  { icon: FileCheck, label: "Secure document management" },
];

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-az-teal-dark px-4 py-10">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-az-teal-dark via-az-teal to-[#052e29]" />
      <div className="az-aurora-orb az-animate-aurora -left-20 -top-24 h-[28rem] w-[28rem] bg-az-teal-light/40" />
      <div
        className="az-aurora-orb az-animate-aurora -bottom-32 -right-16 h-[32rem] w-[32rem] bg-az-gold/25"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="az-aurora-orb az-animate-aurora left-1/3 top-1/2 h-72 w-72 bg-emerald-400/20"
        style={{ animationDelay: "-11s" }}
      />
      <div className="absolute inset-0 az-dot-grid" />

      {/* Card */}
      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl shadow-2xl shadow-black/40 lg:grid-cols-2">
        {/* Brand panel */}
        <div className="az-glass relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
          <div
            className="az-aurora-orb az-animate-float -right-10 top-10 h-40 w-40 bg-az-gold/30"
            style={{ filter: "blur(50px)" }}
          />
          <div className="relative">
            <div className="relative inline-flex">
              <span className="az-animate-ring absolute inset-0 -m-3 rounded-full bg-az-gold/20 blur-xl" />
              <Image
                src="/logo.png"
                alt="AZ Consultants"
                width={96}
                height={96}
                priority
                className="relative rounded-2xl shadow-2xl"
              />
            </div>
            <h1 className="az-fade-up az-delay-1 mt-8 text-4xl font-extrabold leading-tight tracking-tight text-white">
              Welcome to the
              <br />
              <span className="az-gradient-text">AZ Consultants</span>
              <br />
              ERP Portal
            </h1>
            <p className="az-fade-up az-delay-2 mt-4 max-w-sm text-sm leading-relaxed text-white/70">
              The complete platform to manage students from first query to a
              successful visa — admissions, documents, and progress in one place.
            </p>
          </div>

          <div className="relative mt-10 space-y-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.label}
                className={`az-fade-up az-delay-${i + 3} flex items-center gap-3 text-sm text-white/85`}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-az-gold/15 text-az-gold ring-1 ring-az-gold/25">
                  <f.icon className="h-4 w-4" />
                </span>
                {f.label}
              </div>
            ))}
          </div>

          <div className="az-fade-up az-delay-5 relative mt-10 flex items-center gap-2 text-xs text-white/50">
            <ShieldCheck className="h-4 w-4 text-az-gold/70" />
            Enterprise-grade security · Foreign Education Consultants
          </div>
        </div>

        {/* Form panel */}
        <div className="az-glass-card relative flex flex-col justify-center p-8 sm:p-12">
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/logo.png"
              alt="AZ Consultants"
              width={56}
              height={56}
              className="rounded-xl shadow-lg"
            />
            <div>
              <h1 className="text-lg font-extrabold text-heading">AZ CONSULTANTS</h1>
              <p className="text-xs font-medium text-content-muted">Foreign Education Consultants</p>
            </div>
          </div>

          <div className="az-fade-up">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-az-teal/10 px-3 py-1 text-xs font-semibold text-az-teal">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure Sign In
            </span>
            <h2 className="mt-4 text-3xl font-bold text-heading">Welcome back</h2>
            <p className="mt-1.5 text-sm text-content-muted">
              Sign in to continue to the Study Abroad ERP.
            </p>
          </div>

          <div className="az-fade-up az-delay-1 mt-8">
            <Suspense
              fallback={<p className="text-sm text-content-muted">Loading…</p>}
            >
              <LoginForm />
            </Suspense>
          </div>

          <p className="az-fade-up az-delay-2 mt-8 text-center text-xs leading-relaxed text-content-faint">
            Access is provided by AZ Consultants administration.
            <br />
            Contact the Managing Director for account help.
          </p>
        </div>
      </div>
    </div>
  );
}
