import React from "react";
import { SignalRoomClient } from "@/components/SignalRoomClient";
import { getAllIncidents } from "@/lib/db-seed";
import { getServerGatewayStatus } from "@/lib/otari-gateway";
import { PRESET_SCENARIOS } from "@/lib/scenarios";
import type { IncidentReport } from "@/db/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const gatewayStatus = getServerGatewayStatus();
  let initialIncidents: IncidentReport[] = [];

  try {
    initialIncidents = await getAllIncidents();
  } catch (err) {
    console.warn("Database fallback to in-memory presets:", err);
    initialIncidents = PRESET_SCENARIOS.map((preset, idx) => ({
      id: idx + 1,
      incidentCode: preset.incidentCode,
      title: preset.title,
      scenarioKey: preset.key,
      rawLogs: preset.rawLogs,
      severity: preset.severity,
      confidence: preset.confidence,
      status: "INVESTIGATING",
      summary: preset.summary,
      blastRadius: preset.blastRadius,
      affectedServices: preset.affectedServices,
      errorSignatures: preset.errorSignatures,
      timeline: preset.timeline,
      rootCauses: preset.rootCauses,
      nextSteps: preset.nextSteps,
      postmortemMarkdown: preset.postmortemMarkdown,
      telemetry: preset.telemetry,
      createdAt: new Date(),
    }));
  }

  return (
    <SignalRoomClient
      initialIncidents={initialIncidents}
      serverGatewayStatus={gatewayStatus}
    />
  );
}
