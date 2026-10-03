"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Calendar,
  Filter,
  Download,
  Users,
  CheckCircle2,
  PhoneCall,
  PhoneForwarded,
  XCircle,
  FileSpreadsheet,
  RefreshCw,
  FolderKanban,
  TrendingUp,
  BarChart3,
  CalendarDays,
  CheckSquare,
  Receipt,
  CalendarCheck2,
  MapPin,
  Activity,
  HeartPulse,
  Layers,
  MinusSquare,
  PlusSquare,
  Share2,
} from "lucide-react";
import AdminSidebar from "@/app/components/AdminSidebar";
import { getMonthFromDate } from "@/lib/leadOptions";
import * as XLSX from "xlsx";

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

// Parse currency string to number
function parseCurrencyNumber(val: string | number | undefined): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Chronological date sorter for DD-MMM-YY / D-MMM-YY
function parseDateToSortKey(dStr: string): number {
  if (!dStr) return 0;
  const match = dStr.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/i);
  if (match) {
    const day = parseInt(match[1], 10);
    const mStr = match[2].toLowerCase();
    const MONTH_LOOKUP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const m = MONTH_LOOKUP[mStr] ?? 0;
    let y = parseInt(match[3], 10);
    if (y < 100) y += 2000;
    return new Date(y, m, day).getTime();
  }
  const timestamp = new Date(dStr).getTime();
  return isNaN(timestamp) ? 0 : timestamp;
}

// Chronological month sorter for MMM-YY
function parseMonthToSortKey(mStr: string): number {
  if (!mStr) return 0;
  const match = mStr.trim().match(/^([A-Za-z]{3})-(\d{2,4})$/i);
  if (match) {
    const mStrPart = match[1].toLowerCase();
    const MONTH_LOOKUP: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const m = MONTH_LOOKUP[mStrPart] ?? 0;
    let y = parseInt(match[2], 10);
    if (y < 100) y += 2000;
    return new Date(y, m, 1).getTime();
  }
  return 0;
}

// Categorize raw disposition into standard screenshot buckets
function categorizeDisposition(raw: string | undefined): "Closed" | "Contact Attempt" | "Contacted" | "Converted" | "Other" {
  if (!raw) return "Other";
  const str = raw.trim().toLowerCase();
  if (str === "closed") return "Closed";
  if (str === "contact attempt" || str.includes("attempt")) return "Contact Attempt";
  if (str === "contacted") return "Contacted";
  if (str === "converted") return "Converted";
  return "Other";
}

// Categorize raw valid status into standard screenshot buckets
function categorizeValidStatus(raw: string | undefined): "Valid" | "Invalid" | "NA" | "Other" {
  if (!raw) return "Other";
  const str = raw.trim().toLowerCase();
  if (str === "valid") return "Valid";
  if (str === "invalid") return "Invalid";
  if (str === "na" || str === "n/a") return "NA";
  return "Other";
}

