"use client";

import { useState } from "react";
import { X, UserPlus, Shield, User } from "lucide-react";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded: (member: any) => void;
  allowedRole?: "agent";
}

export default function AddMemberModal({
  isOpen,
  onClose,
  onMemberAdded,
  allowedRole,
}: AddMemberModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    email: "",
    password: "",
    role: (allowedRole || "agent") as "team_leader" | "agent",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add member");
      }

      onMemberAdded(data.member);
      setFormData({
        name: "",
        mobile: "",
        email: "",
        password: "",
        role: "agent",
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 sm:p-8 text-black">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-500 hover:text-black transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-bold">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-black">Add New Member</h3>
            <p className="text-xs text-black">
              Create a Team Leader or Agent credential
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Member Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Rahul Sharma"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-black placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                Mobile Number
              </label>
              <input
                type="tel"
                required
                placeholder="+91 9876543210"
                value={formData.mobile}
                onChange={(e) =>
                  setFormData({ ...formData, mobile: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-black placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="rahul@example.com"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-black placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1.5">
              Create Password
            </label>
            <input
              type="password"
              required
              placeholder="Temporary login password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-black placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:border-[#cc2727] font-medium"
            />
          </div>

          {/* Role Radio selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-black mb-2">
              Role
            </label>
            {allowedRole === "agent" ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-black">
                <div className="w-4 h-4 rounded-full border border-[#cc2727] flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-[#cc2727]" />
                </div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-[#cc2727]" />
                  <span className="text-sm font-semibold text-black">Agent</span>
                </div>
                <span className="ml-auto text-[10px] text-gray-600 font-mono bg-white px-2 py-0.5 rounded-full border border-slate-200">
                  Fixed for Team Leader
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.role === "team_leader"
                      ? "bg-[#cc2727]/10 border-[#cc2727] text-black font-semibold"
                      : "bg-white border-slate-200 text-black hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="team_leader"
                    checked={formData.role === "team_leader"}
                    onChange={() =>
                      setFormData({ ...formData, role: "team_leader" })
                    }
                    className="hidden"
                  />
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formData.role === "team_leader"
                        ? "border-[#cc2727]"
                        : "border-slate-400"
                    }`}
                  >
                    {formData.role === "team_leader" && (
                      <div className="w-2 h-2 rounded-full bg-[#cc2727]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#cc2727]" />
                    <span className="text-sm font-semibold">Team Leader</span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.role === "agent"
                      ? "bg-[#cc2727]/10 border-[#cc2727] text-black font-semibold"
                      : "bg-white border-slate-200 text-black hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="agent"
                    checked={formData.role === "agent"}
                    onChange={() => setFormData({ ...formData, role: "agent" })}
                    className="hidden"
                  />
                  <div
                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                      formData.role === "agent"
                        ? "border-[#cc2727]"
                        : "border-slate-400"
                    }`}
                  >
                    {formData.role === "agent" && (
                      <div className="w-2 h-2 rounded-full bg-[#cc2727]" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-[#cc2727]" />
                    <span className="text-sm font-semibold">Agent</span>
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-black font-semibold rounded-xl text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 bg-[#cc2727] hover:bg-[#b02121] text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-[#cc2727]/25 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add Member</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
