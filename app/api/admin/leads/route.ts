import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { getFormattedTimestamp, getTodayDDMMMYY } from "@/lib/leadOptions";

export const dynamic = "force-dynamic";

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

async function getNextUniqueId(): Promise<string> {
  const leads = await Lead.find({}, { uniqueId: 1 }).lean();
  let maxNum = 0;
  for (const l of leads) {
    if (l.uniqueId) {
      const match = l.uniqueId.match(/^SC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }
  return `SC-${maxNum + 1}`;
}

// GET /api/admin/leads - Fetch all leads
export async function GET() {
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    await connectDB();

    // If agent, strictly restrict leads to only those assigned to this agent by callerName
    let query: any = {};
    if (session.role === "agent") {
      const agentName = (session.name || "").trim();
      query = {
        callerName: { $regex: new RegExp(`^${agentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      };
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 });
    const nextUniqueId = await getNextUniqueId();

    return NextResponse.json(
      { leads, nextUniqueId },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

// POST /api/admin/leads - Create new lead
export async function POST(req: Request) {
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const body = await req.json();
    let {
      uniqueId,
      date,
      month,
      mobileNumber,
      phoneNumber,
      alternateNumber,
      callerName,
      patientName,
      patientAge,
      spouseName,
      spouseAge,
      location,
      otherCity,
      lookingForTreatment,
      treatment,
      preConditions,
      preCondition,
      surgeryDetails,
      surgicalData,
      treatmentRequirements,
      treatmentRequired,
      referredBy,
      leadSource,
      followUpDate,
      followUpDates,
      subDispositions,
      subDisposition,
      dispositions,
      disposition,
      validStatus,
      appointmentDate,
      appointmentMonth,
      teleconsultationSlot,
      appointmentSlot,
      consultationCharges,
      teleConsultationCharges,
      notes,
      surgeryPaymentReceived,
      surgeryReceipt,
      surgeryCost,
      surgeryDate,
    } = body;

    await connectDB();

    if (!uniqueId || !uniqueId.trim()) {
      uniqueId = await getNextUniqueId();
    }

    const finalMobile = (mobileNumber || phoneNumber || "").trim();
    const finalDate = (date || "").trim();
    const finalMonth = (month || "").trim();
    const currentTimestamp = body.leadTimestamp?.trim() || getFormattedTimestamp(new Date());

    const newLead = await Lead.create({
      uniqueId: uniqueId.trim(),
      date: finalDate,
      month: finalMonth,
      leadTimestamp: currentTimestamp,
      mobileNumber: finalMobile,
      // legacy sync
      phoneNumber: finalMobile,
      dateOfLead: finalDate || currentTimestamp,
      alternateNumber: (alternateNumber || "").trim(),
      callerName: (callerName || "").trim(),
      patientName: (patientName || "").trim(),
      patientAge: (patientAge || "").trim(),
      spouseName: (spouseName || "").trim(),
      spouseAge: (spouseAge || "").trim(),
      location: (location || "").trim(),
      otherCity: (otherCity || "").trim(),
      lookingForTreatment: (lookingForTreatment || treatment || "").trim(),
      preConditions: (preConditions || preCondition || "").trim(),
      surgeryDetails: (surgeryDetails || surgicalData || "").trim(),
      treatmentRequirements: (treatmentRequirements || treatmentRequired || "").trim(),
      referredBy: (referredBy || "").trim(),
      leadSource: (leadSource || "").trim(),
      followUpDate: (followUpDate || followUpDates || "").trim(),
      subDispositions: (subDispositions || subDisposition || "").trim(),
      dispositions: (dispositions || disposition || "").trim(),
      validStatus: (validStatus || "").trim(),
      appointmentDate: (appointmentDate || "").trim(),
      appointmentMonth: (appointmentMonth || "").trim(),
      teleconsultationSlot: (teleconsultationSlot || appointmentSlot || "").trim(),
      consultationCharges: (consultationCharges || teleConsultationCharges || "").trim(),
      notes: (notes || "").trim(),
      surgeryPaymentReceived: (surgeryPaymentReceived || surgeryReceipt || "").trim(),
      surgeryCost: (surgeryCost || "").trim(),
      surgeryDate: (surgeryDate || "").trim(),
      // Stamp assignment date if a caller is set at creation time
      ...(callerName && callerName.trim()
        ? {
            assignedDate: getTodayDDMMMYY(),        // e.g. "29-Sep-26"
            assignedAt: new Date().toISOString(),   // ISO fallback
          }
        : {}),
      createdBy: session.id || null,
    });

    return NextResponse.json(
      { message: "Lead created successfully", lead: newLead },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create lead" },
      { status: 500 }
    );
  }
}
