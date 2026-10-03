"use client";

import { useState, useRef } from "react";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  FileText,
  Download,
  Loader2,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getMonthFromDate, notifyLeadUpdated } from "@/lib/leadOptions";

interface UploadLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsImported: (leads: any[], nextId: string, deletedCount?: number) => void;
}

// Clean and normalize keys for fuzzy matching
function cleanKey(k: string): string {
  return k.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

/**
 * Normalises any date value to DD-MMM-YY string.
 * Handles: Excel serial int, DD-MMM-YY, DD-MMM-YYYY, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, ISO timestamp.
 */
function parseAnyDate(raw: any): string {
  if (!raw && raw !== 0) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // Excel serial number (pure integer, 25000-60000 range = years 1968–2064)
  const asNum = Number(str);
  if (!isNaN(asNum) && asNum > 25000 && asNum < 60000 && !str.includes("-") && !str.includes("/")) {
    const d = new Date((asNum - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      const yr = String(d.getFullYear()).slice(-2);
      const dy = String(d.getDate()).padStart(2, "0");
      return `${dy}-${MONTH_NAMES[d.getMonth()]}-${yr}`;
    }
  }

  // DD-MMM-YY or DD-MMM-YYYY (e.g. 28-Sep-26, 28-Sep-2026)
  const m1 = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(str);
  if (m1) {
    const day = m1[1].padStart(2, "0");
    const mmm = m1[2].charAt(0).toUpperCase() + m1[2].slice(1).toLowerCase();
    const yr = m1[3].length === 4 ? m1[3].slice(-2) : m1[3];
    return `${day}-${mmm}-${yr}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY (e.g. 15-09-2026)
  const m2 = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(str);
  if (m2) {
    const day = m2[1].padStart(2, "0");
    const monthIdx = parseInt(m2[2], 10) - 1;
    const yr = m2[3].slice(-2);
    return `${day}-${MONTH_NAMES[monthIdx] || m2[2]}-${yr}`;
  }

  // YYYY-MM-DD (e.g. 2026-09-15)
  const m3 = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (m3) {
    const monthIdx = parseInt(m3[2], 10) - 1;
    const yr = m3[1].slice(-2);
    return `${m3[3]}-${MONTH_NAMES[monthIdx] || m3[2]}-${yr}`;
  }

  // ISO / any other JS-parseable date
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const yr = String(d.getFullYear()).slice(-2);
    const dy = String(d.getDate()).padStart(2, "0");
    return `${dy}-${MONTH_NAMES[d.getMonth()]}-${yr}`;
  }

  return str; // fallback: keep as-is
}

/** Derives MMM-YY from a DD-MMM-YY string */
function monthFromDDMMMYY(ddMMMYY: string): string {
  if (!ddMMMYY) return "";
  const parts = ddMMMYY.split("-");
  if (parts.length === 3 && MONTH_NAMES.includes(parts[1])) {
    return `${parts[1]}-${parts[2]}`;
  }
  return "";
}

// Parses any raw date/timestamp (ISO e.g. "2026-08-11T22:28:43+05:30", Excel serial, or string)
function parseExcelTimestamp(raw: any): { date: string; month: string; timestamp: string } {
  if (!raw) return { date: "", month: "", timestamp: "" };

  try {
    let d: Date | null = null;
    if (raw instanceof Date) {
      d = raw;
    } else if (typeof raw === "number") {
      // Excel serial date number
      d = new Date((raw - (25567 + 2)) * 86400 * 1000);
    } else {
      const str = String(raw).trim();
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        d = parsed;
      }
    }

    if (!d || isNaN(d.getTime())) {
      // Fallback: If not parsed, return as raw string date
      return { date: String(raw).trim(), month: "", timestamp: "" };
    }

    const year = String(d.getFullYear()).slice(-2);
    const day = String(d.getDate()).padStart(2, "0");
    const mmm = MONTH_NAMES[d.getMonth()] || "Jan";
    const dateFormatted = `${day}-${mmm}-${year}`;
    const monthFormatted = `${mmm}-${year}`;

    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, "0");
    const timestampFormatted = `${dateFormatted}, ${strHours}:${minutes} ${ampm}`;

    return {
      date: dateFormatted,
      month: monthFormatted,
      timestamp: timestampFormatted,
    };
  } catch (e) {
    return { date: String(raw).trim(), month: "", timestamp: "" };
  }
}

// Cleans phone number (strips Meta 'p:+91' or '+91' prefix and spaces)
function cleanPhoneNumber(raw: any): string {
  if (!raw) return "";
  let str = String(raw).trim();
  if (str.toLowerCase().startsWith("p:")) {
    str = str.slice(2).trim();
  }
  str = str.replace(/[^\d+]/g, "");
  if (str.startsWith("+91") && str.length === 13) {
    return str.slice(3);
  }
  if (str.startsWith("91") && str.length === 12) {
    return str.slice(2);
  }
  return str;
}

export default function UploadLeadsModal({
  isOpen,
  onClose,
  onLeadsImported,
}: UploadLeadsModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedLeads, setParsedLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (selectedFile: File) => {
    setError("");
    setFile(selectedFile);

    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Excel file is empty or has no readable sheets.");
      }

      const worksheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: true,
      });

      if (!rawRows || rawRows.length === 0) {
        throw new Error("No data rows found in the uploaded sheet.");
      }

      const mapped = rawRows.map((row) => {
        const cleanedRow: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          cleanedRow[cleanKey(key)] = value;
        }

        const getVal = (...possibleKeys: string[]): string => {
          for (const k of possibleKeys) {
            const ck = cleanKey(k);
            if (cleanedRow[ck] !== undefined && cleanedRow[ck] !== "") {
              return String(cleanedRow[ck]).trim();
            }
          }
          return "";
        };

        // getRawVal: returns the raw value (number/string/Date) — needed for date fields
        // so Excel serial numbers are NOT coerced to string prematurely
        const getRawVal = (...possibleKeys: string[]): any => {
          for (const k of possibleKeys) {
            const ck = cleanKey(k);
            if (cleanedRow[ck] !== undefined && cleanedRow[ck] !== "") {
              return cleanedRow[ck];
            }
          }
          return "";
        };

        // 1. Extract Date from sheet (priority to Date / Date of Lead)
        const rawDateVal = getRawVal(
          "Date",
          "Date (DD-MMM-YY)",
          "date",
          "Date of Lead",
          "leadDate",
          "Created Time",
          "created_time",
          "Timestamp",
          "leadTimestamp"
        );

        const parsedDate = parseAnyDate(rawDateVal);
        const parsedMonth = monthFromDDMMMYY(parsedDate) || (parsedDate ? getMonthFromDate(parsedDate) : "");

        // 2. Time Stamp: if Excel already has a formatted timestamp with time, keep it, otherwise format with current upload time
        const rawTimestampVal = getRawVal("Time Stamp", "leadTimestamp", "Timestamp");
        let parsedTimestamp = "";
        if (rawTimestampVal && String(rawTimestampVal).includes(":") && (String(rawTimestampVal).includes("AM") || String(rawTimestampVal).includes("PM"))) {
          parsedTimestamp = String(rawTimestampVal).trim();
        } else {
          // Keep the exact lead date, with current upload time
          const now = new Date();
          let hrs = now.getHours();
          const mins = String(now.getMinutes()).padStart(2, "0");
          const ampm = hrs >= 12 ? "PM" : "AM";
          hrs = hrs % 12;
          hrs = hrs ? hrs : 12;
          const strHours = String(hrs).padStart(2, "0");
          const effectiveDate = parsedDate || `${String(now.getDate()).padStart(2, "0")}-${MONTH_NAMES[now.getMonth()]}-${String(now.getFullYear()).slice(-2)}`;
          parsedTimestamp = `${effectiveDate}, ${strHours}:${mins} ${ampm}`;
        }

        const rawPhone = getVal(
          "Mobile Number",
          "Phone Number",
          "phone_number",
          "mobile",
          "phone",
          "contact",
          "Patient Mobile"
        );
        const finalPhone = cleanPhoneNumber(rawPhone);

        const altPhone = cleanPhoneNumber(
          getVal("Alternate #", "Alternate Number", "alternateNumber", "alt_phone")
        );

        const pName = getVal(
          "Patient Name",
          "full_name",
          "Name",
          "name",
          "patient",
          "patientName"
        );
        const pAge = getVal("Patient Age", "Age", "age", "patientAge");
        const sName = getVal("Spouse Name", "spouseName", "Spouse");
        const sAge = getVal("Spouse Age", "spouseAge");
        const loc = getVal("Location", "city", "City", "location", "Branch");
        const caller = getVal("Caller Name", "callerName", "Caller", "Agent");
        const leadSrc = getVal(
          "Lead Source",
          "leadSource",
          "Source",
          "platform",
          "campaign"
        );
        const referred = getVal("Referred By", "referredBy", "Referral");
        const treat = getVal(
          "Looking for Treatment",
          "Treatment",
          "treatment",
          "lookingForTreatment"
        );
        const treatReq = getVal(
          "Treatment Requirements",
          "treatmentRequirements",
          "Requirements"
        );
        const preCond = getVal(
          "Pre Conditions",
          "preConditions",
          "Medical History"
        );
        const surgDetails = getVal(
          "Surgery Details",
          "surgeryDetails",
          "Surgical Data"
        );
        const followUp = parseAnyDate(getRawVal(
          "Follow Up Date",
          "followUpDate",
          "Next Follow Up"
        ));
        const subDisp = getVal(
          "Sub Dispositions",
          "subDispositions",
          "Sub Disposition"
        );
        const disp = getVal("Dispositions", "dispositions", "Disposition");
        const validStat = getVal("Valid Status", "validStatus", "Validity");
        const apptDate = parseAnyDate(getRawVal(
          "Appointment Date",
          "appointmentDate",
          "Consultation Date"
        ));
        const apptMonth = monthFromDDMMMYY(apptDate) ||
          getVal("Appointment Month", "appointmentMonth");
        const apptSlot = getVal(
          "Teleconsultation Slot",
          "teleconsultationSlot",
          "Slot"
        );
        const consultFee = getVal(
          "Consultation Charges",
          "consultationCharges",
          "Fee"
        );
        const notes = getVal(
          "Notes",
          "notes",
          "Remarks",
          "Observation",
          "Observations"
        );
        const surgDate = parseAnyDate(getRawVal("Surgery Date", "surgeryDate"));
        const surgCost = getVal("Surgery Cost", "surgeryCost");
        const surgPay = getVal(
          "Surgery Payment Received",
          "surgeryPaymentReceived",
          "Payment Received"
        );

        return {
          date: parsedDate,
          month: parsedMonth,
          leadTimestamp: parsedTimestamp,
          mobileNumber: finalPhone,
          alternateNumber: altPhone,
          patientName: pName,
          patientAge: pAge,
          spouseName: sName,
          spouseAge: sAge,
          location: loc,
          callerName: caller,
          leadSource: leadSrc || "Excel Import",
          referredBy: referred,
          lookingForTreatment: treat,
          treatmentRequirements: treatReq,
          preConditions: preCond,
          surgeryDetails: surgDetails,
          followUpDate: followUp,
          subDispositions: subDisp,
          dispositions: disp,
          validStatus: validStat,
          appointmentDate: apptDate,
          appointmentMonth: apptMonth,
          teleconsultationSlot: apptSlot,
          consultationCharges: consultFee,
          notes: notes,
          surgeryDate: surgDate,
          surgeryCost: surgCost,
          surgeryPaymentReceived: surgPay,
        };
      });

      // Filter out completely blank rows or rows with no mobile number and no patient name
      const validLeads = mapped.filter((l) => {
        const hasMobile = !!(l.mobileNumber && l.mobileNumber.trim().length >= 10);
        const hasName = !!(l.patientName && l.patientName.trim().length > 0);
        return hasMobile || hasName;
      });

      if (validLeads.length === 0) {
        throw new Error("No valid lead rows found in the sheet (all rows were empty or missing mobile numbers).");
      }

      setParsedLeads(validLeads);
    } catch (err: any) {
      console.error(err);
      setError("Failed to parse file: " + (err.message || "Invalid file format"));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      handleFileProcess(selected);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileProcess(droppedFile);
    }
  };

  const handleDownloadSample = () => {
    const sampleHeaders = [
      {
        "Patient Name": "Rahul Sharma",
        "Mobile Number": "9876543210",
        "Patient Age": "32",
        "Location": "Delhi MN",
        "Spouse Name": "Pooja Sharma",
        "Spouse Age": "29",
        "Alternate #": "9123456789",
        "Caller Name": "Admin",
        "Lead Source": "Google Search Ads",
        "Looking for Treatment": "IVF",
        "Treatment Requirements": "Initial Consultation",
        "Pre Conditions": "None",
        "Surgery Details": "N/A",
        "Follow Up Date": "30-Sep-26",
        "Sub Dispositions": "Appointment Booked",
        "Dispositions": "Converted",
        "Valid Status": "Valid",
        "Appointment Date": "02-Oct-26",
        "Teleconsultation Slot": "10:00 AM - 10:30 AM",
        "Consultation Charges": "500",
        "Surgery Date": "",
        "Surgery Cost": "",
        "Surgery Payment Received": "",
        "Notes": "Patient interested in IVF treatment at Delhi branch.",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleHeaders);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample Template");
    XLSX.writeFile(workbook, "patient_leads_sample_template.xlsx");
  };

  const handleConfirmImport = async () => {
    if (parsedLeads.length === 0) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: parsedLeads }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import leads");
      }

      onLeadsImported(data.leads || [], data.nextUniqueId || "", data.deletedCount || 0);
      notifyLeadUpdated();
      handleClose();
    } catch (err: any) {
      setError(err.message || "Failed to import leads");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedLeads([]);
    setError("");
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className={`relative w-full ${file ? "max-w-7xl" : "max-w-2xl"} bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh] text-black transition-all`}>
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#cc2727]/10 border border-[#cc2727]/20 text-[#cc2727]">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-black">Upload Leads (Excel / CSV)</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Bulk import patient leads with auto-assigned Unique IDs
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-black p-1 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 bg-white">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!file ? (
            /* Upload Drop Area */
            <div className="space-y-4">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? "border-[#cc2727] bg-[#cc2727]/5"
                    : "border-slate-300 hover:border-[#cc2727]/60 bg-slate-50 hover:bg-slate-100/70"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#cc2727]/10 border border-[#cc2727]/20 flex items-center justify-center text-[#cc2727] mb-3.5 shadow-inner">
                  <FileSpreadsheet className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-black mb-1">
                  Drag & Drop Excel or CSV file here
                </h4>
                <p className="text-xs text-gray-600 max-w-sm mx-auto mb-4 font-normal">
                  Supports <strong>.xlsx</strong>, <strong>.xls</strong>, and <strong>.csv</strong>. All rows will be assigned consecutive <strong>SC- Unique IDs</strong> automatically.
                </p>
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold shadow-md shadow-[#cc2727]/25 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse File</span>
                </span>
              </div>

              {/* Sample Template Download */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-[#cc2727]" />
                  <span className="text-xs text-black font-medium">
                    Need the exact column format?
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#cc2727]/10 hover:bg-[#cc2727]/20 text-[#cc2727] border border-[#cc2727]/20 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample Template</span>
                </button>
              </div>
            </div>
          ) : (
            /* File Preview & Confirmation */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#cc2727]/10 text-[#cc2727]">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-black truncate max-w-xs">
                      {file.name}
                    </div>
                    <div className="text-[11px] text-gray-600 font-medium">
                      {(file.size / 1024).toFixed(1)} KB •{" "}
                      <span className="text-emerald-700 font-bold">
                        {parsedLeads.length} leads detected
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setParsedLeads([]);
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold underline cursor-pointer"
                >
                  Change File
                </button>
              </div>

              {/* Preview Table with all 28 columns and all rows */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-black flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>Preview All Detected Leads ({parsedLeads.length} Total):</span>
                    <span className="text-[11px] font-normal text-gray-500">
                      (Showing all 28 fields)
                    </span>
                  </div>
                  <span className="text-[11px] text-[#cc2727] font-semibold">
                    Consecutive SC- Unique IDs will be auto-generated
                  </span>
                </div>
                <div className="border border-slate-300 rounded-xl overflow-x-auto max-h-[55vh] overflow-y-auto bg-white shadow-inner">
                  <table className="w-full text-left text-xs text-black whitespace-nowrap border-collapse">
                    <thead className="bg-slate-100 text-black text-[11px] uppercase tracking-wider border-b border-slate-300 font-bold sticky top-0 z-10 shadow-sm">
                      <tr>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">#</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Patient Name</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Patient Age</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Location</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Spouse Name</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Spouse Age</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Date (DD-MMM-YY)</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Time Stamp</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Mobile Number</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Alternate #</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Caller Name</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Lead Source</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Referred By</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Looking for Treatment</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Treatment Requirements</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Pre Conditions</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Surgery Details</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Follow Up Date</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Sub Dispositions</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Dispositions</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Valid Status</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Appointment Date</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Appointment Month</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Teleconsultation Slot</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Consultation Charges</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Surgery Date</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Surgery Cost</th>
                        <th className="px-3 py-2.5 border-r border-slate-200 bg-slate-100">Surgery Payment Received</th>
                        <th className="px-3 py-2.5 bg-slate-100">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedLeads.map((lead, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-gray-500 font-mono border-r border-slate-100 text-center font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 font-bold text-black border-r border-slate-100">
                            {lead.patientName || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-black border-r border-slate-100 text-center">
                            {lead.patientAge || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.location || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.spouseName || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-black border-r border-slate-100 text-center">
                            {lead.spouseAge || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-black border-r border-slate-100">
                            {lead.date || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-black border-r border-slate-100">
                            {lead.leadTimestamp || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-black border-r border-slate-100">
                            {lead.mobileNumber || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-black border-r border-slate-100">
                            {lead.alternateNumber || "-"}
                          </td>
                          <td className="px-3 py-2 text-black font-semibold border-r border-slate-100">
                            {lead.callerName || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.leadSource || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.referredBy || "-"}
                          </td>
                          <td className="px-3 py-2 text-black font-medium border-r border-slate-100">
                            {lead.lookingForTreatment || "-"}
                          </td>
                          <td className="px-3 py-2 text-black max-w-xs truncate border-r border-slate-100" title={lead.treatmentRequirements}>
                            {lead.treatmentRequirements || "-"}
                          </td>
                          <td className="px-3 py-2 text-black max-w-xs truncate border-r border-slate-100" title={lead.preConditions}>
                            {lead.preConditions || "-"}
                          </td>
                          <td className="px-3 py-2 text-black max-w-xs truncate border-r border-slate-100" title={lead.surgeryDetails}>
                            {lead.surgeryDetails || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-black border-r border-slate-100">
                            {lead.followUpDate || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.subDispositions || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.dispositions || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.validStatus || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-black border-r border-slate-100">
                            {lead.appointmentDate || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-black border-r border-slate-100">
                            {lead.appointmentMonth || "-"}
                          </td>
                          <td className="px-3 py-2 text-black border-r border-slate-100">
                            {lead.teleconsultationSlot || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-right text-black border-r border-slate-100">
                            {lead.consultationCharges || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono font-medium text-black border-r border-slate-100">
                            {lead.surgeryDate || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-right text-black border-r border-slate-100">
                            {lead.surgeryCost || "-"}
                          </td>
                          <td className="px-3 py-2 font-mono text-right font-bold text-emerald-700 border-r border-slate-100">
                            {lead.surgeryPaymentReceived || "-"}
                          </td>
                          <td className="px-3 py-2 text-black max-w-md truncate" title={lead.notes}>
                            {lead.notes || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between text-[11px] text-gray-600 px-1 pt-1 font-medium">
                  <span>Showing all {parsedLeads.length} leads</span>
                  <span>Scroll horizontally to view all 28 columns & vertically to view all rows</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
          >
            Cancel
          </button>

          {file && (
            <button
              type="button"
              disabled={loading || parsedLeads.length === 0}
              onClick={handleConfirmImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold rounded-xl shadow-md shadow-[#cc2727]/25 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Importing {parsedLeads.length} Leads...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Confirm & Import {parsedLeads.length} Leads</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
