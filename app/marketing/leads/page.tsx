"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  FolderKanban,
  UserPlus,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  Search,
  ChevronRight,
  User,
  Hash,
  Trash2,
  AlertCircle,
  Activity,
  FileText,
  Stethoscope,
  SlidersHorizontal,
  Check,
  Filter,
  RotateCcw,
  X,
  ChevronDown,
  Sliders,
  Download,
  FileSpreadsheet,
  ArrowDownToLine,
  Upload,
  ChevronLeft,
} from "lucide-react";
import MarketingSidebar from "@/app/components/MarketingSidebar";
import Footer from "@/app/components/Footer";
import AddLeadModal from "@/app/components/AddLeadModal";
import UploadLeadsModal from "@/app/components/UploadLeadsModal";
import LeadSquaredFilter from "@/app/components/LeadSquaredFilter";
import ManageColumnsModal, { ColumnItem } from "@/app/components/ManageColumnsModal";
import { renderLeadTableCell } from "@/app/components/LeadTableCellRenderer";
import {
  LOCATIONS,
  TREATMENTS,
  LEAD_SOURCES,
  SUB_DISPOSITIONS,
  parseDDMMMYYToISO,
  notifyLeadUpdated,
} from "@/lib/leadOptions";
import {
  getCachedLeads,
  setCachedLeads,
  setCachedLeadDetail,
} from "@/lib/leadsCache";

interface ColumnConfig {
  id: string;
  label: string;
}

export interface LeadFilters {
  leadEntryDateFrom: string;
  leadEntryDateTo: string;
  location: string;
  callerName: string;
  leadSource: string;
  treatment: string;
  followUpDateFrom: string;
  followUpDateTo: string;
  subDispositions: string;
  dispositions: string;
  validStatus: string;
  appointmentDateFrom: string;
  appointmentDateTo: string;
  surgeryDateFrom: string;
  surgeryDateTo: string;
  quickMetricFilter?: string;
}

export const initialFilters: LeadFilters = {
  leadEntryDateFrom: "",
  leadEntryDateTo: "",
  location: "",
  callerName: "",
  leadSource: "",
  treatment: "",
  followUpDateFrom: "",
  followUpDateTo: "",
  subDispositions: "",
  dispositions: "",
  validStatus: "",
  appointmentDateFrom: "",
  appointmentDateTo: "",
  surgeryDateFrom: "",
  surgeryDateTo: "",
  quickMetricFilter: "",
};

