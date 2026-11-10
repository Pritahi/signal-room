import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export interface TimelineEvent {
  id: string;
  timestamp: string;
  service: string;
  level: "CRITICAL" | "ERROR" | "WARN" | "INFO";
  event: string;
  rawSnippet: string;
  isTrigger?: boolean;
}

export interface RootCauseHypothesis {
  id: string;
  rank: number;
  title: string;
  probability: number; // 0 - 100
  category: string;
  mechanism: string;
  supportingEvidence: string[];
  verificationCommand: string;
}

export interface RemediationStep {
  id: string;
  phase: "IMMEDIATE" | "STABILIZE" | "PREVENT";
  title: string;
  rationale: string;
  command: string;
  rollbackNote: string;
  completed: boolean;
  ownerRole: string;
}

export interface GatewayTelemetry {
  mode: "mock" | "live";
  gatewayProvider: string;
  endpointUrl: string;
  model1: {
    id: string;
    role: string;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    status: "completed" | "fallback-mock" | "completed-via-fallback";
  };
  model2: {
    id: string;
    role: string;
    latencyMs: number;
    promptTokens: number;
    completionTokens: number;
    status: "completed" | "fallback-mock" | "completed-via-fallback";
  };
  routingPolicy?: string;
  fallbackEvents?: string[];
  webSearch?: {
    tool: string;
    query: string;
    resultCount: number;
    topResults: { title: string; url: string }[];
    usedInStage: string;
  };
  budget?: {
    capUsd: number | null;
    sessionSpentUsd: number;
    exceeded: boolean;
  };
  totalDurationMs: number;
  timestampIso: string;
}

export const incidentReports = pgTable("incident_reports", {
  id: serial("id").primaryKey(),
  incidentCode: text("incident_code").notNull(),
  title: text("title").notNull(),
  scenarioKey: text("scenario_key").notNull().default("custom"),
  rawLogs: text("raw_logs").notNull(),
  severity: text("severity").notNull(), // SEV-1 | SEV-2 | SEV-3 | SEV-4
  confidence: integer("confidence").notNull().default(90),
  status: text("status").notNull().default("INVESTIGATING"), // INVESTIGATING | MITIGATING | RESOLVED
  summary: text("summary").notNull(),
  blastRadius: text("blast_radius").notNull(),
  affectedServices: jsonb("affected_services").$type<string[]>().notNull(),
  errorSignatures: jsonb("error_signatures").$type<string[]>().notNull(),
  timeline: jsonb("timeline").$type<TimelineEvent[]>().notNull(),
  rootCauses: jsonb("root_causes").$type<RootCauseHypothesis[]>().notNull(),
  nextSteps: jsonb("next_steps").$type<RemediationStep[]>().notNull(),
  postmortemMarkdown: text("postmortem_markdown").notNull(),
  telemetry: jsonb("telemetry").$type<GatewayTelemetry>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type IncidentReport = typeof incidentReports.$inferSelect;
export type NewIncidentReport = typeof incidentReports.$inferInsert;
