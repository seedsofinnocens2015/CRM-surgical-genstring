"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  Pin,
  Settings,
  ChevronDown,
  X,
  RotateCcw,
  Sliders,
  Check,
  Calendar,
  MapPin,
  Phone,
  User,
  Activity,
  FileText,
  Tag,
  Clock,
} from "lucide-react";
import { LeadFilters } from "@/app/admin/leads/page";
import { DISPOSITIONS, VALID_STATUS_LIST } from "@/lib/leadOptions";

export interface FilterFieldMeta {
  key: keyof LeadFilters | "leadEntryDate" | "followUpDate" | "appointmentDate" | "surgeryDate";
  label: string;
  type: "select" | "dateRange";
  options?: string[];
  fromKey?: keyof LeadFilters;
  toKey?: keyof LeadFilters;
}

export const ALL_AVAILABLE_FILTER_FIELDS: FilterFieldMeta[] = [
  {
    key: "dispositions",
    label: "Lead Stage",
    type: "select",
    options: [...DISPOSITIONS],
  },
  {
    key: "subDispositions",
    label: "Sub Status",
    type: "select",
  },
  {
    key: "leadSource",
    label: "Lead Source",
    type: "select",
  },
  {
    key: "callerName",
    label: "Lead Owner / Caller",
    type: "select",
  },
  {
    key: "location",
    label: "Center / Location",
    type: "select",
  },
  {
    key: "treatment",
    label: "Treatment",
    type: "select",
  },
  {
    key: "validStatus",
    label: "Valid Status",
    type: "select",
    options: [...VALID_STATUS_LIST],
  },
  {
    key: "leadEntryDate",
    label: "Created On / Lead Entry Date",
    type: "dateRange",
    fromKey: "leadEntryDateFrom",
    toKey: "leadEntryDateTo",
  },
  {
    key: "followUpDate",
    label: "Follow Up Date",
    type: "dateRange",
    fromKey: "followUpDateFrom",
    toKey: "followUpDateTo",
  },
  {
    key: "appointmentDate",
    label: "Appointment Date",
    type: "dateRange",
    fromKey: "appointmentDateFrom",
    toKey: "appointmentDateTo",
  },
  {
    key: "surgeryDate",
    label: "Surgery Date",
    type: "dateRange",
    fromKey: "surgeryDateFrom",
    toKey: "surgeryDateTo",
  },
];

const DEFAULT_PINNED_FIELD_KEYS: string[] = [
  "dispositions",
  "leadSource",
  "callerName",
  "location",
];

interface LeadSquaredFilterProps {
  filters: LeadFilters;
  updateFilter: (key: keyof LeadFilters, value: string) => void;
  handleResetFilters: () => void;
  activeFilterCount: number;
  distinctLocations: string[];
  distinctCallers: string[];
  distinctLeadSources: string[];
  distinctTreatments: string[];
  distinctSubDispositions: string[];
  storageKeyPrefix?: string;
}

