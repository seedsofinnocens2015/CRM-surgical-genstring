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

const MONTH_NAMES_S = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Normalises any date value to DD-MMM-YY. Handles Excel serial, DD-MM-YYYY, YYYY-MM-DD, DD-MMM-YY, ISO. */
function parseAnyDateServer(raw: any): string {
  if (!raw && raw !== 0) return "";
  const str = String(raw).trim();
  if (!str) return "";

  const asNum = Number(str);
  if (!isNaN(asNum) && asNum > 25000 && asNum < 60000 && !str.includes("-") && !str.includes("/")) {
    const d = new Date((asNum - (25567 + 2)) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return `${String(d.getDate()).padStart(2,"0")}-${MONTH_NAMES_S[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    }
  }
  const m1 = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/.exec(str);
  if (m1) {
    const mmm = m1[2].charAt(0).toUpperCase() + m1[2].slice(1).toLowerCase();
    const yr = m1[3].length === 4 ? m1[3].slice(-2) : m1[3];
    return `${m1[1].padStart(2,"0")}-${mmm}-${yr}`;
  }
  const m2 = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(str);
  if (m2) {
    const monthIdx = parseInt(m2[2], 10) - 1;
    return `${m2[1].padStart(2,"0")}-${MONTH_NAMES_S[monthIdx] || m2[2]}-${m2[3].slice(-2)}`;
  }
  const m3 = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (m3) {
    const monthIdx = parseInt(m3[2], 10) - 1;
    return `${m3[3]}-${MONTH_NAMES_S[monthIdx] || m3[2]}-${m3[1].slice(-2)}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${String(d.getDate()).padStart(2,"0")}-${MONTH_NAMES_S[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
  }
  return str;
}

function monthFromDDMMMYYServer(s: string): string {
  const p = s.split("-");
  return (p.length === 3 && MONTH_NAMES_S.includes(p[1])) ? `${p[1]}-${p[2]}` : "";
}


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

    // 1. Gather all incoming phone numbers to check for duplicates in DB
    const incomingMobiles = new Set<string>();
    for (const item of leads) {
      const mob = String(item.mobileNumber || item.phoneNumber || "").replace(/\D/g, "").slice(-10);
      if (mob && mob.length >= 10) {
        incomingMobiles.add(mob);
      }
    }

    // 2. Find and remove old matching leads from the database
    let deletedCount = 0;
    const existingMatchesByMobile: Record<string, string> = {}; // mob -> old uniqueId

    if (incomingMobiles.size > 0) {
      const mobileRegexes = Array.from(incomingMobiles).map((m) => new RegExp(m + "$"));
      const oldDuplicates = await Lead.find(
        {
          $or: [
            { mobileNumber: { $in: mobileRegexes } },
            { phoneNumber: { $in: mobileRegexes } },
          ],
        },
        { _id: 1, uniqueId: 1, mobileNumber: 1, phoneNumber: 1 }
      ).lean();

      if (oldDuplicates.length > 0) {
        const idsToDelete = oldDuplicates.map((d) => d._id);
        for (const d of oldDuplicates) {
          const mob = String(d.mobileNumber || d.phoneNumber || "").replace(/\D/g, "").slice(-10);
          if (mob && !existingMatchesByMobile[mob] && d.uniqueId) {
            existingMatchesByMobile[mob] = d.uniqueId;
          }
        }
        const delRes = await Lead.deleteMany({ _id: { $in: idsToDelete } });
        deletedCount = delRes.deletedCount || 0;
      }
    }

    // 3. Determine current highest SC- number in database
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

    // 4. Prepare docs to insert (preserve old uniqueId if it replaced an existing lead, else assign consecutive SC- ID)
    const assignedIdsInBatch = new Set<string>();

    const leadsToInsert = leads.map((item: any) => {
      const mobile = String(item.mobileNumber || item.phoneNumber || "").trim();
      const cleanDigits = mobile.replace(/\D/g, "").slice(-10);

      let assignedId = "";
      if (cleanDigits && existingMatchesByMobile[cleanDigits] && !assignedIdsInBatch.has(existingMatchesByMobile[cleanDigits])) {
        // Reuse previous uniqueId so history is maintained
        assignedId = existingMatchesByMobile[cleanDigits];
        assignedIdsInBatch.add(assignedId);
      } else {
        maxNum += 1;
        assignedId = `SC-${maxNum}`;
        assignedIdsInBatch.add(assignedId);
      }

      const subDisp = String(item.subDispositions || item.subDisposition || "").trim();
      let disp = String(item.dispositions || item.disposition || "").trim();
      let valid = String(item.validStatus || "").trim();

      // Auto-populate Disposition & Valid Status if Sub Disposition matches map
      if (subDisp && SUB_DISPOSITIONS_MAP[subDisp]) {
        if (!disp) disp = SUB_DISPOSITIONS_MAP[subDisp].disposition;
        if (!valid) valid = SUB_DISPOSITIONS_MAP[subDisp].validStatus;
      }

      // Ensure exact date from payload/Excel is respected
      let finalDate = parseAnyDateServer(item.date || "");
      let finalMonth = String(item.month || "").trim() || monthFromDDMMMYYServer(finalDate);
      let finalTimestamp = String(item.leadTimestamp || "").trim();

      const rawTimeCandidate = item.created_time || item.createdAt || "";
      if (rawTimeCandidate && (!finalTimestamp || !finalDate)) {
        try {
          const d = new Date(rawTimeCandidate);
          if (!isNaN(d.getTime())) {
            const yr = String(d.getFullYear()).slice(-2);
            const dy = String(d.getDate()).padStart(2, "0");
            const mmm = MONTH_NAMES_S[d.getMonth()] || "Jan";
            if (!finalDate) finalDate = `${dy}-${mmm}-${yr}`;
            if (!finalMonth) finalMonth = `${mmm}-${yr}`;
            let hrs = d.getHours();
            const mins = String(d.getMinutes()).padStart(2, "0");
            const ampm = hrs >= 12 ? "PM" : "AM";
            hrs = hrs % 12;
            hrs = hrs ? hrs : 12;
            if (!finalTimestamp) finalTimestamp = `${finalDate}, ${String(hrs).padStart(2, "0")}:${mins} ${ampm}`;
          }
        } catch {}
      }

      if (!finalDate) finalDate = defaultDate;
      if (!finalMonth) finalMonth = monthFromDDMMMYYServer(finalDate) || defaultMonth;
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
        followUpDate: parseAnyDateServer(item.followUpDate || item.followUpDates || ""),
        subDispositions: subDisp,
        dispositions: disp,
        validStatus: valid,
        appointmentDate: (() => {
          const ad = parseAnyDateServer(item.appointmentDate || "");
          return ad;
        })(),
        appointmentMonth: (() => {
          const ad = parseAnyDateServer(item.appointmentDate || "");
          const stored = String(item.appointmentMonth || "").trim();
          return monthFromDDMMMYYServer(ad) || stored;
        })(),
        teleconsultationSlot: String(item.teleconsultationSlot || item.appointmentSlot || "").trim(),
        consultationCharges: String(
          item.consultationCharges || item.teleConsultationCharges || ""
        ).trim(),
        notes: String(item.notes || "").trim(),
        surgeryPaymentReceived: String(
          item.surgeryPaymentReceived || item.surgeryReceipt || ""
        ).trim(),
        surgeryCost: String(item.surgeryCost || "").trim(),
        surgeryDate: parseAnyDateServer(item.surgeryDate || ""),
      };
    });

    const inserted = await Lead.insertMany(leadsToInsert);
    const nextUniqueId = `SC-${maxNum + 1}`;

    return NextResponse.json({
      success: true,
      count: inserted.length,
      deletedCount,
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
