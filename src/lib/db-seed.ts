import { db, pool } from "@/db";
import { incidentReports, type IncidentReport } from "@/db/schema";
import { PRESET_SCENARIOS } from "@/lib/scenarios";
import { desc } from "drizzle-orm";

let initialized = false;

export async function ensureDatabaseSeeded(): Promise<void> {
  if (initialized) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS incident_reports (
      id SERIAL PRIMARY KEY,
      incident_code TEXT NOT NULL,
      title TEXT NOT NULL,
      scenario_key TEXT NOT NULL DEFAULT 'custom',
      raw_logs TEXT NOT NULL,
      severity TEXT NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 90,
      status TEXT NOT NULL DEFAULT 'INVESTIGATING',
      summary TEXT NOT NULL,
      blast_radius TEXT NOT NULL,
      affected_services JSONB NOT NULL,
      error_signatures JSONB NOT NULL,
      timeline JSONB NOT NULL,
      root_causes JSONB NOT NULL,
      next_steps JSONB NOT NULL,
      postmortem_markdown TEXT NOT NULL,
      telemetry JSONB NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const existing = await db
    .select({ id: incidentReports.id })
    .from(incidentReports)
    .limit(1);

  if (existing.length === 0) {
    for (const scenario of PRESET_SCENARIOS) {
      await db.insert(incidentReports).values({
        incidentCode: scenario.incidentCode,
        title: scenario.title,
        scenarioKey: scenario.key,
        rawLogs: scenario.rawLogs,
        severity: scenario.severity,
        confidence: scenario.confidence,
        status: "INVESTIGATING",
        summary: scenario.summary,
        blastRadius: scenario.blastRadius,
        affectedServices: scenario.affectedServices,
        errorSignatures: scenario.errorSignatures,
        timeline: scenario.timeline,
        rootCauses: scenario.rootCauses,
        nextSteps: scenario.nextSteps,
        postmortemMarkdown: scenario.postmortemMarkdown,
        telemetry: scenario.telemetry,
      });
    }
  }

  initialized = true;
}

export async function getAllIncidents(): Promise<IncidentReport[]> {
  await ensureDatabaseSeeded();
  return db
    .select()
    .from(incidentReports)
    .orderBy(desc(incidentReports.id))
    .limit(30);
}