export default function LeadSquaredFilter({
  filters,
  updateFilter,
  handleResetFilters,
  activeFilterCount,
  distinctLocations,
  distinctCallers,
  distinctLeadSources,
  distinctTreatments,
  distinctSubDispositions,
  storageKeyPrefix = "admin",
}: LeadSquaredFilterProps) {
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isConfigureModalOpen, setIsConfigureModalOpen] = useState(false);
  const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState("");
  const [configureSearch, setConfigureSearch] = useState("");
  const [openInstantField, setOpenInstantField] = useState<string | null>(null);

  // Pinned filter fields with persistence
  const [pinnedFieldKeys, setPinnedFieldKeys] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`crm_pinned_filters_${storageKeyPrefix}`);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_PINNED_FIELD_KEYS;
  });

  const [tempConfiguredKeys, setTempConfiguredKeys] = useState<string[]>(pinnedFieldKeys);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    }
    if (isFilterDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFilterDropdownOpen]);

  const savePinnedFilters = (newKeys: string[]) => {
    setPinnedFieldKeys(newKeys);
    try {
      localStorage.setItem(`crm_pinned_filters_${storageKeyPrefix}`, JSON.stringify(newKeys));
    } catch (e) {}
  };

  const togglePinField = (key: string) => {
    const updated = pinnedFieldKeys.includes(key)
      ? pinnedFieldKeys.filter((k) => k !== key)
      : [...pinnedFieldKeys, key];
    savePinnedFilters(updated);
  };

  // Populate dynamic options
  const filterFieldsWithDynamicOptions = useMemo(() => {
    return ALL_AVAILABLE_FILTER_FIELDS.map((field) => {
      if (field.key === "location") return { ...field, options: distinctLocations };
      if (field.key === "callerName") return { ...field, options: distinctCallers };
      if (field.key === "leadSource") return { ...field, options: distinctLeadSources };
      if (field.key === "treatment") return { ...field, options: distinctTreatments };
      if (field.key === "subDispositions") return { ...field, options: distinctSubDispositions };
      return field;
    });
  }, [
    distinctLocations,
    distinctCallers,
    distinctLeadSources,
    distinctTreatments,
    distinctSubDispositions,
  ]);

  // Pinned filter objects
  const pinnedFields = useMemo(() => {
    return filterFieldsWithDynamicOptions.filter((f) => pinnedFieldKeys.includes(f.key));
  }, [filterFieldsWithDynamicOptions, pinnedFieldKeys]);

  // Unpinned other filter objects
  const otherFields = useMemo(() => {
    return filterFieldsWithDynamicOptions.filter((f) => !pinnedFieldKeys.includes(f.key));
  }, [filterFieldsWithDynamicOptions, pinnedFieldKeys]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 1. LeadSquared "+ Filter" Button with Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
            activeFilterCount > 0
              ? "bg-[#cc2727] text-white hover:bg-[#b02121] shadow-[#cc2727]/25"
              : "bg-[#cc2727] text-white hover:bg-[#b02121] shadow-[#cc2727]/20"
          }`}
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-white text-[#cc2727] text-[10px] font-extrabold flex items-center justify-center ml-1">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* LeadSquared Filter Dropdown Menu (Matches Screenshot 1) */}
        {isFilterDropdownOpen && (
          <div className="absolute left-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 text-xs">
            {/* Search input in dropdown */}
            <div className="p-2.5 border-b border-slate-100 relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search here"
                value={dropdownSearch}
                onChange={(e) => setDropdownSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#cc2727]"
              />
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
              {/* Pinned filters summary banner */}
              <div className="p-3 bg-slate-50/50">
                <div className="text-[11px] font-semibold text-slate-500 mb-2">
                  Pinned filters {pinnedFieldKeys.length}/20
                </div>
                <div className="p-2.5 rounded-lg bg-sky-50/70 border border-sky-100 text-[11px] text-slate-600 flex items-start gap-2">
                  <Pin className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                  <span>Pin most frequently used filters to always see them on top.</span>
                </div>
              </div>

              {/* Pinned list items (if search matches) */}
              {pinnedFields.length > 0 && (
                <div className="py-1">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Pinned
                  </div>
                  {pinnedFields
                    .filter((f) => f.label.toLowerCase().includes(dropdownSearch.toLowerCase()))
                    .map((f) => (
                      <div
                        key={f.key}
                        className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          setOpenInstantField(f.key);
                          setIsFilterDropdownOpen(false);
                        }}
                      >
                        <span className="text-slate-700 font-medium">{f.label}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePinField(f.key);
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-[#cc2727]"
                          title="Unpin"
                        >
                          <Pin className="w-3 h-3 fill-current" />
                        </button>
                      </div>
                    ))}
                </div>
              )}

              {/* Other Filters Section */}
              <div className="py-1">
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Other Filters
                </div>
                {otherFields
                  .filter((f) => f.label.toLowerCase().includes(dropdownSearch.toLowerCase()))
                  .map((f) => (
                    <div
                      key={f.key}
                      className="px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                      onClick={() => {
                        setOpenInstantField(f.key);
                        setIsFilterDropdownOpen(false);
                      }}
                    >
                      <span className="text-slate-700 font-medium">{f.label}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePinField(f.key);
                        }}
                        className="p-1 hover:bg-slate-100 rounded text-slate-300 hover:text-slate-600"
                        title="Pin this filter"
                      >
                        <Pin className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            {/* Bottom Actions: Advanced Filters + Configure Fields */}
            <div className="p-2 border-t border-slate-100 bg-slate-50/70 space-y-1">
              <button
                type="button"
                onClick={() => {
                  setIsFilterDropdownOpen(false);
                  setIsAdvancedModalOpen(true);
                }}
                className="w-full py-1.5 px-3 rounded-lg text-slate-700 hover:bg-white hover:shadow-xs flex items-center justify-center gap-2 font-semibold text-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#cc2727]" />
                <span>Advanced Filters</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsFilterDropdownOpen(false);
                  setTempConfiguredKeys(pinnedFieldKeys);
                  setIsConfigureModalOpen(true);
                }}
                className="w-full py-1.5 px-3 rounded-lg text-slate-600 hover:bg-white hover:shadow-xs flex items-center justify-center gap-2 font-medium text-xs transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-slate-500" />
                <span>Configure Fields</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Instant Pinned Filter Pills Next to Search Bar */}
      {pinnedFields.map((field) => {
        let isFieldActive = false;
        let activeValueLabel = "";

        if (field.type === "select") {
          const val = filters[field.key as keyof LeadFilters];
          if (val) {
            isFieldActive = true;
            activeValueLabel = val;
          }
        } else if (field.type === "dateRange") {
          const from = filters[field.fromKey!];
          const to = filters[field.toKey!];
          if (from || to) {
            isFieldActive = true;
            activeValueLabel = `${from || "Start"} - ${to || "End"}`;
          }
        }

        const isPickerOpen = openInstantField === field.key;

        return (
          <div key={field.key} className="relative">
            <button
              type="button"
              onClick={() => setOpenInstantField((prev) => (prev === field.key ? null : field.key))}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                isFieldActive
                  ? "bg-[#cc2727]/10 text-[#cc2727] border-[#cc2727]/30 font-semibold"
                  : "bg-white text-slate-700 hover:bg-slate-50 border-slate-300"
              }`}
            >
              <span>{field.label}</span>
              {isFieldActive && (
                <span className="font-bold text-[#cc2727] truncate max-w-[120px]">
                  : {activeValueLabel}
                </span>
              )}
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {/* Instant Filter Dropdown Picker */}
            {isPickerOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 text-xs animate-in fade-in slide-in-from-top-1">
                {field.type === "select" ? (
                  <div className="space-y-1 max-h-56 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        updateFilter(field.key as keyof LeadFilters, "");
                        setOpenInstantField(null);
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded hover:bg-slate-100 text-slate-500 font-medium"
                    >
                      All / Clear
                    </button>
                    {(field.options || []).map((opt) => {
                      const isSelected = filters[field.key as keyof LeadFilters] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            updateFilter(field.key as keyof LeadFilters, opt);
                            setOpenInstantField(null);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded flex items-center justify-between transition-colors ${
                            isSelected
                              ? "bg-[#cc2727]/10 text-[#cc2727] font-semibold"
                              : "text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <span className="truncate">{opt}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#cc2727]" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-2 space-y-2.5">
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        From
                      </span>
                      <input
                        type="date"
                        value={filters[field.fromKey!]}
                        onChange={(e) => updateFilter(field.fromKey!, e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 [color-scheme:light]"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        To
                      </span>
                      <input
                        type="date"
                        value={filters[field.toKey!]}
                        onChange={(e) => updateFilter(field.toKey!, e.target.value)}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-800 [color-scheme:light]"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          updateFilter(field.fromKey!, "");
                          updateFilter(field.toKey!, "");
                          setOpenInstantField(null);
                        }}
                        className="px-2.5 py-1 text-slate-500 hover:text-slate-800"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpenInstantField(null)}
                        className="px-3 py-1 bg-[#cc2727] text-white rounded font-medium text-xs shadow-xs"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 3. Reset Button when active filters exist */}
      {activeFilterCount > 0 && (
        <button
          type="button"
          onClick={handleResetFilters}
          className="flex items-center gap-1 px-2.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          title="Reset all active filters"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      )}

      {/* 4. Configure Filter Fields Modal (Exact Screenshot 2 Match) */}
      {isConfigureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-800">Configure Filter Fields</h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                  {tempConfiguredKeys.length}/{filterFieldsWithDynamicOptions.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigureModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Box */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search here"
                  value={configureSearch}
                  onChange={(e) => setConfigureSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#cc2727]"
                />
              </div>
            </div>

            {/* Fields Checklist */}
            <div className="p-3 overflow-y-auto space-y-1 flex-1 text-xs">
              {filterFieldsWithDynamicOptions
                .filter((f) => f.label.toLowerCase().includes(configureSearch.toLowerCase()))
                .map((f) => {
                  const isChecked = tempConfiguredKeys.includes(f.key);
                  return (
                    <label
                      key={f.key}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-50 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setTempConfiguredKeys((prev) =>
                            prev.includes(f.key)
                              ? prev.filter((k) => k !== f.key)
                              : [...prev, f.key]
                          );
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-[#cc2727] focus:ring-[#cc2727] cursor-pointer"
                      />
                      <span className="text-slate-700 font-medium">{f.label}</span>
                    </label>
                  );
                })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => setTempConfiguredKeys(DEFAULT_PINNED_FIELD_KEYS)}
                className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-xs"
              >
                Restore Default
              </button>
              <button
                type="button"
                onClick={() => {
                  savePinnedFilters(tempConfiguredKeys);
                  setIsConfigureModalOpen(false);
                }}
                className="px-4 py-1.5 bg-[#cc2727] hover:bg-[#b02121] text-white rounded-lg text-xs font-bold shadow-sm shadow-[#cc2727]/25"
              >
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Full Advanced Filters Popup Modal */}
      {isAdvancedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#cc2727]/10 text-[#cc2727]">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Advanced Lead Filters</h3>
                  <p className="text-xs text-slate-500">
                    Apply comprehensive multi-field filtering criteria
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdvancedModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields Grid */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Lead Entry Date */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Lead Entry Date</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-500">From</span>
                      <input
                        type="date"
                        value={filters.leadEntryDateFrom}
                        onChange={(e) => updateFilter("leadEntryDateFrom", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">To</span>
                      <input
                        type="date"
                        value={filters.leadEntryDateTo}
                        onChange={(e) => updateFilter("leadEntryDateTo", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Center Location */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Center Location</span>
                  </label>
                  <select
                    value={filters.location}
                    onChange={(e) => updateFilter("location", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">All Locations</option>
                    {distinctLocations.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Caller Name / Lead Owner */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Lead Owner / Caller</span>
                  </label>
                  <select
                    value={filters.callerName}
                    onChange={(e) => updateFilter("callerName", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">All Owners / Callers</option>
                    {distinctCallers.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Lead Source */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Lead Source</span>
                  </label>
                  <select
                    value={filters.leadSource}
                    onChange={(e) => updateFilter("leadSource", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">All Sources</option>
                    {distinctLeadSources.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Treatment */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Treatment</span>
                  </label>
                  <select
                    value={filters.treatment}
                    onChange={(e) => updateFilter("treatment", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">All Treatments</option>
                    {distinctTreatments.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 6. Lead Stage / Disposition */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Lead Stage / Disposition</span>
                  </label>
                  <select
                    value={filters.dispositions}
                    onChange={(e) => updateFilter("dispositions", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">All Stages</option>
                    {DISPOSITIONS.map((disp) => (
                      <option key={disp} value={disp}>
                        {disp}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 7. Sub Disposition */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Sub Disposition</span>
                  </label>
                  <select
                    value={filters.subDispositions}
                    onChange={(e) => updateFilter("subDispositions", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">All Sub Dispositions</option>
                    {distinctSubDispositions.map((sd) => (
                      <option key={sd} value={sd}>
                        {sd}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 8. Valid Status */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Valid Status</span>
                  </label>
                  <select
                    value={filters.validStatus}
                    onChange={(e) => updateFilter("validStatus", e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">All Statuses</option>
                    {VALID_STATUS_LIST.map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 9. Follow Up Date */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Follow Up Date</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-500">From</span>
                      <input
                        type="date"
                        value={filters.followUpDateFrom}
                        onChange={(e) => updateFilter("followUpDateFrom", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">To</span>
                      <input
                        type="date"
                        value={filters.followUpDateTo}
                        onChange={(e) => updateFilter("followUpDateTo", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                  </div>
                </div>

                {/* 10. Appointment Date */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Appointment Date</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-500">From</span>
                      <input
                        type="date"
                        value={filters.appointmentDateFrom}
                        onChange={(e) => updateFilter("appointmentDateFrom", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">To</span>
                      <input
                        type="date"
                        value={filters.appointmentDateTo}
                        onChange={(e) => updateFilter("appointmentDateTo", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                  </div>
                </div>

                {/* 11. Surgery Date */}
                <div className="space-y-1.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="font-bold text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#cc2727]" />
                    <span>Surgery Date</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="block text-[10px] text-slate-500">From</span>
                      <input
                        type="date"
                        value={filters.surgeryDateFrom}
                        onChange={(e) => updateFilter("surgeryDateFrom", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500">To</span>
                      <input
                        type="date"
                        value={filters.surgeryDateTo}
                        onChange={(e) => updateFilter("surgeryDateTo", e.target.value)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs [color-scheme:light]"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 text-rose-600 hover:text-rose-700 font-semibold text-xs transition-colors"
              >
                Clear All Filters
              </button>
              <button
                type="button"
                onClick={() => setIsAdvancedModalOpen(false)}
                className="px-5 py-2 bg-[#cc2727] hover:bg-[#b02121] text-white rounded-xl text-xs font-bold shadow-md shadow-[#cc2727]/25"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
