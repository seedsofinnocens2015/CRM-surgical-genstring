import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { SUB_DISPOSITIONS_MAP, getFormattedTimestamp } from "@/lib/leadOptions";
import { invalidateDashboardCache } from "@/lib/cacheInvalidation";

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

// Allowed fields for bulk update
const ALLOWED_UPDATE_FIELDS = new Set([
  "callerName",
  "dispositions",
  "subDispositions",
  "validStatus",
  "leadSource",
  "location",
  "otherCity",
  "lookingForTreatment",
  "preConditions",
  "surgeryDetails",
  "treatmentRequirements",
  "referredBy",
  "followUpDate",
  "appointmentDate",
  "appointmentMonth",
  "teleconsultationSlot",
  "consultationCharges",
  "surgeryDate",
  "surgeryCost",
  "surgeryPaymentReceived",
  "notes",
  "patientAge",
  "spouseName",
  "spouseAge",
]);

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
    const { leadIds, fieldName, fieldValue, isCustomField } = body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { error: "No leads selected for bulk update." },
        { status: 400 }
      );
    }

    if (!fieldName || typeof fieldName !== "string") {
      return NextResponse.json(
        { error: "Field name is required." },
        { status: 400 }
      );
    }

    await connectDB();

    // Prepare update object
    const updateObj: Record<string, any> = {};
    const auditNote = `Bulk update by Admin (${adminUser.name || "Admin"}): ${fieldName} = "${fieldValue ?? ""}"`;

    if (isCustomField) {
      updateObj[`customFields.${fieldName}`] = fieldValue;
    } else {
      if (!ALLOWED_UPDATE_FIELDS.has(fieldName) && !fieldName.startsWith("customFields.")) {
        return NextResponse.json(
          { error: `Field "${fieldName}" is not allowed for bulk updates.` },
          { status: 400 }
        );
      }

      updateObj[fieldName] = fieldValue;

      // Auto-cascade subDispositions mapping to dispositions and validStatus
      if (fieldName === "subDispositions" && fieldValue) {
        const mapping = SUB_DISPOSITIONS_MAP[fieldValue];
        if (mapping) {
          if (mapping.disposition) updateObj.dispositions = mapping.disposition;
          if (mapping.validStatus) updateObj.validStatus = mapping.validStatus;
        }
      }
    }

    // Add audit log entry
    const auditEntry = {
      changedAt: new Date(),
      changedBy: adminUser.name || "Admin",
      changedByRole: "admin",
      field: fieldName,
      oldValue: "(bulk updated)",
      newValue: String(fieldValue ?? ""),
      timestampFormatted: getFormattedTimestamp(),
    };

    // Find leads by uniqueId or _id
    const targetQuery = {
      $or: [
        { uniqueId: { $in: leadIds } },
        { _id: { $in: leadIds.filter((id: string) => /^[0-9a-fA-F]{24}$/.test(id)) } },
      ],
    };

    const result = await Lead.updateMany(targetQuery, {
      $set: updateObj,
      $push: { auditLogs: auditEntry },
    });

    // Invalidate dashboard stats cache immediately upon bulk update
    invalidateDashboardCache();

    return NextResponse.json({
      success: true,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      fieldName,
      fieldValue,
    });
  } catch (err: any) {
    console.error("Bulk update error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to bulk update leads." },
      { status: 500 }
    );
  }
}
