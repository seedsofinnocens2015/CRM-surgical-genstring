"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  LogOut,
  Building2,
  ChevronRight,
  ShieldCheck,
  X,
  Mail,
  Phone,
  Calendar,
  User,
  UserCheck,
} from "lucide-react";

interface AgentSidebarProps {
  user: any;
  onLogout: () => void;
}

export default function AgentSidebar({ user, onLogout }: AgentSidebarProps) {
  const pathname = usePathname();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const navItems = [
    {
      name: "Dashboard",
      href: "/agent/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "All Leads",
      href: "/agent/leads",
      icon: FolderKanban,
    },
  ];

  return (
    <>
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0 overflow-y-auto z-30 shadow-sm">
        {/* Brand & Navigation */}
        <div>
          {/* Header */}
          <div className="h-16 px-6 border-b border-slate-200 items-center gap-3 bg-white">
              <Image src="/logo.svg" alt="Surgical CRM Logo" width={150} height={38} priority className="h-15 w-auto" />
            </div>
          

          {/* Menu list */}
          <div className="p-4 space-y-1.5">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Main Menu
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-[#cc2727] text-white shadow-md shadow-[#cc2727]/25"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? "text-white" : "text-slate-500"
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-white/80" />}
                </Link>
              );
            })}
          </div>
        </div>

        {/* User profile button (Clickable to open profile popup) */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-3 text-left group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-bold text-sm uppercase group-hover:bg-[#cc2727] group-hover:text-white transition-all shrink-0">
              {user?.name ? user.name.charAt(0) : "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-s font-bold text-slate-900 truncate group-hover:text-[#cc2727] transition-colors">
                {user?.name || "Agent"}
              </p>
              <span className="text-[12px] text-slate-500 block mt-0.5">
                Agent Panel
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* Profile Details Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-7 text-slate-900">
            {/* Close Button */}
            <button
              onClick={() => setIsProfileModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Header */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-extrabold text-2xl uppercase shadow-md shadow-[#cc2727]/10 shrink-0">
                {user?.name ? user.name.charAt(0) : "A"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-slate-900 leading-tight">
                  {user?.name || "Agent"}
                </h3>
                <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                  <User className="w-3 h-3" />
                  Agent
                </span>
              </div>
            </div>

            {/* Profile Details List */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs sm:text-sm">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500 flex items-center gap-2 shrink-0">
                  <UserCheck className="w-4 h-4 text-[#cc2727]" />
                  Full Name
                </span>
                <span className="font-bold text-slate-900 text-right ml-4">
                  {user?.name || "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500 flex items-center gap-2 shrink-0">
                  <Mail className="w-4 h-4 text-[#cc2727]" />
                  Email
                </span>
                <span className="font-semibold text-slate-800 text-right ml-4 break-all select-all">
                  {user?.email || "N/A"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-[#cc2727]" />
                  Mobile
                </span>
                <span className="font-semibold text-slate-800 text-right">
                  {user?.mobile || "Not specified"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
                <span className="text-slate-500 flex items-center gap-2">
                  <User className="w-4 h-4 text-[#cc2727]" />
                  Role
                </span>
                <span className="font-bold text-[#cc2727] uppercase tracking-wider text-[11px]">
                  {user?.role || "agent"}
                </span>
              </div>

              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#cc2727]" />
                  Member Since
                </span>
                <span className="font-semibold text-slate-800 text-right">
                  {user?.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "Active"}
                </span>
              </div>
            </div>

            {/* Sign Out Button inside Popup */}
            <button
              onClick={() => {
                setIsProfileModalOpen(false);
                onLogout();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#cc2727] hover:bg-[#b02121] text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-[#cc2727]/25 active:scale-95 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
