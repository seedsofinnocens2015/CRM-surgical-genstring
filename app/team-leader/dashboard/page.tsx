"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TeamLeaderSidebar from "@/app/components/TeamLeaderSidebar";
import {
  FolderKanban,
  CheckCircle2,
  PhoneCall,
  PhoneForwarded,
  XCircle,
  TrendingUp,
  RefreshCw,
  LayoutDashboard,
  Users,
  UserCheck,
  UserX,
  ChevronRight,
} from "lucide-react";

interface Lead {
  _id?: string;
  uniqueId?: string;
  date?: string;
  month?: string;
  dispositions?: string;
  subDispositions?: string;
  validStatus?: string;
  appointmentDate?: string;
  appointmentMonth?: string;
  consultationCharges?: string;
  surgeryDate?: string;
  surgeryMonth?: string;
  surgeryCost?: string;
  surgeryPaymentReceived?: string;
  leadSource?: string;
  location?: string;
  otherCity?: string;
  callerName?: string;
  patientName?: string;
  mobileNumber?: string;
  createdAt?: string;
}

interface Member {
  _id?: string;
  name: string;
  email: string;
  mobile?: string;
  role: string;
  status?: string;
  createdAt?: string;
}

// Categorize raw disposition into standard metric buckets
function categorizeDisposition(
  raw: string | undefined
): "Closed" | "Contact Attempt" | "Contacted" | "Converted" | "Other" {
  if (!raw) return "Other";
  const str = raw.trim().toLowerCase();
  if (str === "closed") return "Closed";
  if (str === "contact attempt" || str.includes("attempt"))
    return "Contact Attempt";
  if (str === "contacted") return "Contacted";
  if (str === "converted") return "Converted";
  return "Other";
}

