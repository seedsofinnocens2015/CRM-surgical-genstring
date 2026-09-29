"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  User,
  Mail,
  Phone,
  Calendar,
  CheckCircle,
} from "lucide-react";
import TeamLeaderSidebar from "@/app/components/TeamLeaderSidebar";
import AddMemberModal from "@/app/components/AddMemberModal";

export default function TeamLeaderMembersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const fetchSessionAndMembers = async () => {
    try {
      // 1. Check Team Leader Auth
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/team-leader/login");
        return;
      }
      const meData = await meRes.json();
      if (!meData.user || meData.user.role !== "team_leader") {
        router.push("/team-leader/login");
        return;
      }
      setUser(meData.user);

      // 2. Fetch Members (no-cache)
      const membersRes = await fetch("/api/admin/members", {
        cache: "no-store",
      });
      if (membersRes.ok) {
        const memData = await membersRes.json();
        // Filter strictly to show only Agents (do not show Admin or Team Leaders)
        const agentMembers = (memData.members || []).filter(
          (m: any) => m.role === "agent"
        );
        setMembers(agentMembers);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndMembers();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/team-leader/login");
  };

  const handleMemberAdded = (newMember: any) => {
    if (newMember.role === "agent") {
      setMembers((prev) => [newMember, ...prev]);
    }
    setToastMessage(`Agent ${newMember.name} has been added successfully!`);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleMemberUpdated = (updatedMember: any) => {
    setMembers((prev) =>
      prev.map((m) => (m._id === updatedMember._id ? updatedMember : m))
    );
    setToastMessage(`Agent ${updatedMember.name}'s status has been updated!`);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const handleRowClick = (member: any) => {
    router.push(`/team-leader/members/${member._id}`);
  };

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const handleDirectToggleStatus = async (
    e: React.MouseEvent,
    member: any
  ) => {
    e.stopPropagation(); // Don't open modal when clicking toggle
    const nextStatus = member.status === "inactive" ? "active" : "inactive";
    setTogglingId(member._id);

    try {
      const res = await fetch(`/api/admin/members/${member._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      const data = await res.json();
      if (res.ok && data.member) {
        setMembers((prev) =>
          prev.map((m) => (m._id === member._id ? data.member : m))
        );
        setToastMessage(
          `Agent ${member.name} is now ${nextStatus === "active" ? "Active" : "Inactive"}`
        );
        setTimeout(() => setToastMessage(""), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const activeAgentCount = members.filter((m) => m.status !== "inactive").length;
  const inactiveAgentCount = members.filter((m) => m.status === "inactive").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#cc2727]/30 border-t-[#cc2727] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 text-black flex overflow-hidden">
      {/* Sidebar with All Members tab */}
      <TeamLeaderSidebar user={user} onLogout={handleLogout} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-16 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#cc2727]" />
            <h1 className="text-base font-bold text-black">All Members (Agents)</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 font-bold ml-2">
              {members.length} Total Agents
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-2 px-4 bg-[#cc2727] hover:bg-[#b02121] text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md shadow-[#cc2727]/25 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Agent</span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 max-w-7xl">
          {/* Toast Notification */}
          {toastMessage && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 font-medium">
              <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
              <span className="text-sm">{toastMessage}</span>
            </div>
          )}

          {/* Quick Counter Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Total Agents
                </p>
                <h4 className="text-2xl font-extrabold text-black mt-0.5 font-mono">
                  {members.length}
                </h4>
              </div>
              <div className="p-2.5 bg-[#cc2727]/10 text-[#cc2727] rounded-lg">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Active Agents
                </p>
                <h4 className="text-2xl font-extrabold text-emerald-700 mt-0.5 font-mono">
                  {activeAgentCount}
                </h4>
              </div>
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <User className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
                  Inactive / Blocked
                </p>
                <h4 className="text-2xl font-extrabold text-rose-600 mt-0.5 font-mono">
                  {inactiveAgentCount}
                </h4>
              </div>
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-lg">
                <User className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Agents Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-black">Agent Team Members</h2>
                <p className="text-xs text-gray-600 mt-0.5">
                  List of all agents assigned under team management
                </p>
              </div>

              <div className="text-xs text-black font-semibold bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                Showing <span className="text-[#cc2727] font-bold">{members.length}</span> Agents
              </div>
            </div>

            {/* Members Table */}
            {members.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-black">
                  No agents added yet
                </h3>
                <p className="text-xs text-gray-600 max-w-sm mx-auto mt-1 mb-5 font-normal">
                  Click on &quot;Add Agent&quot; button to create a new agent account.
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-[#cc2727] text-white rounded-xl text-xs font-bold hover:bg-[#b02121] transition-all shadow-md shadow-[#cc2727]/25 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Agent
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-black">
                  <thead className="bg-slate-50 text-black text-xs uppercase tracking-wider border-b border-slate-200 font-bold">
                    <tr>
                      <th scope="col" className="px-6 py-3.5 font-bold">
                        Agent Info
                      </th>
                      <th scope="col" className="px-6 py-3.5 font-bold">
                        Role
                      </th>
                      <th scope="col" className="px-6 py-3.5 font-bold">
                        Mobile Number
                      </th>
                      <th scope="col" className="px-6 py-3.5 font-bold">
                        Joined Date
                      </th>
                      <th scope="col" className="px-6 py-3.5 font-bold text-right">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {members.map((member) => (
                      <tr
                        key={member._id}
                        onClick={() => handleRowClick(member)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20 flex items-center justify-center font-bold text-sm uppercase group-hover:scale-105 transition-transform">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-black group-hover:text-[#cc2727] transition-colors">
                                {member.name}
                              </p>
                              <p className="text-xs text-gray-600 flex items-center gap-1.5 mt-0.5">
                                <Mail className="w-3 h-3 text-gray-500" />
                                {member.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#cc2727]/10 text-[#cc2727] border border-[#cc2727]/20">
                            <User className="w-3.5 h-3.5" />
                            Agent
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-black font-medium">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-gray-500" />
                            {member.mobile || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            {member.createdAt
                              ? new Date(member.createdAt).toLocaleDateString()
                              : "Recent"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-3">
                            <span
                              className={`text-[11px] font-bold ${
                                member.status === "inactive"
                                  ? "text-rose-600"
                                  : "text-emerald-700"
                              }`}
                            >
                              {member.status === "inactive" ? "Inactive" : "Active"}
                            </span>

                            {/* Direct Switch Toggle Button */}
                            <button
                              type="button"
                              title={
                                member.status === "inactive"
                                  ? "Click to Activate"
                                  : "Click to Deactivate"
                              }
                              disabled={togglingId === member._id}
                              onClick={(e) => handleDirectToggleStatus(e, member)}
                              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#cc2727] focus:ring-offset-2 focus:ring-offset-white ${
                                member.status === "inactive"
                                  ? "bg-slate-300"
                                  : "bg-emerald-500"
                              } ${
                                togglingId === member._id
                                  ? "opacity-60 cursor-not-allowed"
                                  : ""
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                                  member.status === "inactive"
                                    ? "translate-x-0"
                                    : "translate-x-5"
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Add Member Modal locked to Agent only */}
      <AddMemberModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onMemberAdded={handleMemberAdded}
        allowedRole="agent"
      />
    </div>
  );
}
