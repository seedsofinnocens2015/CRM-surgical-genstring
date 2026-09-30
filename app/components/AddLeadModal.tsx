"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  UserPlus,
  Sparkles,
  AlertCircle,
  Calendar,
  Clock,
  Phone,
  User,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  LOCATIONS,
  TREATMENTS,
  LEAD_SOURCES,
  SUB_DISPOSITIONS_MAP,
  TELECONSULTATION_SLOTS,
  formatDateToDDMMMYY,
  parseDDMMMYYToISO,
  getMonthFromDate,
  getTodayDDMMMYY,
  getCurrentMonthMMMYY,
  getFormattedTimestamp,
} from "@/lib/leadOptions";
import { IFormField } from "@/models/FormConfig";
import { DEFAULT_FORM_FIELDS } from "@/lib/defaultFormFields";

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadAdded: (lead: any) => void;
  suggestedUniqueId?: string;
  existingLeads?: any[];
  defaultCallerName?: string; // auto-fill for agent panel
}

export default function AddLeadModal({
  isOpen,
  onClose,
  onLeadAdded,
  suggestedUniqueId,
  existingLeads,
  defaultCallerName,
}: AddLeadModalProps) {
  const [callerOptions, setCallerOptions] = useState<string[]>([]);
  const [leadsCache, setLeadsCache] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formFields, setFormFields] = useState<IFormField[]>(DEFAULT_FORM_FIELDS);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [subDispositionMappings, setSubDispositionMappings] = useState<
    Record<string, { disposition: string; validStatus: string }>
  >({ ...SUB_DISPOSITIONS_MAP });

  // States for Location 'Other' and Treatment 'Other'
  const [selectedLocationOption, setSelectedLocationOption] = useState("");
  const [otherLocationText, setOtherLocationText] = useState("");
  const [selectedTreatmentOption, setSelectedTreatmentOption] = useState("");
  const [otherTreatmentText, setOtherTreatmentText] = useState("");

  const [leadTimestamp, setLeadTimestamp] = useState<string>(getFormattedTimestamp());

  const getInitialFormData = (uid = suggestedUniqueId || "SC-1", caller = defaultCallerName || "") => ({
    uniqueId: uid,
    date: getTodayDDMMMYY(),
    month: getCurrentMonthMMMYY(),
    mobileNumber: "",
    alternateNumber: "",
    callerName: caller,
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

  const [formData, setFormData] = useState(getInitialFormData());

  // Keep live timestamp updated every 10 seconds while modal is open
  useEffect(() => {
    if (!isOpen) return;
    setLeadTimestamp(getFormattedTimestamp());
    const interval = setInterval(() => {
      setLeadTimestamp(getFormattedTimestamp());
    }, 10000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Completely reset form and fetch callers on modal open
  useEffect(() => {
    if (isOpen) {
      const currentNowStamp = getFormattedTimestamp();
      setLeadTimestamp(currentNowStamp);

      setSelectedLocationOption("");
      setOtherLocationText("");
      setSelectedTreatmentOption("");
      setOtherTreatmentText("");

      // Fresh clean reset of all fields without stale inputs
      setFormData(getInitialFormData(suggestedUniqueId || "SC-1", defaultCallerName || ""));
      setError("");

      const fetchCallersAndLeads = async () => {
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
          // fallback to DEFAULT_FORM_FIELDS
        }

        try {
          const res = await fetch("/api/admin/members");
          if (res.ok) {
            const data = await res.json();
            const names = (data.members || [])
              .map((m: any) => m.name)
              .filter(Boolean);
            setCallerOptions(names);
            // Re-apply defaultCallerName after callerOptions are loaded
            // so the <select> can match the value correctly
            if (defaultCallerName) {
              setFormData((prev) => ({
                ...prev,
                callerName: defaultCallerName,
              }));
            }
          }
        } catch {
          // fallback
        }

        if (existingLeads && existingLeads.length > 0) {
          setLeadsCache(existingLeads);
        } else {
          try {
            const leadsRes = await fetch("/api/admin/leads");
            if (leadsRes.ok) {
              const data = await leadsRes.json();
              setLeadsCache(data.leads || []);
            }
          } catch {
            // fallback
          }
        }
      };
      fetchCallersAndLeads();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, suggestedUniqueId, defaultCallerName]);

  // Real-time phone duplication matching
  // Matches any lead where either mobileNumber or alternateNumber contains/starts-with the entered digits
  const mobileDuplicates = useMemo(() => {
    const rawInput = formData.mobileNumber.trim();
    if (!rawInput || rawInput.length < 3) return [];
    return leadsCache.filter((lead) => {
      const mob = (lead.mobileNumber || lead.phoneNumber || "").replace(/\D/g, "");
      const alt = (lead.alternateNumber || "").replace(/\D/g, "");
      return mob.includes(rawInput) || alt.includes(rawInput);
    });
  }, [formData.mobileNumber, leadsCache]);

  const alternateDuplicates = useMemo(() => {
    const rawInput = formData.alternateNumber.trim();
    if (!rawInput || rawInput.length < 3) return [];
    return leadsCache.filter((lead) => {
      const mob = (lead.mobileNumber || lead.phoneNumber || "").replace(/\D/g, "");
      const alt = (lead.alternateNumber || "").replace(/\D/g, "");
      return mob.includes(rawInput) || alt.includes(rawInput);
    });
  }, [formData.alternateNumber, leadsCache]);

  if (!isOpen) return null;

  // Handle standard text / select change
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 10 digits validation for mobile & alternate
  const handlePhoneChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "mobileNumber" | "alternateNumber"
  ) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setFormData((prev) => ({
      ...prev,
      [field]: raw,
    }));
  };

  // 2 digits validation for age
  const handleAgeChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "patientAge" | "spouseAge"
  ) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 2);
    setFormData((prev) => ({
      ...prev,
      [field]: raw,
    }));
  };

  // Date selection handler: converts YYYY-MM-DD to DD-MMM-YY and updates Month
  const handleDateChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    dateField: "date" | "followUpDate" | "appointmentDate" | "surgeryDate",
    monthField?: "month" | "appointmentMonth"
  ) => {
    const isoVal = e.target.value;
    if (!isoVal) {
      setFormData((prev) => ({
        ...prev,
        [dateField]: "",
        ...(monthField ? { [monthField]: "" } : {}),
      }));
      return;
    }
    const formatted = formatDateToDDMMMYY(isoVal);
    const mmmYY = getMonthFromDate(isoVal);

    setFormData((prev) => ({
      ...prev,
      [dateField]: formatted,
      ...(monthField ? { [monthField]: mmmYY } : {}),
    }));
  };

  const handleCustomFieldChange = (fieldId: string, value: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  // Helper to render any dynamically added fields for a given section
  const renderDynamicSectionFields = (sectionId: 1 | 2 | 3 | 4) => {
    const customFieldsInSec = formFields.filter(
      (f) => f.section === sectionId && !f.isSystem && f.enabled !== false
    );
    if (customFieldsInSec.length === 0) return null;

    return (
      <div className="pt-2 border-t border-slate-200/80 mt-3">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
          Custom Added Fields
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customFieldsInSec.map((f) => (
            <div key={f.id} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
              <label className="block text-xs font-bold text-black mb-1.5">
                {f.label} {f.required && <span className="text-rose-600">*</span>}
              </label>

              {f.type === "select" ? (
                <select
                  required={f.required}
                  value={customFieldValues[f.id] || ""}
                  onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] font-medium"
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] font-medium"
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] font-medium [color-scheme:light]"
                />
              ) : (
                <input
                  type={f.type}
                  required={f.required}
                  placeholder={f.placeholder || `Enter ${f.label}`}
                  value={customFieldValues[f.id] || ""}
                  onChange={(e) => handleCustomFieldChange(f.id, e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] font-medium"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Location dropdown change handler
  const handleLocationOptionChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const val = e.target.value;
    setSelectedLocationOption(val);
    if (val === "Other") {
      setFormData((prev) => ({
        ...prev,
        location: otherLocationText,
        otherCity: otherLocationText,
      }));
    } else {
      setOtherLocationText("");
      setFormData((prev) => ({
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
    setFormData((prev) => ({
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
      setFormData((prev) => ({
        ...prev,
        lookingForTreatment: otherTreatmentText,
      }));
    } else {
      setOtherTreatmentText("");
      setFormData((prev) => ({
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
    setFormData((prev) => ({
      ...prev,
      lookingForTreatment: text,
    }));
  };

  // Sub Disposition change -> Auto-select Disposition & Valid Status
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

    setFormData((prev) => ({
      ...prev,
      subDispositions: sub,
      dispositions: mapping.disposition,
      validStatus: mapping.validStatus,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const finalLocation =
        selectedLocationOption === "Other"
          ? otherLocationText.trim() || "Other"
          : selectedLocationOption;

      const finalTreatment =
        selectedTreatmentOption === "Other"
          ? otherTreatmentText.trim() || "Other"
          : selectedTreatmentOption;

      const payload = {
        ...formData,
        leadTimestamp,
        location: finalLocation,
        otherCity: selectedLocationOption === "Other" ? finalLocation : "",
        lookingForTreatment: finalTreatment,
        customFields: customFieldValues,
      };

      const res = await fetch("/api/admin/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create lead");
      }

      onLeadAdded(data.lead);
      // Immediately reset all form fields
      setFormData(getInitialFormData());
      setSelectedLocationOption("");
      setOtherLocationText("");
      setSelectedTreatmentOption("");
      setOtherTreatmentText("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add lead");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    // Clean reset on manual close as well
    setFormData(getInitialFormData());
    setSelectedLocationOption("");
    setOtherLocationText("");
    setSelectedTreatmentOption("");
    setOtherTreatmentText("");
    setError("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-8 max-h-[92vh] overflow-y-auto text-black">
        {/* Close Button */}
        <button
          onClick={handleCloseModal}
          className="absolute top-5 right-5 text-gray-500 hover:text-black transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center shadow-md shadow-[#cc2727]/10">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-black">Add New Patient Lead</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 font-mono font-bold">
                {formData.uniqueId}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-0.5">
              Enter lead, patient clinical, disposition, and surgery details as configured.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Lead Date, Contact & Caller */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-[#cc2727] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> 1. Lead Date, Contact & Caller
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Unique ID */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Unique ID
                </label>
                <input
                  type="text"
                  name="uniqueId"
                  value={formData.uniqueId}
                  onChange={handleChange}
                  placeholder="SC-1"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727]"
                />
              </div>

              {/* Date Field (DD-MMM-YY) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 flex items-center justify-between">
                  <span>Date (DD-MMM-YY)</span>
                  {formData.date && (
                    <span className="text-[11px] font-mono text-[#cc2727] font-bold">
                      {formData.date}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={parseDDMMMYYToISO(formData.date)}
                    onChange={(e) => handleDateChange(e, "date", "month")}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] [color-scheme:light]"
                  />
                </div>
              </div>

              {/* Real-time Stamp (Created timestamp) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#cc2727]" />
                  <span>Time Stamp (Real-Time)</span>
                </label>
                <div className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-[#cc2727] text-xs font-mono font-bold flex items-center justify-between">
                  <span>{leadTimestamp}</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </div>
              </div>

              {/* Mobile Number (10 digits) with Real-Time Duplication Preview */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-black">
                    Mobile Number (10 digits) *
                  </label>
                  {mobileDuplicates.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300 animate-pulse">
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      {mobileDuplicates.length} Duplicate{mobileDuplicates.length > 1 ? "s" : ""} Found
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={formData.mobileNumber}
                  onChange={(e) => handlePhoneChange(e, "mobileNumber")}
                  className={`w-full px-3.5 py-2.5 bg-white border ${
                    mobileDuplicates.length > 0
                      ? "border-amber-400 focus:ring-amber-500/50"
                      : "border-slate-300 focus:ring-[#cc2727] focus:border-[#cc2727]"
                  } rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 font-mono font-medium`}
                />

                {/* Live Duplicate Preview dropdown */}
                {mobileDuplicates.length > 0 && (
                  <div className="mt-1.5 p-2.5 bg-white border border-amber-300 rounded-xl shadow-xl space-y-2 max-h-48 overflow-y-auto z-20">
                    <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>Existing patient leads matching this number:</span>
                    </div>
                    <div className="space-y-1.5">
                      {mobileDuplicates.map((dup) => (
                        <div
                          key={dup._id || dup.uniqueId}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-black truncate">
                                {dup.patientName || "Unnamed"}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#cc2727]/10 text-[#cc2727] font-mono font-bold">
                                {dup.uniqueId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-black font-mono">
                              <span className="text-amber-700 font-semibold">
                                📞 {dup.mobileNumber || dup.phoneNumber}
                              </span>
                              {dup.alternateNumber && (
                                <span className="text-gray-600">
                                  Alt: {dup.alternateNumber}
                                </span>
                              )}
                              {dup.location && <span>📍 {dup.location}</span>}
                            </div>
                          </div>
                          <a
                            href={`/admin/leads/${dup.uniqueId || dup._id}`}
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-white hover:bg-slate-200 text-[#cc2727] shrink-0 border border-slate-200"
                            title="View Lead in New Tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Alternate # (10 digits) with Real-Time Duplication Preview */}
              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-black">
                    Alternate # (10 digits)
                  </label>
                  {alternateDuplicates.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-300 animate-pulse">
                      <ShieldAlert className="w-3 h-3 text-amber-600" />
                      {alternateDuplicates.length} Duplicate{alternateDuplicates.length > 1 ? "s" : ""} Found
                    </span>
                  )}
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876543211"
                  value={formData.alternateNumber}
                  onChange={(e) => handlePhoneChange(e, "alternateNumber")}
                  className={`w-full px-3.5 py-2.5 bg-white border ${
                    alternateDuplicates.length > 0
                      ? "border-amber-400 focus:ring-amber-500/50"
                      : "border-slate-300 focus:ring-[#cc2727] focus:border-[#cc2727]"
                  } rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 font-mono font-medium`}
                />

                {/* Live Duplicate Preview dropdown */}
                {alternateDuplicates.length > 0 && (
                  <div className="mt-1.5 p-2.5 bg-white border border-amber-300 rounded-xl shadow-xl space-y-2 max-h-48 overflow-y-auto z-20">
                    <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1.5 border-b border-amber-200 pb-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      <span>Existing patient leads matching this number:</span>
                    </div>
                    <div className="space-y-1.5">
                      {alternateDuplicates.map((dup) => (
                        <div
                          key={dup._id || dup.uniqueId}
                          className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center justify-between text-xs"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-black truncate">
                                {dup.patientName || "Unnamed"}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#cc2727]/10 text-[#cc2727] font-mono font-bold">
                                {dup.uniqueId}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-black font-mono">
                              <span className="text-amber-700 font-semibold">
                                📞 {dup.mobileNumber || dup.phoneNumber}
                              </span>
                              {dup.alternateNumber && (
                                <span className="text-gray-600">
                                  Alt: {dup.alternateNumber}
                                </span>
                              )}
                              {dup.location && <span>📍 {dup.location}</span>}
                            </div>
                          </div>
                          <a
                            href={`/admin/leads/${dup.uniqueId || dup._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded bg-white hover:bg-slate-200 text-[#cc2727] shrink-0 border border-slate-200"
                            title="View Lead in New Tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Caller Name (Drop Down) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Caller Name
                </label>
                <select
                  name="callerName"
                  value={formData.callerName}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
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
                <label className="block text-xs font-bold text-black mb-1.5">
                  Lead Source 
                </label>
                <select
                  name="leadSource"
                  value={formData.leadSource}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
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
                <label className="block text-xs font-bold text-black mb-1.5">
                  Referred By (Free text)
                </label>
                <input
                  type="text"
                  name="referredBy"
                  value={formData.referredBy}
                  onChange={handleChange}
                  placeholder="e.g. Dr. Rajesh Verma / Practo"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>
            </div>
            {renderDynamicSectionFields(1)}
          </div>

          {/* Section 2: Patient & Spouse Profile */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-[#cc2727] uppercase tracking-wider">
              2. Patient & Family Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Patient Name (Free text) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-black mb-1.5">
                  Patient Name (Free text) *
                </label>
                <input
                  type="text"
                  required
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleChange}
                  placeholder="e.g. Amit Sharma"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>

              {/* Patient Age (Number Field with 2 Digits) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Patient Age (2 Digits)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="e.g. 35"
                  value={formData.patientAge}
                  onChange={(e) => handleAgeChange(e, "patientAge")}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-mono font-medium"
                />
              </div>

              {/* Location (Drop Down with inline Other text field) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Location
                </label>
                <select
                  value={selectedLocationOption}
                  onChange={handleLocationOptionChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
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
                    className="w-full mt-2 px-3.5 py-2.5 bg-white border border-[#cc2727]/50 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] animate-fadeIn font-medium"
                    autoFocus
                  />
                )}
              </div>

              {/* Spouse Name (Free text) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Spouse Name (Free text)
                </label>
                <input
                  type="text"
                  name="spouseName"
                  value={formData.spouseName}
                  onChange={handleChange}
                  placeholder="e.g. Neha Sharma"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>

              {/* Spouse Age (Number Field with 2 Digits) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Spouse Age (2 Digits)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  placeholder="e.g. 32"
                  value={formData.spouseAge}
                  onChange={(e) => handleAgeChange(e, "spouseAge")}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-mono font-medium"
                />
              </div>
            </div>
            {renderDynamicSectionFields(2)}
          </div>

          {/* Section 3: Clinical & Surgical Details */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-[#cc2727] uppercase tracking-wider">
              3. Clinical & Surgical Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Looking for Treatment (Drop Down with inline Other text field) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Looking for Treatment
                </label>
                <select
                  value={selectedTreatmentOption}
                  onChange={handleTreatmentOptionChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
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
                    className="w-full mt-2 px-3.5 py-2.5 bg-white border border-[#cc2727]/50 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] animate-fadeIn font-medium"
                    autoFocus
                  />
                )}
              </div>

              {/* Treatment Requirements (Free text) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Treatment Requirements (Free text)
                </label>
                <input
                  type="text"
                  name="treatmentRequirements"
                  value={formData.treatmentRequirements}
                  onChange={handleChange}
                  placeholder="Specific requirements or doctor specialization"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>

              {/* Pre Conditions (Free text) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Pre Conditions (Free text)
                </label>
                <input
                  type="text"
                  name="preConditions"
                  value={formData.preConditions}
                  onChange={handleChange}
                  placeholder="Symptoms, duration, medical reports"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>

              {/* Surgery Details (Free text) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Surgery Details (Free text)
                </label>
                <input
                  type="text"
                  name="surgeryDetails"
                  value={formData.surgeryDetails}
                  onChange={handleChange}
                  placeholder="Past surgeries, allergies, clinical notes"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>
            </div>
            {renderDynamicSectionFields(3)}
          </div>

          {/* Section 4: Follow Up, Disposition & Appointment */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-[#cc2727] uppercase tracking-wider">
              4. Disposition, Appointments & Follow-up
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Follow Up Date (Date Field DD-MMM-YY) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 flex items-center justify-between">
                  <span>Follow Up Date (DD-MMM-YY)</span>
                  {formData.followUpDate && (
                    <span className="text-[11px] font-mono text-[#cc2727] font-bold">
                      {formData.followUpDate}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={parseDDMMMYYToISO(formData.followUpDate)}
                  onChange={(e) => handleDateChange(e, "followUpDate")}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] [color-scheme:light]"
                />
              </div>

              {/* Sub Dispositions (Drop Down) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Sub Dispositions
                </label>
                <select
                  name="subDispositions"
                  value={formData.subDispositions}
                  onChange={handleSubDispositionChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
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
                <label className="block text-xs font-bold text-black mb-1.5">
                  Dispositions (Auto Selection)
                </label>
                <input
                  type="text"
                  readOnly
                  name="dispositions"
                  value={formData.dispositions}
                  placeholder="Auto populated"
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-[#cc2727] font-bold text-xs cursor-not-allowed"
                />
              </div>

              {/* Valid Status (Auto Selection) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Valid Status (Auto Selection)
                </label>
                <input
                  type="text"
                  readOnly
                  name="validStatus"
                  value={formData.validStatus}
                  placeholder="Auto populated"
                  className={`w-full px-3.5 py-2.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold cursor-not-allowed ${
                    formData.validStatus === "Valid"
                      ? "text-emerald-700"
                      : formData.validStatus === "Invalid"
                      ? "text-rose-700"
                      : "text-black"
                  }`}
                />
              </div>

              {/* Appointment Date (Date Field DD-MMM-YY) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 flex items-center justify-between">
                  <span>Appointment Date (DD-MMM-YY)</span>
                  {formData.appointmentDate && (
                    <span className="text-[11px] font-mono text-[#cc2727] font-bold">
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
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] [color-scheme:light]"
                />
              </div>

              {/* Appointment month (Month MMM-YY) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Appointment Month (MMM-YY)
                </label>
                <input
                  type="text"
                  name="appointmentMonth"
                  value={formData.appointmentMonth}
                  onChange={handleChange}
                  placeholder="Auto or e.g. Sep-26"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>

              {/* Teleconsultation Slot (Drop Down) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Teleconsultation Slot
                </label>
                <select
                  name="teleconsultationSlot"
                  value={formData.teleconsultationSlot}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                >
                  <option value="">Select Teleconsultation Slot</option>
                  {(formFields.find((f) => f.id === "teleconsultationSlot")?.options || TELECONSULTATION_SLOTS).map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              {/* Consultation Charges (Free text Amount Field) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Consultation Charges (Amount Field)
                </label>
                <input
                  type="text"
                  name="consultationCharges"
                  value={formData.consultationCharges}
                  onChange={handleChange}
                  placeholder="e.g. 500"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-mono font-medium"
                />
              </div>

              {/* Surgery Date (Date Field DD-MMM-YY) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5 flex items-center justify-between">
                  <span>Surgery Date (DD-MMM-YY)</span>
                  {formData.surgeryDate && (
                    <span className="text-[11px] font-mono text-[#cc2727] font-bold">
                      {formData.surgeryDate}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  value={parseDDMMMYYToISO(formData.surgeryDate)}
                  onChange={(e) => handleDateChange(e, "surgeryDate")}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] [color-scheme:light]"
                />
              </div>

              {/* Surgery Cost (Free text Amount Field) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Surgery Cost (Amount Field)
                </label>
                <input
                  type="text"
                  name="surgeryCost"
                  value={formData.surgeryCost}
                  onChange={handleChange}
                  placeholder="e.g. 75000"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-mono font-medium"
                />
              </div>

              {/* Surgery - Payment Received (Free text Amount Field) */}
              <div>
                <label className="block text-xs font-bold text-black mb-1.5">
                  Surgery - Payment Received (Amount)
                </label>
                <input
                  type="text"
                  name="surgeryPaymentReceived"
                  value={formData.surgeryPaymentReceived}
                  onChange={handleChange}
                  placeholder="e.g. 25000"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-mono font-medium"
                />
              </div>
            </div>
            {renderDynamicSectionFields(4)}
          </div>

          {/* Section 5: Notes */}
          <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200">
            <label className="block text-xs font-bold text-black mb-1.5">
              Notes (Free Text)
            </label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              placeholder="Any clinical notes, patient conversation remarks, payment details..."
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] resize-none font-medium"
            />
          </div>

          {/* Submit buttons */}
          <div className="flex gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={handleCloseModal}
              className="flex-1 py-3 px-4 bg-white hover:bg-slate-100 text-black text-xs font-bold rounded-xl transition-colors border border-slate-300 shadow-2xs cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-[#cc2727]/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
