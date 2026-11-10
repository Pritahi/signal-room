import { NextRequest, NextResponse } from "next/server";
import {
  executeDualModelTriage,
  getServerGatewayStatus,
  type GatewayConfigInput,
} from "@/lib/otari-gateway";
import { ensureDatabaseSeeded } from "@/lib/db-seed";
import { db } from "@/db";
import { incidentReports } from "@/db/schema";
import { PRESET_SCENARIOS } from "@/lib/scenarios";

export async function GET() {
  try {
    const gatewayStatus = getServerGatewayStatus();
    return NextResponse.json({
      gatewayStatus,
      presets: PRESET_SCENARIOS,
    });
  } catch (error) {
    console.error("Failed to fetch gateway status:", error);
    return NextResponse.json(
      { error: "Failed to fetch gateway status" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawLogs = typeof body?.rawLogs === "string" ? body.rawLogs.trim() : "";
    const customTitle =
      typeof body?.title === "string" ? body.title.trim() : undefined;
    const gatewayConfig: GatewayConfigInput | undefined = body?.gatewayConfig;
    const saveToDb = body?.saveToDb !== false;

    if (!rawLogs) {
      return NextResponse.json(
        { error: "Please provide raw logs or alert payloads to triage." },
        { status: 400 }
      );
    }

    const triageResult = await executeDualModelTriage(
      rawLogs,
      customTitle,
      gatewayConfig
    );

    if (saveToDb) {
      await ensureDatabaseSeeded();
      const [inserted] = await db
        .insert(incidentReports)
        .values({
          incidentCode: triageResult.incidentCode,
          title: triageResult.title,
          scenarioKey: triageResult.scenarioKey,
          rawLogs: triageResult.rawLogs,
          severity: triageResult.severity,
          confidence: triageResult.confidence,
          status: "INVESTIGATING",
          summary: triageResult.summary,
          blastRadius: triageResult.blastRadius,
          affectedServices: triageResult.affectedServices,
          errorSignatures: triageResult.errorSignatures,
          timeline: triageResult.timeline,
          rootCauses: triageResult.rootCauses,
          nextSteps: triageResult.nextSteps,
          postmortemMarkdown: triageResult.postmortemMarkdown,
          telemetry: triageResult.telemetry,
        })
        .returning();

      return NextResponse.json({
        incident: inserted,
        gatewayStatus: getServerGatewayStatus(),
      });
    }

    return NextResponse.json({
      incident: {
        id: Date.now(),
        status: "INVESTIGATING",
        createdAt: new Date().toISOString(),
        ...triageResult,
      },
      gatewayStatus: getServerGatewayStatus(),
    });
  } catch (error) {
    console.error("Error running dual-model triage:", error);
    return NextResponse.json(
      { error: "Failed to execute dual-model incident triage." },
      { status: 500 }
    );
  }
}