export default function TeamLeaderDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setRefreshing(true);
      }
      const [authRes, leadsRes, membersRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/admin/leads", { cache: "no-store" }),
        fetch("/api/admin/members", { cache: "no-store" }),
      ]);

      if (!authRes.ok) {
        if (authRes.status === 403) {
          router.push("/team-leader/login?error=deactivated");
          return;
        }
        router.push("/team-leader/login");
        return;
      }
      const authData = await authRes.json();
      if (!authData.user) {
        router.push("/team-leader/login");
        return;
      }
      if (authData.user.role !== "team_leader") {
        if (authData.user.role === "admin") router.push("/admin/dashboard");
        else if (authData.user.role === "agent") router.push("/agent/dashboard");
        else router.push("/team-leader/login");
        return;
      }
      setUser(authData.user);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.leads || []);
      }

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        // Filter strictly to show only Agents
        const agents = (membersData.members || []).filter(
          (m: any) => m.role === "agent"
        );
        setMembers(agents);
      }
    } catch (err) {
      console.error("Team Leader Dashboard load error:", err);
    } finally {
      setLoading(false);
      if (!isBackground) {
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    // 1. Initial Load
    fetchDashboardData();

    // 2. Real-time background polling every 5 seconds
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchDashboardData(true);
      }
    }, 5000);

    // 3. Instant refresh on tab focus / visibility change
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchDashboardData(true);
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // 4. Real-time Cross-tab/Window Broadcast Sync
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "surgical_crm_leads_updated") {
        fetchDashboardData(true);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // 5. In-app custom event sync
    const handleCustomLeadUpdate = () => {
      fetchDashboardData(true);
    };
    window.addEventListener("lead_updated", handleCustomLeadUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("lead_updated", handleCustomLeadUpdate);
    };
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/team-leader/login");
  };

  // Calculate Overall KPI Lead Metrics
  const leadMetrics = useMemo(() => {
    let closed = 0;
    let contactAttempt = 0;
    let contacted = 0;
    let converted = 0;
    let other = 0;

    leads.forEach((lead) => {
      const category = categorizeDisposition(lead.dispositions);
      if (category === "Closed") closed++;
      else if (category === "Contact Attempt") contactAttempt++;
      else if (category === "Contacted") contacted++;
      else if (category === "Converted") converted++;
      else other++;
    });

    const total = leads.length;
    const conversionRate =
      total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

    return {
      total,
      closed,
      contactAttempt,
      contacted,
      converted,
      other,
      conversionRate,
    };
  }, [leads]);

  // Calculate Agent Team Metrics
  const agentMetrics = useMemo(() => {
    const totalAgents = members.length;
    const activeAgents = members.filter((m) => m.status !== "inactive").length;
    const inactiveAgents = members.filter((m) => m.status === "inactive").length;
    const activePercent =
      totalAgents > 0
        ? Math.round((activeAgents / totalAgents) * 100)
        : 0;

    return {
      totalAgents,
      activeAgents,
      inactiveAgents,
      activePercent,
    };
  }, [members]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#cc2727]/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-black flex overflow-hidden">
      {/* Sidebar with Navigation (Dashboard, All Leads, All Members) */}
      <TeamLeaderSidebar user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#cc2727]/10 border border-[#cc2727]/20 text-[#cc2727]">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-black leading-tight">
                Team Leader Dashboard
              </h1>
              <p className="text-[11px] text-gray-500">
                Performance Metrics & Team Operations Overview
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Real-time Live Badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/20 rounded-xl text-[11px] font-semibold text-emerald-700">
              <span className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
              <span>Live Sync</span>
            </div>

            {/* Refresh Data */}
            <button
              onClick={() => fetchDashboardData(false)}
              disabled={refreshing}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-black hover:text-black rounded-xl border border-slate-300 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Section 1: Lead Performance Metrics (6 Cards - Generous Height & Spacing) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-[#cc2727]" />
                <h2 className="text-xs font-bold text-black uppercase tracking-wider">
                  Lead Performance & Dispositions
                </h2>
              </div>
              <Link
                href="/team-leader/leads"
                className="text-xs text-[#cc2727] hover:text-[#b02121] font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>View All Leads</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* Total Leads */}
              <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-lg hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">
                    Total Leads
                  </span>
                  <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {leadMetrics.total}
                  </span>
                  <p className="text-[11px] text-black mt-1">
                    All recorded leads
                  </p>
                </div>
              </div>

              {/* Converted */}
              <div className="p-4 sm:p-5 bg-white border border-emerald-200/20 rounded-2xl shadow-lg hover:border-emerald-200/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700">
                    Converted
                  </span>
                  <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {leadMetrics.converted}
                  </span>
                  <p className="text-[11px] text-emerald-700/90 font-medium mt-1">
                    {leadMetrics.conversionRate}% Conversion Rate
                  </p>
                </div>
              </div>

              {/* Contacted */}
              <div className="p-4 sm:p-5 bg-white border border-sky-500/20 rounded-2xl shadow-lg hover:border-sky-500/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-400">
                    Contacted
                  </span>
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {leadMetrics.contacted}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Successfully connected
                  </p>
                </div>
              </div>

              {/* Contact Attempt */}
              <div className="p-4 sm:p-5 bg-white border border-amber-500/20 rounded-2xl shadow-lg hover:border-amber-500/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-400">
                    Contact Attempt
                  </span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                    <PhoneForwarded className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {leadMetrics.contactAttempt}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Ringing / Not reachable
                  </p>
                </div>
              </div>

              {/* Closed */}
              <div className="p-4 sm:p-5 bg-white border border-rose-500/20 rounded-2xl shadow-lg hover:border-rose-500/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400">
                    Closed
                  </span>
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {leadMetrics.closed}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Lost / Invalid leads
                  </p>
                </div>
              </div>

              {/* Others / Unassigned */}
              <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-lg hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">
                    Unassigned
                  </span>
                  <div className="p-2 rounded-xl bg-slate-100 text-black border border-slate-300">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {leadMetrics.other}
                  </span>
                  <p className="text-[11px] text-black mt-1">
                    Pending / In pipeline
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Agent Team Members Status (3 Prominent Cards) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <h2 className="text-xs font-bold text-black uppercase tracking-wider">
                  Agent Team Overview
                </h2>
              </div>
              <Link
                href="/team-leader/members"
                className="text-xs text-[#cc2727] hover:text-[#b02121] font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>Manage All Agents</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Total Agents */}
              <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-2xl shadow-lg hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-gray-500">
                      Total Agents
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-black font-mono mt-1">
                      {agentMetrics.totalAgents}
                    </h3>
                  </div>
                  <div className="p-3 bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 rounded-2xl">
                    <Users className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-gray-500">
                  <span>Registered Agents</span>
                  <span className="font-semibold text-black">
                    {agentMetrics.totalAgents} Team Staff
                  </span>
                </div>
              </div>

              {/* Card 2: Active Agents */}
              <div className="p-5 sm:p-6 bg-white border border-emerald-200/20 rounded-2xl shadow-lg hover:border-emerald-200/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-emerald-700">
                      Active Agents
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-[#cc2727] font-mono mt-1">
                      {agentMetrics.activeAgents}
                    </h3>
                  </div>
                  <div className="p-3 bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 rounded-2xl">
                    <UserCheck className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-gray-500">
                  <span>Can Login & Call</span>
                  <span className="font-semibold text-emerald-700">
                    {agentMetrics.activePercent}% Active Staff
                  </span>
                </div>
              </div>

              {/* Card 3: Inactive / Blocked Agents */}
              <div className="p-5 sm:p-6 bg-white border border-rose-500/20 rounded-2xl shadow-lg hover:border-rose-500/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-rose-400">
                      Inactive / Blocked
                    </span>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono mt-1">
                      {agentMetrics.inactiveAgents}
                    </h3>
                  </div>
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl">
                    <UserX className="w-6 h-6" />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-gray-500">
                  <span>Access Blocked</span>
                  <span className="font-semibold text-rose-400">
                    {agentMetrics.inactiveAgents} Disabled
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
