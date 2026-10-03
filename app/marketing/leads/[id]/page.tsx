"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Hash,
  Phone,
  User,
  MapPin,
  Sparkles,
  Activity,
  HeartPulse,
  FileText,
  Clock,
  Eye,
} from "lucide-react";
import MarketingSidebar from "@/app/components/MarketingSidebar";
import LeadAuditHistory, { AuditLog } from "@/app/components/LeadAuditHistory";
import NotesHistory, { NoteHistoryItem } from "@/app/components/NotesHistory";
import {
  LOCATIONS,
  TREATMENTS,
  LEAD_SOURCES,
  SUB_DISPOSITIONS_MAP,
  TELECONSULTATION_SLOTS,
  formatDateToDDMMMYY,
  parseDDMMMYYToISO,
  getMonthFromDate,
  notifyLeadUpdated,
} from "@/lib/leadOptions";
import { IFormField } from "@/models/FormConfig";
import { DEFAULT_FORM_FIELDS } from "@/lib/defaultFormFields";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const leadId = resolvedParams.id;
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [error, setError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [callerOptions, setCallerOptions] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notesHistory, setNotesHistory] = useState<NoteHistoryItem[]>([]);
  const [formFields, setFormFields] = useState<IFormField[]>(DEFAULT_FORM_FIELDS);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [subDispositionMappings, setSubDispositionMappings] = useState<
    Record<string, { disposition: string; validStatus: string }>
  >({ ...SUB_DISPOSITIONS_MAP });

  const [formData, setFormData] = useState<any>({
    uniqueId: "",
    date: "",
    month: "",
    leadTimestamp: "",
    createdAt: "",
    mobileNumber: "",
    alternateNumber: "",
    callerName: "",
    patientName: "",
    patientAge: "",
    spouseName: "",
    spouseAge: "",
    location: "",
    otherCity: "",
    lookingForTreatment: "",
    preConditions: "",
    surgeryDetails: "",
    treatmentRequirements: "",
    referredBy: "",
    leadSource: "",
    followUpDate: "",
    subDispositions: "",
    dispositions: "",
    validStatus: "",
    appointmentDate: "",
    appointmentMonth: "",
    teleconsultationSlot: "",
    consultationCharges: "",
    notes: "",
    surgeryPaymentReceived: "",
    surgeryCost: "",
    surgeryDate: "",
  });

  // State for inline Other Location & Treatment
  const [selectedLocationOption, setSelectedLocationOption] = useState<string>("");
  const [otherLocationText, setOtherLocationText] = useState<string>("");
  const [selectedTreatmentOption, setSelectedTreatmentOption] = useState<string>("");
  const [otherTreatmentText, setOtherTreatmentText] = useState<string>("");

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Check Auth
        const meRes = await fetch("/api/auth/me");
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

        // Fetch dynamic form configuration
        try {
          const cfgRes = await fetch("/api/admin/form-config");
          if (cfgRes.ok) {
            const cfgData = await cfgRes.json();
            if (cfgData.config?.fields && Array.isArray(cfgData.config.fields)) {
              setFormFields(cfgData.config.fields);
            }
            if (cfgData.config?.subDispositionMappings && Object.keys(cfgData.config.subDispositionMappings).length > 0) {
              setSubDispositionMappings(cfgData.config.subDispositionMappings);
            } else {
              const subDispField = (cfgData.config?.fields || []).find((f: any) => f.id === "subDispositions");
              if (subDispField?.subDispositionMappings && Object.keys(subDispField.subDispositionMappings).length > 0) {
                setSubDispositionMappings(subDispField.subDispositionMappings);
              }
            }
          }
        } catch {
          // ignore
        }

        // Fetch caller names from members
        try {
          const membersRes = await fetch("/api/admin/members");
          if (membersRes.ok) {
            const mData = await membersRes.json();
            const names = (mData.members || [])
              .map((m: any) => m.name)
              .filter(Boolean);
            setCallerOptions(names);
          }
        } catch {
          // ignore
        }

        // 2. Fetch Lead Details
        const leadRes = await fetch(`/api/admin/leads/${leadId}`, {
          cache: "no-store",
        });
        if (!leadRes.ok) {
          throw new Error("Patient lead not found");
        }
        const data = await leadRes.json();
        if (data.lead) {
          const l = data.lead;
          const locVal = l.location || "";
          const otherLocVal = l.otherCity || "";
          if (locVal && !LOCATIONS.includes(locVal as any)) {
            setSelectedLocationOption("Other");
            setOtherLocationText(locVal);
          } else if (locVal === "Other") {
            setSelectedLocationOption("Other");
            setOtherLocationText(otherLocVal);
          } else {
            setSelectedLocationOption(locVal);
            setOtherLocationText("");
          }

          const treatVal = l.lookingForTreatment || l.treatment || "";
          if (treatVal && !TREATMENTS.includes(treatVal as any)) {
            setSelectedTreatmentOption("Other");
            setOtherTreatmentText(treatVal);
          } else if (treatVal === "Other") {
            setSelectedTreatmentOption("Other");
            setOtherTreatmentText("");
          } else {
            setSelectedTreatmentOption(treatVal);
            setOtherTreatmentText("");
          }

          setFormData({
            uniqueId: l.uniqueId || "",
            date: l.date || l.dateOfLead || "",
            month: l.month || "",
            leadTimestamp:
              l.leadTimestamp ||
              (l.createdAt
                ? new Date(l.createdAt).toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  })
                : ""),
            createdAt: l.createdAt || "",
            mobileNumber: l.mobileNumber || l.phoneNumber || "",
            alternateNumber: l.alternateNumber || "",
            callerName: l.callerName || "",
            patientName: l.patientName || "",
            patientAge: l.patientAge || "",
            spouseName: l.spouseName || "",
            spouseAge: l.spouseAge || "",
            location: locVal,
            otherCity: otherLocVal,
            lookingForTreatment: treatVal,
            preConditions: l.preConditions || l.preCondition || "",
            surgeryDetails: l.surgeryDetails || l.surgicalData || "",
            treatmentRequirements:
              l.treatmentRequirements || l.treatmentRequired || "",
            referredBy: l.referredBy || "",
            leadSource: l.leadSource || "",
            followUpDate: l.followUpDate || l.followUpDates || "",
            subDispositions: l.subDispositions || l.subDisposition || "",
            dispositions: l.dispositions || l.disposition || "",
            validStatus: l.validStatus || "",
            appointmentDate: l.appointmentDate || "",
            appointmentMonth: l.appointmentMonth || "",
            teleconsultationSlot:
              l.teleconsultationSlot || l.appointmentSlot || "",
            consultationCharges:
              l.consultationCharges || l.teleConsultationCharges || "",
            notes: l.notes || "",
            surgeryPaymentReceived:
              l.surgeryPaymentReceived || l.surgeryReceipt || "",
            surgeryCost: l.surgeryCost || "",
            surgeryDate: l.surgeryDate || "",
          });
          setCustomFieldValues(l.customFields || {});
          setAuditLogs(l.auditLogs || []);
          setNotesHistory(l.notesHistory || []);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load lead details");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [leadId, router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/marketing/login");
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "mobileNumber" | "alternateNumber"
  ) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setFormData((prev: any) => ({
      ...prev,
      [field]: raw,
    }));
  };

  const handleAgeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "patientAge" | "spouseAge"
  ) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setFormData((prev: any) => ({
      ...prev,
      [field]: raw,
    }));
  };

  const handleDateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    dateField: "date" | "followUpDate" | "appointmentDate" | "surgeryDate",
    monthField?: "month" | "appointmentMonth"
  ) => {
    const isoVal = e.target.value;
    if (!isoVal) {
      setFormData((prev: any) => ({
        ...prev,
        [dateField]: "",
        ...(monthField ? { [monthField]: "" } : {}),
      }));
      return;
    }
    const formatted = formatDateToDDMMMYY(isoVal);
    const mmmYY = getMonthFromDate(isoVal);

    setFormData((prev: any) => ({
      ...prev,
      [dateField]: formatted,
      ...(monthField ? { [monthField]: mmmYY } : {}),
    }));
  };

  // Location dropdown change handler
  const handleLocationOptionChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const val = e.target.value;
    setSelectedLocationOption(val);
    if (val === "Other") {
      setFormData((prev: any) => ({
        ...prev,
        location: otherLocationText,
        otherCity: otherLocationText,
      }));
    } else {
      setOtherLocationText("");
      setFormData((prev: any) => ({
        ...prev,
        location: val,
        otherCity: "",
      }));
    }
  };

  const handleOtherLocationTextChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const text = e.target.value;
    setOtherLocationText(text);
    setFormData((prev: any) => ({
      ...prev,
      location: text,
      otherCity: text,
    }));
  };

  // Treatment dropdown change handler
  const handleTreatmentOptionChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const val = e.target.value;
    setSelectedTreatmentOption(val);
    if (val === "Other") {
      setFormData((prev: any) => ({
        ...prev,
        lookingForTreatment: otherTreatmentText,
      }));
    } else {
      setOtherTreatmentText("");
      setFormData((prev: any) => ({
        ...prev,
        lookingForTreatment: val,
      }));
    }
  };

  const handleOtherTreatmentTextChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const text = e.target.value;
    setOtherTreatmentText(text);
    setFormData((prev: any) => ({
      ...prev,
      lookingForTreatment: text,
    }));
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const renderDynamicSectionFields = (sectionId: 1 | 2 | 3 | 4) => {
    const customFieldsInSec = formFields.filter(
      (f) => f.section === sectionId && !f.isSystem && f.enabled !== false
    );
    if (customFieldsInSec.length === 0) return null;

    return (
      <div className="pt-3 border-t border-slate-200 mt-4">
        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mb-2">
          Custom Added Fields
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customFieldsInSec.map((f) => (
            <div key={f.id} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="block text-xs font-semibold text-black mb-1.5">
                {f.label} {f.required && <span className="text-rose-600">*</span>}
              </label>

              {f.type === "select" ? (
                <select
                  required={f.required}
                  value={customFieldValues[f.id] || ""}
                  onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                >
                  <option value="">Select {f.label}</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  rows={2}
                  required={f.required}
                  placeholder={f.placeholder || `Enter ${f.label}`}
                  value={customFieldValues[f.id] || ""}
                  onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                />
              ) : f.type === "checkbox" ? (
                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-black">
                    <input
                      type="checkbox"
                      required={f.required}
                      checked={Boolean(customFieldValues[f.id])}
                      onChange={(e) => handleCustomFieldChange(f.id, e.target.checked)}
                      className="w-4 h-4 rounded text-[#cc2727] focus:ring-[#cc2727]"
                    />
                    <span>{f.placeholder || f.label}</span>
                  </label>
                </div>
              ) : f.type === "date" || f.type === "month" || f.type === "time" || f.type === "datetime-local" ? (
                <input
                  type={f.type}
                  required={f.required}
                  value={customFieldValues[f.id] || ""}
                  onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] [color-scheme:light]"
                />
              ) : (
                <input
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder || `Enter ${f.label}`}
                  value={customFieldValues[f.id] || ""}
                  onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const handleSubDispositionChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const sub = e.target.value;
    const mapping =
      subDispositionMappings[sub] ||
      SUB_DISPOSITIONS_MAP[sub] || {
        disposition: "",
        validStatus: "",
      };

    setFormData((prev: any) => ({
      ...prev,
      subDispositions: sub,
      dispositions: mapping.disposition,
      validStatus: mapping.validStatus,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const finalLocation =
      selectedLocationOption === "Other"
        ? otherLocationText
        : selectedLocationOption;
    const finalTreatment =
      selectedTreatmentOption === "Other"
        ? otherTreatmentText
        : selectedTreatmentOption;

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          location: finalLocation,
          otherCity: selectedLocationOption === "Other" ? otherLocationText : "",
          lookingForTreatment: finalTreatment,
          treatment: finalTreatment, // keep legacy field in sync
          phoneNumber: formData.mobileNumber, // keep legacy field in sync
          dateOfLead: formData.date,
          customFields: customFieldValues,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save lead changes");
      }

      if (data.lead?.auditLogs) {
        setAuditLogs(data.lead.auditLogs);
      }
      if (data.lead?.notesHistory) {
        setNotesHistory(data.lead.notesHistory);
      }
      // Blank out Section 5 notes field as requested
      setFormData((prev: any) => ({
        ...prev,
        notes: "",
      }));
      setToastMessage("Lead details updated successfully!");
      notifyLeadUpdated();
      setTimeout(() => setToastMessage(""), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to update lead");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete lead");
      }

      notifyLeadUpdated();
      router.push("/admin/leads");
    } catch (err: any) {
      setError(err.message || "Failed to delete lead");
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
      <MarketingSidebar user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Link
              href="/marketing/leads"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-black hover:text-black transition-colors flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Leads</span>
            </Link>
            <div className="h-5 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#cc2727] bg-[#cc2727]/10 px-2.5 py-0.5 rounded-lg border border-[#cc2727]/20">
                {formData.uniqueId || leadId}
              </span>
              <h1 className="text-sm sm:text-base font-bold text-black truncate max-w-[200px] sm:max-w-md">
                {formData.patientName || "Patient Details"}
              </h1>
            </div>
          </div>

          {/* View Only Mode Indicator */}
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#cc2727]" />
              <span>View Only</span>
            </span>
          </div>
        </header>

        {/* Form Body - Two-column responsive layout (Form Left, Audit History Right) */}
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] w-full mx-auto">
          {/* Toast Message */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{toastMessage}</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {/* Header Card with Patient Overview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[#cc2727]/20 text-[#cc2727] border border-indigo-500/30 flex items-center justify-center font-extrabold text-2xl uppercase shadow-lg shadow-indigo-500/10 shrink-0">
                {formData.patientName ? formData.patientName.charAt(0) : "P"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-black">
                    {formData.patientName || "Unnamed Patient"}
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 font-mono font-bold">
                    {formData.uniqueId}
                  </span>
                  {formData.validStatus && (
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                        formData.validStatus === "Valid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200/20"
                          : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                      }`}
                    >
                      {formData.validStatus}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-gray-600" />
                    {formData.mobileNumber || "No phone"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-gray-600" />
                    {formData.location || formData.otherCity || "No location"}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[#cc2727]">
                    <Clock className="w-3.5 h-3.5 text-[#cc2727]" />
                    Added: {formData.leadTimestamp || formData.date || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-right sm:self-center">
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Read-Only Mode
              </span>
              <p className="text-xs text-gray-600">
                MIS members have view and export access.
              </p>
            </div>
          </div>

          {/* Two Column Grid: Left Side Form (8 cols), Right Side Change History (4 cols) */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Patient Edit Form */}
            <div className="xl:col-span-8">
              <fieldset disabled className="space-y-6 [&_input]:bg-slate-50 [&_input]:border-slate-200 [&_input]:cursor-default [&_select]:bg-slate-50 [&_select]:border-slate-200 [&_select]:cursor-default [&_textarea]:bg-slate-50 [&_textarea]:border-slate-200 [&_textarea]:cursor-default">
            {/* Section 1: Lead Date, Contact & Caller */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#cc2727]" />
                <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                  1. Lead Date, Contact & Caller
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Unique ID */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Unique ID
                  </label>
                  <input
                    type="text"
                    name="uniqueId"
                    value={formData.uniqueId}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Date Field (DD-MMM-YY) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5 flex items-center justify-between">
                    <span>Date (DD-MMM-YY)</span>
                    {formData.date && (
                      <span className="text-[11px] font-mono text-[#cc2727]">
                        {formData.date}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={parseDDMMMYYToISO(formData.date)}
                    onChange={(e) => handleDateChange(e, "date", "month")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] [color-scheme:light]"
                  />
                </div>

                {/* Time Stamp (Real-Time when added) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Time Stamp (Lead Added)</span>
                  </label>
                  <div className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-[#cc2727] text-xs font-mono font-medium flex items-center justify-between">
                    <span>{formData.leadTimestamp || "Not recorded"}</span>
                    {formData.leadTimestamp && (
                      <span className="flex h-2 w-2 relative">
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#cc2727]"></span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Mobile Number (10 digits) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Mobile Number (10 digits)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    name="mobileNumber"
                    value={formData.mobileNumber}
                    onChange={(e) => handlePhoneChange(e, "mobileNumber")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Alternate # (10 digits) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Alternate # (10 digits)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    name="alternateNumber"
                    value={formData.alternateNumber}
                    onChange={(e) => handlePhoneChange(e, "alternateNumber")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Caller Name (Drop Down) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Caller Name (Drop Down)
                  </label>
                  <select
                    name="callerName"
                    value={formData.callerName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  >
                    <option value="">Select Caller Name</option>
                    {callerOptions.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                    {(formFields.find((f) => f.id === "callerName")?.options || ["Self / Direct Call", "Front Desk"])
                      .filter((opt) => !callerOptions.includes(opt))
                      .map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Lead Source (Drop Down) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Lead Source (Drop Down)
                  </label>
                  <select
                    name="leadSource"
                    value={formData.leadSource}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  >
                    <option value="">Select Lead Source</option>
                    {(formFields.find((f) => f.id === "leadSource")?.options || LEAD_SOURCES).map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Referred By (Free text) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Referred By (Free text)
                  </label>
                  <input
                    type="text"
                    name="referredBy"
                    value={formData.referredBy}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>
              </div>
              {renderDynamicSectionFields(1)}
            </div>

            {/* Section 2: Patient & Family Profile */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-[#cc2727]" />
                <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                  2. Patient & Family Profile
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Patient Name (Free text) */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Patient Name (Free text)
                  </label>
                  <input
                    type="text"
                    name="patientName"
                    value={formData.patientName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Patient Age (Number Field with 2 Digits) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Patient Age (2 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    name="patientAge"
                    value={formData.patientAge}
                    onChange={(e) => handleAgeChange(e, "patientAge")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Location (Drop Down with inline Other text field) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Location
                  </label>
                  <select
                    value={selectedLocationOption}
                    onChange={handleLocationOptionChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  >
                    <option value="">Select Location</option>
                    {(formFields.find((f) => f.id === "location")?.options || LOCATIONS).map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                  {selectedLocationOption === "Other" && (
                    <input
                      type="text"
                      value={otherLocationText}
                      onChange={handleOtherLocationTextChange}
                      placeholder="Enter other city / location..."
                      className="w-full mt-2 px-3.5 py-2.5 bg-white border border-indigo-500/50 rounded-xl text-black text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#cc2727] animate-fadeIn"
                      autoFocus
                    />
                  )}
                </div>

                {/* Spouse Name (Free text) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Spouse Name (Free text)
                  </label>
                  <input
                    type="text"
                    name="spouseName"
                    value={formData.spouseName}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Spouse Age (Number Field with 2 Digits) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Spouse Age (2 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={2}
                    name="spouseAge"
                    value={formData.spouseAge}
                    onChange={(e) => handleAgeChange(e, "spouseAge")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>
              </div>
              {renderDynamicSectionFields(2)}
            </div>

            {/* Section 3: Clinical & Surgical Details */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-[#cc2727]" />
                <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                  3. Clinical & Surgical Information
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Looking for Treatment (Drop Down with inline Other text field) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Looking for Treatment
                  </label>
                  <select
                    value={selectedTreatmentOption}
                    onChange={handleTreatmentOptionChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  >
                    <option value="">Select Treatment</option>
                    {(formFields.find((f) => f.id === "lookingForTreatment")?.options || TREATMENTS).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  {selectedTreatmentOption === "Other" && (
                    <input
                      type="text"
                      value={otherTreatmentText}
                      onChange={handleOtherTreatmentTextChange}
                      placeholder="Enter other treatment..."
                      className="w-full mt-2 px-3.5 py-2.5 bg-white border border-indigo-500/50 rounded-xl text-black text-xs placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#cc2727] animate-fadeIn"
                      autoFocus
                    />
                  )}
                </div>

                {/* Treatment Requirements (Free text) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Treatment Requirements (Free text)
                  </label>
                  <input
                    type="text"
                    name="treatmentRequirements"
                    value={formData.treatmentRequirements}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Pre Conditions (Free text) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Pre Conditions (Free text)
                  </label>
                  <input
                    type="text"
                    name="preConditions"
                    value={formData.preConditions}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Surgery Details (Free text) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Surgery Details (Free text)
                  </label>
                  <input
                    type="text"
                    name="surgeryDetails"
                    value={formData.surgeryDetails}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>
              </div>
              {renderDynamicSectionFields(3)}
            </div>

            {/* Section 4: Follow Up, Disposition & Appointments */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#cc2727]" />
                <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                  4. Disposition, Appointments & Follow-up
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Follow Up Date (Date Field DD-MMM-YY) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5 flex items-center justify-between">
                    <span>Follow Up Date (DD-MMM-YY)</span>
                    {formData.followUpDate && (
                      <span className="text-[11px] font-mono text-[#cc2727]">
                        {formData.followUpDate}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={parseDDMMMYYToISO(formData.followUpDate)}
                    onChange={(e) => handleDateChange(e, "followUpDate")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] [color-scheme:light]"
                  />
                </div>

                {/* Sub Dispositions (Drop Down) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Sub Dispositions (Drop Down)
                  </label>
                  <select
                    name="subDispositions"
                    value={formData.subDispositions}
                    onChange={handleSubDispositionChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  >
                    <option value="">Select Sub Disposition</option>
                    {(formFields.find((f) => f.id === "subDispositions")?.options || Object.keys(SUB_DISPOSITIONS_MAP)).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dispositions (Auto Selection) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Dispositions (Auto Selection)
                  </label>
                  <input
                    type="text"
                    readOnly
                    name="dispositions"
                    value={formData.dispositions}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[#cc2727] font-semibold text-xs cursor-not-allowed"
                  />
                </div>

                {/* Valid Status (Auto Selection) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Valid Status (Auto Selection)
                  </label>
                  <input
                    type="text"
                    readOnly
                    name="validStatus"
                    value={formData.validStatus}
                    className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold cursor-not-allowed ${
                      formData.validStatus === "Valid"
                        ? "text-emerald-700"
                        : formData.validStatus === "Invalid"
                        ? "text-rose-400"
                        : "text-gray-500"
                    }`}
                  />
                </div>

                {/* Appointment Date (Date Field DD-MMM-YY) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5 flex items-center justify-between">
                    <span>Appointment Date (DD-MMM-YY)</span>
                    {formData.appointmentDate && (
                      <span className="text-[11px] font-mono text-[#cc2727]">
                        {formData.appointmentDate}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={parseDDMMMYYToISO(formData.appointmentDate)}
                    onChange={(e) =>
                      handleDateChange(
                        e,
                        "appointmentDate",
                        "appointmentMonth"
                      )
                    }
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] [color-scheme:light]"
                  />
                </div>

                {/* Appointment month (Month MMM-YY) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Appointment Month (MMM-YY)
                  </label>
                  <input
                    type="text"
                    name="appointmentMonth"
                    value={formData.appointmentMonth}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Teleconsultation Slot (Drop Down) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Teleconsultation Slot (Drop Down)
                  </label>
                  <select
                    name="teleconsultationSlot"
                    value={formData.teleconsultationSlot}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  >
                    <option value="">Select Slot</option>
                    {(formFields.find((f) => f.id === "teleconsultationSlot")?.options || TELECONSULTATION_SLOTS).map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Consultation Charges (Free text Amount Field) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Consultation Charges (Amount Field)
                  </label>
                  <input
                    type="text"
                    name="consultationCharges"
                    value={formData.consultationCharges}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Surgery Date (Date Field DD-MMM-YY) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5 flex items-center justify-between">
                    <span>Surgery Date (DD-MMM-YY)</span>
                    {formData.surgeryDate && (
                      <span className="text-[11px] font-mono text-[#cc2727]">
                        {formData.surgeryDate}
                      </span>
                    )}
                  </label>
                  <input
                    type="date"
                    value={parseDDMMMYYToISO(formData.surgeryDate)}
                    onChange={(e) => handleDateChange(e, "surgeryDate")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] [color-scheme:light]"
                  />
                </div>

                {/* Surgery Cost (Free text Amount Field) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Surgery Cost (Amount Field)
                  </label>
                  <input
                    type="text"
                    name="surgeryCost"
                    value={formData.surgeryCost}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>

                {/* Surgery - Payment Received (Free text Amount Field) */}
                <div>
                  <label className="block text-xs font-semibold text-black mb-1.5">
                    Surgery - Payment Received (Amount)
                  </label>
                  <input
                    type="text"
                    name="surgeryPaymentReceived"
                    value={formData.surgeryPaymentReceived}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#cc2727]"
                  />
                </div>
              </div>
              {renderDynamicSectionFields(4)}
            </div>

            {/* Section 5: Notes */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="border-b border-slate-200 pb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#cc2727]" />
                <h3 className="text-sm font-bold text-black uppercase tracking-wider">
                  5. Notes & Observations
                </h3>
              </div>
              <div>
                <textarea
                  name="notes"
                  rows={4}
                  value={formData.notes}
                  readOnly
                  disabled
                  placeholder="No clinical notes or observations recorded."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-black text-xs resize-none cursor-default"
                />
              </div>
            </div>
            </fieldset>
            </div>

            {/* Right Column: Notes History + Change History */}
            <div className="xl:col-span-4 space-y-6">
              <NotesHistory
                notesHistory={notesHistory}
                leadUniqueId={formData.uniqueId}
              />
              <LeadAuditHistory
                auditLogs={auditLogs}
                leadCreatedAt={formData.createdAt || formData.leadTimestamp}
                leadUniqueId={formData.uniqueId}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
