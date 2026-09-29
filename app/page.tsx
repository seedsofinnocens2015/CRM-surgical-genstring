import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, Shield, User, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      {/* Top Header */}
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="Surgical CRM Logo" width={160} height={40} priority className="h-15 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/login"
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-xs"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-6 flex-1 flex flex-col items-center justify-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[#cc2727] text-xs font-bold uppercase tracking-wider mb-3">
          {/* <ShieldCheck className="w-4 h-4" />
          Role Based Multi-Panel CRM */}
          <Image src="/logo.webp" alt="Surgical CRM Logo" width={160} height={40} priority className="h-45 w-80" />
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-5xl">
          Lead Management System
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-600 max-w-2xl font-normal">
          Streamlined multi-level portal with dedicated workspaces for Admin,
          Team Leaders, and Calling/Medical Agents.
        </p>

        {/* 3 Panels Showcase */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl mt-6 text-left">
          {/* Admin Panel Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg transition-all shadow-sm flex flex-col justify-between group">
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center mb-3 font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#cc2727] transition-colors">
                1. Admin Panel
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Full control over staff members. Add Team Leaders and Agents with credentials, monitor all system users, and manage operations.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/admin/login"
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                Access Portal <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] font-mono font-semibold">
                Admin
              </span>
            </div>
          </div>

          {/* Team Leader Panel Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg transition-all shadow-sm flex flex-col justify-between group">
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center mb-3 font-bold">
                <Shield className="w-5 h-5" />
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
                href="/team-leader/login"
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                Team Leader Login <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] font-mono font-semibold">
                TL
              </span>
            </div>
          </div>

          {/* Agent Panel Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-[#cc2727]/50 hover:shadow-lg transition-all shadow-sm flex flex-col justify-between group">
            <div>
              <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center mb-3 font-bold">
                <User className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-[#cc2727] transition-colors">
                3. Agent Panel
              </h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Direct calling and lead engagement interface for patient coordination, appointment booking, and status updates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <Link
                href="/agent/login"
                className="text-xs font-bold text-[#cc2727] hover:text-[#b02121] flex items-center gap-1"
              >
                Agent Login <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] font-mono font-semibold">
                Agent
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-40 shrink-0 border-t border-[#b51f1f] bg-[#cc2727] px-2 py-1.5 text-center text-[11px] leading-snug text-white sm:px-3 sm:py-2 sm:text-[15px] sm:leading-tight">
        <p>
          © {new Date().getFullYear()}{" "}
          <Link
            href="https://www.seedsofinnocens.com/seeds-of-innocens-surgical-center/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-white hover:text-white/80"
          >
            Seeds of Innocence Surgical Centre
          </Link>
          . All Rights Reserved. Designed &amp; Developed by{" "}
          <Link
            href="https://amit1999-portfolio.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="border-b border-white/80 font-bold text-white hover:text-white/80"
          >
            Amit Kumar
          </Link>
        </p>
      </footer>
    </div>
  );
}
