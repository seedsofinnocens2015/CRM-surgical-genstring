"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Eye, EyeOff, AlertCircle } from "lucide-react";

function AgentLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam === "deactivated") {
      setError("Invalid user. Your account has been deactivated by the administrator.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, requiredRole: "agent" }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      router.push("/agent/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 py-8 px-6 shadow-xl rounded-2xl sm:px-10">
      {error && (
        <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="email"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            Agent Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@surgicalcrm.com"
            className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] transition-all text-sm font-medium"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] transition-all text-sm pr-11 font-medium"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 px-4 bg-[#cc2727] hover:bg-[#b02121] text-white font-bold rounded-xl text-sm transition-all duration-200 shadow-md shadow-[#cc2727]/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer active:scale-95"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Sign In as Agent"
          )}
        </button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-200 text-center space-y-2">
        <p className="text-xs text-slate-600">
          Need to login to another panel?
        </p>
        <div className="flex justify-center gap-4 text-xs font-semibold">
          <Link
            href="/team-leader/login"
            className="text-[#cc2727] hover:text-[#b02121] transition-colors"
          >
            Team Leader Login
          </Link>
          <span className="text-slate-300">•</span>
          <Link
            href="/admin/login"
            className="text-[#cc2727] hover:text-[#b02121] transition-colors"
          >
            Admin Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AgentLoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 mb-4 shadow-md shadow-[#cc2727]/10">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Agent Portal
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Sign in to access your Agent calling & workspace dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense
          fallback={
            <div className="bg-white border border-slate-200 p-8 rounded-2xl text-center text-slate-600 shadow-md">
              Loading...
            </div>
          }
        >
          <AgentLoginForm />
        </Suspense>
      </div>
    </div>
  );
}
