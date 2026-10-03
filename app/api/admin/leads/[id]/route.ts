import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { getTodayDDMMMYY } from "@/lib/leadOptions";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key";

async function verifyAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/admin/leads/[id] - Fetch single lead by uniqueId or mongoId
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    let lead = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      lead = await Lead.findById(id);
    }
    if (!lead) {
      lead = await Lead.findOne({ uniqueId: id });
    }

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // If agent, ensure callerName matches their name
    if (session.role === "agent") {
      const agentName = (session.name || "").trim().toLowerCase();
      const leadCaller = (lead.callerName || "").trim().toLowerCase();
      if (!leadCaller || leadCaller !== agentName) {
        return NextResponse.json(
          { error: "Access denied. This lead is not assigned to you." },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ lead });
  } catch (error: any) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch lead" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/leads/[id] - Update all fields of lead
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    await connectDB();

    let query: any = { uniqueId: id };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { uniqueId: id }] };
    }

    const existingLead = await Lead.findOne(query);
    if (!existingLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    // If agent, ensure callerName matches their name and protect Section 1 fields
    if (session.role === "agent") {
      const agentName = (session.name || "").trim().toLowerCase();
      const leadCaller = (existingLead.callerName || "").trim().toLowerCase();
      if (!leadCaller || leadCaller !== agentName) {
        return NextResponse.json(
          { error: "Access denied. You can only update leads assigned to you." },
          { status: 403 }
        );
      }
      
      // Preserve Section 1 values & patientName from existing lead
      body.uniqueId = existingLead.uniqueId;
      body.patientName = existingLead.patientName;
      body.date = existingLead.date;
      body.dateOfLead = existingLead.dateOfLead;
      body.month = existingLead.month;
      body.leadTimestamp = existingLead.leadTimestamp;
      body.mobileNumber = existingLead.mobileNumber;
      body.phoneNumber = existingLead.phoneNumber;
      body.alternateNumber = existingLead.alternateNumber;
      body.callerName = existingLead.callerName;
      body.leadSource = existingLead.leadSource;
      body.referredBy = existingLead.referredBy;

      const newNotes = (body.notes || "").trim();
      const newSubDisp = (body.subDispositions || "").trim();

      // Mandatory check: Both must be provided
      if (!newSubDisp) {
        return NextResponse.json(
          { error: "Sub Dispositions is mandatory. Please select a Sub Disposition." },
          { status: 400 }
        );
      }
      if (!newNotes) {
        return NextResponse.json(
          { error: "Notes & Observations is mandatory. Please enter call remarks." },
          { status: 400 }
        );
      }

      // If either was previously filled, at least one of Notes or Sub Dispositions must be updated
      const latestNoteInHistory = (existingLead.notesHistory && existingLead.notesHistory.length > 0)
        ? (existingLead.notesHistory[0]?.newNotes || "").trim()
        : "";
      const oldNotes = (existingLead.notes || "").trim() || latestNoteInHistory;
      const oldSubDisp = (existingLead.subDispositions || "").trim();
      const hadExistingData = oldNotes !== "" || oldSubDisp !== "";

      if (hadExistingData && oldNotes === newNotes && oldSubDisp === newSubDisp) {
        return NextResponse.json(
          { error: "not update any thing" },
          { status: 400 }
        );
      }
    }

    // Handle Notes & Observations dedicated history and field reset
    const submittedNotes = (body.notes || "").trim();
    if (submittedNotes) {
      const currentNotesHistory = existingLead.notesHistory || [];
      const previousNote =
        (existingLead.notes || "").trim() ||
        (currentNotesHistory.length > 0 ? (currentNotesHistory[0]?.newNotes || "").trim() : "");

      const newNoteEntry = {
        performedBy: session.name || "Unknown Member",
        performedByRole: session.role || "unknown",
        performedByEmail: session.email || "",
        timestamp: new Date().toISOString(),
        oldNotes: previousNote,
        newNotes: submittedNotes,
      };

      body.notesHistory = [newNoteEntry, ...currentNotesHistory];
    } else {
      body.notesHistory = existingLead.notesHistory || [];
    }
    // As per requirement: Notes & Observations field becomes blank after saving
    body.notes = "";

    // Track field differences for audit log
    const FIELD_LABELS: Record<string, string> = {
      patientName: "Patient Name",
      patientAge: "Patient Age",
      spouseName: "Spouse Name",
      spouseAge: "Spouse Age",
      location: "Location",
      otherCity: "Other City",
      lookingForTreatment: "Looking for Treatment",
      treatmentRequirements: "Treatment Requirements",
      preConditions: "Pre Conditions",
      surgeryDetails: "Surgery Details",
      referredBy: "Referred By",
      leadSource: "Lead Source",
      callerName: "Caller Name",
      date: "Lead Date",
      dateOfLead: "Lead Date",
      month: "Lead Month",
      mobileNumber: "Mobile Number",
      phoneNumber: "Mobile Number",
      alternateNumber: "Alternate #",
      followUpDate: "Follow Up Date",
      subDispositions: "Sub Dispositions",
      dispositions: "Dispositions",
      validStatus: "Valid Status",
      appointmentDate: "Appointment Date",
      appointmentMonth: "Appointment Month",
      teleconsultationSlot: "Teleconsultation Slot",
      consultationCharges: "Consultation Charges",
      surgeryDate: "Surgery Date",
      surgeryCost: "Surgery Cost",
      surgeryPaymentReceived: "Surgery Payment Received",
    };

    const changes: Array<{
      field: string;
      fieldLabel: string;
      oldValue: string;
      newValue: string;
    }> = [];

    // Fields to ignore in diff tracking
    const ignoredFields = new Set([
      "_id",
      "__v",
      "createdAt",
      "updatedAt",
      "auditLogs",
      "notesHistory",
      "createdBy",
      "treatment",
      "notes",
      "phoneNumber", // alias of mobileNumber
      "dateOfLead", // alias of date
    ]);

    for (const [key, label] of Object.entries(FIELD_LABELS)) {
      if (ignoredFields.has(key)) continue;
      if (body[key] !== undefined) {
        const oldVal = (existingLead.get(key) ?? "").toString().trim();
        const newVal = (body[key] ?? "").toString().trim();
        if (oldVal !== newVal) {
          changes.push({
            field: key,
            fieldLabel: label,
            oldValue: oldVal || "(empty)",
            newValue: newVal || "(empty)",
          });
        }
      }
    }

    // If changes occurred, create audit log entry
    if (changes.length > 0) {
      const newAuditLog = {
        performedBy: session.name || "Unknown Member",
        performedByRole: session.role || "unknown",
        performedByEmail: session.email || "",
        timestamp: new Date().toISOString(),
        changes,
      };

      const currentLogs = existingLead.auditLogs || [];
      // Keep most recent first
      body.auditLogs = [newAuditLog, ...currentLogs];
    } else {
      // Keep existing audit logs intact
      body.auditLogs = existingLead.auditLogs || [];
    }

    // ── Stamp assignment date when callerName is being set or changed ─────────
    // This ensures single-lead assignment (from any panel) always records
    // the actual date of assignment so the daily sheet filter is accurate.
    if (session.role !== "agent") {
      const oldCaller = (existingLead.callerName || "").trim().toLowerCase();
      const newCaller = (body.callerName || "").trim().toLowerCase();
      if (newCaller && newCaller !== oldCaller) {
        body.assignedDate = getTodayDDMMMYY();          // e.g. "29-Sep-26"
        body.assignedAt   = new Date().toISOString();   // ISO for fallback filter
      }
    }

    const updatedLead = await Lead.findOneAndUpdate(
      query,
      { $set: body },
      { new: true, runValidators: true }
    );

    return NextResponse.json({
      message: "Lead updated successfully",
      lead: updatedLead,
    });
  } catch (error: any) {
    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update lead" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/leads/[id] - Delete lead
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Agents are never allowed to delete leads
    if (session.role === "agent") {
      return NextResponse.json(
        { error: "Forbidden. Agents are not permitted to delete leads." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();

    let query: any = { uniqueId: id };
    if (mongoose.Types.ObjectId.isValid(id)) {
      query = { $or: [{ _id: id }, { uniqueId: id }] };
    }

    const deleted = await Lead.findOneAndDelete(query);
    if (!deleted) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Lead deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete lead" },
      { status: 500 }
    );
  }
}
