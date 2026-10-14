import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { Lead } from "@/models/Lead";

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

// GET /api/admin/leads/check-phone?phone=9876543210
export async function GET(req: Request) {
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const phone = (searchParams.get("phone") || "").trim().replace(/\D/g, "");

    // If less than 4 digits, return empty array immediately (no DB load)
    if (phone.length < 4) {
      return NextResponse.json({ duplicates: [] });
    }

    await connectDB();

    // Find up to 10 matching leads by mobileNumber, alternateNumber, or phoneNumber
    // Return only minimal identification fields
    const phoneRegex = new RegExp(phone, "i");
    const query: any = {
      $or: [
        { mobileNumber: { $regex: phoneRegex } },
        { alternateNumber: { $regex: phoneRegex } },
        { phoneNumber: { $regex: phoneRegex } },
      ],
    };

    // If agent, restrict to agent's assigned leads
    if (session.role === "agent") {
      const agentName = (session.name || "").trim();
      query.callerName = {
        $regex: new RegExp(`^${agentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
      };
    }

    const duplicates = await Lead.find(query)
      .select({
        uniqueId: 1,
        patientName: 1,
        mobileNumber: 1,
        alternateNumber: 1,
        phoneNumber: 1,
        location: 1,
        callerName: 1,
        dispositions: 1,
      })
      .limit(10)
      .lean();

    return NextResponse.json(
      { duplicates },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: any) {
    console.error("Error checking phone duplicate:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check phone number" },
      { status: 500 }
    );
  }
}
