import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { User } from "@/models/User";
import { getTodayDDMMMYY } from "@/lib/leadOptions";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key";

async function verifyAdminOrTeamLeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== "admin" && decoded.role !== "team_leader") return null;
    return decoded;
  } catch {
    return null;
  }
}

// POST /api/admin/leads/assign-bulk - Bulk assign leads to an agent
export async function POST(req: Request) {
  try {
    const authUser = await verifyAdminOrTeamLeader();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized. Admin or Team Leader access required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { leadIds, agentId, agentName } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one lead to assign." },
        { status: 400 }
      );
    }

    if (!agentName || !agentName.trim()) {
      return NextResponse.json(
        { error: "Agent name is required for assignment." },
        { status: 400 }
      );
    }

    await connectDB();

    // Verify agent exists and is indeed an agent
    let targetAgent = null;
    if (agentId && mongoose.Types.ObjectId.isValid(agentId)) {
      targetAgent = await User.findById(agentId);
    } else {
      targetAgent = await User.findOne({ name: agentName.trim(), role: "agent" });
    }

    if (!targetAgent) {
      return NextResponse.json(
        { error: "Target agent not found." },
        { status: 404 }
      );
    }

    if (targetAgent.role !== "agent") {
      return NextResponse.json(
        { error: "Bulk lead assignments can only be made to Agent members." },
        { status: 400 }
      );
    }

    const assignedAgentName = targetAgent.name.trim();
    const todayDDMMMYY = getTodayDDMMMYY();
    const nowISO = new Date().toISOString();

    // Prepare ID queries (can be Mongo _id or uniqueId)
    const idFilters = leadIds.map((id: string) => {
      if (mongoose.Types.ObjectId.isValid(id)) {
        return { $or: [{ _id: id }, { uniqueId: id }] };
      }
      return { uniqueId: id };
    });

    const filterQuery = { $or: idFilters };

    // Fetch the leads to update
    const targetLeads = await Lead.find(filterQuery);

    if (targetLeads.length === 0) {
      return NextResponse.json(
        { error: "No matching leads found to assign." },
        { status: 404 }
      );
    }

    const auditEntry = {
      performedBy: authUser.name || "Admin / Team Leader",
      performedByRole: authUser.role || "admin",
      performedByEmail: authUser.email || "",
      timestamp: nowISO,
      changes: [
        {
          field: "callerName",
          fieldLabel: "Caller Name (Assigned)",
          oldValue: "Unassigned / Previous Caller",
          newValue: assignedAgentName,
        },
      ],
    };

    // Update each lead with callerName, assignedDate, assignedAt, and audit log
    const bulkOps = targetLeads.map((lead) => {
      const oldCaller = lead.callerName || "(Unassigned)";
      const leadAudit = {
        ...auditEntry,
        changes: [
          {
            field: "callerName",
            fieldLabel: "Caller Name (Bulk Assigned)",
            oldValue: oldCaller,
            newValue: assignedAgentName,
          },
        ],
      };

      return {
        updateOne: {
          filter: { _id: lead._id },
          update: {
            $set: {
              callerName: assignedAgentName,
              assignedDate: todayDDMMMYY,
              assignedAt: nowISO,
            },
            $push: {
              auditLogs: {
                $each: [leadAudit],
                $position: 0,
              },
            },
          },
        },
      };
    });

    const result = await Lead.bulkWrite(bulkOps);

    return NextResponse.json({
      message: `Successfully assigned ${result.modifiedCount} lead(s) to agent ${assignedAgentName}!`,
      modifiedCount: result.modifiedCount,
      assignedAgent: assignedAgentName,
      assignedDate: todayDDMMMYY,
    });
  } catch (error: any) {
    console.error("Bulk lead assignment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to assign leads in bulk." },
      { status: 500 }
    );
  }
}
