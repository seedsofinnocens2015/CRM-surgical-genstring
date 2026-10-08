"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AgentSidebar from "@/app/components/AgentSidebar";
import Footer from "@/app/components/Footer";
import {
  FolderKanban,
  CalendarCheck,
  CheckCircle2,
  PhoneForwarded,
  PhoneCall,
  XCircle,
  RefreshCw,
  LayoutDashboard,
  ChevronRight,
  TrendingUp,
  Calendar,
  FileSpreadsheet,
  Download,
  Phone,
  Search,
  Check,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Clock,
  User,
  AlertCircle,
} from "lucide-react";
import { formatDateToDDMMMYY, parseDDMMMYYToISO } from "@/lib/leadOptions";

interface ChangeItem {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
}

interface AuditLog {
  _id?: string;
  performedBy: string;
  performedByRole: string;
  performedByEmail?: string;
  timestamp: string;
  changes: ChangeItem[];
}

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
  leadTimestamp?: string;
  lookingForTreatment?: string;
  teleconsultationSlot?: string;
  assignedDate?: string;
  assignedAt?: string;
  createdAt?: string;
  auditLogs?: AuditLog[];
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

// Format Date YYYY-MM-DD for today in local time
function getTodayISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AgentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Daily Sheet Date Filter (defaults to today)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISODate());

  const fetchDashboardData = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setRefreshing(true);
      }
      const [authRes, leadsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/admin/leads", { cache: "no-store" }),
      ]);

      if (!authRes.ok) {
        if (authRes.status === 403) {
          router.push("/agent/login?error=deactivated");
          return;
        }
        router.push("/agent/login");
        return;
      }
      const authData = await authRes.json();
      if (!authData.user) {
        router.push("/agent/login");
        return;
      }
      if (authData.user.role !== "agent") {
        if (authData.user.role === "admin") router.push("/admin/dashboard");
        else if (authData.user.role === "team_leader")
          router.push("/team-leader/dashboard");
        else router.push("/agent/login");
        return;
      }
      setUser(authData.user);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        // Since role is "agent", /api/admin/leads already returns ONLY leads assigned to this caller
        setLeads(leadsData.leads || []);
      }
    } catch (err) {
      console.error("Agent Dashboard load error:", err);
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
    router.push("/agent/login");
  };

  // Lifetime Overall Metrics for Assigned Leads
  const overallMetrics = useMemo(() => {
    let appointmentBooked = 0;
    let converted = 0;
    let contactAttempt = 0;
    let contacted = 0;
    let closed = 0;

    leads.forEach((lead) => {
      const sub = (lead.subDispositions || "").trim().toLowerCase();
      if (sub === "appointment booked" || sub.includes("appointment booked")) {
        appointmentBooked++;
      }

      const category = categorizeDisposition(lead.dispositions);
      if (category === "Converted") converted++;
      else if (category === "Contact Attempt") contactAttempt++;
      else if (category === "Contacted") contacted++;
      else if (category === "Closed") closed++;
    });

    const totalAssigned = leads.length;
    const conversionRate =
      totalAssigned > 0
        ? ((converted / totalAssigned) * 100).toFixed(1)
        : "0.0";
    const appointmentRate =
      totalAssigned > 0
        ? ((appointmentBooked / totalAssigned) * 100).toFixed(1)
        : "0.0";

    return {
      totalAssigned,
      appointmentBooked,
      converted,
      contactAttempt,
      contacted,
      closed,
      conversionRate,
      appointmentRate,
    };
  }, [leads]);

  // Selected Date Formatting & Filter Match
  const selectedDateFormatted = useMemo(() => {
    if (!selectedDate) return "";
    return formatDateToDDMMMYY(selectedDate); // e.g. "28-Sep-26"
  }, [selectedDate]);

  // Daily Sheet Metrics & Leads for the selected date
  const dailySheetData = useMemo(() => {
    if (!selectedDate) {
      return {
        dateLeads: [],
        assignedCount: 0,
        callsMadeCount: 0,
        appointmentBookedCount: 0,
        convertedCount: 0,
        contactedCount: 0,
        closedCount: 0,
        contactAttemptCount: 0,
      };
    }

    const targetFormatted = selectedDateFormatted.toLowerCase(); // "28-sep-26"
    const targetISO = selectedDate; // "2026-09-28"

    // 1. Leads assigned to this agent on the selected date
    // Check assignedDate (set during bulk/single assign), or fallback to lead date or createdAt
    const dateAssignedLeads = leads.filter((lead) => {
      // Direct assignedDate match
      if (lead.assignedDate && lead.assignedDate.trim().toLowerCase() === targetFormatted) {
        return true;
      }
      if (lead.assignedAt) {
        const aISO = new Date(lead.assignedAt).toISOString().slice(0, 10);
        if (aISO === targetISO) return true;
      }
      // If no explicit assignedDate, fallback to lead date
      if (!lead.assignedDate) {
        const rawDate = (lead.date || "").trim().toLowerCase();
        if (rawDate === targetFormatted) return true;

        if (lead.createdAt) {
          const createdISO = new Date(lead.createdAt).toISOString().slice(0, 10);
          if (createdISO === targetISO) return true;
        }
      }
      return false;
    });

    // 2. Metrics for leads assigned on this selected date
    let appointmentBookedCount = 0;
    let convertedCount = 0;
    let contactedCount = 0;
    let closedCount = 0;
    let contactAttemptCount = 0;

    dateAssignedLeads.forEach((lead) => {
      const sub = (lead.subDispositions || "").trim().toLowerCase();
      if (sub === "appointment booked" || sub.includes("appointment booked")) {
        appointmentBookedCount++;
      }

      const cat = categorizeDisposition(lead.dispositions);
      if (cat === "Converted") convertedCount++;
      else if (cat === "Contacted") contactedCount++;
      else if (cat === "Contact Attempt") contactAttemptCount++;
      else if (cat === "Closed") closedCount++;
    });

    // 3. Total calls made on this date by this agent:
    // User requirement: Agar agent ek hi particular patient lead ke Notes ya Sub Dispositions ko bar bar change kar rha hai,
    // to call count bar bar nahi badhna chahiye. Distinct/unique patient leads count karne hain
    // jinke Notes ya Sub Dispositions us din update hue (1 call per patient).
    const agentName = (user?.name || "").trim().toLowerCase();
    let distinctCalledPatientsCount = 0;

    leads.forEach((lead) => {
      let patientCalledOnDate = false;

      // Check if this patient lead has at least one audit log on target date by this agent
      // updating Notes & Observations or Sub Dispositions
      (lead.auditLogs || []).forEach((log) => {
        const logDateISO = new Date(log.timestamp).toISOString().slice(0, 10);
        const performedByName = (log.performedBy || "").trim().toLowerCase();
        if (
          logDateISO === targetISO &&
          (!agentName || performedByName === agentName)
        ) {
          const hasNotesOrSubDispUpdate = (log.changes || []).some((c) =>
            ["notes", "subDispositions"].includes(c.field)
          );

          if (hasNotesOrSubDispUpdate) {
            patientCalledOnDate = true;
          }
        }
      });

      if (patientCalledOnDate) {
        distinctCalledPatientsCount++;
      }
    });

    const finalCallsCount = distinctCalledPatientsCount;

    return {
      dateLeads: dateAssignedLeads,
      assignedCount: dateAssignedLeads.length,
      callsMadeCount: finalCallsCount,
      appointmentBookedCount,
      convertedCount,
      contactedCount,
      closedCount,
      contactAttemptCount,
    };
  }, [leads, selectedDate, selectedDateFormatted, user]);

  // Export Daily Sheet to Excel (.xlsx)
  const handleExportDailyExcel = async () => {
    try {
      setExportingExcel(true);
      const XLSX = await import("xlsx");

      // 1. Daily Summary KPI Sheet
      const summaryRows = [
        {
          "Daily Sheet Parameter": "Agent Name",
          "Metric Value": user?.name || "Agent",
        },
        {
          "Daily Sheet Parameter": "Selected Date",
          "Metric Value": `${selectedDateFormatted} (${selectedDate})`,
        },
        {
          "Daily Sheet Parameter": "Total Leads Assigned",
          "Metric Value": dailySheetData.assignedCount,
        },
        {
          "Daily Sheet Parameter": "Appointment Booked",
          "Metric Value": dailySheetData.appointmentBookedCount,
        },
        {
          "Daily Sheet Parameter": "Total Converted",
          "Metric Value": dailySheetData.convertedCount,
        },
        {
          "Daily Sheet Parameter": "Total Contacted",
          "Metric Value": dailySheetData.contactedCount,
        },
        {
          "Daily Sheet Parameter": "Total Closed",
          "Metric Value": dailySheetData.closedCount,
        },
        {
          "Daily Sheet Parameter": "Contact Attempt",
          "Metric Value": dailySheetData.contactAttemptCount,
        },
        {
          "Daily Sheet Parameter": "Total Calls Done",
          "Metric Value": dailySheetData.callsMadeCount,
        },
      ];

      // 2. Daily Leads Details Sheet
      const detailRows = dailySheetData.dateLeads.map((lead, idx) => ({
        "S.No": idx + 1,
        "Unique ID": lead.uniqueId || "-",
        "Date": lead.date || "-",
        "Time Stamp": lead.leadTimestamp || "-",
        "Patient Name": lead.patientName || "-",
        "Mobile Number": lead.mobileNumber || "-",
        "Caller Name": lead.callerName || "-",
        "Location": lead.location || lead.otherCity || "-",
        "Looking For Treatment": lead.lookingForTreatment || "-",
        "Sub Dispositions": lead.subDispositions || "-",
        "Dispositions": lead.dispositions || "-",
        "Valid Status": lead.validStatus || "-",
        "Appointment Date": lead.appointmentDate || "-",
        "Teleconsultation Slot": lead.teleconsultationSlot || "-",
        "Surgery Date": lead.surgeryDate || "-",
        "Surgery Cost": lead.surgeryCost || "-",
        "Lead Source": lead.leadSource || "-",
      }));

      const workbook = XLSX.utils.book_new();

      // Summary Worksheet
      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet["!cols"] = [{ wch: 30 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Daily KPI Summary");

      // Details Worksheet
      if (detailRows.length > 0) {
        const detailsSheet = XLSX.utils.json_to_sheet(detailRows);
        const colWidths = Object.keys(detailRows[0] || {}).map((k) => ({
          wch: Math.max(k.length + 3, 15),
        }));
        detailsSheet["!cols"] = colWidths;
        XLSX.utils.book_append_sheet(workbook, detailsSheet, "Assigned Leads List");
      }

      const fileName = `Agent_Daily_Sheet_${(user?.name || "Agent").replace(
        /\s+/g,
        "_"
      )}_${selectedDateFormatted || selectedDate}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      setToastMessage(
        `Daily Sheet for ${selectedDateFormatted} downloaded successfully!`
      );
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err: any) {
      console.error("Export daily excel error:", err);
      setToastMessage("Failed to export Excel: " + (err.message || "Unknown error"));
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setExportingExcel(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#cc2727]/30 border-t-[#cc2727] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-black flex overflow-hidden">
      {/* Sidebar with Navigation (Dashboard, All Leads) */}
      <AgentSidebar user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200/20 text-emerald-700">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-black leading-tight">
                Agent Dashboard & Daily Sheet
              </h1>
              <p className="text-[11px] text-gray-500">
                Live performance, daily calling sheet & assigned leads
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
          {/* Toast Message */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <Check className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{toastMessage}</span>
            </div>
          )}

          {/* Important Calling Update Reminder Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border border-amber-500/30 text-amber-200 flex items-start sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/20">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5 sm:mt-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-black text-xs sm:text-sm flex items-center gap-2">
                  <span>Call Logging Rule &amp; Reminder</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Important
                  </span>
                </p>
                <p className="text-xs text-black leading-relaxed">
                  On each call with a patient, you must update either <strong className="text-amber-300 font-semibold">Notes &amp; Observations</strong> or <strong className="text-amber-300 font-semibold">Sub Dispositions</strong>. If neither field is updated, the call will not be added to your Total Calls.
                </p>
              </div>
            </div>
            <Link
              href="/agent/leads"
              className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs font-semibold shrink-0 transition-colors"
            >
              <span>Go to Leads</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          
          {/* ========================================================================= */}
          {/* SECTION 1: LIFETIME OVERALL METRICS (All Assigned Leads Summary) */}
          {/* ========================================================================= */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderKanban className="w-4 h-4 text-emerald-700" />
                <h2 className="text-xs font-bold text-black uppercase tracking-wider">
                  Lifetime Assigned Leads Performance
                </h2>
              </div>
              <Link
                href="/agent/leads"
                className="text-xs text-[#cc2727] hover:text-[#b02121] font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>View All Leads</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* 6 Overall Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {/* 1. Total Assigned Leads */}
              <div className="p-4 sm:p-5 bg-white border border-slate-200 rounded-2xl shadow-lg hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">
                    Total Assigned Leads
                  </span>
                  <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {overallMetrics.totalAssigned}
                  </span>
                  <p className="text-[11px] text-black mt-1">
                    All assigned to {user?.name || "you"}
                  </p>
                </div>
              </div>

              {/* 2. Total Appointment Booked */}
              <div className="p-4 sm:p-5 bg-white border border-violet-500/20 rounded-2xl shadow-lg hover:border-violet-500/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-violet-400">
                    Appointment Booked
                  </span>
                  <div className="p-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-200">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {overallMetrics.appointmentBooked}
                  </span>
                  <p className="text-[11px] text-violet-400/90 font-medium mt-1">
                    {overallMetrics.appointmentRate}% Booked Rate
                  </p>
                </div>
              </div>

              {/* 3. Total Converted */}
              <div className="p-4 sm:p-5 bg-white border border-emerald-200/20 rounded-2xl shadow-lg hover:border-emerald-200/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700">
                    Total Converted
                  </span>
                  <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {overallMetrics.converted}
                  </span>
                  <p className="text-[11px] text-emerald-700/90 font-medium mt-1">
                    {overallMetrics.conversionRate}% Conversion Rate
                  </p>
                </div>
              </div>

              {/* 4. Total Contact Attempt */}
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
                    {overallMetrics.contactAttempt}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Ringing / Not reachable
                  </p>
                </div>
              </div>

              {/* 5. Total Contacted */}
              <div className="p-4 sm:p-5 bg-white border border-sky-500/20 rounded-2xl shadow-lg hover:border-sky-500/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-400">
                    Total Contacted
                  </span>
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {overallMetrics.contacted}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Successfully connected
                  </p>
                </div>
              </div>

              {/* 6. Total Closed */}
              <div className="p-4 sm:p-5 bg-white border border-rose-500/20 rounded-2xl shadow-lg hover:border-rose-500/30 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-400">
                    Total Closed
                  </span>
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {overallMetrics.closed}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Lost / Closed leads
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 2: DAILY CALLING & PERFORMANCE SHEET (Interactive Date Filter + Excel Export) */}
          {/* ========================================================================= */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
            {/* Daily Sheet Header Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h2 className="text-base font-bold text-black tracking-wide">
                    Agent Daily Sheet & Calling Performance
                  </h2>
                </div>
                <p className="text-xs text-gray-500">
                  Select any date to view daily calls made, assigned leads, booked appointments, and disposition metrics.
                </p>
              </div>

              {/* Date Filter & Export Button Controls */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Input */}
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-inner">
                  <Calendar className="w-4 h-4 text-[#cc2727] shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-[10px] text-black font-semibold uppercase leading-tight">
                      Filter Date:
                    </span>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="bg-transparent text-black text-xs font-semibold focus:outline-none [color-scheme:light] cursor-pointer"
                    />
                  </div>
                  {selectedDate !== getTodayISODate() && (
                    <button
                      type="button"
                      onClick={() => setSelectedDate(getTodayISODate())}
                      className="ml-1 p-1 text-gray-500 hover:text-black rounded-md hover:bg-slate-100 transition-colors"
                      title="Reset to Today"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Export Daily Sheet in Excel */}
                <button
                  type="button"
                  onClick={handleExportDailyExcel}
                  disabled={exportingExcel}
                  className="py-2 px-4 bg-[#cc2727] hover:bg-[#b02121] disabled:opacity-50 text-black text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-[#cc2727]/20 transition-all active:scale-95 cursor-pointer shrink-0"
                  title="Export Daily Calling Sheet to Microsoft Excel (.xlsx)"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>
                    {exportingExcel ? "Generating..." : "Export Daily Sheet"}
                  </span>
                </button>
              </div>
            </div>

            {/* Active Date Banner Info */}
            <div className="flex flex-wrap items-center justify-between text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-black">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                <span>Showing calling report for:</span>
                <span className="font-bold text-black font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                  {selectedDateFormatted || selectedDate}
                </span>
                {selectedDate === getTodayISODate() && (
                  <span className="text-[10px] uppercase font-bold text-[#cc2727] bg-[#cc2727]/10 px-2 py-0.5 rounded-full border border-[#cc2727]/20">
                    Today
                  </span>
                )}
              </div>
              <span className="text-gray-600 font-medium">
                Caller: <strong className="text-black">{user?.name}</strong>
              </span>
            </div>

            {/* 6 Daily Sheet Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
              {/* 1. Daily Leads Assigned */}
              <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-black">
                    Assigned Leads
                  </span>
                  <div className="p-2 rounded-xl bg-slate-100 text-black border border-slate-300">
                    <FolderKanban className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {dailySheetData.assignedCount}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Assigned on {selectedDateFormatted}
                  </p>
                </div>
              </div>

              {/* 2. Daily Appointment Booked (From Sub Dispositions) */}
              <div className="p-4 bg-white border border-violet-200 rounded-2xl shadow-sm hover:border-violet-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-violet-300">
                    Appointment Booked
                  </span>
                  <div className="p-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-200">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {dailySheetData.appointmentBookedCount}
                  </span>
                  <p className="text-[11px] text-violet-400/90 font-medium mt-0.5">
                    Sub Disposition Booked
                  </p>
                </div>
              </div>

              {/* 3. Daily Converted (From Dispositions) */}
              <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700">
                    Total Converted
                  </span>
                  <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {dailySheetData.convertedCount}
                  </span>
                  <p className="text-[11px] text-emerald-700/90 font-medium mt-0.5">
                    Disposition Converted
                  </p>
                </div>
              </div>

              {/* 4. Daily Contacted (From Dispositions) */}
              <div className="p-4 bg-white border border-sky-200 rounded-2xl shadow-sm hover:border-sky-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-300">
                    Total Contacted
                  </span>
                  <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {dailySheetData.contactedCount}
                  </span>
                  <p className="text-[11px] text-sky-400/90 font-medium mt-0.5">
                    Connected with patient
                  </p>
                </div>
              </div>

              {/* 5. Daily Closed (From Dispositions) */}
              <div className="p-4 bg-white border border-rose-200 rounded-2xl shadow-sm hover:border-rose-300 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-300">
                    Total Closed
                  </span>
                  <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                    <XCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {dailySheetData.closedCount}
                  </span>
                  <p className="text-[11px] text-rose-400/90 font-medium mt-0.5">
                    Lost / Closed records
                  </p>
                </div>
              </div>

              {/* 6. Total Calls Made on Date */}
              <div className="p-4 bg-white border border-[#cc2727]/30 rounded-2xl shadow-md hover:border-indigo-500/50 transition-all flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#cc2727]">
                    Total Calls Done
                  </span>
                  <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <Phone className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2.5">
                  <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                    {dailySheetData.callsMadeCount}
                  </span>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Notes & Sub Disposition updates
                  </p>
                </div>
              </div>
            </div>

            {/* Daily Assigned Leads Mini Table Preview */}
            <div className="pt-2">
              <div className="flex items-center justify-between pb-3">
                <span className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-2">
                  <span>Leads for {selectedDateFormatted}</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-black text-[11px] font-mono">
                    {dailySheetData.dateLeads.length} leads
                  </span>
                </span>
                <Link
                  href="/agent/leads"
                  className="text-xs text-[#cc2727] hover:text-[#b02121] font-semibold inline-flex items-center gap-1 transition-colors"
                >
                  <span>Open Full Leads Table</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {dailySheetData.dateLeads.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-gray-500 text-xs">
                  No leads assigned or recorded on {selectedDateFormatted}. Try selecting a different date from the date picker above.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-white/90 text-gray-500 border-b border-slate-200 text-[11px] font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Unique ID</th>
                        <th className="py-2.5 px-3">Patient Name</th>
                        <th className="py-2.5 px-3">Mobile #</th>
                        <th className="py-2.5 px-3">Location</th>
                        <th className="py-2.5 px-3">Sub Dispositions</th>
                        <th className="py-2.5 px-3">Dispositions</th>
                        <th className="py-2.5 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white font-medium">
                      {dailySheetData.dateLeads.slice(0, 5).map((lead) => (
                        <tr
                          key={lead._id || lead.uniqueId}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-2 px-3 font-mono font-bold text-[#cc2727]">
                            {lead.uniqueId}
                          </td>
                          <td className="py-2 px-3 text-black font-semibold">
                            {lead.patientName || "-"}
                          </td>
                          <td className="py-2 px-3 font-mono text-black">
                            {lead.mobileNumber || "-"}
                          </td>
                          <td className="py-2 px-3 text-gray-500">
                            {lead.location || lead.otherCity || "-"}
                          </td>
                          <td className="py-2 px-3 text-violet-300">
                            {lead.subDispositions || "-"}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                lead.dispositions === "Converted"
                                  ? "bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20"
                                  : lead.dispositions === "Contacted"
                                  ? "bg-sky-50 text-sky-700 border border-sky-200"
                                  : lead.dispositions === "Closed"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {lead.dispositions || "-"}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <Link
                              href={`/agent/leads/${lead.uniqueId || lead._id}`}
                              className="text-[#cc2727] hover:text-[#b02121] text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <span>Edit</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dailySheetData.dateLeads.length > 5 && (
                    <div className="p-2.5 text-center bg-white border-t border-slate-200 text-[11px] text-gray-500">
                      Showing 5 of {dailySheetData.dateLeads.length} leads. Use &quot;Export Daily Sheet&quot; to download the complete list in Excel.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions & Assigned Leads Shortcut Banner */}
          <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/30 border border-slate-200 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[#cc2727] text-xs font-bold uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" />
                <span>Agent Performance Hub</span>
              </div>
              <h3 className="text-lg font-bold text-black">
                Manage all your assigned leads in real-time
              </h3>
              <p className="text-xs text-gray-500 max-w-xl">
                Aapke paas total {overallMetrics.totalAssigned} assigned leads hain. Patient calls karke call dispositions update karein aur dates schedule karein.
              </p>
            </div>

            <Link
              href="/agent/leads"
              className="px-5 py-2.5 bg-[#cc2727] hover:bg-[#b02121] text-black text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-[#cc2727]/20 transition-all active:scale-95 shrink-0"
            >
              <FolderKanban className="w-4 h-4" />
              <span>Open All Leads</span>
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
