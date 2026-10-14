import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import { getFormattedTimestamp, getTodayDDMMMYY } from "@/lib/leadOptions";
import { invalidateDashboardCache } from "@/lib/cacheInvalidation";

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
  // Check the most recent leads first instead of scanning all documents
  const recentLeads = await Lead.find(
    { uniqueId: { $regex: /^SC-\d+$/i } },
    { uniqueId: 1 }
  )
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  let maxNum = 0;
  for (const l of recentLeads) {
    if (l.uniqueId) {
      const match = l.uniqueId.match(/^SC-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
  }

  // Fallback: If no recent matches found, check collection count + 1
  if (maxNum === 0) {
    const totalCount = await Lead.countDocuments();
    return `SC-${totalCount + 1}`;
  }

  return `SC-${maxNum + 1}`;
}

// Table columns projection: excludes heavy auditLogs, notesHistory, and unnecessary nested data
const TABLE_VIEW_PROJECTION = {
  auditLogs: 0,
  notesHistory: 0,
};

// GET /api/admin/leads - Fetch leads with server-side pagination and projection
export async function GET(req: Request) {
  const startTime = Date.now();
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view"); // e.g. "dashboard" or "table"
    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");

    // If agent, strictly restrict leads to only those assigned to this agent by callerName
    let query: any = {};
    if (session.role === "agent") {
      const agentName = (session.name || "").trim();
      query = {
        callerName: { $regex: new RegExp(`^${agentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      };
    }

    // Special lightweight view for dashboard calculations
    if (view === "dashboard") {
      const dashboardProjection = {
        uniqueId: 1,
        patientName: 1,
        mobileNumber: 1,
        callerName: 1,
        month: 1,
        date: 1,
        appointmentMonth: 1,
        appointmentDate: 1,
        surgeryMonth: 1,
        surgeryDate: 1,
        surgeryCost: 1,
        location: 1,
        otherCity: 1,
        lookingForTreatment: 1,
        teleconsultationSlot: 1,
        assignedDate: 1,
        assignedAt: 1,
        createdAt: 1,
        followUpDate: 1,
        followUpDates: 1,
        dispositions: 1,
        validStatus: 1,
        consultationCharges: 1,
        surgeryPaymentReceived: 1,
        subDispositions: 1,
        leadSource: 1,
        leadTimestamp: 1,
        auditLogs: 1,
      };

      const leads = await Lead.find(query)
        .select(dashboardProjection)
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json(
        { leads, totalCount: leads.length },
        {
          headers: {
            "Cache-Control": "no-store, max-age=0",
          },
        }
      );
    }

    // Pagination parameters
    // If limit is not specified or is "all" or "0", return all leads so client-side table
    // has the full dataset for instant searching, filtering, and 100-per-page windowing.
    // If an explicit numeric limit is specified (e.g. limit=50), apply server pagination.
    const hasExplicitNumericLimit = limitParam !== null && limitParam !== "" && limitParam !== "all" && limitParam !== "0";
    const page = Math.max(parseInt(pageParam || "1", 10) || 1, 1);
    const limit = hasExplicitNumericLimit
      ? Math.min(Math.max(parseInt(limitParam, 10) || 100, 1), 1000)
      : 0;

    const skip = limit > 0 ? (page - 1) * limit : 0;

    let leadQuery = Lead.find(query)
      .select(TABLE_VIEW_PROJECTION)
      .sort({ createdAt: -1 })
      .lean();

    if (limit > 0) {
      leadQuery = leadQuery.skip(skip).limit(limit);
    }

    const [leads, totalCount, nextUniqueId] = await Promise.all([
      leadQuery,
      Lead.countDocuments(query),
      getNextUniqueId(),
    ]);

    const totalPages = limit > 0 ? Math.max(1, Math.ceil(totalCount / limit)) : 1;

    const response = NextResponse.json(
      {
        leads,
        totalCount,
        page,
        limit: limit > 0 ? limit : totalCount,
        totalPages,
        nextUniqueId,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Response-Time": `${Date.now() - startTime}ms`,
        },
      }
    );
    return response;
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
      patientName: (patientName || "").trim() || "NA",
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
      customFields: body.customFields || {},
      // Stamp assignment date if a caller is set at creation time
      ...(callerName && callerName.trim()
        ? {
            assignedDate: getTodayDDMMMYY(),        // e.g. "29-Sep-26"
            assignedAt: new Date().toISOString(),   // ISO fallback
          }
        : {}),
      createdBy: session.id || null,
    });

    // Invalidate dashboard stats cache immediately upon lead creation
    invalidateDashboardCache();

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
