import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { SUB_DISPOSITIONS_MAP, getFormattedTimestamp } from "@/lib/leadOptions";

export const dynamic = "force-dynamic";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key";

async function verifyAdminAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const adminUser = await verifyAdminAuth();
    if (!adminUser) {
      return NextResponse.json(
        { error: "Unauthorized. Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { masterLeadId, otherLeadIds, selectedFieldValues } = body;

    if (!masterLeadId || typeof masterLeadId !== "string") {
      return NextResponse.json(
        { error: "Master Lead ID is required." },
        { status: 400 }
      );
    }

    if (!Array.isArray(otherLeadIds) || otherLeadIds.length === 0) {
      return NextResponse.json(
        { error: "At least one secondary lead is required to merge." },
        { status: 400 }
      );
    }

    const totalLeadsToMerge = 1 + otherLeadIds.length;
    if (totalLeadsToMerge > 20) {
      return NextResponse.json(
        { error: "Maximum 20 leads can be merged at a time." },
        { status: 400 }
      );
    }

    await connectDB();

    const isValidObjectId = (id: string) => /^[0-9a-fA-F]{24}$/.test(id);

    // 1. Fetch Master Lead (safely by uniqueId or valid ObjectId)
    const masterQueryConditions: any[] = [{ uniqueId: masterLeadId }];
    if (isValidObjectId(masterLeadId)) {
      masterQueryConditions.push({ _id: masterLeadId });
    }
    const masterLead = await Lead.findOne({ $or: masterQueryConditions });

    if (!masterLead) {
      return NextResponse.json(
        { error: `Master lead (${masterLeadId}) not found.` },
        { status: 404 }
      );
    }

    // 2. Fetch Other Leads to be merged (safely by uniqueId or valid ObjectId)
    const validOtherObjectIds = otherLeadIds.filter((id: string) => isValidObjectId(id));
    const otherQueryConditions: any[] = [{ uniqueId: { $in: otherLeadIds } }];
    if (validOtherObjectIds.length > 0) {
      otherQueryConditions.push({ _id: { $in: validOtherObjectIds } });
    }

    const otherLeads = await Lead.find({ $or: otherQueryConditions });

    if (otherLeads.length === 0) {
      return NextResponse.json(
        { error: "No secondary leads found to merge." },
        { status: 404 }
      );
    }

    // 3. Collect activities, notes history, audit logs from other leads
    const combinedAuditLogs: any[] = Array.isArray(masterLead.auditLogs) ? [...masterLead.auditLogs] : [];
    const combinedNotesHistory: any[] = Array.isArray(masterLead.notesHistory) ? [...masterLead.notesHistory] : [];

    const otherIdentifiers: string[] = [];
    const otherPhoneNumbers: string[] = [];
    const otherNames: string[] = [];

    // Determine the lowest serial number Unique ID among all merged leads (e.g. SC-1191 instead of SC-1192)
    const allMergingLeads = [masterLead, ...otherLeads];
    let chosenLowestUniqueId = masterLead.uniqueId;
    let lowestSerialNum = Infinity;

    for (const lead of allMergingLeads) {
      if (lead.uniqueId) {
        const match = lead.uniqueId.match(/(\d+)/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num < lowestSerialNum) {
            lowestSerialNum = num;
            chosenLowestUniqueId = lead.uniqueId;
          }
        }
      }
    }

    if (chosenLowestUniqueId) {
      masterLead.uniqueId = chosenLowestUniqueId;
    }

    for (const ol of otherLeads) {
      const olId = ol.uniqueId || ol._id?.toString();
      otherIdentifiers.push(olId);
      if (ol.mobileNumber && !otherPhoneNumbers.includes(ol.mobileNumber)) {
        otherPhoneNumbers.push(ol.mobileNumber);
      }
      if (ol.patientName && !otherNames.includes(ol.patientName)) {
        otherNames.push(ol.patientName);
      }

      if (Array.isArray(ol.auditLogs)) {
        combinedAuditLogs.push(...ol.auditLogs);
      }
      if (Array.isArray(ol.notesHistory)) {
        combinedNotesHistory.push(...ol.notesHistory);
      }
      if (ol.notes && ol.notes.trim()) {
        combinedNotesHistory.push({
          performedBy: ol.callerName || "System (Merged)",
          performedByRole: "admin",
          timestamp: ol.updatedAt ? new Date(ol.updatedAt).toISOString() : new Date().toISOString(),
          newNotes: `[From Merged Lead ${olId}]: ${ol.notes}`,
        });
      }
    }

    // 4. Apply selected field values to Master Lead
    if (selectedFieldValues && typeof selectedFieldValues === "object") {
      const allowedFields = [
        "patientName",
        "mobileNumber",
        "spouseName",
        "patientAge",
        "spouseAge",
        "location",
        "otherCity",
        "leadSource",
        "referredBy",
        "lookingForTreatment",
        "treatmentRequirements",
        "preConditions",
        "surgeryDetails",
        "callerName",
        "subDispositions",
        "dispositions",
        "validStatus",
        "followUpDate",
        "appointmentDate",
        "appointmentMonth",
        "teleconsultationSlot",
        "consultationCharges",
        "surgeryDate",
        "surgeryCost",
        "surgeryPaymentReceived",
        "notes",
      ];

      for (const field of allowedFields) {
        if (selectedFieldValues[field] !== undefined) {
          (masterLead as any)[field] = selectedFieldValues[field];
        }
      }

      // Auto-sync subDispositions to disposition and validStatus if subDispositions was chosen
      if (selectedFieldValues.subDispositions) {
        const mapping = SUB_DISPOSITIONS_MAP[selectedFieldValues.subDispositions];
        if (mapping) {
          if (!selectedFieldValues.dispositions) {
            masterLead.dispositions = mapping.disposition;
          }
          if (!selectedFieldValues.validStatus) {
            masterLead.validStatus = mapping.validStatus;
          }
        }
      }
    }

    // Add merge audit record
    const timestampStr = getFormattedTimestamp();
    combinedAuditLogs.push({
      performedBy: adminUser.name || "Admin",
      performedByRole: "admin",
      performedByEmail: adminUser.email || "",
      timestamp: new Date().toISOString(),
      changes: [
        {
          field: "mergeLeads",
          fieldLabel: "Merge Leads",
          oldValue: "Merged Leads",
          newValue: `Merged ${otherIdentifiers.length} leads (${otherIdentifiers.join(", ")}) into Master Lead (${masterLead.uniqueId || masterLead._id}) on ${timestampStr}`,
        },
      ],
    });

    masterLead.auditLogs = combinedAuditLogs;
    masterLead.notesHistory = combinedNotesHistory;
    masterLead.updatedAt = new Date();

    await masterLead.save();

    // 5. Delete other merged leads from the database
    const deleteIds = otherLeads.map((ol) => ol._id);
    await Lead.deleteMany({ _id: { $in: deleteIds } });

    return NextResponse.json({
      success: true,
      message: `Successfully merged ${otherIdentifiers.length} leads into Master Lead ${masterLead.uniqueId || masterLead._id}.`,
      masterLeadId: masterLead.uniqueId || masterLead._id,
      deletedCount: deleteIds.length,
    });
  } catch (error: any) {
    console.error("Error in merge-leads route:", error);
    return NextResponse.json(
      { error: error.message || "Failed to merge leads." },
      { status: 500 }
    );
  }
}
