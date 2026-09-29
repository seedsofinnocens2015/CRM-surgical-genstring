"use client";

import { useState, useEffect } from "react";
import {
  X,
  UserCheck,
  Mail,
  Phone,
  Calendar,
  Shield,
  User,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Power,
} from "lucide-react";

interface MemberDetailModalProps {
  isOpen: boolean;
  member: any;
  onClose: () => void;
  onUpdated: (updatedMember: any) => void;
  onDeleted: (memberId: string) => void;
}

export default function MemberDetailModal({
  isOpen,
  member,
  onClose,
  onUpdated,
  onDeleted,
}: MemberDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [editForm, setEditForm] = useState({
    name: "",
    mobile: "",
    email: "",
    role: "agent",
    status: "active",
    password: "",
  });

  useEffect(() => {
    if (member) {
      setEditForm({
        name: member.name || "",
        mobile: member.mobile || "",
        email: member.email || "",
        role: member.role || "agent",
        status: member.status || "active",
        password: "",
      });
      setIsEditing(false);
      setIsDeleting(false);
      setError("");
    }
  }, [member]);

  if (!isOpen || !member) return null;

  // Toggle Active / Inactive Status directly
  const handleToggleStatus = async () => {
    const nextStatus = member.status === "inactive" ? "active" : "inactive";
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/members/${member._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      onUpdated(data.member);
    } catch (err: any) {
      setError(err.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  // Submit edit form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload: any = {
        name: editForm.name,
        mobile: editForm.mobile,
        email: editForm.email,
        role: editForm.role,
        status: editForm.status,
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await fetch(`/api/admin/members/${member._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update member");

      onUpdated(data.member);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || "Failed to update member");
    } finally {
      setLoading(false);
    }
  };

  // Confirm delete
  const handleDelete = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/members/${member._id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete member");

      onDeleted(member._id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto text-black">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-500 hover:text-black transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Error notification */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        {/* Header Avatar and Basic Info */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-extrabold text-2xl uppercase shadow-md shrink-0">
            {member.name ? member.name.charAt(0) : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold text-black truncate">
              {member.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-[#cc2727]/10 text-[#cc2727] border-[#cc2727]/20">
                {member.role === "team_leader" ? (
                  <Shield className="w-3 h-3" />
                ) : (
                  <User className="w-3 h-3" />
                )}
                {member.role === "team_leader" ? "Team Leader" : "Agent"}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  member.status === "inactive"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    member.status === "inactive"
                      ? "bg-rose-600"
                      : "bg-emerald-500 animate-pulse"
                  }`}
                />
                {member.status === "inactive" ? "Inactive" : "Active"}
              </span>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Box */}
        {isDeleting ? (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-black mb-6 space-y-3">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
              <span>Confirm Delete Member?</span>
            </div>
            <p className="text-xs text-black leading-relaxed">
              Are you sure you want to permanently delete member{" "}
              <strong className="text-black">{member.name}</strong> ({member.email})? This action cannot be undone.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs rounded-lg font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDelete}
                className="flex-1 py-2 px-3 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {loading ? "Deleting..." : "Yes, Delete Permanently"}
              </button>
            </div>
          </div>
        ) : null}

        {/* Edit Form OR View Details Mode */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="space-y-4 mb-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-black text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  required
                  value={editForm.mobile}
                  onChange={(e) =>
                    setEditForm({ ...editForm, mobile: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-black text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-black text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
                />
              </div>
            </div>

            {/* Role Radio in Edit */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                Role
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setEditForm({ ...editForm, role: "team_leader" })
                  }
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    editForm.role === "team_leader"
                      ? "bg-[#cc2727] text-white border-[#cc2727] shadow-xs"
                      : "bg-white text-black border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Team Leader
                </button>
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, role: "agent" })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    editForm.role === "agent"
                      ? "bg-[#cc2727] text-white border-[#cc2727] shadow-xs"
                      : "bg-white text-black border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Agent
                </button>
              </div>
            </div>

            {/* Status Radio in Edit */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                Account Status
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditForm({ ...editForm, status: "active" })}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    editForm.status === "active"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-white text-black border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  Active (Can Login)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditForm({ ...editForm, status: "inactive" })
                  }
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    editForm.status === "inactive"
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-white text-black border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  Inactive (Login Blocked)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                Reset Password (Optional)
              </label>
              <input
                type="password"
                placeholder="Leave blank to keep existing password"
                value={editForm.password}
                onChange={(e) =>
                  setEditForm({ ...editForm, password: e.target.value })
                }
                className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-black text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] placeholder-slate-400 font-medium"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 text-black border border-slate-300 text-xs rounded-xl font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-3 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs rounded-xl font-bold transition-all shadow-md shadow-[#cc2727]/25 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs sm:text-sm">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
              <span className="text-gray-600 flex items-center gap-2 shrink-0">
                <UserCheck className="w-4 h-4 text-[#cc2727]" />
                Full Name
              </span>
              <span className="font-bold text-black text-right ml-4">
                {member.name}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
              <span className="text-gray-600 flex items-center gap-2 shrink-0">
                <Mail className="w-4 h-4 text-[#cc2727]" />
                Email Address
              </span>
              <span className="font-semibold text-black text-right ml-4 break-all select-all">
                {member.email}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
              <span className="text-gray-600 flex items-center gap-2 shrink-0">
                <Phone className="w-4 h-4 text-[#cc2727]" />
                Mobile Number
              </span>
              <span className="font-semibold text-black text-right ml-4">
                {member.mobile || "Not specified"}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
              <span className="text-gray-600 flex items-center gap-2 shrink-0">
                <Shield className="w-4 h-4 text-[#cc2727]" />
                Role Assigned
              </span>
              <span className="font-bold text-[#cc2727] uppercase tracking-wider text-xs">
                {member.role === "team_leader" ? "Team Leader" : "Agent"}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-200">
              <span className="text-gray-600 flex items-center gap-2 shrink-0">
                <Power className="w-4 h-4 text-[#cc2727]" />
                Login Permission
              </span>
              <span
                className={`font-bold text-xs ${
                  member.status === "inactive"
                    ? "text-rose-600"
                    : "text-emerald-700"
                }`}
              >
                {member.status === "inactive"
                  ? "Disabled (Cannot Login)"
                  : "Enabled (Can Login)"}
              </span>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <span className="text-gray-600 flex items-center gap-2 shrink-0">
                <Calendar className="w-4 h-4 text-[#cc2727]" />
                Date Joined
              </span>
              <span className="font-semibold text-black text-right ml-4">
                {member.createdAt
                  ? new Date(member.createdAt).toLocaleString()
                  : "Recent"}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons Footer (when not editing or deleting) */}
        {!isEditing && !isDeleting && (
          <div className="space-y-3">
            {/* Quick Status Toggle Button */}
            <button
              type="button"
              disabled={loading}
              onClick={handleToggleStatus}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all border cursor-pointer ${
                member.status === "inactive"
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {member.status === "inactive"
                  ? "Activate Member (Enable Login)"
                  : "Deactivate Member (Block Login)"}
              </span>
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="flex-1 py-2.5 px-4 bg-[#cc2727] hover:bg-[#b02121] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-[#cc2727]/25 cursor-pointer active:scale-95"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>

              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
