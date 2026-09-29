import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";
import {
  getFormattedTimestamp,
  getTodayDDMMMYY,
  getCurrentMonthMMMYY,
  SUB_DISPOSITIONS_MAP,
} from "@/lib/leadOptions";

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
    const { leads } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: "No leads data provided in payload" },
        { status: 400 }
      );
    }

    await connectDB();

    // 1. Determine current highest SC- number in database
    const existingLeads = await Lead.find({}, { uniqueId: 1 }).lean();
    let maxNum = 0;
    for (const l of existingLeads) {
      if (l.uniqueId) {
        const match = l.uniqueId.match(/^SC-(\d+)$/i);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxNum) maxNum = num;
        }
      }
    }

    const defaultDate = getTodayDDMMMYY();
    const defaultMonth = getCurrentMonthMMMYY();
    const currentTimestamp = getFormattedTimestamp(new Date());

    // 2. Prepare docs to insert with consecutive Unique IDs
    const leadsToInsert = leads.map((item: any) => {
      maxNum += 1;
      const assignedId = `SC-${maxNum}`;

      const mobile = String(item.mobileNumber || item.phoneNumber || "").trim();
      const subDisp = String(item.subDispositions || item.subDisposition || "").trim();
      let disp = String(item.dispositions || item.disposition || "").trim();
      let valid = String(item.validStatus || "").trim();

      // Auto-populate Disposition & Valid Status if Sub Disposition matches map
      if (subDisp && SUB_DISPOSITIONS_MAP[subDisp]) {
        if (!disp) disp = SUB_DISPOSITIONS_MAP[subDisp].disposition;
        if (!valid) valid = SUB_DISPOSITIONS_MAP[subDisp].validStatus;
      }

      // If date/timestamp is ISO string (e.g. 2026-08-11T22:28:43+05:30) or created_time is provided
      let finalDate = String(item.date || "").trim();
      let finalMonth = String(item.month || "").trim();
      let finalTimestamp = String(item.leadTimestamp || "").trim();

      const rawTimeCandidate = item.created_time || item.createdAt || (!finalDate || finalDate.includes("T") ? finalDate : "");
      if (rawTimeCandidate && (!finalTimestamp || finalDate.includes("T"))) {
        try {
          const d = new Date(rawTimeCandidate);
          if (!isNaN(d.getTime())) {
            const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const yr = String(d.getFullYear()).slice(-2);
            const dy = String(d.getDate()).padStart(2, "0");
            const mmm = MONTH_NAMES[d.getMonth()] || "Jan";
            finalDate = `${dy}-${mmm}-${yr}`;
            finalMonth = `${mmm}-${yr}`;
            let hrs = d.getHours();
            const mins = String(d.getMinutes()).padStart(2, "0");
            const ampm = hrs >= 12 ? "PM" : "AM";
            hrs = hrs % 12;
            hrs = hrs ? hrs : 12;
            finalTimestamp = `${finalDate}, ${String(hrs).padStart(2, "0")}:${mins} ${ampm}`;
          }
        } catch {}
      }

      if (!finalDate) finalDate = defaultDate;
      if (!finalMonth) finalMonth = defaultMonth;
      if (!finalTimestamp) finalTimestamp = currentTimestamp;

      return {
        uniqueId: assignedId,
        date: finalDate,
        month: finalMonth,
        leadTimestamp: finalTimestamp,
        mobileNumber: mobile,
        phoneNumber: mobile, // legacy alias
        alternateNumber: String(item.alternateNumber || "").trim(),
        callerName: String(item.callerName || "").trim(),
        patientName: String(item.patientName || "").trim(),
        patientAge: String(item.patientAge || "").trim(),
        spouseName: String(item.spouseName || "").trim(),
        spouseAge: String(item.spouseAge || "").trim(),
        location: String(item.location || item.otherCity || "").trim(),
        otherCity: String(item.otherCity || "").trim(),
        lookingForTreatment: String(
          item.lookingForTreatment || item.treatmentRequired || item.treatment || ""
        ).trim(),
        treatmentRequirements: String(
          item.treatmentRequirements || item.treatmentRequired || ""
        ).trim(),
        preConditions: String(item.preConditions || item.preCondition || "").trim(),
        surgeryDetails: String(item.surgeryDetails || item.surgicalData || "").trim(),
        referredBy: String(item.referredBy || "").trim(),
        leadSource: String(item.leadSource || "").trim(),
        followUpDate: String(item.followUpDate || item.followUpDates || "").trim(),
        subDispositions: subDisp,
        dispositions: disp,
        validStatus: valid,
        appointmentDate: String(item.appointmentDate || "").trim(),
        appointmentMonth: String(item.appointmentMonth || "").trim(),
        teleconsultationSlot: String(item.teleconsultationSlot || item.appointmentSlot || "").trim(),
        consultationCharges: String(
          item.consultationCharges || item.teleConsultationCharges || ""
        ).trim(),
        notes: String(item.notes || "").trim(),
        surgeryPaymentReceived: String(
          item.surgeryPaymentReceived || item.surgeryReceipt || ""
        ).trim(),
        surgeryCost: String(item.surgeryCost || "").trim(),
        surgeryDate: String(item.surgeryDate || "").trim(),
      };
    });

    const inserted = await Lead.insertMany(leadsToInsert);
    const nextUniqueId = `SC-${maxNum + 1}`;

    return NextResponse.json({
      success: true,
      count: inserted.length,
      leads: inserted,
      nextUniqueId,
    });
  } catch (error: any) {
    console.error("Bulk upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to bulk import leads" },
      { status: 500 }
    );
  }
}
