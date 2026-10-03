"use client";

import {
  FileText,
  Clock,
  ShieldCheck,
  UserCog,
  Headphones,
  User,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

export interface NoteHistoryItem {
  _id?: string;
  performedBy: string;
  performedByRole: string; // "admin" | "team_leader" | "agent"
  performedByEmail?: string;
  timestamp: string;
  oldNotes?: string;
  newNotes: string;
}

interface NotesHistoryProps {
  notesHistory?: NoteHistoryItem[];
  leadUniqueId?: string;
}

export default function NotesHistory({
  notesHistory = [],
  leadUniqueId,
}: NotesHistoryProps) {
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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col text-black">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#cc2727]/10 border border-[#cc2727]/20 text-[#cc2727]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-black uppercase tracking-wider flex items-center gap-2">
              <span>Notes & Observations History</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 font-mono font-semibold normal-case">
                {notesHistory.length} notes
              </span>
            </h3>
            <p className="text-[11px] text-gray-600">
              Audit log of all clinical notes & call remarks
            </p>
          </div>
        </div>
      </div>

      {/* Notes Timeline */}
      <div className="overflow-y-auto pr-1 mt-4 space-y-4 max-h-[380px]">
        {notesHistory.length === 0 ? (
          <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-gray-500 flex items-center justify-center mx-auto mb-2.5">
              <MessageSquare className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-xs font-bold text-black">
              No notes recorded yet
            </p>
            <p className="text-[11px] text-gray-600 mt-1 max-w-[220px] mx-auto">
              Jab bhi koi member is lead me Notes & Observations add karke save karega, unki complete history yahan show hogi.
            </p>
          </div>
        ) : (
          notesHistory.map((item, idx) => {
            const badge = getRoleBadge(item.performedByRole);
            return (
              <div
                key={item._id || idx}
                className="relative pl-6 pb-2 border-l-2 border-slate-200 last:border-l-0 group"
              >
                {/* Timeline node */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-[#cc2727] group-hover:scale-110 transition-transform" />

                <div className="p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl space-y-2.5 transition-colors shadow-xs">
                  {/* Performed By & Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-black">
                        {item.performedBy}
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
                      <span>{formatTimestamp(item.timestamp)}</span>
                    </div>
                  </div>

                  {/* Old vs New Note Content */}
                  <div className="space-y-1.5 text-xs">
                    {item.oldNotes ? (
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block">
                          Old Note:
                        </span>
                        <div className="p-2 rounded-lg bg-rose-50/60 border border-rose-200 text-rose-800 text-[11px] leading-relaxed whitespace-pre-wrap">
                          {item.oldNotes}
                        </div>
                      </div>
                    ) : null}

                    <div className="space-y-1">
                      {item.oldNotes && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                          New Note:
                        </span>
                      )}
                      <div className="p-2 rounded-lg bg-white border border-slate-200 text-black text-xs leading-relaxed whitespace-pre-wrap font-medium">
                        {item.newNotes}
                      </div>
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
