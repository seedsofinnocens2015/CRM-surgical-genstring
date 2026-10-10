"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Shield, User, FileSpreadsheet, Megaphone, ArrowRight, LogOut, CheckCircle2 } from "lucide-react";
import Footer from "@/app/components/Footer";

export default function Home() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data?.user && data.user.status === "active") {
            setCurrentUser(data.user);
          }
        }
      } catch (err) {
        // ignore
      } finally {
        setLoadingUser(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setCurrentUser(null);
      window.location.reload();
    } catch (e) {}
  };

  const getRolePanelPath = (role: string) => {
    switch (role) {
      case "admin":
        return "/admin/dashboard";
      case "team_leader":
        return "/team-leader/dashboard";
      case "agent":
        return "/agent/dashboard";
      case "mis":
        return "/mis/dashboard";
      case "marketing":
        return "/marketing/leads";
      default:
        return "/admin/login";
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Surgical CRM Logo" width={160} height={40} priority className="h-15 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            {!loadingUser && currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Logged in as: <strong>{currentUser.name}</strong></span>
                  <span className="px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] text-[10px] font-mono uppercase">
                    {currentUser.role}
                  </span>
                </div>
                <Link
                  href={getRolePanelPath(currentUser.role)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#cc2727] hover:bg-[#b02121] text-white transition-colors shadow-xs flex items-center gap-1.5"
                >
                  <span>Go to My Panel</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/admin/login"
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[#cc2727] text-xs font-bold uppercase tracking-wider mb-3">
          <Image src="/logo.webp" alt="Surgical CRM Logo" width={160} height={40} priority className="h-45 w-80" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-5xl">
          Lead Management System
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl font-normal">
          Streamlined multi-level portal with dedicated workspaces for Admin,
          Team Leaders, Calling Agents, MIS Analysts, and Marketing.
        </p>

        {/* 5 Panels Showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 w-full mt-6 text-left">
          {/* Admin Panel Card */}
          <div className={`p-5 rounded-2xl bg-white border transition-all shadow-sm flex flex-col justify-between group ${
            currentUser?.role === "admin"
              ? "border-[#cc2727] ring-2 ring-[#cc2727]/20 shadow-md"
              : "border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg"
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                {currentUser?.role === "admin" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Logged In
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#cc2727] transition-colors">
                1. Admin Panel
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Full control over staff members, configurations, role permissions, and system oversight.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={currentUser?.role === "admin" ? "/admin/dashboard" : "/admin/login"}
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                {currentUser?.role === "admin" ? "Open Dashboard" : "Access Portal"} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] font-mono font-semibold">
                Admin
              </span>
            </div>
          </div>

          {/* Team Leader Panel Card */}
          <div className={`p-5 rounded-2xl bg-white border transition-all shadow-sm flex flex-col justify-between group ${
            currentUser?.role === "team_leader"
              ? "border-[#cc2727] ring-2 ring-[#cc2727]/20 shadow-md"
              : "border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg"
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-bold">
                  <Shield className="w-5 h-5" />
                </div>
                {currentUser?.role === "team_leader" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Logged In
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#cc2727] transition-colors">
                2. Team Leader Panel
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Manage assigned team agents, supervise consultation follow-ups, and review pipeline metrics.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={currentUser?.role === "team_leader" ? "/team-leader/dashboard" : "/team-leader/login"}
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                {currentUser?.role === "team_leader" ? "Open Dashboard" : "TL Login"} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] font-mono font-semibold">
                TL
              </span>
            </div>
          </div>

          {/* Agent Panel Card */}
          <div className={`p-5 rounded-2xl bg-white border transition-all shadow-sm flex flex-col justify-between group ${
            currentUser?.role === "agent"
              ? "border-[#cc2727] ring-2 ring-[#cc2727]/20 shadow-md"
              : "border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg"
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                {currentUser?.role === "agent" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Logged In
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#cc2727] transition-colors">
                3. Agent Panel
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Direct calling interface for patient coordination, appointment booking, and status updates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={currentUser?.role === "agent" ? "/agent/dashboard" : "/agent/login"}
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                {currentUser?.role === "agent" ? "Open Dashboard" : "Agent Login"} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] font-mono font-semibold">
                Agent
              </span>
            </div>
          </div>

          {/* MIS Panel Card */}
          <div className={`p-5 rounded-2xl bg-white border transition-all shadow-sm flex flex-col justify-between group ${
            currentUser?.role === "mis"
              ? "border-[#cc2727] ring-2 ring-[#cc2727]/20 shadow-md"
              : "border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg"
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                {currentUser?.role === "mis" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Logged In
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#cc2727] transition-colors">
                4. MIS Panel
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Complete overview of leads and metrics dashboards. View-only access with Excel export.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={currentUser?.role === "mis" ? "/mis/dashboard" : "/mis/login"}
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                {currentUser?.role === "mis" ? "Open Dashboard" : "MIS Login"} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-mono font-semibold border border-sky-200">
                MIS
              </span>
            </div>
          </div>

          {/* Marketing Panel Card */}
          <div className={`p-5 rounded-2xl bg-white border transition-all shadow-sm flex flex-col justify-between group ${
            currentUser?.role === "marketing"
              ? "border-[#cc2727] ring-2 ring-[#cc2727]/20 shadow-md"
              : "border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg"
          }`}>
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center font-bold">
                  <Megaphone className="w-5 h-5" />
                </div>
                {currentUser?.role === "marketing" && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Logged In
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#cc2727] transition-colors">
                5. Marketing Panel
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Add new patient leads, bulk upload Excel/CSV sheets, and download lead files with ease.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href={currentUser?.role === "marketing" ? "/marketing/leads" : "/marketing/login"}
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                {currentUser?.role === "marketing" ? "Open Leads" : "Marketing Login"} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-mono font-semibold border border-purple-200">
                Marketing
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
