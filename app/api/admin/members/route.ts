import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== "admin") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

async function verifyAdminOrTeamLeader() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== "admin" && decoded.role !== "team_leader") {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export const dynamic = "force-dynamic";

// GET /api/admin/members - Fetch all members (team leaders and agents)
export async function GET() {
  try {
    const authUser = await verifyAdminOrTeamLeader();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized. Access required." },
        { status: 403 }
      );
    }

    await connectDB();
    const members = await User.find({
      role: { $in: ["team_leader", "agent"] },
    })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(
      { members },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// POST /api/admin/members - Add member (name, mobile, email, password, role)
export async function POST(req: Request) {
  try {
    const authUser = await verifyAdminOrTeamLeader();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized access required." },
        { status: 403 }
      );
    }

    const { name, mobile, email, password, role } = await req.json();

    if (!name || !mobile || !email || !password || !role) {
      return NextResponse.json(
        { error: "Please fill all fields: name, mobile, email, password, role." },
        { status: 400 }
      );
    }

    // Team Leader can only add agent
    if (authUser.role === "team_leader") {
      if (role !== "agent") {
        return NextResponse.json(
          { error: "Team Leaders are only permitted to add Agents." },
          { status: 403 }
        );
      }
    } else {
      if (!["team_leader", "agent"].includes(role)) {
        return NextResponse.json(
          { error: "Invalid role selected. Must be Team Leader or Agent." },
          { status: 400 }
        );
      }
    }

    await connectDB();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newMember = await User.create({
      name,
      mobile,
      email,
      password: hashedPassword,
      role,
      createdBy: authUser.id,
    });

    return NextResponse.json(
      {
        message: `${role === "team_leader" ? "Team Leader" : "Agent"} added successfully!`,
        member: {
          _id: newMember._id,
          name: newMember.name,
          mobile: newMember.mobile,
          email: newMember.email,
          role: newMember.role,
          status: newMember.status || "active",
          createdAt: newMember.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create member" },
      { status: 500 }
    );
  }
}
