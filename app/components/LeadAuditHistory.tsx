"use client";

import { useMemo } from "react";
import {
  History,
  User,
  Clock,
  Calendar,
  ArrowRight,
  ShieldCheck,
  UserCog,
  Headphones,
  CheckCircle2,
} from "lucide-react";

export interface ChangeItem {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
}

export interface AuditLog {
  _id?: string;
  performedBy: string;
  performedByRole: string; // "admin" | "team_leader" | "agent"
  performedByEmail?: string;
  timestamp: string;
  changes: ChangeItem[];
}

interface LeadAuditHistoryProps {
  auditLogs?: AuditLog[];
  leadCreatedAt?: string;
  leadUniqueId?: string;
}

export default function LeadAuditHistory({
  auditLogs = [],
  leadCreatedAt,
  leadUniqueId,
}: LeadAuditHistoryProps) {
  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
    } catch {
      return ts;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role?.toLowerCase()) {
      case "admin":
        return {
          label: "Admin",
          bg: "bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20",
          icon: <ShieldCheck className="w-3 h-3 text-[#cc2727]" />,
        };
      case "team_leader":
        return {
          label: "Team Leader",
          bg: "bg-amber-50 text-amber-700 border border-amber-200",
          icon: <UserCog className="w-3 h-3 text-amber-600" />,
        };
      case "agent":
        return {
          label: "Agent",
          bg: "bg-emerald-50 text-emerald-700 border border-emerald-200",
          icon: <Headphones className="w-3 h-3 text-emerald-600" />,
        };
      default:
        return {
          label: role || "Member",
          bg: "bg-slate-100 text-black border border-slate-200",
          icon: <User className="w-3 h-3 text-gray-600" />,
        };
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col h-full text-black">
      {/* Column Header */}
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#cc2727]/10 border border-[#cc2727]/20 text-[#cc2727]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-black uppercase tracking-wider flex items-center gap-2">
              <span>Change History</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 font-mono font-semibold normal-case">
                {auditLogs.length} updates
              </span>
            </h3>
            <p className="text-[11px] text-gray-600">
              Audit log of all edits & field modifications
            </p>
          </div>
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="flex-1 overflow-y-auto pr-1 mt-4 space-y-4 max-h-[calc(100vh-280px)]">
        {auditLogs.length === 0 ? (
          <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-gray-500 flex items-center justify-center mx-auto mb-3">
              <History className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-xs font-bold text-black">
              No modifications recorded yet
            </p>
            <p className="text-[11px] text-gray-600 mt-1 max-w-[240px] mx-auto">
              Whenever a team member modifies any field in this lead, their name, date, time, and previous vs new values will appear here.
            </p>
            {leadCreatedAt && (
              <div className="mt-4 pt-3 border-t border-slate-200 inline-flex items-center gap-1.5 text-[11px] text-gray-600">
                <Clock className="w-3 h-3 text-gray-500" />
                <span>Created: {formatTimestamp(leadCreatedAt)}</span>
              </div>
            )}
          </div>
        ) : (
          auditLogs.map((log, logIdx) => {
            const badge = getRoleBadge(log.performedByRole);
            return (
              <div
                key={log._id || logIdx}
                className="relative pl-6 pb-2 border-l-2 border-slate-200 last:border-l-0 group"
              >
                {/* Timeline node */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-[#cc2727] group-hover:scale-110 transition-transform" />

                <div className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl space-y-2.5 transition-colors shadow-xs">
                  {/* Member & Role & Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-black">
                        {log.performedBy}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold flex items-center gap-1 ${badge.bg}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] font-mono text-gray-600 font-medium">
                      <Clock className="w-3 h-3 text-[#cc2727]" />
                      <span>{formatTimestamp(log.timestamp)}</span>
                    </div>
                  </div>

                  {/* Changes List */}
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                      {log.changes.length}{" "}
                      {log.changes.length === 1 ? "Field Changed" : "Fields Changed"}
                    </span>

                    <div className="space-y-1.5">
                      {log.changes.map((change, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-2 rounded-lg bg-white border border-slate-200 text-xs space-y-1"
                        >
                          <div className="font-semibold text-black text-[11px]">
                            {change.fieldLabel}
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[11px]">
                            {/* Old Value */}
                            <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 truncate max-w-[130px]" title={change.oldValue}>
                              {change.oldValue}
                            </span>
                            <ArrowRight className="w-3 h-3 text-gray-500 shrink-0" />
                            {/* New Value */}
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold truncate max-w-[130px]" title={change.newValue}>
                              {change.newValue}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