export default function AdminDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>("All");
  const [selectedLocation, setSelectedLocation] = useState<string>("All");
  const [activeReportTab, setActiveReportTab] = useState<"ALL" | "FTD" | "MTD" | "VALID" | "APPT_DATE" | "APPT_MONTH" | "SURGERY_DATE" | "SURGERY_MONTH" | "CALL_SUMMARY" | "SUB_DISP" | "LEAD_SOURCE">("ALL");
  const [selectedCell, setSelectedCell] = useState<{ key: string; column: string } | null>(null);
  const [collapsedDispositions, setCollapsedDispositions] = useState<Record<string, boolean>>({});
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  const toggleDispositionCollapse = (disp: string) => {
    setCollapsedDispositions((prev) => ({
      ...prev,
      [disp]: !prev[disp],
    }));
  };

  const toggleMonthCollapse = (m: string) => {
    setCollapsedMonths((prev) => ({
      ...prev,
      [m]: !prev[m],
    }));
  };

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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
        router.push("/admin/login");
        return;
      }
      const authData = await authRes.json();
      if (!authData.user || authData.user.role !== "admin") {
        router.push("/admin/login");
        return;
      }
      setUser(authData.user);

      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.leads || []);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error("Dashboard load error:", err);
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
      // Only poll when page/tab is currently visible
      if (typeof document !== "undefined" && !document.hidden) {
        fetchDashboardData(true);
      }
    }, 5000);

    // 3. Instant refresh when user returns/switches back to this tab
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchDashboardData(true);
      }
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // 4. Real-time Cross-tab/Window Broadcast Sync
    // When leads are added/updated/imported in another tab, this triggers immediately
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "surgical_crm_leads_updated") {
        fetchDashboardData(true);
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // 5. In-app custom event sync (if actions happen within same app router session)
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

  // Extract distinct months present in the leads chronologically
  const distinctMonths = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      let lm = (l.month || "").trim();
      if (!lm && l.date) lm = getMonthFromDate(l.date);
      if (lm) set.add(lm);

      let am = (l.appointmentMonth || "").trim();
      if (!am && l.appointmentDate) am = getMonthFromDate(l.appointmentDate);
      if (am) set.add(am);

      let sm = (l.surgeryMonth || "").trim();
      if (!sm && l.surgeryDate) sm = getMonthFromDate(l.surgeryDate);
      if (sm) set.add(sm);
    });
    return Array.from(set).sort((a, b) => parseMonthToSortKey(a) - parseMonthToSortKey(b));
  }, [leads]);

  // Extract distinct locations present in the leads
  const distinctLocations = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      const loc = (l.location || l.otherCity || "").trim();
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [leads]);

  // Filter leads based on month selection (for daily views)
  const filteredLeads = useMemo(() => {
    if (selectedMonth === "All") return leads;
    return leads.filter((l) => {
      let m = (l.month || "").trim();
      if (!m && l.date) m = getMonthFromDate(l.date);
      return m === selectedMonth;
    });
  }, [leads, selectedMonth]);

  // Calculate Overall KPI Metrics
  const metrics = useMemo(() => {
    let closed = 0;
    let contactAttempt = 0;
    let contacted = 0;
    let converted = 0;
    let other = 0;

    const sourceLeads = activeReportTab === "FTD" ? filteredLeads : leads;

    sourceLeads.forEach((lead) => {
      const category = categorizeDisposition(lead.dispositions);
      if (category === "Closed") closed++;
      else if (category === "Contact Attempt") contactAttempt++;
      else if (category === "Contacted") contacted++;
      else if (category === "Converted") converted++;
      else other++;
    });

    const total = sourceLeads.length;
    const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";

    return {
      total,
      closed,
      contactAttempt,
      contacted,
      converted,
      other,
      conversionRate,
    };
  }, [leads, filteredLeads, activeReportTab]);

  // 1. Build Lead Summary FTD (Date-wise Pivot Matrix - Screenshot 1)
  const ftdData = useMemo(() => {
    const dateMap: Record<
      string,
      {
        date: string;
        dateSortKey: number;
        other: number;
        closed: number;
        contactAttempt: number;
        contacted: number;
        converted: number;
        grandTotal: number;
      }
    > = {};

    let totalOther = 0;
    let totalClosed = 0;
    let totalContactAttempt = 0;
    let totalContacted = 0;
    let totalConverted = 0;
    let grandTotalSum = 0;

    filteredLeads.forEach((lead) => {
      const d = (lead.date || "Unknown").trim();
      if (!dateMap[d]) {
        dateMap[d] = {
          date: d,
          dateSortKey: parseDateToSortKey(d),
          other: 0,
          closed: 0,
          contactAttempt: 0,
          contacted: 0,
          converted: 0,
          grandTotal: 0,
        };
      }

      const category = categorizeDisposition(lead.dispositions);
      if (category === "Closed") {
        dateMap[d].closed++;
        totalClosed++;
      } else if (category === "Contact Attempt") {
        dateMap[d].contactAttempt++;
        totalContactAttempt++;
      } else if (category === "Contacted") {
        dateMap[d].contacted++;
        totalContacted++;
      } else if (category === "Converted") {
        dateMap[d].converted++;
        totalConverted++;
      } else {
        dateMap[d].other++;
        totalOther++;
      }

      const rowSum =
        dateMap[d].closed +
        dateMap[d].contactAttempt +
        dateMap[d].contacted +
        dateMap[d].converted +
        dateMap[d].other;
      dateMap[d].grandTotal = rowSum;
    });

    grandTotalSum =
      totalClosed + totalContactAttempt + totalContacted + totalConverted + totalOther;

    const rows = Object.values(dateMap).sort((a, b) => a.dateSortKey - b.dateSortKey);

    return {
      rows,
      totals: {
        other: totalOther,
        closed: totalClosed,
        contactAttempt: totalContactAttempt,
        contacted: totalContacted,
        converted: totalConverted,
        grandTotal: grandTotalSum,
      },
    };
  }, [filteredLeads]);

  // 2. Build Lead Summary MTD (Month-wise Pivot Matrix - Screenshot 2)
  const mtdData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        month: string;
        monthSortKey: number;
        other: number;
        closed: number;
        contactAttempt: number;
        contacted: number;
        converted: number;
        grandTotal: number;
      }
    > = {};

    let totalOther = 0;
    let totalClosed = 0;
    let totalContactAttempt = 0;
    let totalContacted = 0;
    let totalConverted = 0;
    let grandTotalSum = 0;

    leads.forEach((lead) => {
      const m = (lead.month || "").trim();
      const monthKey = m || "Unknown";
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          month: monthKey,
          monthSortKey: parseMonthToSortKey(monthKey),
          other: 0,
          closed: 0,
          contactAttempt: 0,
          contacted: 0,
          converted: 0,
          grandTotal: 0,
        };
      }

      const category = categorizeDisposition(lead.dispositions);
      if (category === "Closed") {
        monthMap[monthKey].closed++;
        totalClosed++;
      } else if (category === "Contact Attempt") {
        monthMap[monthKey].contactAttempt++;
        totalContactAttempt++;
      } else if (category === "Contacted") {
        monthMap[monthKey].contacted++;
        totalContacted++;
      } else if (category === "Converted") {
        monthMap[monthKey].converted++;
        totalConverted++;
      } else {
        monthMap[monthKey].other++;
        totalOther++;
      }

      const rowSum =
        monthMap[monthKey].closed +
        monthMap[monthKey].contactAttempt +
        monthMap[monthKey].contacted +
        monthMap[monthKey].converted +
        monthMap[monthKey].other;
      monthMap[monthKey].grandTotal = rowSum;
    });

    grandTotalSum =
      totalClosed + totalContactAttempt + totalContacted + totalConverted + totalOther;

    const rows = Object.values(monthMap).sort((a, b) => a.monthSortKey - b.monthSortKey);

    return {
      rows,
      totals: {
        other: totalOther,
        closed: totalClosed,
        contactAttempt: totalContactAttempt,
        contacted: totalContacted,
        converted: totalConverted,
        grandTotal: grandTotalSum,
      },
    };
  }, [leads]);

  // 3. Build Valid Summary (Month-wise Valid Status Matrix - Screenshot 3)
  const validSummaryData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        month: string;
        monthSortKey: number;
        other: number;
        invalid: number;
        na: number;
        valid: number;
        grandTotal: number;
      }
    > = {};

    let totalOther = 0;
    let totalInvalid = 0;
    let totalNa = 0;
    let totalValid = 0;
    let grandTotalSum = 0;

    leads.forEach((lead) => {
      const m = (lead.month || "").trim();
      const monthKey = m || "Unknown";
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          month: monthKey,
          monthSortKey: parseMonthToSortKey(monthKey),
          other: 0,
          invalid: 0,
          na: 0,
          valid: 0,
          grandTotal: 0,
        };
      }

      const status = categorizeValidStatus(lead.validStatus);
      if (status === "Invalid") {
        monthMap[monthKey].invalid++;
        totalInvalid++;
      } else if (status === "NA") {
        monthMap[monthKey].na++;
        totalNa++;
      } else if (status === "Valid") {
        monthMap[monthKey].valid++;
        totalValid++;
      } else {
        monthMap[monthKey].other++;
        totalOther++;
      }

      const rowSum = monthMap[monthKey].invalid + monthMap[monthKey].na + monthMap[monthKey].valid;
      monthMap[monthKey].grandTotal = rowSum;
    });

    grandTotalSum = totalInvalid + totalNa + totalValid;

    const rows = Object.values(monthMap).sort((a, b) => a.monthSortKey - b.monthSortKey);
    const totalValidPercent = grandTotalSum > 0 ? ((totalValid / grandTotalSum) * 100).toFixed(2) + "%" : "0.00%";

    return {
      rows: rows.map((r) => ({
        ...r,
        validPercent: r.grandTotal > 0 ? ((r.valid / r.grandTotal) * 100).toFixed(2) + "%" : "0.00%",
      })),
      totals: {
        other: totalOther,
        invalid: totalInvalid,
        na: totalNa,
        valid: totalValid,
        grandTotal: grandTotalSum,
        validPercent: totalValidPercent,
      },
    };
  }, [leads]);

  // 4. Build Appointment Date Summary (Count & Collections with Location - Screenshot 4)
  const appointmentDateData = useMemo(() => {
    const dateMap: Record<
      string,
      {
        date: string;
        location: string;
        dateSortKey: number;
        count: number;
        collections: number;
      }
    > = {};

    let totalCount = 0;
    let totalCollections = 0;

    let sourceLeads = selectedMonth === "All" ? leads : leads.filter((l) => {
      let m = (l.appointmentMonth || "").trim();
      if (!m && l.appointmentDate) {
        m = getMonthFromDate(l.appointmentDate);
      }
      return m === selectedMonth;
    });

    if (selectedLocation !== "All") {
      sourceLeads = sourceLeads.filter((l) => (l.location || l.otherCity || "") === selectedLocation);
    }

    sourceLeads.forEach((lead) => {
      const d = (lead.appointmentDate || "").trim();
      const charges = parseCurrencyNumber(lead.consultationCharges);
      const hasAppt = !!lead.appointmentDate || charges > 0;

      if (hasAppt) {
        const dateKey = d || "Unknown";
        const loc = (lead.location || lead.otherCity || "Unspecified").trim();
        const groupKey = `${dateKey}___${loc}`;

        if (!dateMap[groupKey]) {
          dateMap[groupKey] = {
            date: dateKey,
            location: loc,
            dateSortKey: parseDateToSortKey(dateKey),
            count: 0,
            collections: 0,
          };
        }

        dateMap[groupKey].count += 1;
        dateMap[groupKey].collections += charges;
        totalCount += 1;
        totalCollections += charges;
      }
    });

    const rows = Object.values(dateMap).sort((a, b) => a.dateSortKey - b.dateSortKey);

    return {
      rows,
      totals: {
        count: totalCount,
        collections: totalCollections,
      },
    };
  }, [leads, selectedMonth, selectedLocation]);

  // 5. Build Appointment Month Summary (Count & Collections - Screenshot 3)
  const appointmentMonthData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        month: string;
        monthSortKey: number;
        count: number;
        collections: number;
      }
    > = {};

    let totalCount = 0;
    let totalCollections = 0;

    let sourceLeads = leads;
    if (selectedLocation !== "All") {
      sourceLeads = sourceLeads.filter(
        (l) => (l.location || l.otherCity || "") === selectedLocation
      );
    }

    sourceLeads.forEach((lead) => {
      let m = (lead.appointmentMonth || "").trim();
      if (!m && lead.appointmentDate) {
        m = getMonthFromDate(lead.appointmentDate);
      }

      const charges = parseCurrencyNumber(lead.consultationCharges);
      const hasAppt = !!lead.appointmentDate || !!lead.appointmentMonth || charges > 0;

      if (hasAppt) {
        const monthKey = m || "Unknown";
        if (!monthMap[monthKey]) {
          monthMap[monthKey] = {
            month: monthKey,
            monthSortKey: parseMonthToSortKey(monthKey),
            count: 0,
            collections: 0,
          };
        }

        monthMap[monthKey].count += 1;
        monthMap[monthKey].collections += charges;
        totalCount += 1;
        totalCollections += charges;
      }
    });

    const rows = Object.values(monthMap).sort((a, b) => a.monthSortKey - b.monthSortKey);

    return {
      rows,
      totals: {
        count: totalCount,
        collections: totalCollections,
      },
    };
  }, [leads, selectedLocation]);

  // 6. Build Surgery Month Summary (Count & Surgery - Payment Received - Screenshot 5)
  const surgeryMonthData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        month: string;
        monthSortKey: number;
        count: number;
        paymentReceived: number;
      }
    > = {};

    let totalCount = 0;
    let totalPaymentReceived = 0;

    let sourceLeads = leads;
    if (selectedLocation !== "All") {
      sourceLeads = sourceLeads.filter(
        (l) => (l.location || l.otherCity || "") === selectedLocation
      );
    }

    sourceLeads.forEach((lead) => {
      const payment = parseCurrencyNumber(lead.surgeryPaymentReceived);
      const cost = parseCurrencyNumber(lead.surgeryCost);
      const hasSurgery =
        !!lead.surgeryDate ||
        !!lead.surgeryMonth ||
        payment > 0 ||
        cost > 0;

      if (hasSurgery) {
        let m = (lead.surgeryMonth || "").trim();
        if (!m && lead.surgeryDate) {
          m = getMonthFromDate(lead.surgeryDate);
        }
        if (!m && lead.month) {
          m = lead.month.trim();
        }
        const monthKey = m || "Unknown";

        if (!monthMap[monthKey]) {
          monthMap[monthKey] = {
            month: monthKey,
            monthSortKey: parseMonthToSortKey(monthKey),
            count: 0,
            paymentReceived: 0,
          };
        }

        monthMap[monthKey].count += 1;
        monthMap[monthKey].paymentReceived += payment;
        totalCount += 1;
        totalPaymentReceived += payment;
      }
    });

    const rows = Object.values(monthMap).sort((a, b) => a.monthSortKey - b.monthSortKey);

    return {
      rows,
      totals: {
        count: totalCount,
        paymentReceived: totalPaymentReceived,
      },
    };
  }, [leads, selectedLocation]);

  // 7. Build Surgery Date Summary (Date-wise Count & Surgery - Payment Received with Location - Screenshot 6)
  const surgeryDateData = useMemo(() => {
    const dateMap: Record<
      string,
      {
        date: string;
        location: string;
        dateSortKey: number;
        count: number;
        paymentReceived: number;
      }
    > = {};

    let totalCount = 0;
    let totalPaymentReceived = 0;

    let sourceLeads = selectedMonth === "All" ? leads : leads.filter((l) => {
      if (!l.surgeryDate) return false;
      let m = (l.surgeryMonth || "").trim();
      if (!m) {
        m = getMonthFromDate(l.surgeryDate);
      }
      return m === selectedMonth;
    });

    if (selectedLocation !== "All") {
      sourceLeads = sourceLeads.filter(
        (l) => (l.location || l.otherCity || "") === selectedLocation
      );
    }

    sourceLeads.forEach((lead) => {
      const d = (lead.surgeryDate || "").trim();
      // Only include if surgeryDate is present and not blank
      if (!d) return;

      const payment = parseCurrencyNumber(lead.surgeryPaymentReceived);
      const dateKey = d;
      const loc = (lead.location || lead.otherCity || "Unspecified").trim();
      const groupKey = `${dateKey}___${loc}`;

      if (!dateMap[groupKey]) {
        dateMap[groupKey] = {
          date: dateKey,
          location: loc,
          dateSortKey: parseDateToSortKey(dateKey),
          count: 0,
          paymentReceived: 0,
        };
      }

      dateMap[groupKey].count += 1;
      dateMap[groupKey].paymentReceived += payment;
      totalCount += 1;
      totalPaymentReceived += payment;
    });

    const rows = Object.values(dateMap).sort((a, b) => a.dateSortKey - b.dateSortKey);

    return {
      rows,
      totals: {
        count: totalCount,
        paymentReceived: totalPaymentReceived,
      },
    };
  }, [leads, selectedMonth, selectedLocation]);

  // 8. Build Call Summary (Month-wise Enquiry, Valid, Converted, %, Collections - Screenshot 7)
  const callSummaryData = useMemo(() => {
    const monthMap: Record<
      string,
      {
        month: string;
        monthSortKey: number;
        enquiry: number;
        valid: number;
        converted: number;
        consultationCharges: number;
        surgeryCount: number;
        surgeryCollections: number;
        totalCollections: number;
      }
    > = {};

    let totalEnquiry = 0;
    let totalValid = 0;
    let totalConverted = 0;
    let totalConsultationCharges = 0;
    let totalSurgeryCount = 0;
    let totalSurgeryCollections = 0;
    let grandTotalCollections = 0;

    let sourceLeads = leads;
    if (selectedLocation !== "All") {
      sourceLeads = sourceLeads.filter(
        (l) => (l.location || l.otherCity || "") === selectedLocation
      );
    }

    sourceLeads.forEach((lead) => {
      let m = (lead.month || "").trim();
      if (!m && lead.date) {
        m = getMonthFromDate(lead.date);
      }
      const monthKey = m || "Unknown";

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          month: monthKey,
          monthSortKey: parseMonthToSortKey(monthKey),
          enquiry: 0,
          valid: 0,
          converted: 0,
          consultationCharges: 0,
          surgeryCount: 0,
          surgeryCollections: 0,
          totalCollections: 0,
        };
      }

      // 1. Enquiry count
      monthMap[monthKey].enquiry += 1;
      totalEnquiry += 1;

      // 2. Valid status
      const validCategory = categorizeValidStatus(lead.validStatus);
      if (validCategory === "Valid") {
        monthMap[monthKey].valid += 1;
        totalValid += 1;
      }

      // 3. Converted disposition
      const dispCategory = categorizeDisposition(lead.dispositions);
      if (dispCategory === "Converted") {
        monthMap[monthKey].converted += 1;
        totalConverted += 1;
      }

      // 4. Consultation charges
      const consultFee = parseCurrencyNumber(lead.consultationCharges);
      if (consultFee > 0) {
        monthMap[monthKey].consultationCharges += consultFee;
        totalConsultationCharges += consultFee;
      }

      // 5. Surgery count & collections
      const surgPay = parseCurrencyNumber(lead.surgeryPaymentReceived);
      const hasSurgery = !!lead.surgeryDate || !!lead.surgeryMonth || surgPay > 0;
      if (hasSurgery) {
        monthMap[monthKey].surgeryCount += 1;
        totalSurgeryCount += 1;
        monthMap[monthKey].surgeryCollections += surgPay;
        totalSurgeryCollections += surgPay;
      }
    });

    const rows = Object.values(monthMap)
      .sort((a, b) => a.monthSortKey - b.monthSortKey)
      .map((r) => {
        const totalColl = r.consultationCharges + r.surgeryCollections;
        const enqToValidPct =
          r.enquiry > 0 ? ((r.valid / r.enquiry) * 100).toFixed(2) + "%" : "0.00%";
        const validToConPct =
          r.valid > 0 ? ((r.converted / r.valid) * 100).toFixed(2) + "%" : "0.00%";
        const enqToConPct =
          r.enquiry > 0 ? ((r.converted / r.enquiry) * 100).toFixed(2) + "%" : "0.00%";

        return {
          ...r,
          totalCollections: totalColl,
          enqToValidPct,
          validToConPct,
          enqToConPct,
        };
      });

    grandTotalCollections = totalConsultationCharges + totalSurgeryCollections;
    const totalEnqToValidPct =
      totalEnquiry > 0 ? ((totalValid / totalEnquiry) * 100).toFixed(2) + "%" : "0.00%";
    const totalValidToConPct =
      totalValid > 0 ? ((totalConverted / totalValid) * 100).toFixed(2) + "%" : "0.00%";
    const totalEnqToConPct =
      totalEnquiry > 0 ? ((totalConverted / totalEnquiry) * 100).toFixed(2) + "%" : "0.00%";

    return {
      rows,
      totals: {
        enquiry: totalEnquiry,
        valid: totalValid,
        converted: totalConverted,
        enqToValidPct: totalEnqToValidPct,
        validToConPct: totalValidToConPct,
        enqToConPct: totalEnqToConPct,
        consultationCharges: totalConsultationCharges,
        surgeryCount: totalSurgeryCount,
        surgeryCollections: totalSurgeryCollections,
        totalCollections: grandTotalCollections,
      },
    };
  }, [leads, selectedLocation]);

  // 9. Build Sub-Disposition Summary (Hierarchical Pivot Matrix - Screenshot 8)
  const subDispData = useMemo(() => {
    let sourceLeads = leads;
    if (selectedLocation !== "All") {
      sourceLeads = sourceLeads.filter(
        (l) => (l.location || l.otherCity || "") === selectedLocation
      );
    }

    // 1. Gather all unique months present in leads, sorted chronologically
    const monthSet = new Set<string>();
    sourceLeads.forEach((lead) => {
      let m = (lead.month || "").trim();
      if (!m && lead.date) {
        m = getMonthFromDate(lead.date);
      }
      if (m) monthSet.add(m);
    });
    const months = Array.from(monthSet).sort(
      (a, b) => parseMonthToSortKey(a) - parseMonthToSortKey(b)
    );

    // 2. Build nested map: disposition -> subDisposition -> month -> count
    const matrix: Record<string, Record<string, Record<string, number>>> = {};
    const dispositionTotals: Record<string, Record<string, number>> = {};
    const grandTotals: Record<string, number> = {};
    months.forEach((m) => {
      grandTotals[m] = 0;
    });
    let overallGrandTotal = 0;

    sourceLeads.forEach((lead) => {
      const rawDisp = (lead.dispositions || "").trim();
      const rawSub = (lead.subDispositions || "").trim() || "Unspecified";
      let m = (lead.month || "").trim();
      if (!m && lead.date) {
        m = getMonthFromDate(lead.date);
      }
      const monthKey = m || "Unknown";

      // Categorize disposition or preserve blank
      const dispCat = rawDisp ? categorizeDisposition(rawDisp) : "";

      if (!matrix[dispCat]) {
        matrix[dispCat] = {};
        dispositionTotals[dispCat] = {};
        months.forEach((mon) => {
          dispositionTotals[dispCat][mon] = 0;
        });
      }

      if (!matrix[dispCat][rawSub]) {
        matrix[dispCat][rawSub] = {};
        months.forEach((mon) => {
          matrix[dispCat][rawSub][mon] = 0;
        });
      }

      matrix[dispCat][rawSub][monthKey] = (matrix[dispCat][rawSub][monthKey] || 0) + 1;
      dispositionTotals[dispCat][monthKey] = (dispositionTotals[dispCat][monthKey] || 0) + 1;
      grandTotals[monthKey] = (grandTotals[monthKey] || 0) + 1;
      overallGrandTotal += 1;
    });

    // Desired disposition order matching standard business workflow & screenshot
    const orderedDispositions = ["", "Closed", "Contact Attempt", "Contacted", "Converted", "Other"].filter(
      (d) => matrix[d] && Object.keys(matrix[d]).length > 0
    );

    Object.keys(matrix).forEach((d) => {
      if (!orderedDispositions.includes(d)) {
        orderedDispositions.push(d);
      }
    });

    const groups = orderedDispositions.map((dispName) => {
      const subDisps = matrix[dispName];
      const sortedSubNames = Object.keys(subDisps).sort((a, b) => a.localeCompare(b));

      const rows = sortedSubNames.map((subName) => {
        const monthCounts = subDisps[subName];
        let subTotal = 0;
        months.forEach((m) => {
          subTotal += monthCounts[m] || 0;
        });
        return {
          subDisposition: subName,
          monthCounts,
          total: subTotal,
        };
      });

      const totalsByMonth = dispositionTotals[dispName] || {};
      let groupTotal = 0;
      months.forEach((m) => {
        groupTotal += totalsByMonth[m] || 0;
      });

      return {
        disposition: dispName,
        label: dispName ? `${dispName} Total` : "Total",
        rows,
        totalsByMonth,
        groupTotal,
      };
    });

    return {
      months,
      groups,
      grandTotals,
      overallGrandTotal,
    };
  }, [leads, selectedLocation]);

  // 10. Build Lead Source Summary (Month-wise Lead Source Count - Screenshot 9)
  const leadSourceData = useMemo(() => {
    let sourceLeads = leads;
    if (selectedLocation !== "All") {
      sourceLeads = sourceLeads.filter(
        (l) => (l.location || l.otherCity || "") === selectedLocation
      );
    }

    const monthMap: Record<string, Record<string, number>> = {};
    const monthTotals: Record<string, number> = {};
    let grandTotalCount = 0;

    sourceLeads.forEach((lead) => {
      let m = (lead.month || "").trim();
      if (!m && lead.date) {
        m = getMonthFromDate(lead.date);
      }
      const monthKey = m || "Unknown";
      const src = (lead.leadSource || "").trim() || "Unspecified";

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {};
        monthTotals[monthKey] = 0;
      }

      monthMap[monthKey][src] = (monthMap[monthKey][src] || 0) + 1;
      monthTotals[monthKey] = (monthTotals[monthKey] || 0) + 1;
      grandTotalCount += 1;
    });

    const sortedMonths = Object.keys(monthMap).sort(
      (a, b) => parseMonthToSortKey(a) - parseMonthToSortKey(b)
    );

    const groups = sortedMonths.map((m) => {
      const srcObj = monthMap[m];
      const sortedSources = Object.keys(srcObj).sort((a, b) => a.localeCompare(b));
      const rows = sortedSources.map((srcName) => ({
        source: srcName,
        count: srcObj[srcName],
      }));

      return {
        month: m,
        rows,
        total: monthTotals[m] || 0,
      };
    });

    return {
      groups,
      grandTotal: grandTotalCount,
    };
  }, [leads, selectedLocation]);

  // Export Active Table to Excel
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new();

      // 1. Lead Summary FTD
      const ftdRows = ftdData.rows.map((r) => ({
        Date: r.date,
        Closed: r.closed || "",
        "Contact Attempt": r.contactAttempt || "",
        Contacted: r.contacted || "",
        Converted: r.converted || "",
        "Unassigned leads": r.other || "",
        "Grand Total": r.grandTotal,
      }));
      ftdRows.push({
        Date: "Grand Total",
        Closed: ftdData.totals.closed || "",
        "Contact Attempt": ftdData.totals.contactAttempt || "",
        Contacted: ftdData.totals.contacted || "",
        Converted: ftdData.totals.converted || "",
        "Unassigned leads": ftdData.totals.other || "",
        "Grand Total": ftdData.totals.grandTotal,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ftdRows), "Lead Summary FTD");

      // 2. Lead Summary MTD
      const mtdRows = mtdData.rows.map((r) => ({
        Month: r.month,
        Closed: r.closed || "",
        "Contact Attempt": r.contactAttempt || "",
        Contacted: r.contacted || "",
        Converted: r.converted || "",
        "Unassigned leads": r.other || "",
        "Grand Total": r.grandTotal,
      }));
      mtdRows.push({
        Month: "Grand Total",
        Closed: mtdData.totals.closed || "",
        "Contact Attempt": mtdData.totals.contactAttempt || "",
        Contacted: mtdData.totals.contacted || "",
        Converted: mtdData.totals.converted || "",
        "Unassigned leads": mtdData.totals.other || "",
        "Grand Total": mtdData.totals.grandTotal,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mtdRows), "Lead Summary MTD");

      // 3. Valid Summary
      const validRows = validSummaryData.rows.map((r) => ({
        Month: r.month,
        Invalid: r.invalid || "",
        NA: r.na || "",
        Valid: r.valid || "",
        "Grand Total": r.grandTotal,
        "Valid %": r.validPercent,
      }));
      validRows.push({
        Month: "Grand Total",
        Invalid: validSummaryData.totals.invalid || "",
        NA: validSummaryData.totals.na || "",
        Valid: validSummaryData.totals.valid || "",
        "Grand Total": validSummaryData.totals.grandTotal,
        "Valid %": validSummaryData.totals.validPercent,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(validRows), "Valid Summary");

      // 4. Appointment Date Summary
      const apptDateRows = appointmentDateData.rows.map((r) => ({
        "Appointment Date": r.date,
        Location: r.location,
        Count: r.count,
        Collections: `₹${r.collections.toLocaleString("en-IN")}`,
      }));
      apptDateRows.push({
        "Appointment Date": "Grand Total",
        Location: "",
        Count: appointmentDateData.totals.count,
        Collections: `₹${appointmentDateData.totals.collections.toLocaleString("en-IN")}`,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(apptDateRows), "Appt Date Summary");

      // 5. Appointment Month Summary
      const apptMonthRows = appointmentMonthData.rows.map((r) => ({
        "Appointment month": r.month,
        Count: r.count,
        Collections: `₹${r.collections.toLocaleString("en-IN")}`,
      }));
      apptMonthRows.push({
        "Appointment month": "Grand Total",
        Count: appointmentMonthData.totals.count,
        Collections: `₹${appointmentMonthData.totals.collections.toLocaleString("en-IN")}`,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(apptMonthRows), "Appt Month Summary");

      // 6. Surgery Date Summary
      const surgDateRows = surgeryDateData.rows.map((r) => ({
        "Surgery Date": r.date,
        Location: r.location,
        Count: r.count,
        "Surgery - Payment Received": `₹${r.paymentReceived.toLocaleString("en-IN")}`,
      }));
      surgDateRows.push({
        "Surgery Date": "Grand Total",
        Location: "",
        Count: surgeryDateData.totals.count,
        "Surgery - Payment Received": `₹${surgeryDateData.totals.paymentReceived.toLocaleString("en-IN")}`,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(surgDateRows), "Surgery Date Summary");

      // 7. Surgery Month Summary
      const surgMonthRows = surgeryMonthData.rows.map((r) => ({
        "Surgery month": r.month,
        Count: r.count,
        "Surgery - Payment Received": `₹${r.paymentReceived.toLocaleString("en-IN")}`,
      }));
      surgMonthRows.push({
        "Surgery month": "Grand Total",
        Count: surgeryMonthData.totals.count,
        "Surgery - Payment Received": `₹${surgeryMonthData.totals.paymentReceived.toLocaleString("en-IN")}`,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(surgMonthRows), "Surgery Month Summary");

      // 8. Call Summary
      const callRows = callSummaryData.rows.map((r) => ({
        Month: r.month,
        Enquiry: r.enquiry,
        Valid: r.valid,
        Converted: r.converted,
        "Enq. To Valid %": r.enqToValidPct,
        "Valid to Con%": r.validToConPct,
        "Enq. to Con %": r.enqToConPct,
        "Consultation Charges": `₹${r.consultationCharges.toLocaleString("en-IN")}`,
        "Surgery Count": r.surgeryCount,
        "Surgery collections": `₹${r.surgeryCollections.toLocaleString("en-IN")}`,
        "Total Collections": `₹${r.totalCollections.toLocaleString("en-IN")}`,
      }));
      callRows.push({
        Month: "Total",
        Enquiry: callSummaryData.totals.enquiry,
        Valid: callSummaryData.totals.valid,
        Converted: callSummaryData.totals.converted,
        "Enq. To Valid %": callSummaryData.totals.enqToValidPct,
        "Valid to Con%": callSummaryData.totals.validToConPct,
        "Enq. to Con %": callSummaryData.totals.enqToConPct,
        "Consultation Charges": `₹${callSummaryData.totals.consultationCharges.toLocaleString("en-IN")}`,
        "Surgery Count": callSummaryData.totals.surgeryCount,
        "Surgery collections": `₹${callSummaryData.totals.surgeryCollections.toLocaleString("en-IN")}`,
        "Total Collections": `₹${callSummaryData.totals.totalCollections.toLocaleString("en-IN")}`,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(callRows), "Call Summary");

      // 9. Sub Dispositions Summary
      const subRows: any[] = [];
      subDispData.groups.forEach((group) => {
        group.rows.forEach((r) => {
          const rowObj: any = {
            Dispositions: group.disposition || "(blank)",
            "Sub Dispositions": r.subDisposition,
          };
          subDispData.months.forEach((m) => {
            rowObj[m] = r.monthCounts[m] || "";
          });
          rowObj["Grand Total"] = r.total;
          subRows.push(rowObj);
        });
        const subTotalObj: any = {
          Dispositions: group.label,
          "Sub Dispositions": "",
        };
        subDispData.months.forEach((m) => {
          subTotalObj[m] = group.totalsByMonth[m] || "";
        });
        subTotalObj["Grand Total"] = group.groupTotal;
        subRows.push(subTotalObj);
      });
      const grandTotalObj: any = {
        Dispositions: "Grand Total",
        "Sub Dispositions": "",
      };
      subDispData.months.forEach((m) => {
        grandTotalObj[m] = subDispData.grandTotals[m] || 0;
      });
      grandTotalObj["Grand Total"] = subDispData.overallGrandTotal;
      subRows.push(grandTotalObj);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(subRows), "Sub Disposition Summary");

      // 10. Lead Source Summary
      const leadSrcRows: any[] = [];
      leadSourceData.groups.forEach((group) => {
        group.rows.forEach((r) => {
          leadSrcRows.push({
            Month: group.month,
            "Lead Source": r.source,
            "COUNTA of Mobile Number": r.count,
          });
        });
        leadSrcRows.push({
          Month: `${group.month} Total`,
          "Lead Source": "",
          "COUNTA of Mobile Number": group.total,
        });
      });
      leadSrcRows.push({
        Month: "Grand Total",
        "Lead Source": "",
        "COUNTA of Mobile Number": leadSourceData.grandTotal,
      });
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(leadSrcRows), "Lead Source Summary");

      // Download consolidated Excel workbook
      XLSX.writeFile(workbook, "All_10_Reports_Consolidated_Summary.xlsx");
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#cc2727]/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-black flex overflow-hidden">
      {/* Sidebar with Navigation (Fixed) */}
      <AdminSidebar user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#cc2727]/10 border border-[#cc2727]/20 text-[#cc2727]">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-black leading-tight">Admin Dashboard</h1>
              <p className="text-[11px] text-gray-500">
                Performance Metrics & Dispositions Reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Month Filter Selector (relevant for FTD, APPT_DATE & SURGERY_DATE view) */}
            {(activeReportTab === "FTD" || activeReportTab === "APPT_DATE" || activeReportTab === "SURGERY_DATE") && (
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-[#cc2727]" />
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent text-black font-medium focus:outline-none cursor-pointer"
                >
                  <option value="All" className="bg-white text-black">
                    All Months
                  </option>
                  {distinctMonths.map((m) => (
                    <option key={m} value={m} className="bg-white text-black">
                      Month: {m}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Location Filter Selector (for Appointment Date, Surgery, Call Summary & Sub-Disp view) */}
            {(activeReportTab === "APPT_DATE" || activeReportTab === "SURGERY_DATE" || activeReportTab === "SURGERY_MONTH" || activeReportTab === "CALL_SUMMARY" || activeReportTab === "SUB_DISP") && (
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="bg-transparent text-black font-medium focus:outline-none cursor-pointer"
                >
                  <option value="All" className="bg-white text-black">
                    All Locations
                  </option>
                  {distinctLocations.map((loc) => (
                    <option key={loc} value={loc} className="bg-white text-black">
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Real-time Live Badge */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/20 rounded-xl text-[11px] font-semibold text-emerald-700">
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
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>

            {/* Export Summary */}
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#cc2727] hover:bg-[#b02121] text-black rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer"
              title="Export Current Matrix to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export Excel</span>
            </button>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 overflow-hidden min-h-0">
          {/* KPI Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
            {/* Total Leads */}
            <div className="py-2 px-3 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500">Total Leads</span>
                <FolderKanban className="w-3.5 h-3.5 text-[#cc2727]" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-black font-mono">{metrics.total}</span>
                <span className="text-[10px] text-gray-600 truncate max-w-[80px]">All records</span>
              </div>
            </div>

            {/* Converted */}
            <div className="py-2 px-3 bg-white border border-emerald-200/20 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-700">Converted</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-black font-mono">{metrics.converted}</span>
                <span className="text-[10px] text-emerald-700/80 font-medium">{metrics.conversionRate}%</span>
              </div>
            </div>

            {/* Contacted */}
            <div className="py-2 px-3 bg-white border border-sky-500/20 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-sky-400">Contacted</span>
                <PhoneCall className="w-3.5 h-3.5 text-sky-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-black font-mono">{metrics.contacted}</span>
                <span className="text-[10px] text-gray-600 truncate max-w-[80px]">Connected</span>
              </div>
            </div>

            {/* Contact Attempt */}
            <div className="py-2 px-3 bg-white border border-amber-500/20 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-amber-400">Contact Attempt</span>
                <PhoneForwarded className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-black font-mono">{metrics.contactAttempt}</span>
                <span className="text-[10px] text-gray-600 truncate max-w-[80px]">Ringing/NA</span>
              </div>
            </div>

            {/* Closed */}
            <div className="py-2 px-3 bg-white border border-rose-500/20 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-rose-400">Closed</span>
                <XCircle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-black font-mono">{metrics.closed}</span>
                <span className="text-[10px] text-gray-600 truncate max-w-[80px]">Lost/Invalid</span>
              </div>
            </div>

            {/* Others / Unassigned */}
            <div className="py-2 px-3 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-500">Unassigned</span>
                <TrendingUp className="w-3.5 h-3.5 text-gray-600" />
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-bold text-black font-mono">{metrics.other}</span>
                <span className="text-[10px] text-gray-600 truncate max-w-[80px]">Pending</span>
              </div>
            </div>
          </div>

          {/* Consolidated 10 Reports Stack */}
          <div className="flex-1 overflow-y-auto min-h-0 space-y-6 bg-slate-50 rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            {/* 1. Lead Summary FTD */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        1. Lead Summary FTD
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Date-wise Dispositions Matrix
                      </span>
                    </div>
                    {/* Inline Filter: Month Filter */}
                    <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                      <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Month:</span>
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="All" className="bg-white text-black">All Months</option>
                        {distinctMonths.map((m) => (
                          <option key={m} value={m} className="bg-white text-black">{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {ftdData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No lead records found for FTD</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="bg-white text-black text-xs font-semibold border-b border-slate-200">
                            <th rowSpan={2} className="px-6 py-3 text-left font-bold italic tracking-wide text-black border-r border-slate-200 sticky left-0 bg-white z-30 min-w-[130px]">
                              <div className="text-[11px] text-gray-500 font-normal">Lead Summary FTD</div>
                              <div className="text-sm font-extrabold text-black mt-0.5">Date</div>
                            </th>
                            <th colSpan={5} className="py-2.5 px-4 text-center font-bold text-[#cc2727] italic tracking-wider bg-white border-r border-slate-200 text-xs">
                              Dispositions
                            </th>
                            <th rowSpan={2} className="px-6 py-3 text-right font-extrabold text-black bg-white min-w-[110px]">
                              Grand Total
                            </th>
                          </tr>
                          <tr className="bg-[#5c768d] text-black text-[12px] font-bold border-b border-slate-300">
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[80px]">Closed</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[120px]">Contact Attempt</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[90px]">Contacted</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[90px]">Converted</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[120px]">Blank Disposition</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {ftdData.rows.map((row) => (
                            <tr key={row.date} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-6 py-2.5 text-left font-sans font-semibold text-black border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-100 transition-colors">
                                {row.date}
                              </td>
                              <td className="px-6 py-2.5 border-r border-slate-200/50 text-black">{row.closed > 0 ? row.closed : ""}</td>
                              <td className="px-6 py-2.5 border-r border-slate-200/50 text-black">{row.contactAttempt > 0 ? row.contactAttempt : ""}</td>
                              <td className="px-6 py-2.5 border-r border-slate-200/50 text-black">{row.contacted > 0 ? row.contacted : ""}</td>
                              <td className="px-6 py-2.5 border-r border-slate-200/50 text-[#cc2727] font-semibold">{row.converted > 0 ? row.converted : ""}</td>
                              <td className="px-6 py-2.5 border-r border-slate-200/50 text-amber-700 font-semibold">{row.other > 0 ? row.other : ""}</td>
                              <td className="px-6 py-2.5 text-right font-bold text-black group-hover:text-[#cc2727]">{row.grandTotal}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/60 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-extrabold text-sm text-black border-r border-slate-200 sticky left-0 bg-white z-30">Grand Total</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-black">{ftdData.totals.closed}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-black">{ftdData.totals.contactAttempt}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-black">{ftdData.totals.contacted}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-[#cc2727] font-extrabold">{ftdData.totals.converted}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-amber-700 font-extrabold">{ftdData.totals.other}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-[#cc2727]">{ftdData.totals.grandTotal}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 2. Lead Summary MTD */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        2. Lead Summary MTD
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Month-wise Dispositions Matrix
                      </span>
                    </div>
                  </div>
                  {mtdData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No monthly records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="bg-white text-black text-xs font-semibold border-b border-slate-200">
                            <th rowSpan={2} className="px-6 py-3 text-left font-bold italic tracking-wide text-black border-r border-slate-200 sticky left-0 bg-white z-30 min-w-[130px]">
                              <div className="text-[11px] text-gray-500 font-normal">Lead Summary MTD</div>
                              <div className="text-sm font-extrabold text-black mt-0.5">Month</div>
                            </th>
                            <th colSpan={5} className="py-2.5 px-4 text-center font-bold text-[#cc2727] italic tracking-wider bg-white border-r border-slate-200 text-xs">
                              Dispositions
                            </th>
                            <th rowSpan={2} className="px-6 py-3 text-right font-extrabold text-black bg-white min-w-[110px]">
                              Grand Total
                            </th>
                          </tr>
                          <tr className="bg-[#5c768d] text-black text-[12px] font-bold border-b border-slate-300">
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[80px]">Closed</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[120px]">Contact Attempt</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[90px]">Contacted</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[90px]">Converted</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[120px]">Blank Disposition</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {mtdData.rows.map((row) => (
                            <tr key={row.month} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-6 py-3.5 text-left font-sans font-bold text-black border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-100 transition-colors">
                                {row.month}
                              </td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-black">{row.closed > 0 ? row.closed : ""}</td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-black">{row.contactAttempt > 0 ? row.contactAttempt : ""}</td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-black">{row.contacted > 0 ? row.contacted : ""}</td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-[#cc2727] font-semibold">{row.converted > 0 ? row.converted : ""}</td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-amber-700 font-semibold">{row.other > 0 ? row.other : ""}</td>
                              <td className="px-6 py-3.5 text-right font-extrabold text-black group-hover:text-[#cc2727]">{row.grandTotal}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/60 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-extrabold text-sm text-black border-r border-slate-200 sticky left-0 bg-white z-30">Grand Total</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-black">{mtdData.totals.closed}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-black">{mtdData.totals.contactAttempt}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-black">{mtdData.totals.contacted}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-[#cc2727] font-extrabold">{mtdData.totals.converted}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-amber-700 font-extrabold">{mtdData.totals.other}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-[#cc2727]">{mtdData.totals.grandTotal}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. Valid Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        3. Valid Summary
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Valid Status Matrix (% Breakdown)
                      </span>
                    </div>
                  </div>
                  {validSummaryData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No valid status records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="bg-white text-black text-xs font-semibold border-b border-slate-200">
                            <th rowSpan={2} className="px-6 py-3 text-left font-bold italic tracking-wide text-black border-r border-slate-200 sticky left-0 bg-white z-30 min-w-[130px]">
                              <div className="text-[11px] text-gray-500 font-normal">Valid Summary</div>
                              <div className="text-sm font-extrabold text-black mt-0.5">Month</div>
                            </th>
                            <th colSpan={3} className="py-2.5 px-4 text-center font-bold text-[#cc2727] italic tracking-wider bg-white border-r border-slate-200 text-xs">
                              Valid Status
                            </th>
                            <th rowSpan={2} className="px-6 py-3 text-right font-extrabold text-black bg-white border-r border-slate-200 min-w-[100px]">Grand Total</th>
                            <th rowSpan={2} className="px-6 py-3 text-right font-extrabold text-black bg-[#7ba0cd] min-w-[90px]">Valid %</th>
                          </tr>
                          <tr className="bg-[#5c768d] text-black text-[12px] font-bold border-b border-slate-300">
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[80px]">Invalid</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[80px]">NA</th>
                            <th className="px-6 py-2 border-r border-slate-600/50 min-w-[80px]">Valid</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {validSummaryData.rows.map((row) => (
                            <tr key={row.month} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-6 py-3.5 text-left font-sans font-bold text-black border-r border-slate-200 sticky left-0 bg-white group-hover:bg-slate-100 transition-colors">
                                {row.month}
                              </td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-rose-300">{row.invalid > 0 ? row.invalid : ""}</td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-black">{row.na > 0 ? row.na : ""}</td>
                              <td className="px-6 py-3.5 border-r border-slate-200/50 text-[#cc2727] font-bold">{row.valid > 0 ? row.valid : ""}</td>
                              <td className="px-6 py-3.5 text-right font-extrabold text-black border-r border-slate-200 group-hover:text-[#cc2727]">{row.grandTotal}</td>
                              <td className="px-6 py-3.5 text-right font-extrabold text-black bg-[#c0d4ec] font-mono">{row.validPercent}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/60 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-extrabold text-sm text-black border-r border-slate-200 sticky left-0 bg-white z-30">Grand Total</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-rose-300">{validSummaryData.totals.invalid}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-black">{validSummaryData.totals.na}</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-[#cc2727] font-extrabold">{validSummaryData.totals.valid}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-black border-r border-slate-200">{validSummaryData.totals.grandTotal}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-black bg-[#9cb3d5]">{validSummaryData.totals.validPercent}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. Appointment Date Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        4. Appointment Date Summary FTD
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Date-wise Appointment Count & Collections
                      </span>
                    </div>
                    {/* Inline Filters: Month & Location */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                        <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Month:</span>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                        >
                          <option value="All" className="bg-white text-black">All Months</option>
                          {distinctMonths.map((m) => (
                            <option key={m} value={m} className="bg-white text-black">{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                        <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Location:</span>
                        <select
                          value={selectedLocation}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                        >
                          <option value="All" className="bg-white text-black">All Locations</option>
                          {distinctLocations.map((loc) => (
                            <option key={loc} value={loc} className="bg-white text-black">{loc}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {appointmentDateData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No appointment date records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="border-b border-slate-300 font-bold text-xs bg-white">
                            <th className="px-6 py-3.5 text-left font-bold italic tracking-wide text-black border-r border-slate-200 min-w-[150px]">
                              Appointment Date
                            </th>
                            <th className="px-5 py-3.5 text-left font-bold text-black border-r border-slate-200 min-w-[160px]">
                              Location
                            </th>
                            <th className="px-6 py-3.5 text-center font-bold text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[90px]">
                              Count
                            </th>
                            <th className="px-6 py-3.5 text-right font-bold text-black bg-[#5c768d] min-w-[130px]">
                              Collections
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {appointmentDateData.rows.map((row, idx) => (
                            <tr key={`${row.date}-${row.location}-${idx}`} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-6 py-2.5 text-left font-sans font-semibold text-black border-r border-slate-200 bg-white group-hover:bg-slate-100 transition-colors">
                                {row.date}
                              </td>
                              <td className="px-5 py-2.5 text-left font-sans text-black border-r border-slate-200/50">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100/80 text-[11px] text-black font-medium border border-slate-300/60">
                                  <MapPin className="w-3 h-3 text-[#cc2727] shrink-0" />
                                  {row.location}
                                </span>
                              </td>
                              <td className="px-6 py-2.5 text-center text-black border-r border-slate-200/50">
                                {row.count}
                              </td>
                              <td className="px-6 py-2.5 text-right font-bold text-emerald-700">
                                ₹{row.collections.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/60 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-extrabold text-sm text-black border-r border-slate-200 sticky left-0 bg-white z-30">Grand Total</td>
                            <td className="px-5 py-3.5 border-r border-slate-200 text-gray-600 text-xs font-sans text-left">—</td>
                            <td className="px-6 py-3.5 text-center text-sm font-extrabold text-black border-r border-slate-200">{appointmentDateData.totals.count}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-emerald-700">₹{appointmentDateData.totals.collections.toLocaleString("en-IN")}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 5. Appointment Month Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        5. Appointment month Summary MTD
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Month-wise Appointment Count & Collections
                      </span>
                    </div>
                    {/* Inline Filter: Location */}
                    <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                      <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Location:</span>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="All" className="bg-white text-black">All Locations</option>
                        {distinctLocations.map((loc) => (
                          <option key={loc} value={loc} className="bg-white text-black">{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {appointmentMonthData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No appointment records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="border-b border-slate-300 font-bold text-xs bg-white">
                            <th className="px-6 py-3.5 text-left font-bold italic tracking-wide text-black border-r border-slate-200 min-w-[160px]">
                              Appointment month
                            </th>
                            <th className="px-6 py-3.5 text-center font-bold text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[100px]">
                              Count
                            </th>
                            <th className="px-6 py-3.5 text-right font-bold text-black bg-[#5c768d] min-w-[130px]">
                              Collections
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {appointmentMonthData.rows.map((row) => (
                            <tr key={row.month} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-6 py-3.5 text-left font-sans font-bold text-black border-r border-slate-200 bg-white group-hover:bg-slate-100 transition-colors">
                                {row.month}
                              </td>
                              <td className="px-6 py-3.5 text-center text-black border-r border-slate-200/50">
                                {row.count}
                              </td>
                              <td className="px-6 py-3.5 text-right font-bold text-emerald-700">
                                ₹{row.collections.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/60 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-extrabold text-sm text-black border-r border-slate-200 sticky left-0 bg-white z-30">Grand Total</td>
                            <td className="px-6 py-3.5 text-center text-sm font-extrabold text-black border-r border-slate-200">{appointmentMonthData.totals.count}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-emerald-700">₹{appointmentMonthData.totals.collections.toLocaleString("en-IN")}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 6. Surgery Date Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        6. Surgery Date Summary FTD
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Date-wise Surgery Count & Payment Received
                      </span>
                    </div>
                    {/* Inline Filters: Month & Location */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                        <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Month:</span>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                        >
                          <option value="All" className="bg-white text-black">All Months</option>
                          {distinctMonths.map((m) => (
                            <option key={m} value={m} className="bg-white text-black">{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                        <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Location:</span>
                        <select
                          value={selectedLocation}
                          onChange={(e) => setSelectedLocation(e.target.value)}
                          className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                        >
                          <option value="All" className="bg-white text-black">All Locations</option>
                          {distinctLocations.map((loc) => (
                            <option key={loc} value={loc} className="bg-white text-black">{loc}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {surgeryDateData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No surgery date records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="border-b border-slate-300 font-bold text-xs bg-white">
                            <th className="px-6 py-3.5 text-left font-bold italic tracking-wide text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[150px]">
                              Surgery Date
                            </th>
                            <th className="px-5 py-3.5 text-left font-bold text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[160px]">
                              Location
                            </th>
                            <th className="px-6 py-3.5 text-center font-bold text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[90px]">
                              Count
                            </th>
                            <th className="px-6 py-3.5 text-right font-bold text-black bg-[#5c768d] min-w-[170px]">
                              Surgery - Payment Received
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {surgeryDateData.rows.map((row, idx) => (
                            <tr key={`${row.date}-${row.location}-${idx}`} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-6 py-2.5 text-left font-sans font-semibold text-black border-r border-slate-200 bg-white group-hover:bg-slate-100 transition-colors">
                                {row.date}
                              </td>
                              <td className="px-5 py-2.5 text-left font-sans text-black border-r border-slate-200/50">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100/80 text-[11px] text-black font-medium border border-slate-300/60">
                                  <MapPin className="w-3 h-3 text-[#cc2727] shrink-0" />
                                  {row.location}
                                </span>
                              </td>
                              <td className="px-6 py-2.5 text-center text-black border-r border-slate-200/50">
                                {row.count}
                              </td>
                              <td className="px-6 py-2.5 text-right font-bold text-emerald-700">
                                ₹{row.paymentReceived.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/60 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-extrabold text-sm text-black border-r border-slate-200 sticky left-0 bg-white z-30">Grand Total</td>
                            <td className="px-5 py-3.5 border-r border-slate-200 text-gray-600 text-xs font-sans text-left">—</td>
                            <td className="px-6 py-3.5 text-center text-sm font-extrabold text-black border-r border-slate-200">{surgeryDateData.totals.count}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-emerald-700">₹{surgeryDateData.totals.paymentReceived.toLocaleString("en-IN")}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 7. Surgery Month Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        7. Surgery month Summary MTD
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Month-wise Surgery Count & Payment Received
                      </span>
                    </div>
                    {/* Inline Filter: Location */}
                    <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                      <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Location:</span>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="All" className="bg-white text-black">All Locations</option>
                        {distinctLocations.map((loc) => (
                          <option key={loc} value={loc} className="bg-white text-black">{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {surgeryMonthData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No surgery records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="border-b border-slate-300 font-bold text-xs bg-white">
                            <th className="px-6 py-3.5 text-left font-bold italic tracking-wide text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[160px]">
                              Surgery month
                            </th>
                            <th className="px-6 py-3.5 text-center font-bold text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[100px]">
                              Count
                            </th>
                            <th className="px-6 py-3.5 text-right font-bold text-black bg-[#5c768d] min-w-[180px]">
                              Surgery - Payment Received
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {surgeryMonthData.rows.map((row) => (
                            <tr key={row.month} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-6 py-3.5 text-left font-sans font-bold text-black border-r border-slate-200 bg-white group-hover:bg-slate-100 transition-colors">
                                {row.month}
                              </td>
                              <td className="px-6 py-3.5 text-center text-black border-r border-slate-200/50">
                                {row.count}
                              </td>
                              <td className="px-6 py-3.5 text-right font-bold text-emerald-700">
                                ₹{row.paymentReceived.toLocaleString("en-IN")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/60 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-extrabold text-sm text-black border-r border-slate-200 sticky left-0 bg-white z-30">Grand Total</td>
                            <td className="px-6 py-3.5 text-center text-sm font-extrabold text-black border-r border-slate-200">{surgeryMonthData.totals.count}</td>
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-emerald-700">₹{surgeryMonthData.totals.paymentReceived.toLocaleString("en-IN")}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 8. Call Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-block bg-[#ffff00] text-black font-black text-xs px-2 py-0.5 rounded shadow-sm border border-yellow-500/50 uppercase tracking-wider">
                        8. Call Summary
                      </span>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Master Month-wise Conversion & Collections
                      </span>
                    </div>
                    {/* Inline Filter: Location */}
                    <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                      <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Location:</span>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="All" className="bg-white text-black">All Locations</option>
                        {distinctLocations.map((loc) => (
                          <option key={loc} value={loc} className="bg-white text-black">{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {callSummaryData.rows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No call summary records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="border-b border-slate-300 font-bold text-xs bg-[#5c768d] text-black">
                            <th className="px-5 py-3.5 text-left font-bold border-r border-slate-600/50 min-w-[110px]">Month</th>
                            <th className="px-4 py-3.5 text-center font-bold border-r border-slate-600/50 min-w-[85px]">Enquiry</th>
                            <th className="px-4 py-3.5 text-center font-bold border-r border-slate-600/50 min-w-[85px]">Valid</th>
                            <th className="px-4 py-3.5 text-center font-bold border-r border-slate-600/50 min-w-[95px]">Converted</th>
                            <th className="px-4 py-3.5 text-right font-bold border-r border-slate-600/50 min-w-[110px]">Enq. To Valid %</th>
                            <th className="px-4 py-3.5 text-right font-bold border-r border-slate-600/50 min-w-[105px]">Valid to Con%</th>
                            <th className="px-4 py-3.5 text-right font-bold border-r border-slate-600/50 min-w-[105px]">Enq. to Con %</th>
                            <th className="px-5 py-3.5 text-right font-bold border-r border-slate-600/50 min-w-[145px]">Consultation Charges</th>
                            <th className="px-4 py-3.5 text-center font-bold border-r border-slate-600/50 min-w-[100px]">Surgery Count</th>
                            <th className="px-5 py-3.5 text-right font-bold border-r border-slate-600/50 min-w-[140px]">Surgery collections</th>
                            <th className="px-5 py-3.5 text-right font-bold min-w-[140px]">Total Collections</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {callSummaryData.rows.map((row) => (
                            <tr key={row.month} className="hover:bg-slate-100/60 transition-colors group">
                              <td className="px-5 py-3 text-left font-sans font-bold text-black border-r border-slate-200 bg-white group-hover:bg-slate-100 transition-colors">{row.month}</td>
                              <td className="px-4 py-3 text-center text-black border-r border-slate-200/50">{row.enquiry}</td>
                              <td className="px-4 py-3 text-center text-black border-r border-slate-200/50">{row.valid}</td>
                              <td className="px-4 py-3 text-center text-[#cc2727] font-bold border-r border-slate-200/50">{row.converted > 0 ? row.converted : ""}</td>
                              <td className="px-4 py-3 text-right text-black border-r border-slate-200/50">{row.enqToValidPct}</td>
                              <td className="px-4 py-3 text-right text-black border-r border-slate-200/50">{row.validToConPct}</td>
                              <td className="px-4 py-3 text-right text-black border-r border-slate-200/50">{row.enqToConPct}</td>
                              <td className="px-5 py-3 text-right text-black border-r border-slate-200/50 font-bold">₹{row.consultationCharges.toLocaleString("en-IN")}</td>
                              <td className="px-4 py-3 text-center text-black border-r border-slate-200/50">{row.surgeryCount}</td>
                              <td className="px-5 py-3 text-right text-[#cc2727] font-bold border-r border-slate-200/50">₹{row.surgeryCollections.toLocaleString("en-IN")}</td>
                              <td className="px-5 py-3 text-right text-[#cc2727] font-extrabold">₹{row.totalCollections.toLocaleString("en-IN")}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/80 bg-[#dbe5f1] text-black font-bold">
                            <td className="px-5 py-3 text-left font-sans font-black text-sm text-black border-r border-slate-300">Total</td>
                            <td className="px-4 py-3 text-center font-bold text-black border-r border-slate-300">{callSummaryData.totals.enquiry}</td>
                            <td className="px-4 py-3 text-center font-bold text-black border-r border-slate-300">{callSummaryData.totals.valid}</td>
                            <td className="px-4 py-3 text-center font-bold text-black border-r border-slate-300">{callSummaryData.totals.converted}</td>
                            <td className="px-4 py-3 text-right font-bold text-black border-r border-slate-300">{callSummaryData.totals.enqToValidPct}</td>
                            <td className="px-4 py-3 text-right font-bold text-black border-r border-slate-300">{callSummaryData.totals.validToConPct}</td>
                            <td className="px-4 py-3 text-right font-bold text-black border-r border-slate-300">{callSummaryData.totals.enqToConPct}</td>
                            <td className="px-5 py-3 text-right font-bold text-black border-r border-slate-300">₹{callSummaryData.totals.consultationCharges.toLocaleString("en-IN")}</td>
                            <td className="px-4 py-3 text-center font-bold text-black border-r border-slate-300">{callSummaryData.totals.surgeryCount}</td>
                            <td className="px-5 py-3 text-right font-bold text-black border-r border-slate-300">₹{callSummaryData.totals.surgeryCollections.toLocaleString("en-IN")}</td>
                            <td className="px-5 py-3 text-right font-black text-black text-sm">₹{callSummaryData.totals.totalCollections.toLocaleString("en-IN")}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 9. Sub Dispositions Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        9. Sub Dispositions Summary
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Hierarchical Disposition & Sub-Disposition Matrix
                      </span>
                    </div>
                    {/* Inline Filter: Location */}
                    <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                      <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Location:</span>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="All" className="bg-white text-black">All Locations</option>
                        {distinctLocations.map((loc) => (
                          <option key={loc} value={loc} className="bg-white text-black">{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {subDispData.groups.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No sub-disposition records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                      <table className="w-full text-center text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="bg-white text-black text-xs font-semibold border-b border-slate-200">
                            <th colSpan={2} className="px-6 py-2.5 text-left font-bold italic tracking-wide text-black border-r border-slate-200">Count</th>
                            <th colSpan={subDispData.months.length + 1} className="px-4 py-2.5 text-left font-bold italic tracking-wider text-black bg-white border-b border-slate-200">Month</th>
                          </tr>
                          <tr className="border-b border-slate-300 font-bold text-xs bg-white text-black">
                            <th className="px-6 py-3 text-left font-bold italic border-r border-slate-200 min-w-[170px]">Dispositions</th>
                            <th className="px-6 py-3 text-left font-bold italic border-r border-slate-200 min-w-[220px]">Sub Dispositions</th>
                            {subDispData.months.map((m) => (
                              <th key={m} className="px-5 py-3 text-center font-bold text-black bg-[#5c768d] border-r border-slate-600/50 min-w-[90px]">{m}</th>
                            ))}
                            <th className="px-6 py-3 text-right font-bold text-black bg-[#5c768d] min-w-[100px]">Grand Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono font-medium">
                          {subDispData.groups.map((group) => {
                            const isCollapsed = !!collapsedDispositions[group.disposition];
                            return (
                              <Fragment key={group.disposition || "__blank__"}>
                                {!isCollapsed &&
                                  group.rows.map((row, rIdx) => (
                                    <tr key={`${group.disposition}-${row.subDisposition}-${rIdx}`} className="hover:bg-slate-100/60 transition-colors group">
                                      <td className="px-6 py-2 text-left font-sans font-semibold text-black border-r border-slate-200 bg-white/60">
                                        {rIdx === 0 && (
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => toggleDispositionCollapse(group.disposition)}
                                              className="text-gray-500 hover:text-black transition-colors cursor-pointer"
                                              title={isCollapsed ? "Expand group" : "Collapse group"}
                                            >
                                              {isCollapsed ? <PlusSquare className="w-3.5 h-3.5 text-[#cc2727]" /> : <MinusSquare className="w-3.5 h-3.5 text-gray-500 hover:text-[#cc2727]" />}
                                            </button>
                                            <span className="font-bold text-black">{group.disposition || "(blank)"}</span>
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-6 py-2 text-left font-sans text-black border-r border-slate-200/50 pl-8">{row.subDisposition}</td>
                                      {subDispData.months.map((m) => (
                                        <td key={m} className="px-5 py-2 text-center text-black border-r border-slate-200/50">{row.monthCounts[m] > 0 ? row.monthCounts[m] : ""}</td>
                                      ))}
                                      <td className="px-6 py-2 text-right font-bold text-black">{row.total}</td>
                                    </tr>
                                  ))}
                                <tr className="bg-white/90 border-y border-slate-300 font-sans font-bold text-xs text-black">
                                  <td className="px-6 py-2.5 text-left border-r border-slate-200">
                                    <div className="flex items-center gap-2">
                                      {isCollapsed && (
                                        <button
                                          type="button"
                                          onClick={() => toggleDispositionCollapse(group.disposition)}
                                          className="text-gray-500 hover:text-black transition-colors cursor-pointer"
                                          title="Expand group"
                                        >
                                          <PlusSquare className="w-3.5 h-3.5 text-[#cc2727]" />
                                        </button>
                                      )}
                                      <span className={group.disposition ? "font-bold text-[#cc2727]" : "font-semibold text-gray-500"}>{group.label}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-2.5 border-r border-slate-200 text-gray-600">—</td>
                                  {subDispData.months.map((m) => (
                                    <td key={m} className="px-5 py-2.5 text-center font-mono font-bold text-black border-r border-slate-200">{group.totalsByMonth[m] > 0 ? group.totalsByMonth[m] : ""}</td>
                                  ))}
                                  <td className="px-6 py-2.5 text-right font-mono font-bold text-[#cc2727]">{group.groupTotal}</td>
                                </tr>
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/80 bg-white">
                            <td className="px-6 py-3.5 text-left font-sans font-black text-sm text-black border-r border-slate-200">Grand Total</td>
                            <td className="px-6 py-3.5 border-r border-slate-200 text-gray-600">—</td>
                            {subDispData.months.map((m) => (
                              <td key={m} className="px-5 py-3.5 text-center text-sm font-extrabold text-black border-r border-slate-200">{subDispData.grandTotals[m]}</td>
                            ))}
                            <td className="px-6 py-3.5 text-right text-sm font-extrabold text-emerald-700">{subDispData.overallGrandTotal}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 10. Lead Source Summary */}
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#cc2727] animate-pulse" />
                      <h2 className="text-sm font-bold text-black tracking-wide">
                        10. Lead Source Summary
                      </h2>
                      <span className="text-xs text-gray-500 italic hidden sm:inline">
                        — Month-wise Lead Source & COUNTA of Mobile Number
                      </span>
                    </div>
                    {/* Inline Filter: Location */}
                    <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-300 rounded-xl px-2.5 py-1 text-xs">
                      <MapPin className="w-3.5 h-3.5 text-[#cc2727] shrink-0" />
                      <span className="text-gray-500 text-[11px] font-medium hidden md:inline">Location:</span>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="bg-transparent text-black font-medium focus:outline-none cursor-pointer text-xs"
                      >
                        <option value="All" className="bg-white text-black">All Locations</option>
                        {distinctLocations.map((loc) => (
                          <option key={loc} value={loc} className="bg-white text-black">{loc}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {leadSourceData.groups.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-600">No Lead Source records found</div>
                  ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                      <table className="w-full text-xs text-black border-collapse select-none whitespace-nowrap">
                        <thead className="sticky top-0 z-20 shadow-md">
                          <tr className="border-b border-slate-300 font-bold text-xs bg-white">
                            <th className="px-6 py-3 text-left font-bold italic tracking-wide text-black border-r border-slate-200 w-[140px]">Month</th>
                            <th className="px-6 py-3 text-left font-bold italic tracking-wide text-black border-r border-slate-200">Lead Source</th>
                            <th className="px-6 py-3 text-right font-bold text-black bg-[#5c768d] border-b border-slate-600/50 w-[200px]">COUNTA of Mobile Number</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/40 text-xs font-mono">
                          {leadSourceData.groups.map((group) => {
                            const isCollapsed = collapsedMonths[group.month];
                            return (
                              <Fragment key={group.month}>
                                {!isCollapsed &&
                                  group.rows.map((row, idx) => (
                                    <tr key={`${group.month}-${row.source}`} className="hover:bg-slate-50 transition-colors">
                                      {idx === 0 ? (
                                        <td rowSpan={group.rows.length} className="px-6 py-2.5 text-left font-sans font-bold text-black border-r border-slate-200 align-top bg-slate-50">
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => toggleMonthCollapse(group.month)}
                                              className="text-gray-500 hover:text-black transition-colors cursor-pointer"
                                              title="Collapse month"
                                            >
                                              <MinusSquare className="w-3.5 h-3.5 text-sky-400" />
                                            </button>
                                            <span className="font-semibold text-black">{group.month === "(blank)" ? "" : group.month}</span>
                                          </div>
                                        </td>
                                      ) : null}
                                      <td className="px-6 py-2.5 text-left font-sans text-black border-r border-slate-200/60">{row.source}</td>
                                      <td className="px-6 py-2.5 text-right font-bold text-black">{row.count}</td>
                                    </tr>
                                  ))}
                                <tr className="bg-[#dbe5f1]/10 border-t border-b border-slate-300/60 font-bold hover:bg-[#dbe5f1]/20 transition-colors">
                                  <td className="px-6 py-2.5 text-left font-sans font-extrabold text-black border-r border-slate-200">
                                    <div className="flex items-center gap-2">
                                      {isCollapsed && (
                                        <button
                                          type="button"
                                          onClick={() => toggleMonthCollapse(group.month)}
                                          className="text-gray-500 hover:text-black transition-colors cursor-pointer"
                                          title="Expand month"
                                        >
                                          <PlusSquare className="w-3.5 h-3.5 text-sky-400" />
                                        </button>
                                      )}
                                      <span>{isCollapsed ? `${group.month === "(blank)" ? "Total" : group.month}` : `${group.month === "(blank)" ? "Total" : `${group.month} Total`}`}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-2.5 border-r border-slate-200 text-gray-600"></td>
                                  <td className="px-6 py-2.5 text-right font-mono font-bold text-sky-300">{group.total}</td>
                                </tr>
                              </Fragment>
                            );
                          })}
                        </tbody>
                        <tfoot className="sticky bottom-0 z-20 bg-white text-black font-mono font-bold text-xs shadow-sm">
                          <tr className="border-t-2 border-double border-slate-400/80 bg-white">
                            <td colSpan={2} className="px-6 py-3.5 text-left font-sans font-black text-sm text-black border-r border-slate-200">Grand Total</td>
                            <td className="px-6 py-3.5 text-right text-sm font-black text-emerald-700">{leadSourceData.grandTotal}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              </div>
        </main>
      </div>
    </div>
  );
}
