import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { connectDB } from "@/lib/mongodb";
import { FormConfig } from "@/models/FormConfig";
import { DEFAULT_FORM_FIELDS } from "@/lib/defaultFormFields";
import { SUB_DISPOSITIONS_MAP } from "@/lib/leadOptions";

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

// GET /api/admin/form-config - Fetch dynamic form configuration
export async function GET() {
  try {
    const session = await verifyAuth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    let config = await FormConfig.findOne().lean();

    if (!config) {
      // Initialize with default configuration
      const created = await FormConfig.create({
        version: 1,
        sections: [
          { id: 1, title: "1. Lead Date, Contact & Caller" },
          { id: 2, title: "2. Patient & Family Profile" },
          { id: 3, title: "3. Clinical & Surgical Information" },
          { id: 4, title: "4. Disposition, Appointments & Follow-up" },
        ],
        fields: DEFAULT_FORM_FIELDS,
        subDispositionMappings: { ...SUB_DISPOSITIONS_MAP },
        updatedBy: "System Default",
      });
      config = created.toObject();
    } else if (!config.subDispositionMappings || Object.keys(config.subDispositionMappings).length === 0) {
      config.subDispositionMappings = { ...SUB_DISPOSITIONS_MAP };
    }

    return NextResponse.json({ config });
  } catch (error: any) {
    console.error("Error fetching form-config:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch form configuration" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/form-config - Update fields order, sections, dropdown options, new fields
export async function PUT(req: Request) {
  try {
    const session = await verifyAuth();
    if (!session || (session.role !== "admin" && session.role !== "team_leader")) {
      return NextResponse.json(
        { error: "Access denied. Only Admin or Team Leader can edit form fields." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { fields, sections, subDispositionMappings } = body;

    if (!Array.isArray(fields)) {
      return NextResponse.json(
        { error: "Invalid payload: fields must be an array" },
        { status: 400 }
      );
    }

    await connectDB();

    const updateData: any = {
      fields,
      version: Date.now(),
      updatedBy: `${session.name || "User"} (${session.role})`,
    };

    if (sections && Array.isArray(sections)) {
      updateData.sections = sections;
    }

    if (subDispositionMappings && typeof subDispositionMappings === "object") {
      updateData.subDispositionMappings = subDispositionMappings;
    }

    const config = await FormConfig.findOneAndUpdate(
      {},
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return NextResponse.json({
      message: "Form configuration saved successfully",
      config,
    });
  } catch (error: any) {
    console.error("Error updating form-config:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update form configuration" },
      { status: 500 }
    );
  }
}

// POST /api/admin/form-config/reset - Reset to default fields if needed
export async function POST(req: Request) {
  try {
    const session = await verifyAuth();
    if (!session || (session.role !== "admin" && session.role !== "team_leader")) {
      return NextResponse.json(
        { error: "Access denied. Only Admin or Team Leader can reset form fields." },
        { status: 403 }
      );
    }

    await connectDB();

    let config = await FormConfig.findOne();
    if (!config) {
      config = new FormConfig({
        version: 1,
        sections: [
          { id: 1, title: "1. Lead Date, Contact & Caller" },
          { id: 2, title: "2. Patient & Family Profile" },
          { id: 3, title: "3. Clinical & Surgical Information" },
          { id: 4, title: "4. Disposition, Appointments & Follow-up" },
        ],
        fields: DEFAULT_FORM_FIELDS,
        subDispositionMappings: { ...SUB_DISPOSITIONS_MAP },
        updatedBy: `Reset by ${session.name || "Admin"}`,
      });
    } else {
      config.fields = DEFAULT_FORM_FIELDS;
      config.subDispositionMappings = { ...SUB_DISPOSITIONS_MAP };
      config.version = (config.version || 1) + 1;
      config.updatedBy = `Reset by ${session.name || "Admin"}`;
    }

    await config.save();

    return NextResponse.json({
      message: "Form configuration reset to default successfully",
      config,
    });
  } catch (error: any) {
    console.error("Error resetting form-config:", error);
    return NextResponse.json(
      { error: error.message || "Failed to reset form configuration" },
      { status: 500 }
    );
  }
}
