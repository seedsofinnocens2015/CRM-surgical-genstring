"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Trash2,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  KeyRound,
  AlertTriangle,
  FolderKanban,
  Clock,
  Power,
  UserPlus,
  Layers,
  CalendarCheck,
  CheckCircle2,
  PhoneCall,
  XCircle,
  FileSpreadsheet,
  RotateCcw,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import TeamLeaderSidebar from "@/app/components/TeamLeaderSidebar";
import Footer from "@/app/components/Footer";
import BulkAssignModal from "@/app/components/BulkAssignModal";
import {
  getTodayDDMMMYY,
  formatDateToDDMMMYY,
  parseDDMMMYYToISO,
} from "@/lib/leadOptions";

export default function TeamLeaderMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const memberId = resolvedParams.id;
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

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

function getTodayISODate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    role: "agent",
    status: "active",
    password: "",
    createdAt: "",
  });

  // Leads state for bulk assignment & assigned metrics
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);

  // Daily Sheet Date Filter & Export state
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISODate());
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Check Auth (Team Leader)
        const meRes = await fetch("/api/auth/me");
        if (!meRes.ok) {
          router.push("/team-leader/login");
          return;
        }
        const meData = await meRes.json();
        if (!meData.user || meData.user.role !== "team_leader") {
          router.push("/team-leader/login");
          return;
        }
        setUser(meData.user);

        // 2. Fetch Member Details
        const memberRes = await fetch(`/api/admin/members/${memberId}`, {
          cache: "no-store",
        });
        if (!memberRes.ok) {
          throw new Error("Agent member not found or access denied");
        }
        const memberData = await memberRes.json();
        const m = memberData.member;
        if (m) {
          // Team leader can only view/edit agent
          if (m.role !== "agent") {
            router.push("/team-leader/members");
            return;
          }

          setFormData({
            name: m.name || "",
            mobile: m.mobile || "",
            email: m.email || "",
            role: "agent",
            status: m.status || "active",
            password: "",
            createdAt: m.createdAt || "",
          });
        }

        // 3. Fetch all leads for stats & bulk assignment pool
        await refreshLeads();
      } catch (err: any) {
        setError(err.message || "Failed to load agent profile");
      } finally {
        setLoading(false);
      }
    }

    loadData();

    // Listen for lead updates across tabs or within app
    const handleSync = () => {
      refreshLeads();
    };
    window.addEventListener("lead_updated", handleSync);
    window.addEventListener("storage", handleSync);
    return () => {
      window.removeEventListener("lead_updated", handleSync);
      window.removeEventListener("storage", handleSync);
    };
  }, [memberId, router]);

  const refreshLeads = async () => {
    try {
      const leadsRes = await fetch("/api/admin/leads", { cache: "no-store" });
      if (leadsRes.ok) {
        const ld = await leadsRes.json();
        setAllLeads(ld.leads || []);
      }
    } catch {
      // ignore
    }
  };

  // Compute Daily & Lifetime assigned leads for this agent
  const todayStr = getTodayDDMMMYY();
  const agentNameLower = (formData.name || "").trim().toLowerCase();

  const assignedToThisAgent = allLeads.filter(
    (lead: any) =>
      (lead.callerName || "").trim().toLowerCase() === agentNameLower &&
      agentNameLower !== ""
  );

  const totalAssignedCount = assignedToThisAgent.length;

  const todayAssignedCount = assignedToThisAgent.filter((lead: any) => {
    const aDate = lead.assignedDate || lead.date || "";
    return aDate === todayStr;
  }).length;

  // Selected Date Formatting & Filter Match
  const selectedDateFormatted = selectedDate
    ? formatDateToDDMMMYY(selectedDate)
    : ""; // e.g. "28-Sep-26"

  // Daily Sheet Metrics & Leads for this agent on the selected date
  const dailySheetData = (() => {
    if (!selectedDate || formData.role !== "agent") {
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

    const targetFormatted = (selectedDateFormatted || "").toLowerCase();
    const targetISO = selectedDate;

    // 1. Leads assigned to this specific agent on the selected date
    const dateAssignedLeads = assignedToThisAgent.filter((lead: any) => {
      if (
        lead.assignedDate &&
        lead.assignedDate.trim().toLowerCase() === targetFormatted
      ) {
        return true;
      }
      if (lead.assignedAt) {
        const aISO = new Date(lead.assignedAt).toISOString().slice(0, 10);
        if (aISO === targetISO) return true;
      }
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

    dateAssignedLeads.forEach((lead: any) => {
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
    // Distinct patient leads whose Notes or Sub Dispositions were updated by this agent on that date
    let distinctCalledPatientsCount = 0;

    assignedToThisAgent.forEach((lead: any) => {
      let patientCalledOnDate = false;

      (lead.auditLogs || []).forEach((log: any) => {
        const logDateISO = new Date(log.timestamp).toISOString().slice(0, 10);
        const performedByName = (log.performedBy || "").trim().toLowerCase();
        if (
          logDateISO === targetISO &&
          (!agentNameLower || performedByName === agentNameLower)
        ) {
          const hasNotesOrSubDispUpdate = (log.changes || []).some((c: any) =>
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

    return {
      dateLeads: dateAssignedLeads,
      assignedCount: dateAssignedLeads.length,
      callsMadeCount: distinctCalledPatientsCount,
      appointmentBookedCount,
      convertedCount,
      contactedCount,
      closedCount,
      contactAttemptCount,
    };
  })();

  // Export Daily Sheet to Excel (.xlsx)
  const handleExportDailyExcel = async () => {
    try {
      setExportingExcel(true);
      const XLSX = await import("xlsx");

      const summaryRows = [
        {
          "Daily Sheet Parameter": "Agent Name",
          "Metric Value": formData.name || "Agent",
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

      const detailRows = dailySheetData.dateLeads.map((lead: any, idx: number) => ({
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

      const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
      summarySheet["!cols"] = [{ wch: 30 }, { wch: 25 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Daily KPI Summary");

      if (detailRows.length > 0) {
        const detailsSheet = XLSX.utils.json_to_sheet(detailRows);
        const colWidths = Object.keys(detailRows[0] || {}).map((k) => ({
          wch: Math.max(k.length + 3, 15),
        }));
        detailsSheet["!cols"] = colWidths;
        XLSX.utils.book_append_sheet(workbook, detailsSheet, "Assigned Leads List");
      }

      const fileName = `Agent_Daily_Sheet_${(formData.name || "Agent").replace(
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

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/team-leader/login");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({ ...prev, mobile: raw }));
  };

  const handleToggleStatus = () => {
    setFormData((prev) => ({
      ...prev,
      status: prev.status === "inactive" ? "active" : "inactive",
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload: any = {
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        email: formData.email.trim(),
        role: "agent", // locked to agent
        status: formData.status,
      };

      if (formData.password.trim()) {
        payload.password = formData.password.trim();
      }

      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save agent details");
      }

      setFormData((prev) => ({ ...prev, password: "" }));
      setToastMessage("Agent profile updated successfully!");
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update agent");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/members/${memberId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete agent");
      }

      router.push("/team-leader/members");
    } catch (err: any) {
      setError(err.message || "Failed to delete agent");
      setDeleting(false);
      setIsConfirmDeleteOpen(false);
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
    <div className="min-h-screen bg-slate-50 text-black flex">
      {/* Sidebar */}
      <TeamLeaderSidebar user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link
              href="/team-leader/members"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-black hover:text-black border border-slate-200 transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Members</span>
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#cc2727] bg-[#cc2727]/10 px-2.5 py-0.5 rounded-lg border border-[#cc2727]/20">
                AGENT
              </span>
              <h1 className="text-sm sm:text-base font-bold text-black truncate max-w-[200px] sm:max-w-md">
                {formData.name || "Agent Profile"}
              </h1>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setIsBulkAssignOpen(true)}
              className="py-2 px-3.5 bg-[#cc2727] hover:bg-[#b02121] text-black text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-[#cc2727]/20 transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Bulk Assign Leads</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="py-2 px-4 bg-[#cc2727] hover:bg-[#b02121] text-black text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-[#cc2727]/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </header>

        {/* Profile Body */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl w-full mx-auto">
          {/* Toast Message */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium">{toastMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Member Hero Card */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-extrabold text-3xl uppercase shadow-sm shrink-0 bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                {formData.name ? formData.name.charAt(0) : "A"}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-bold text-black">
                    {formData.name || "Unnamed Agent"}
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-[#cc2727]/10 text-[#cc2727] border-[#cc2727]/20">
                    <User className="w-3.5 h-3.5" />
                    Agent
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-black">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                    {formData.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    {formData.mobile || "No mobile"}
                  </span>
                  {formData.createdAt && (
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      Joined: {new Date(formData.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions & Status */}
            <div className="sm:self-center flex flex-col items-start sm:items-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsBulkAssignOpen(true)}
                className="py-2 px-4 rounded-xl text-xs font-semibold flex items-center gap-2 bg-[#cc2727] hover:bg-[#b02121] text-black shadow-md shadow-[#cc2727]/20 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Bulk Assign Leads</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">
                  Status:
                </span>
                <button
                  type="button"
                  onClick={handleToggleStatus}
                  className={`py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer shadow-sm ${
                    formData.status === "inactive"
                      ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>
                    {formData.status === "inactive" ? "Inactive / Blocked" : "Active"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Today's Assigned Leads */}
            <div className="p-4 bg-white border border-[#cc2727]/30 rounded-2xl shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#cc2727] font-semibold flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#cc2727]" />
                  Today Assigned Leads
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                  {todayStr}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-black">
                  {todayAssignedCount}
                </span>
                <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                  <Layers className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-1.5">
                Leads allocated to this agent today
              </p>
            </div>

            {/* Total Lifetime Assigned Leads */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <span className="text-xs text-black font-medium flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-gray-600" />
                Total Assigned Leads
              </span>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-3xl font-bold font-mono text-black">
                  {totalAssignedCount}
                </span>
                <div className="p-2 rounded-xl bg-slate-100 text-black border border-slate-200">
                  <FolderKanban className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-1.5">
                Total lifetime leads assigned to this agent
              </p>
            </div>

            {/* System Role */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <span className="text-xs text-black font-medium">System Role</span>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="text-xl font-bold text-black capitalize">Agent</span>
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <User className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-1.5">Calling & patient lead handling</p>
            </div>

            {/* Login Access */}
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <span className="text-xs text-black font-medium">Portal Access</span>
              <div className="mt-3 flex items-baseline justify-between">
                <span
                  className={`text-xl font-bold ${
                    formData.status === "inactive" ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {formData.status === "inactive" ? "Blocked" : "Enabled"}
                </span>
                <div
                  className={`p-2 rounded-xl border ${
                    formData.status === "inactive"
                      ? "bg-rose-50 text-rose-600 border-rose-200"
                      : "bg-emerald-50 text-emerald-600 border-emerald-200"
                  }`}
                >
                  <Power className="w-4 h-4" />
                </div>
              </div>
              <p className="text-[11px] text-gray-600 mt-1.5">Agent login active status</p>
            </div>
          </div>

          {/* Assigned Leads Preview for Agent */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-sm font-bold text-black flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-[#cc2727]" />
                  <span>Assigned Leads To {formData.name}</span>
                  <span className="text-xs font-mono font-normal text-gray-600">
                    ({assignedToThisAgent.length} leads)
                  </span>
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  Leads currently assigned to this agent. Today's assigned:{" "}
                  <strong className="text-[#cc2727] font-mono">{todayAssignedCount}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkAssignOpen(true)}
                className="py-2 px-3.5 bg-[#cc2727] hover:bg-[#b02121] text-black text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer self-start sm:self-auto shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Assign More Leads</span>
              </button>
            </div>

            {assignedToThisAgent.length === 0 ? (
              <div className="text-center py-8 text-gray-600 text-xs">
                No leads currently assigned to this agent. Click{" "}
                <button
                  type="button"
                  onClick={() => setIsBulkAssignOpen(true)}
                  className="text-[#cc2727] hover:underline font-semibold"
                >
                  Bulk Assign Leads
                </button>{" "}
                to allocate leads.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-black text-[11px] uppercase tracking-wider sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Lead ID</th>
                      <th className="py-2.5 px-3">Patient Name</th>
                      <th className="py-2.5 px-3">Contact</th>
                      <th className="py-2.5 px-3">Treatment</th>
                      <th className="py-2.5 px-3">Disposition</th>
                      <th className="py-2.5 px-3">Assigned Date</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {assignedToThisAgent.slice(0, 50).map((l: any) => (
                      <tr key={l.uniqueId || l._id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-semibold text-[#cc2727]">
                          {l.uniqueId}
                        </td>
                        <td className="py-2.5 px-3 text-black font-medium">
                          {l.patientName || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-black font-mono">
                          {l.mobileNumber || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-black">
                          {l.lookingForTreatment || "-"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-black border border-slate-200">
                            {l.dispositions || "New Lead"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-gray-600 font-mono text-[11px]">
                          {l.assignedDate || l.date || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={`/team-leader/leads/${l.uniqueId}`}
                            className="text-[#cc2727] hover:text-[#b02121] hover:underline font-semibold"
                          >
                            View Lead
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {assignedToThisAgent.length > 50 && (
                  <div className="py-2 px-3 text-center text-[11px] text-gray-600 bg-slate-50 border-t border-slate-200">
                    Showing latest 50 of {assignedToThisAgent.length} leads
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* AGENT DAILY SHEET & CALLING PERFORMANCE (Visible for Agent profiles) */}
          {/* ========================================================================= */}
          {formData.role === "agent" && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
              {/* Daily Sheet Header Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h2 className="text-base font-bold text-black tracking-wide">
                      Agent Daily Sheet & Calling Performance
                    </h2>
                  </div>
                  <p className="text-xs text-gray-600">
                    Select any date to view daily calls made, assigned leads, booked appointments, and disposition metrics for {formData.name || "this agent"}.
                  </p>
                </div>

                {/* Date Filter & Export Button Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Date Input */}
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-xl shadow-inner">
                    <Calendar className="w-4 h-4 text-[#cc2727] shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-600 font-semibold uppercase leading-tight">
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
                        className="ml-1 p-1 text-gray-600 hover:text-black rounded-md hover:bg-slate-200 transition-colors"
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
                  Caller: <strong className="text-black">{formData.name}</strong>
                </span>
              </div>

              {/* 6 Daily Sheet Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
                {/* 1. Daily Leads Assigned */}
                <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-black">Assigned Leads</span>
                    <div className="p-2 rounded-xl bg-slate-100 text-black border border-slate-200">
                      <FolderKanban className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                      {dailySheetData.assignedCount}
                    </span>
                    <p className="text-[11px] text-gray-600 mt-0.5">Assigned on {selectedDateFormatted}</p>
                  </div>
                </div>

                {/* 2. Daily Appointment Booked */}
                <div className="p-4 bg-white border border-violet-200 rounded-2xl shadow-sm hover:border-violet-300 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-violet-700">Appointment Booked</span>
                    <div className="p-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-200">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                      {dailySheetData.appointmentBookedCount}
                    </span>
                    <p className="text-[11px] text-violet-600 font-medium mt-0.5">Sub Disposition Booked</p>
                  </div>
                </div>

                {/* 3. Daily Converted */}
                <div className="p-4 bg-white border border-emerald-200 rounded-2xl shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-700">Total Converted</span>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                      {dailySheetData.convertedCount}
                    </span>
                    <p className="text-[11px] text-emerald-600 font-medium mt-0.5">Disposition Converted</p>
                  </div>
                </div>

                {/* 4. Daily Contacted */}
                <div className="p-4 bg-white border border-sky-200 rounded-2xl shadow-sm hover:border-sky-300 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-sky-700">Total Contacted</span>
                    <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-200">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                      {dailySheetData.contactedCount}
                    </span>
                    <p className="text-[11px] text-sky-600 font-medium mt-0.5">Connected with patient</p>
                  </div>
                </div>

                {/* 5. Daily Closed */}
                <div className="p-4 bg-white border border-rose-200 rounded-2xl shadow-sm hover:border-rose-300 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-rose-700">Total Closed</span>
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
                      <XCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                      {dailySheetData.closedCount}
                    </span>
                    <p className="text-[11px] text-rose-600 font-medium mt-0.5">Lost / Closed records</p>
                  </div>
                </div>

                {/* 6. Total Calls Made */}
                <div className="p-4 bg-white border border-[#cc2727]/30 rounded-2xl shadow-sm hover:border-[#cc2727]/50 transition-all flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#cc2727]">Total Calls Done</span>
                    <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <span className="text-2xl sm:text-3xl font-extrabold text-black font-mono tracking-tight">
                      {dailySheetData.callsMadeCount}
                    </span>
                    <p className="text-[11px] text-gray-600 mt-0.5">Notes & Sub Disposition updates</p>
                  </div>
                </div>
              </div>

              {/* Daily Assigned Leads Mini Table Preview */}
              <div className="pt-2">
                <div className="flex items-center justify-between pb-3">
                  <span className="text-xs font-bold text-black uppercase tracking-wider flex items-center gap-2">
                    <span>Leads for {selectedDateFormatted}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-black text-[11px] font-mono border border-slate-200">
                      {dailySheetData.dateLeads.length} leads
                    </span>
                  </span>
                  <Link
                    href="/team-leader/leads"
                    className="text-xs text-[#cc2727] hover:text-[#b02121] font-semibold inline-flex items-center gap-1 transition-colors"
                  >
                    <span>Open Full Leads Table</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {dailySheetData.dateLeads.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-gray-600 text-xs">
                    No leads assigned or recorded on {selectedDateFormatted} for this agent. Try selecting a different date from the date picker above.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-50 text-black border-b border-slate-200 text-[11px] font-semibold uppercase">
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
                        {dailySheetData.dateLeads.slice(0, 10).map((lead: any) => (
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
                            <td className="py-2 px-3 text-black">
                              {lead.location || lead.otherCity || "-"}
                            </td>
                            <td className="py-2 px-3 text-violet-700">
                              {lead.subDispositions || "-"}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  lead.dispositions === "Converted"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
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
                                href={`/team-leader/leads/${lead.uniqueId || lead._id}`}
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
                    {dailySheetData.dateLeads.length > 10 && (
                      <div className="py-2 px-3 text-center text-[11px] text-gray-600 bg-slate-50 border-t border-slate-200">
                        Showing first 10 of {dailySheetData.dateLeads.length} leads for this date
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Edit Form */}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#cc2727]" />
                  <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                    Agent Credentials & Information
                  </h3>
                </div>
                <span className="text-xs text-gray-600">
                  Edit fields below and click Save Changes
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727]"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727]"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Mobile Number (10 digits)
                  </label>
                  <input
                    type="tel"
                    name="mobile"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={handlePhoneChange}
                    placeholder="e.g. 9876543210"
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727]"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Account Status *
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727]"
                  >
                    <option value="active">Active (Full Access)</option>
                    <option value="inactive">Inactive (Access Blocked)</option>
                  </select>
                </div>

                {/* Reset Password */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-black mb-1.5 flex items-center justify-between">
                    <span>Reset Password</span>
                    <span className="text-[11px] text-gray-600 font-normal">
                      Leave blank to keep current password
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Enter new password to reset for this agent"
                      className="w-full pl-9 pr-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727]"
                    />
                    <KeyRound className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between p-4 bg-white/90 border border-slate-200 rounded-2xl sticky bottom-4 z-20 backdrop-blur-md shadow-lg">
              <span className="text-xs text-black">
                Updating profile for: <strong className="text-black">{formData.name}</strong>
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href="/team-leader/members"
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-xl transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="py-2.5 px-5 bg-[#cc2727] hover:bg-[#b02121] text-black text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-[#cc2727]/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          </form>
        </main>
        <Footer />
      </div>

      {/* Bulk Assign Modal (Agents) */}
      <BulkAssignModal
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        agentId={memberId}
        agentName={formData.name}
        allLeads={allLeads}
        onAssignedSuccess={async (count) => {
          setToastMessage(`Successfully assigned ${count} lead(s) to agent ${formData.name}!`);
          setTimeout(() => setToastMessage(""), 5000);
          await refreshLeads();
        }}
      />
    </div>
  );
}
