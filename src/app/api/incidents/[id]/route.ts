import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { incidentReports } from "@/db/schema";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { eq } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseSeeded();
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Invalid incident ID" }, { status: 400 });
    }

    const body = await req.json();
    const updatePayload: Record<string, unknown> = {};

    if (Array.isArray(body.nextSteps)) {
      updatePayload.nextSteps = body.nextSteps;
    }
    if (typeof body.postmortemMarkdown === "string") {
      updatePayload.postmortemMarkdown = body.postmortemMarkdown;
    }
    if (typeof body.status === "string") {
      updatePayload.status = body.status;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided for update" },
        { status: 400 }
      );
    }

    const [updated] = await db
      .update(incidentReports)
      .set(updatePayload)
      .where(eq(incidentReports.id, numericId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Incident not found" }, { status: 404 });
    }

    return NextResponse.json({ incident: updated });
  } catch (error) {
    console.error("Failed to update incident:", error);
    return NextResponse.json(
      { error: "Failed to update incident" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDatabaseSeeded();
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      return NextResponse.json({ error: "Invalid incident ID" }, { status: 400 });
    }

    await db
      .delete(incidentReports)
      .where(eq(incidentReports.id, numericId));

    return NextResponse.json({ deleted: true, id: numericId });
  } catch (error) {
    console.error("Failed to delete incident:", error);
    return NextResponse.json(
      { error: "Failed to delete incident" },
      { status: 500 }
    );
  }
}
