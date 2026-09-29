"use client";

import { useEffect, useState, useMemo } from "react";
import {
  FolderKanban,
  UserPlus,
  Search,
  CheckSquare,
  Square,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  Stethoscope,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
  X,
} from "lucide-react";
import { notifyLeadUpdated } from "@/lib/leadOptions";

interface Lead {
  _id?: string;
  uniqueId: string;
  patientName?: string;
  mobileNumber?: string;
  location?: string;
  otherCity?: string;
  lookingForTreatment?: string;
  callerName?: string;
  date?: string;
  assignedDate?: string;
  leadTimestamp?: string;
  subDispositions?: string;
  dispositions?: string;
  createdAt?: string;
}

interface BulkAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  allLeads: Lead[];
  onAssignedSuccess: (count: number) => void;
}

export default function BulkAssignModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  allLeads = [],
  onAssignedSuccess,
}: BulkAssignModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTreatment, setFilterTreatment] = useState("all");
  const [filterLocation, setFilterLocation] = useState("all");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  // Filter unassigned leads ONLY (callerName is empty or "unassigned" or not assigned to any member)
  const unassignedPool = useMemo(() => {
    return allLeads.filter((l) => {
      const c = (l.callerName || "").trim().toLowerCase();
      return (
        !c ||
        c === "unassigned" ||
        c === "none" ||
        c === "-" ||
        c === "n/a"
      );
    });
  }, [allLeads]);

  // Distinct filters
  const treatmentsList = useMemo(() => {
    const set = new Set<string>();
    unassignedPool.forEach((l) => {
      if (l.lookingForTreatment) set.add(l.lookingForTreatment);
    });
    return Array.from(set).sort();
  }, [unassignedPool]);

  const locationsList = useMemo(() => {
    const set = new Set<string>();
    unassignedPool.forEach((l) => {
      const loc = l.location || l.otherCity;
      if (loc) set.add(loc);
    });
    return Array.from(set).sort();
  }, [unassignedPool]);

  // Filtered pool
  const filteredPool = useMemo(() => {
    return unassignedPool.filter((l) => {
      if (filterTreatment !== "all" && l.lookingForTreatment !== filterTreatment)
        return false;
      if (
        filterLocation !== "all" &&
        (l.location || l.otherCity) !== filterLocation
      )
        return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const id = (l.uniqueId || "").toLowerCase();
        const name = (l.patientName || "").toLowerCase();
        const phone = (l.mobileNumber || "").toLowerCase();
        const loc = (l.location || l.otherCity || "").toLowerCase();
        const tr = (l.lookingForTreatment || "").toLowerCase();
        return (
          id.includes(q) ||
          name.includes(q) ||
          phone.includes(q) ||
          loc.includes(q) ||
          tr.includes(q)
        );
      }
      return true;
    });
  }, [unassignedPool, filterTreatment, filterLocation, searchQuery]);

  // Toggle selection of a single lead
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all visible filtered leads
  const handleSelectAll = () => {
    const allFilteredIds = filteredPool.map((l) => l.uniqueId || l._id || "");
    const areAllSelected = allFilteredIds.every((id) => selectedIds.has(id));

    if (areAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
  };

  // Quick select first N leads (e.g. 5, 10, 25, 50)
  const handleQuickSelect = (count: number) => {
    const ids = filteredPool
      .slice(0, count)
      .map((l) => l.uniqueId || l._id || "");
    setSelectedIds(new Set(ids));
  };

  // Submit bulk assignment
  const handleAssignSubmit = async () => {
    if (selectedIds.size === 0) {
      setError("Please select at least 1 lead to assign.");
      return;
    }

    setAssigning(true);
    setError("");

    try {
      const res = await fetch("/api/admin/leads/assign-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadIds: Array.from(selectedIds),
          agentId,
          agentName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to assign leads");
      }

      notifyLeadUpdated();
      onAssignedSuccess(selectedIds.size);
      setSelectedIds(new Set());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to assign leads");
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  const isAllSelected =
    filteredPool.length > 0 &&
    filteredPool.every((l) => selectedIds.has(l.uniqueId || l._id || ""));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200 text-black">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-2xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
              <FolderKanban className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
                <span>Bulk Assign Leads</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 font-semibold font-mono">
                  To: {agentName}
                </span>
              </h2>
              <p className="text-xs text-gray-600 mt-0.5">
                Sirf unassigned leads pool yahan dikhega. Assign hone ke baad ye leads kisi doosre member ko nahi dikhengi.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black p-2 rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter & Quick Select Bar */}
        <div className="p-4 sm:p-6 pb-3 space-y-3.5 bg-slate-50/70 border-b border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search patient, phone, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-slate-300 rounded-xl text-black text-xs placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
              />
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            </div>

            {/* Treatment Filter */}
            <div>
              <select
                value={filterTreatment}
                onChange={(e) => setFilterTreatment(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium cursor-pointer"
              >
                <option value="all">All Treatments ({treatmentsList.length})</option>
                {treatmentsList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Location Filter */}
            <div>
              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-black text-xs focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium cursor-pointer"
              >
                <option value="all">All Locations ({locationsList.length})</option>
                {locationsList.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Select Buttons & Count */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 font-medium">Quick select:</span>
              {[5, 10, 20, 50].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => handleQuickSelect(n)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white hover:bg-slate-100 text-black border border-slate-300 transition-colors cursor-pointer shadow-2xs"
                >
                  +{n} leads
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-black font-medium">
                Available unassigned:{" "}
                <strong className="text-black font-mono font-bold">{unassignedPool.length}</strong>
              </span>
              <span className="text-[#cc2727] font-bold bg-[#cc2727]/10 px-2.5 py-1 rounded-lg border border-[#cc2727]/20 font-mono">
                {selectedIds.size} Selected
              </span>
            </div>
          </div>
        </div>

        {/* Leads Table List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-[250px] bg-white">
          {filteredPool.length === 0 ? (
            <div className="py-12 text-center text-gray-600 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-gray-500 flex items-center justify-center mx-auto">
                <FolderKanban className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-black">No unassigned leads found</p>
              <p className="text-xs text-gray-600 max-w-sm mx-auto">
                Sabhi leads already kisi na kisi member ko assign ho chuki hain ya aapke filter criteria se match nahi karti.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-black text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3.5 w-12 text-center">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-gray-600 hover:text-black cursor-pointer"
                        title={isAllSelected ? "Deselect All" : "Select All"}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#cc2727]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">Unique ID</th>
                    <th className="py-3 px-3">Patient Name</th>
                    <th className="py-3 px-3">Mobile #</th>
                    <th className="py-3 px-3">Location</th>
                    <th className="py-3 px-3">Looking For</th>
                    <th className="py-3 px-3">Lead Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPool.map((lead) => {
                    const id = lead.uniqueId || lead._id || "";
                    const isSelected = selectedIds.has(id);
                    return (
                      <tr
                        key={id}
                        onClick={() => toggleSelect(id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#cc2727]/10 text-black"
                            : "hover:bg-slate-50 text-black"
                        }`}
                      >
                        <td className="py-2.5 px-3.5 text-center">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-[#cc2727] mx-auto" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-500 mx-auto" />
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[#cc2727]">
                          {lead.uniqueId}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-black">
                          {lead.patientName || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-black">
                          {lead.mobileNumber || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-black">
                          {lead.location || lead.otherCity || "-"}
                        </td>
                        <td className="py-2.5 px-3 text-black font-medium">
                          {lead.lookingForTreatment || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-gray-600 text-[11px]">
                          {lead.date || "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-xs text-black font-medium">
            Selected: <strong className="text-black font-mono font-bold">{selectedIds.size}</strong> leads ready to assign
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={assigning}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAssignSubmit}
              disabled={assigning || selectedIds.size === 0}
              className="py-2 px-5 bg-[#cc2727] hover:bg-[#b02121] disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-[#cc2727]/25 transition-all active:scale-95 cursor-pointer"
            >
              {assigning ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Assign {selectedIds.size} Leads to {agentName}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
