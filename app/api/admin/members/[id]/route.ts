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

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.role !== "admin") return null;
    return decoded;
  } catch {
    return null;
  }
}

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

// GET /api/admin/members/[id] - Fetch single member details
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await verifyAdminOrTeamLeader();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized. Access required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();

    const member = await User.findById(id).select("-password");
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Team Leader can only view Agent profiles
    if (authUser.role === "team_leader" && member.role !== "agent") {
      return NextResponse.json(
        { error: "Access denied. Team leaders can only view agents." },
        { status: 403 }
      );
    }

    return NextResponse.json({ member });
  } catch (error: any) {
    console.error("Error fetching member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch member" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/members/[id] - Update member details or status
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await verifyAdminOrTeamLeader();
    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized. Access required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { name, mobile, email, role, status, password } = body;

    await connectDB();

    const member = await User.findById(id);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Team Leader can only update Agent accounts, not other team leaders or admins
    if (authUser.role === "team_leader") {
      if (member.role !== "agent") {
        return NextResponse.json(
          { error: "Team Leaders are only permitted to manage Agents." },
          { status: 403 }
        );
      }
      if (role && role !== "agent") {
        return NextResponse.json(
          { error: "Team Leaders cannot promote agents to other roles." },
          { status: 403 }
        );
      }
    }

    // Email duplication check if email changed
    if (email && email.toLowerCase() !== member.email) {
      const existing = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A user with this email already exists." },
          { status: 400 }
        );
      }
      member.email = email.toLowerCase();
    }

    const updateFields: any = {};
    if (name) updateFields.name = name;
    if (mobile) updateFields.mobile = mobile;
    if (role && ["team_leader", "agent", "mis", "marketing"].includes(role)) updateFields.role = role;
    if (status && ["active", "inactive"].includes(status)) updateFields.status = status;

    // Optional password reset
    if (password && password.trim().length > 0) {
      updateFields.password = await bcrypt.hash(password, 10);
    }

    const updatedMember = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Member updated successfully",
      member: updatedMember,
    });
  } catch (error: any) {
    console.error("Error updating member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update member" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/members/[id] - Delete a member
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminUser = await verifyAdmin();
    if (!adminUser) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    await connectDB();

    const member = await User.findById(id);
    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Do not allow deleting other admins via this route
    if (member.role === "admin") {
      return NextResponse.json(
        { error: "Cannot delete an administrator account" },
        { status: 400 }
      );
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: "Member deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting member:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete member" },
      { status: 500 }
    );
  }
}