function normalizeDateStr(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  let trimmed = String(dateStr).trim();
  if (trimmed.includes(",")) {
    trimmed = trimmed.split(",")[0].trim();
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  const iso = parseDDMMMYYToISO(trimmed);
  if (iso) return iso;
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return "";
}

function matchesDateRange(
  dateVal: string | undefined | null,
  fromIso: string,
  toIso: string
): boolean {
  if (!fromIso && !toIso) return true;
  if (!dateVal) return false;
  const iso = normalizeDateStr(dateVal);
  if (!iso) return false;
  if (fromIso && iso < fromIso) return false;
  if (toIso && iso > toIso) return false;
  return true;
}

const TABLE_COLUMNS: ColumnConfig[] = [
  { id: "patientName", label: "Patient Name" },
  { id: "patientAge", label: "Patient Age" },
  { id: "location", label: "Location" },
  { id: "spouseName", label: "Spouse Name" },
  { id: "spouseAge", label: "Spouse Age" },
  { id: "date", label: "Date (DD-MMM-YY)" },
  { id: "leadTimestamp", label: "Time Stamp" },
  { id: "mobileNumber", label: "Mobile Number" },
  { id: "alternateNumber", label: "Alternate #" },
  { id: "callerName", label: "Caller Name" },
  { id: "leadSource", label: "Lead Source" },
  { id: "referredBy", label: "Referred By" },
  { id: "lookingForTreatment", label: "Looking for Treatment" },
  { id: "treatmentRequirements", label: "Treatment Requirements" },
  { id: "preConditions", label: "Pre Conditions" },
  { id: "surgeryDetails", label: "Surgery Details" },
  { id: "followUpDate", label: "Follow Up Date" },
  { id: "subDispositions", label: "Sub Dispositions" },
  { id: "dispositions", label: "Dispositions" },
  { id: "validStatus", label: "Valid Status" },
  { id: "appointmentDate", label: "Appointment Date" },
  { id: "appointmentMonth", label: "Appointment Month" },
  { id: "teleconsultationSlot", label: "Teleconsultation Slot" },
  { id: "consultationCharges", label: "Consultation Charges" },
  { id: "surgeryDate", label: "Surgery Date" },
  { id: "surgeryCost", label: "Surgery Cost" },
  { id: "surgeryPaymentReceived", label: "Surgery Payment Received" },
  { id: "notes", label: "Notes" },
];

export default function MarketingLeadsPage() {
  const router = useRouter();
  // Instant preview from in-memory cache (0ms loading time)
  const cachedInitial = typeof window !== "undefined" ? getCachedLeads("marketing") : null;
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>(() => cachedInitial?.leads || []);
  const [nextUniqueId, setNextUniqueId] = useState<string>(() => cachedInitial?.nextUniqueId || "SC-1");
  const [loading, setLoading] = useState(() => !cachedInitial);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Advanced Filters State with localStorage persistence
  const [filters, setFilters] = useState<LeadFilters>(initialFilters);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Load saved filters on mount or apply filter from URL query param (e.g. from KPI metric cards)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const filterParam = urlParams.get("filter");

      if (filterParam) {
        if (filterParam === "all") {
          setFilters(initialFilters);
          localStorage.removeItem("crm_leads_filters_marketing");
          return;
        }

        let updated = { ...initialFilters };
        if (filterParam === "converted") {
          updated.dispositions = "Converted";
        } else if (filterParam === "contacted") {
          updated.dispositions = "Contacted";
        } else if (filterParam === "contact_attempt") {
          updated.dispositions = "Contact Attempt";
        } else if (filterParam === "closed") {
          updated.dispositions = "Closed";
        } else if (filterParam === "follow_up") {
          updated.quickMetricFilter = "follow_up";
        } else if (filterParam === "unassigned") {
          updated.quickMetricFilter = "unassigned";
        }

        setFilters(updated);
        localStorage.setItem("crm_leads_filters_marketing", JSON.stringify(updated));
        return;
      }

      const savedFilters = localStorage.getItem("crm_leads_filters_marketing");
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        setFilters((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const updateFilter = (key: keyof LeadFilters, value: string) => {
    setFilters((prev) => {
      const updated = { ...prev, [key]: value };
      try {
        localStorage.setItem("crm_leads_filters_marketing", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleResetFilters = () => {
    setFilters(initialFilters);
    try {
      localStorage.removeItem("crm_leads_filters_marketing");
    } catch (e) {}
  };

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    TABLE_COLUMNS.forEach((col) => {
      initial[col.id] = true;
    });
    return initial;
  });
  const [isColumnDropdownOpen, setIsColumnDropdownOpen] = useState(false);
  const [isManageColumnsModalOpen, setIsManageColumnsModalOpen] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>(() => TABLE_COLUMNS.map((c) => c.id));
  const [pinnedColumns, setPinnedColumns] = useState<string[]>([]);
  const [columnSearch, setColumnSearch] = useState("");
  const columnDropdownRef = useRef<HTMLDivElement>(null);

  // Load column preferences from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("crm_leads_visible_columns");
      if (saved) {
        const parsed = JSON.parse(saved);
        setVisibleColumns((prev) => ({ ...prev, ...parsed }));
      }
      const savedOrder = localStorage.getItem("crm_leads_column_order_marketing");
      if (savedOrder) {
        try {
          const parsedOrder = JSON.parse(savedOrder);
          if (Array.isArray(parsedOrder)) setColumnOrder(parsedOrder);
        } catch (e) {}
      }
      const savedPinned = localStorage.getItem("crm_leads_pinned_columns_marketing");
      if (savedPinned) {
        try {
          const parsedPinned = JSON.parse(savedPinned);
          if (Array.isArray(parsedPinned)) setPinnedColumns(parsedPinned);
        } catch (e) {}
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Close column dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        columnDropdownRef.current &&
        !columnDropdownRef.current.contains(event.target as Node)
      ) {
        setIsColumnDropdownOpen(false);
      }
    }
    if (isColumnDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isColumnDropdownOpen]);

  const toggleColumn = (colId: string) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [colId]: !prev[colId] };
      try {
        localStorage.setItem("crm_leads_visible_columns", JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const setAllColumns = (val: boolean) => {
    const updated: Record<string, boolean> = {};
    TABLE_COLUMNS.forEach((col) => {
      updated[col.id] = val;
    });
    setVisibleColumns(updated);
    try {
      localStorage.setItem("crm_leads_visible_columns", JSON.stringify(updated));
    } catch (e) {}
  };

  // Calculate dynamic ordered columns strictly based on user's columnOrder preference
  const orderedColumns = useMemo(() => {
    const all = [...columnOrder];
    TABLE_COLUMNS.forEach((c) => {
      if (!all.includes(c.id)) all.push(c.id);
    });
    return all.filter((id) => visibleColumns[id]);
  }, [columnOrder, visibleColumns]);

  const handleApplyColumns = (
    newVisible: Record<string, boolean>,
    newOrder: string[],
    newPinned?: string[]
  ) => {
    setVisibleColumns(newVisible);
    setColumnOrder(newOrder);
    setPinnedColumns(newPinned || []);
    try {
      localStorage.setItem("crm_leads_visible_columns", JSON.stringify(newVisible));
      localStorage.setItem("crm_leads_column_order_marketing", JSON.stringify(newOrder));
      localStorage.removeItem("crm_leads_pinned_columns_marketing");
    } catch (e) {}
  };

  const handleRestoreDefaultColumns = () => {
    const defVisible: Record<string, boolean> = {};
    const defOrder = TABLE_COLUMNS.map((c) => c.id);
    TABLE_COLUMNS.forEach((c) => {
      defVisible[c.id] = true;
    });
    setVisibleColumns(defVisible);
    setColumnOrder(defOrder);
    setPinnedColumns([]);
    try {
      localStorage.setItem("crm_leads_visible_columns", JSON.stringify(defVisible));
      localStorage.removeItem("crm_leads_column_order_marketing");
      localStorage.removeItem("crm_leads_pinned_columns_marketing");
    } catch (e) {}
  };

  // Download Modal State
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const downloadModalRef = useRef<HTMLDivElement>(null);

  // Table Scroll Container Ref & Last Viewed Lead State
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const [highlightedLeadId, setHighlightedLeadId] = useState<string | null>(null);

  // Save scroll position when navigating to a lead
  const handleOpenLead = (lead: any) => {
    const id = lead.uniqueId || lead._id;
    try {
      if (id) {
        sessionStorage.setItem("crm_last_viewed_lead_marketing", id);
        setCachedLeadDetail(id, lead);
      }
      if (tableScrollRef.current) {
        sessionStorage.setItem("crm_leads_scroll_top_marketing", String(tableScrollRef.current.scrollTop));
      }
    } catch (e) {}
    router.push(`/marketing/leads/${id}`);
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDownloadModalOpen(false);
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (
        downloadModalRef.current &&
        !downloadModalRef.current.contains(e.target as Node)
      ) {
        setIsDownloadModalOpen(false);
      }
    }
    if (isDownloadModalOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDownloadModalOpen]);

  const prepareExportData = () => {
    return filteredLeads.map((lead) => {
      const row: Record<string, any> = {};

      // 1. Unique ID is always included
      row["Unique ID"] = lead.uniqueId || "N/A";

      // 2. Add only currently visible columns
      if (visibleColumns.patientName) row["Patient Name"] = lead.patientName || "-";
      if (visibleColumns.patientAge) row["Patient Age"] = lead.patientAge || "-";
      if (visibleColumns.location) row["Location"] = lead.location || lead.otherCity || "-";
      if (visibleColumns.spouseName) row["Spouse Name"] = lead.spouseName || "-";
      if (visibleColumns.spouseAge) row["Spouse Age"] = lead.spouseAge || "-";
      if (visibleColumns.date) row["Date (DD-MMM-YY)"] = lead.date || lead.dateOfLead || "-";
      if (visibleColumns.leadTimestamp) {
        row["Time Stamp"] =
          lead.leadTimestamp ||
          (lead.createdAt
            ? new Date(lead.createdAt).toLocaleString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : lead.date || "-");
      }
      if (visibleColumns.mobileNumber) row["Mobile Number"] = lead.mobileNumber || lead.phoneNumber || "-";
      if (visibleColumns.alternateNumber) row["Alternate #"] = lead.alternateNumber || "-";
      if (visibleColumns.callerName) row["Caller Name"] = lead.callerName || "-";
      if (visibleColumns.leadSource) row["Lead Source"] = lead.leadSource || "-";
      if (visibleColumns.referredBy) row["Referred By"] = lead.referredBy || "-";
      if (visibleColumns.lookingForTreatment) {
        row["Looking for Treatment"] = lead.lookingForTreatment || lead.treatmentRequired || lead.treatment || "-";
      }
      if (visibleColumns.treatmentRequirements) {
        row["Treatment Requirements"] = lead.treatmentRequirements || lead.treatmentRequired || "-";
      }
      if (visibleColumns.preConditions) row["Pre Conditions"] = lead.preConditions || lead.preCondition || "-";
      if (visibleColumns.surgeryDetails) row["Surgery Details"] = lead.surgeryDetails || lead.surgicalData || "-";
      if (visibleColumns.followUpDate) row["Follow Up Date"] = lead.followUpDate || lead.followUpDates || "-";
      if (visibleColumns.subDispositions) row["Sub Dispositions"] = lead.subDispositions || lead.subDisposition || "-";
      if (visibleColumns.dispositions) row["Dispositions"] = lead.dispositions || lead.disposition || "-";
      if (visibleColumns.validStatus) row["Valid Status"] = lead.validStatus || "-";
      if (visibleColumns.appointmentDate) row["Appointment Date"] = lead.appointmentDate || "-";
      if (visibleColumns.appointmentMonth) row["Appointment Month"] = lead.appointmentMonth || "-";
      if (visibleColumns.teleconsultationSlot) {
        row["Teleconsultation Slot"] = lead.teleconsultationSlot || lead.appointmentSlot || "-";
      }
      if (visibleColumns.consultationCharges) {
        row["Consultation Charges"] =
          lead.consultationCharges || lead.teleConsultationCharges
            ? lead.consultationCharges || lead.teleConsultationCharges
            : "-";
      }
      if (visibleColumns.surgeryDate) row["Surgery Date"] = lead.surgeryDate || "-";
      if (visibleColumns.surgeryCost) row["Surgery Cost"] = lead.surgeryCost || "-";
      if (visibleColumns.surgeryPaymentReceived) {
        row["Surgery Payment Received"] = lead.surgeryPaymentReceived || lead.surgeryReceipt || "-";
      }
      if (visibleColumns.notes) row["Notes"] = lead.notes || "-";

      return row;
    });
  };

  const handleDownloadExcel = async () => {
    if (filteredLeads.length === 0) {
      setToastMessage("No leads available to download with the current filters.");
      setTimeout(() => setToastMessage(""), 4000);
      return;
    }

    try {
      const data = prepareExportData();
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.json_to_sheet(data);

      // Auto-fit column widths
      const colWidths = Object.keys(data[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...data.map((row) => String(row[key] ?? "").length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 12), 45) };
      });
      worksheet["!cols"] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Patient Leads");

      const todayStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(workbook, `patient_leads_${todayStr}.xlsx`);

      setIsDownloadModalOpen(false);
      setToastMessage(`Downloaded ${data.length} leads in Excel (.xlsx) successfully!`);
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err: any) {
      setToastMessage("Failed to export Excel: " + (err.message || "Unknown error"));
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  const handleDownloadCSV = () => {
    if (filteredLeads.length === 0) {
      setToastMessage("No leads available to download with the current filters.");
      setTimeout(() => setToastMessage(""), 4000);
      return;
    }

    try {
      const data = prepareExportData();
      const headers = Object.keys(data[0] || {});
      const csvRows: string[] = [];

      // Header row
      csvRows.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

      // Data rows
      for (const row of data) {
        const values = headers.map((header) => {
          const val = row[header] ?? "";
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(","));
      }

      // Prepend UTF-8 BOM so Excel opens Hindi/special characters without corruption
      const csvContent = "\uFEFF" + csvRows.join("\r\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const todayStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `patient_leads_${todayStr}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsDownloadModalOpen(false);
      setToastMessage(`Downloaded ${data.length} leads in CSV (.csv) successfully!`);
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err: any) {
      setToastMessage("Failed to export CSV: " + (err.message || "Unknown error"));
      setTimeout(() => setToastMessage(""), 4000);
    }
  };

  // Upload / Import Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleLeadsImported = (importedLeads: any[], newNextId: string, deletedCount?: number) => {
    fetchSessionAndLeads();
    notifyLeadUpdated();
    if (newNextId) {
      setNextUniqueId(newNextId);
    }
    const replaceMsg = deletedCount && deletedCount > 0 ? ` (${deletedCount} existing duplicate leads replaced)` : "";
    setToastMessage(`Successfully imported ${importedLeads.length} patient leads${replaceMsg}!`);
    setTimeout(() => setToastMessage(""), 5000);
  };

  // Delete confirmation state
  const [leadToDelete, setLeadToDelete] = useState<any>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchSessionAndLeads = async (isBackground = false) => {
    try {
      // Parallel execution of Marketing Auth and Leads fetch
      const [meRes, leadsRes] = await Promise.all([
        fetch("/api/auth/me"),
        fetch("/api/admin/leads", { cache: "no-store" }),
      ]);

      if (!meRes.ok) {
        router.push("/marketing/login");
        return;
      }
      const meData = await meRes.json();
      if (!meData.user || !["admin", "marketing"].includes(meData.user.role)) {
        router.push("/marketing/login");
        return;
      }
      setUser(meData.user);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        const loadedLeads = leadsData.leads || [];
        setLeads(loadedLeads);
        if (leadsData.nextUniqueId) {
          setNextUniqueId(leadsData.nextUniqueId);
        }
        // Save to cache for instant page switching
        setCachedLeads("marketing", loadedLeads, leadsData.nextUniqueId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndLeads();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/marketing/login");
  };

  const handleLeadAdded = (newLead: any) => {
    setLeads((prev) => [newLead, ...prev]);
    notifyLeadUpdated();
    // Compute next ID
    const match = newLead.uniqueId?.match(/^SC-(\d+)$/i);
    if (match) {
      const nextNum = parseInt(match[1], 10) + 1;
      setNextUniqueId(`SC-${nextNum}`);
    }
    setToastMessage(`Patient lead ${newLead.patientName || newLead.uniqueId} created successfully!`);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleConfirmDelete = async () => {
    if (!leadToDelete) return;
    setDeleting(true);

    try {
      const targetId = leadToDelete.uniqueId || leadToDelete._id;
      const res = await fetch(`/api/admin/leads/${targetId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete lead");
      }

      setLeads((prev) =>
        prev.filter((l) => (l.uniqueId || l._id) !== targetId)
      );
      notifyLeadUpdated();
      setToastMessage(`Lead ${leadToDelete.uniqueId || "record"} deleted successfully!`);
      setTimeout(() => setToastMessage(""), 4000);
      setIsDeleteModalOpen(false);
      setLeadToDelete(null);
    } catch (err: any) {
      setToastMessage(err.message || "Failed to delete lead");
      setTimeout(() => setToastMessage(""), 4000);
    } finally {
      setDeleting(false);
    }
  };

  const distinctLocations = useMemo(() => {
    const set = new Set<string>(LOCATIONS.filter((l) => l !== "Other"));
    leads.forEach((l) => {
      const loc = l.location || l.otherCity;
      if (loc && loc !== "Other") set.add(loc);
    });
    return Array.from(set).sort();
  }, [leads]);

  const distinctCallers = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.callerName) set.add(l.callerName);
    });
    return Array.from(set).sort();
  }, [leads]);

  const distinctLeadSources = useMemo(() => {
    const set = new Set<string>(LEAD_SOURCES);
    leads.forEach((l) => {
      if (l.leadSource) set.add(l.leadSource);
    });
    return Array.from(set).sort();
  }, [leads]);

  const distinctTreatments = useMemo(() => {
    const set = new Set<string>(TREATMENTS.filter((t) => t !== "Other"));
    leads.forEach((l) => {
      const t = l.lookingForTreatment || l.treatmentRequired || l.treatment;
      if (t && t !== "Other") set.add(t);
    });
    return Array.from(set).sort();
  }, [leads]);

  const distinctSubDispositions = useMemo(() => {
    const set = new Set<string>(SUB_DISPOSITIONS);
    leads.forEach((l) => {
      const s = l.subDispositions || l.subDisposition;
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [leads]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.leadEntryDateFrom || filters.leadEntryDateTo) count++;
    if (filters.location) count++;
    if (filters.callerName) count++;
    if (filters.leadSource) count++;
    if (filters.treatment) count++;
    if (filters.followUpDateFrom || filters.followUpDateTo) count++;
    if (filters.subDispositions) count++;
    if (filters.dispositions) count++;
    if (filters.validStatus) count++;
    if (filters.appointmentDateFrom || filters.appointmentDateTo) count++;
    if (filters.surgeryDateFrom || filters.surgeryDateTo) count++;
    if (filters.quickMetricFilter) count++;
    return count;
  }, [filters]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 0. Quick Metric Filter (from Dashboard KPI cards)
      if (filters.quickMetricFilter) {
        if (filters.quickMetricFilter === "follow_up") {
          const hasFollowUp = !!(lead.followUpDate && lead.followUpDate.trim()) || !!(lead.followUpDates && lead.followUpDates.trim());
          if (!hasFollowUp) return false;
        } else if (filters.quickMetricFilter === "unassigned") {
          const disp = (lead.dispositions || lead.disposition || "").trim().toLowerCase();
          const isAssignedCategory =
            disp === "converted" ||
            disp === "contacted" ||
            disp === "contact attempt" ||
            disp.includes("attempt") ||
            disp === "closed";
          if (isAssignedCategory) return false;
        }
      }
      // 1. Text Search Query (Supports multiple space-separated numbers/tokens e.g. "9335920357 9810732822 9891707535")
      if (searchQuery.trim()) {
        const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
        const id = (lead.uniqueId || "").toLowerCase();
        const name = (lead.patientName || "").toLowerCase();
        const phone = (lead.mobileNumber || lead.phoneNumber || "").toLowerCase();
        const altPhone = (lead.alternateNumber || "").toLowerCase();
        const loc = (lead.location || lead.otherCity || "").toLowerCase();
        const treat = (lead.lookingForTreatment || lead.treatmentRequired || lead.treatment || "").toLowerCase();
        const subDisp = (lead.subDispositions || "").toLowerCase();
        const disp = (lead.dispositions || "").toLowerCase();
        const caller = (lead.callerName || "").toLowerCase();
        const source = (lead.leadSource || "").toLowerCase();
        const notes = (lead.notes || "").toLowerCase();

        // Lead matches if ANY of the space-separated tokens matches any field
        const matchesQuery = tokens.some((token) => {
          const cleanToken = token.replace(/\D/g, "");
          const cleanPhone = phone.replace(/\D/g, "");
          const cleanAlt = altPhone.replace(/\D/g, "");

          // If token looks like a phone number (>= 5 digits)
          if (cleanToken.length >= 5) {
            if (cleanPhone.includes(cleanToken) || cleanAlt.includes(cleanToken)) {
              return true;
            }
          }

          return (
            id.includes(token) ||
            name.includes(token) ||
            phone.includes(token) ||
            altPhone.includes(token) ||
            loc.includes(token) ||
            treat.includes(token) ||
            subDisp.includes(token) ||
            disp.includes(token) ||
            caller.includes(token) ||
            source.includes(token) ||
            notes.includes(token)
          );
        });

        if (!matchesQuery) return false;
      }

      // 2. Lead Entry Date wise
      const entryDate = lead.date || lead.dateOfLead || lead.createdAt || lead.leadTimestamp;
      if (!matchesDateRange(entryDate, filters.leadEntryDateFrom, filters.leadEntryDateTo)) {
        return false;
      }

      // 3. Location wise
      if (filters.location) {
        const leadLoc = (lead.location || lead.otherCity || "").toLowerCase();
        if (leadLoc !== filters.location.toLowerCase()) return false;
      }

      // 4. Caller Name wise
      if (filters.callerName) {
        const leadCaller = (lead.callerName || "").toLowerCase();
        if (leadCaller !== filters.callerName.toLowerCase()) return false;
      }

      // 5. Lead Source wise
      if (filters.leadSource) {
        const leadSrc = (lead.leadSource || "").toLowerCase();
        if (leadSrc !== filters.leadSource.toLowerCase()) return false;
      }

      // 6. Treatment wise
      if (filters.treatment) {
        const leadTreat = (lead.lookingForTreatment || lead.treatmentRequired || lead.treatment || "").toLowerCase();
        if (leadTreat !== filters.treatment.toLowerCase()) return false;
      }

      // 7. Follow Up Date wise
      if (!matchesDateRange(lead.followUpDate || lead.followUpDates, filters.followUpDateFrom, filters.followUpDateTo)) {
        return false;
      }

      // 8. Sub Dispositions wise
      if (filters.subDispositions) {
        const leadSub = (lead.subDispositions || lead.subDisposition || "").toLowerCase();
        if (leadSub !== filters.subDispositions.toLowerCase()) return false;
      }

      // 9. Dispositions wise
      if (filters.dispositions) {
        const leadDisp = (lead.dispositions || lead.disposition || "").toLowerCase();
        if (leadDisp !== filters.dispositions.toLowerCase()) return false;
      }

      // 10. Valid Status wise
      if (filters.validStatus) {
        const leadVal = (lead.validStatus || "").toLowerCase();
        if (leadVal !== filters.validStatus.toLowerCase()) return false;
      }

      // 11. Appointment Date wise
      if (!matchesDateRange(lead.appointmentDate, filters.appointmentDateFrom, filters.appointmentDateTo)) {
        return false;
      }

      // 12. Surgery Date wise
      if (!matchesDateRange(lead.surgeryDate, filters.surgeryDateFrom, filters.surgeryDateTo)) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      const numA = parseInt((a.uniqueId || "").replace(/\D/g, ""), 10) || 0;
      const numB = parseInt((b.uniqueId || "").replace(/\D/g, ""), 10) || 0;
      if (numA !== numB) return numB - numA;
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [leads, searchQuery, filters]);

  // High-performance windowed pagination (100 leads per page)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));

  // Reset to page 1 whenever filters or search query change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters]);

  // Keep page within bounds
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredLeads.slice(startIndex, startIndex + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Restore scroll position instantly after data is loaded (clean, professional, no animated jumping)
  useEffect(() => {
    if (loading || filteredLeads.length === 0) return;

    try {
      const savedLeadId = sessionStorage.getItem("crm_last_viewed_lead_marketing");
      const savedScrollTop = sessionStorage.getItem("crm_leads_scroll_top_marketing");

      if (savedLeadId) {
        setHighlightedLeadId(savedLeadId);
      }

      // Restore exact scroll position instantly
      requestAnimationFrame(() => {
        if (tableScrollRef.current) {
          if (savedScrollTop) {
            tableScrollRef.current.scrollTop = Number(savedScrollTop);
          } else if (savedLeadId) {
            const rowElem = document.getElementById(`lead-row-${savedLeadId}`);
            if (rowElem) {
              rowElem.scrollIntoView({ block: "nearest" });
            }
          }
        }
      });
    } catch (e) {}
  }, [loading, filteredLeads.length]);

  // Keep saved scroll position updated on user scroll (so page refresh also remembers scroll)
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      try {
        sessionStorage.setItem("crm_leads_scroll_top_marketing", String(el.scrollTop));
      } catch (e) {}
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#cc2727]/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-black flex overflow-hidden">
      {/* Sidebar with All Leads Tab (Fixed height, no scroll with leads) */}
      <MarketingSidebar user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header - Fixed at top, does not scroll */}
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-[#cc2727]" />
            <h1 className="text-base font-bold text-black">All Leads</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 font-semibold ml-2">
              {filteredLeads.length} {filteredLeads.length === leads.length ? "Total" : `of ${leads.length}`}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Upload Excel / CSV Button */}
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-xl flex items-center gap-2 border border-slate-300 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Upload Leads (Excel or CSV)"
            >
              <Upload className="w-3.5 h-3.5 text-[#cc2727]" />
              <span>Upload</span>
            </button>

            {/* Download Button */}
            <button
              type="button"
              onClick={() => setIsDownloadModalOpen(true)}
              className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-xl flex items-center gap-2 border border-slate-300 shadow-sm transition-all active:scale-95 cursor-pointer"
              title="Download Leads (Excel or CSV)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Download</span>
            </button>

            {/* Add Lead Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="py-2 px-4 bg-[#cc2727] hover:bg-[#b02121] text-black text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-[#cc2727]/20 transition-all active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Lead</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col px-4 pt-4 sm:px-6 sm:pt-6 pb-0 space-y-4 overflow-hidden min-h-0">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="shrink-0 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{toastMessage}</span>
            </div>
          )}

                    {/* Search Bar & LeadSquared Filters */}
          <div className="space-y-3 shrink-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[280px] max-w-md">
                <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Unique ID, Patient Name, Phone, Location..."
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-black text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#cc2727] shadow-sm"
                />
              </div>

              {/* LeadSquared Filter Button & Instant Pinned Filters */}
              <LeadSquaredFilter
                filters={filters}
                updateFilter={updateFilter}
                handleResetFilters={handleResetFilters}
                activeFilterCount={activeFilterCount}
                distinctLocations={distinctLocations}
                distinctCallers={distinctCallers}
                distinctLeadSources={distinctLeadSources}
                distinctTreatments={distinctTreatments}
                distinctSubDispositions={distinctSubDispositions}
                storageKeyPrefix="marketing"
              />

              {/* Column Visibility Filter on the far right */}
              <div className="ml-auto relative z-30">
                <div className="relative self-end sm:self-auto z-50" ref={columnDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsManageColumnsModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200/80 text-black border border-slate-300 rounded-xl text-xs font-medium transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#cc2727]" />
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#cc2727]/10 text-[#cc2727] rounded-md">
                    {Object.values(visibleColumns).filter(Boolean).length}/{TABLE_COLUMNS.length}
                  </span>
                </button>

                
              </div>
              </div>
            </div>

{/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] font-semibold text-gray-500">Active Filters:</span>

                {(filters.leadEntryDateFrom || filters.leadEntryDateTo) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Entry: {filters.leadEntryDateFrom || "Start"} to {filters.leadEntryDateTo || "End"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter("leadEntryDateFrom", "");
                        updateFilter("leadEntryDateTo", "");
                      }}
                      className="hover:text-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.location && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Location: {filters.location}</span>
                    <button type="button" onClick={() => updateFilter("location", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.callerName && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Caller: {filters.callerName}</span>
                    <button type="button" onClick={() => updateFilter("callerName", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.leadSource && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Source: {filters.leadSource}</span>
                    <button type="button" onClick={() => updateFilter("leadSource", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.treatment && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Treatment: {filters.treatment}</span>
                    <button type="button" onClick={() => updateFilter("treatment", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(filters.followUpDateFrom || filters.followUpDateTo) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Follow Up: {filters.followUpDateFrom || "Start"} to {filters.followUpDateTo || "End"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter("followUpDateFrom", "");
                        updateFilter("followUpDateTo", "");
                      }}
                      className="hover:text-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.subDispositions && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Sub Disp: {filters.subDispositions}</span>
                    <button type="button" onClick={() => updateFilter("subDispositions", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.dispositions && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Disp: {filters.dispositions}</span>
                    <button type="button" onClick={() => updateFilter("dispositions", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.validStatus && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Status: {filters.validStatus}</span>
                    <button type="button" onClick={() => updateFilter("validStatus", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(filters.appointmentDateFrom || filters.appointmentDateTo) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Appt: {filters.appointmentDateFrom || "Start"} to {filters.appointmentDateTo || "End"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter("appointmentDateFrom", "");
                        updateFilter("appointmentDateTo", "");
                      }}
                      className="hover:text-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {(filters.surgeryDateFrom || filters.surgeryDateTo) && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Surgery: {filters.surgeryDateFrom || "Start"} to {filters.surgeryDateTo || "End"}</span>
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter("surgeryDateFrom", "");
                        updateFilter("surgeryDateTo", "");
                      }}
                      className="hover:text-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                {filters.quickMetricFilter && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                    <span>Filter: {filters.quickMetricFilter === "follow_up" ? "Follow Up Scheduled" : "Unassigned Leads"}</span>
                    <button type="button" onClick={() => updateFilter("quickMetricFilter", "")} className="hover:text-black">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="text-xs text-rose-400 hover:text-rose-300 underline ml-1"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>

          {/* Leads Table Container */}
          <div className="flex-1 flex flex-col min-h-0 bg-white border-t border-x border-slate-200 rounded-t-2xl shadow-sm overflow-hidden relative">
            

            {filteredLeads.length === 0 ? (
              <div className="py-16 text-center">
                <FolderKanban className="w-12 h-12 text-black mx-auto mb-3" />
                <h3 className="text-base font-semibold text-black">
                  No leads found
                </h3>
                <p className="text-xs text-gray-600 max-w-sm mx-auto mt-1 mb-5">
                  {searchQuery
                    ? "No leads matched your search query."
                    : 'Click "Add Lead" to register your first patient lead.'}
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#cc2727]/20 text-[#cc2727] border border-[#cc2727]/30 rounded-xl text-xs font-semibold hover:bg-[#cc2727]/30 transition-all"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Lead
                </button>
              </div>
            ) : (
              <div ref={tableScrollRef} className="flex-1 overflow-auto min-h-0">
                <table className="w-full text-left text-xs text-black whitespace-nowrap">
                  <thead className="bg-slate-50 text-black uppercase tracking-wider border-b border-slate-200 text-[11px] sticky top-0 z-20 shadow-sm">
                    <tr>
                      {/* 1. Unique ID */}
                      <th scope="col" className="px-4 py-3.5 font-semibold sticky top-0 left-0 bg-white z-30 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                        Lead ID
                      </th>

                      {/* Dynamic Ordered Column Headers */}
                      {orderedColumns.map((colId) => {
                        const colDef = TABLE_COLUMNS.find((c) => c.id === colId);
                        return (
                          <th
                            key={colId}
                            scope="col"
                            className="px-4 py-3.5 font-semibold sticky top-0 bg-white z-20"
                          >
                            <span>{colDef?.label || colId}</span>
                          </th>
                        );
                      })}

                      {/* Action */}
                      <th scope="col" className="px-4 py-3.5 font-semibold text-right sticky top-0 right-0 bg-white z-30 shadow-[-2px_0_5px_rgba(0,0,0,0.5)]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedLeads.map((lead) => {
                      const leadId = lead.uniqueId || lead._id;
                      const isHighlighted = highlightedLeadId === leadId;
                      return (
                      <tr
                        key={lead._id || lead.uniqueId}
                        id={`lead-row-${leadId}`}
                        onClick={() => handleOpenLead(lead)}
                        className={`cursor-pointer transition-colors group ${
                          isHighlighted
                            ? "bg-amber-100/70 hover:bg-amber-100 font-medium ring-1 ring-inset ring-amber-400"
                            : "hover:bg-slate-100/60"
                        }`}
                      >
                        {/* 1. Unique ID (Sticky Left) */}
                        <td className="px-4 py-3.5 sticky left-0 bg-white group-hover:bg-slate-100/90 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 text-xs font-mono font-bold">
                            <Hash className="w-3 h-3 text-[#cc2727]" />
                            {lead.uniqueId || "N/A"}
                          </div>
                        </td>

                        {/* Dynamic Ordered & Pinned Column Cells */}
                        {orderedColumns.map((colId) => (
                          renderLeadTableCell({ colId, lead, leadId })
                        ))}

                        {/* Action Column (Sticky Right) */}
                        <td className="px-4 py-3.5 text-right sticky right-0 bg-white group-hover:bg-slate-100/90 z-10 shadow-[-2px_0_5px_rgba(0,0,0,0.5)]">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLead(lead);
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-[#cc2727]/10 hover:bg-[#cc2727]/20 text-[#cc2727] hover:text-black border border-[#cc2727]/20 text-xs font-medium transition-colors flex items-center gap-1"
                            >
                              <span>View Details</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredLeads.length > pageSize && (
              <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-black shadow-xs">
                <span className="text-gray-500">
                  Showing <strong className="text-black">{((currentPage - 1) * pageSize) + 1}</strong> - <strong className="text-black">{Math.min(currentPage * pageSize, filteredLeads.length)}</strong> of <strong className="text-black">{filteredLeads.length}</strong> leads
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
                    }}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-black cursor-pointer transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2.5 py-1 rounded-md bg-slate-100 font-mono text-[11px]">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
                    }}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-black cursor-pointer transition-colors"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLeadAdded={handleLeadAdded}
        suggestedUniqueId={nextUniqueId}
        existingLeads={leads}
      />

      {/* Download Modal Popup */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            ref={downloadModalRef}
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-white/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/20 text-emerald-700">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-black">Download Leads</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Export your leads to Excel or CSV file
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="text-gray-500 hover:text-black p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              {/* Filter Scope Summary */}
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Export Scope Summary
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500 block text-[11px]">Leads (Rows):</span>
                    <span className="font-semibold text-black">
                      {filteredLeads.length}{" "}
                      {filteredLeads.length !== leads.length ? (
                        <span className="text-[#cc2727] text-[11px] font-normal">
                          (Filtered)
                        </span>
                      ) : (
                        <span className="text-black text-[11px] font-normal">
                          (All Leads)
                        </span>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[11px]">Columns:</span>
                    <span className="font-semibold text-black">
                      {Object.values(visibleColumns).filter(Boolean).length + 1}{" "}
                      {Object.values(visibleColumns).filter(Boolean).length !== TABLE_COLUMNS.length ? (
                        <span className="text-[#cc2727] text-[11px] font-normal">
                          (Customized)
                        </span>
                      ) : (
                        <span className="text-black text-[11px] font-normal">
                          (All Columns)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {activeFilterCount > 0 ? (
                  <p className="text-[11px] text-amber-400/90 pt-1.5 border-t border-slate-200 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>{activeFilterCount} active filter(s) will be applied to this export.</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-700/80 pt-1.5 border-t border-slate-200 flex items-center gap-1.5">
                    <span>✓</span>
                    <span>No row filters active — exporting all {leads.length} leads.</span>
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-1">
                {/* 1. Download in Excel */}
                <button
                  type="button"
                  onClick={handleDownloadExcel}
                  className="w-full p-4 rounded-xl bg-slate-100/70 hover:bg-slate-100 border border-slate-200/80 hover:border-emerald-200/50 flex items-center justify-between group transition-all text-left shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 group-hover:scale-105 transition-transform">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-black group-hover:text-emerald-700 transition-colors">
                        Download in Excel
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Microsoft Excel spreadsheet (.xlsx) with auto-sized columns
                      </div>
                    </div>
                  </div>
                  <ArrowDownToLine className="w-4 h-4 text-gray-500 group-hover:text-emerald-700 transition-colors shrink-0 ml-2" />
                </button>

                {/* 2. Download in CSV */}
                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  className="w-full p-4 rounded-xl bg-slate-100/70 hover:bg-slate-100 border border-slate-200/80 hover:border-indigo-500/50 flex items-center justify-between group transition-all text-left shadow-sm cursor-pointer"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 group-hover:scale-105 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-black group-hover:text-[#cc2727] transition-colors">
                        Download in CSV
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Universal comma-separated format (.csv) with UTF-8 encoding
                      </div>
                    </div>
                  </div>
                  <ArrowDownToLine className="w-4 h-4 text-gray-500 group-hover:text-[#cc2727] transition-colors shrink-0 ml-2" />
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsDownloadModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Leads Modal */}
      <UploadLeadsModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onLeadsImported={handleLeadsImported}
      />

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && leadToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-400 font-bold text-base">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <span>Confirm Delete Lead?</span>
            </div>
            <p className="text-xs text-black leading-relaxed">
              Are you sure you want to permanently delete lead{" "}
              <strong>{leadToDelete.patientName || leadToDelete.uniqueId}</strong> (
              <span className="font-mono text-[#cc2727] font-bold">{leadToDelete.uniqueId}</span>
              )? This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setLeadToDelete(null);
                }}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-black text-xs font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-black text-xs font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20"
              >
                {deleting ? "Deleting..." : "Yes, Delete Lead"}
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Manage Columns LeadSquared Modal */}
      <ManageColumnsModal
        isOpen={isManageColumnsModalOpen}
        onClose={() => setIsManageColumnsModalOpen(false)}
        allColumns={TABLE_COLUMNS}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        pinnedColumns={pinnedColumns}
        onApply={handleApplyColumns}
        onRestoreDefault={handleRestoreDefaultColumns}
      />
    </div>
  );
}