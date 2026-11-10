import {
  MODEL_1_ID,
  MODEL_2_ID,
  runMockDualModelTriage,
} from "@/lib/scenarios";
import type {
  GatewayTelemetry,
  RemediationStep,
  RootCauseHypothesis,
  TimelineEvent,
} from "@/db/schema";

export interface GatewayConfigInput {
  forceMock?: boolean;
  apiKey?: string;
  baseUrl?: string;
  model1Id?: string;
  model2Id?: string;
}

export interface DualModelTriageResult {
  scenarioKey: string;
  incidentCode: string;
  title: string;
  rawLogs: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
  confidence: number;
  summary: string;
  blastRadius: string;
  affectedServices: string[];
  errorSignatures: string[];
  timeline: TimelineEvent[];
  rootCauses: RootCauseHypothesis[];
  nextSteps: RemediationStep[];
  postmortemMarkdown: string;
  telemetry: GatewayTelemetry;
}

export function getServerGatewayStatus() {
  const envKey =
    process.env.OTARI_API_KEY ||
    process.env.ANY_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    "";
  const envBaseUrl =
    process.env.OTARI_BASE_URL ||
    process.env.ANY_LLM_BASE_URL ||
    "https://otari.ai/api/v1";

  return {
    hasServerApiKey: Boolean(envKey.trim()),
    defaultBaseUrl: envBaseUrl,
    model1Default: process.env.OTARI_MODEL_1 || MODEL_1_ID,
    model2Default: process.env.OTARI_MODEL_2 || MODEL_2_ID,
  };
}

export async function executeDualModelTriage(
  rawLogs: string,
  customTitle?: string,
  config?: GatewayConfigInput
): Promise<DualModelTriageResult> {
  const serverStatus = getServerGatewayStatus();
  const effectiveApiKey = (
    config?.apiKey ||
    process.env.OTARI_API_KEY ||
    process.env.ANY_LLM_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""
  ).trim();

  const effectiveBaseUrl = (
    config?.baseUrl ||
    serverStatus.defaultBaseUrl
  ).replace(/\/+$/, "");

  const model1 = config?.model1Id?.trim() || serverStatus.model1Default;
  const model2 = config?.model2Id?.trim() || serverStatus.model2Default;

  // If no API key or user explicitly selected deterministic mock mode
  if (config?.forceMock || !effectiveApiKey) {
    const mockResult = runMockDualModelTriage(rawLogs, customTitle);
    return {
      ...mockResult,
      telemetry: {
        ...mockResult.telemetry,
        mode: "mock",
        gatewayProvider: "Mozilla Otari / any-llm Gateway (Deterministic Mock)",
        endpointUrl: `${effectiveBaseUrl}/chat/completions`,
        model1: {
          ...mockResult.telemetry.model1,
          id: model1,
        },
        model2: {
          ...mockResult.telemetry.model2,
          id: model2,
        },
      },
    };
  }

  // Live Dual-Model Execution via Mozilla Otari / any-llm OpenAI-compatible gateway
  const baselineFallback = runMockDualModelTriage(rawLogs, customTitle);
  const endpoint = `${effectiveBaseUrl}/chat/completions`;
  const startTotal = Date.now();

  try {
    // STAGE 1: Model 1 (Summarizer + Severity Classifier + Timeline Extractor)
    const startM1 = Date.now();
    const stage1Prompt = `You are Model 1 (Incident Summarizer & Severity Classifier) in Signal Room, an incident-triage copilot for the Mozilla Otari hackathon.
Analyze the following raw incident logs/alerts and return ONLY valid JSON matching this schema:
{
  "incidentCode": "INC-XXXX",
  "title": "Concise technical incident title",
  "severity": "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4",
  "confidence": 92,
  "summary": "2-3 sentence executive technical summary",
  "blastRadius": "1 sentence describing customer/system impact",
  "affectedServices": ["service-a", "service-b"],
  "errorSignatures": ["error signature 1", "error signature 2"],
  "timeline": [
    {
      "id": "tl-1",
      "timestamp": "HH:MM:SS UTC",
      "service": "service-name",
      "level": "CRITICAL" | "ERROR" | "WARN" | "INFO",
      "event": "Clear summary of this log event",
      "rawSnippet": "Original log snippet",
      "isTrigger": true
    }
  ]
}

RAW LOGS:
${rawLogs}`;

    const res1 = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: model1,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You are an expert SRE incident classifier. Always respond with raw valid JSON only.",
          },
          { role: "user", content: stage1Prompt },
        ],
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res1.ok) {
      throw new Error(`Stage 1 gateway returned HTTP ${res1.status}`);
    }

    const data1 = await res1.json();
    const latencyM1 = Date.now() - startM1;
    const rawContent1 = data1?.choices?.[0]?.message?.content || "{}";
    const parsed1 = safeParseJson(rawContent1);

    const stage1Summary = parsed1?.summary || baselineFallback.summary;
    const rawSeverity = parsed1?.severity;
    const stage1Severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4" =
      rawSeverity === "SEV-1" ||
      rawSeverity === "SEV-2" ||
      rawSeverity === "SEV-3" ||
      rawSeverity === "SEV-4"
        ? rawSeverity
        : baselineFallback.severity;

    // STAGE 2: Model 2 (Root-Cause Hypotheses + Remediation Runbook + Postmortem Draft)
    const startM2 = Date.now();
    const stage2Prompt = `You are Model 2 (Root-Cause & Remediation Planner) in Signal Room, an incident-triage copilot.
Model 1 (${model1}) classified this incident as ${stage1Severity}: "${stage1Summary}".

Given the raw logs and Model 1 classification, return ONLY valid JSON matching this schema:
{
  "rootCauses": [
    {
      "id": "rc-1",
      "rank": 1,
      "title": "Root cause title",
      "probability": 90,
      "category": "Category",
      "mechanism": "Detailed technical explanation",
      "supportingEvidence": ["log line 1"],
      "verificationCommand": "kubectl or cli command to verify"
    }
  ],
  "nextSteps": [
    {
      "id": "ns-1",
      "phase": "IMMEDIATE" | "STABILIZE" | "PREVENT",
      "title": "Actionable remediation step",
      "rationale": "Why this step is needed",
      "command": "copyable CLI command",
      "rollbackNote": "Safety / rollback note",
      "completed": false,
      "ownerRole": "SRE / On-Call"
    }
  ],
  "postmortemMarkdown": "# Blameless Postmortem markdown document..."
}

RAW LOGS:
${rawLogs}`;

    const res2 = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`,
      },
      body: JSON.stringify({
        model: model2,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You are an expert Staff SRE remediation planner. Always respond with raw valid JSON only.",
          },
          { role: "user", content: stage2Prompt },
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res2.ok) {
      throw new Error(`Stage 2 gateway returned HTTP ${res2.status}`);
    }

    const data2 = await res2.json();
    const latencyM2 = Date.now() - startM2;
    const rawContent2 = data2?.choices?.[0]?.message?.content || "{}";
    const parsed2 = safeParseJson(rawContent2);

    return {
      scenarioKey: "live-gateway",
      incidentCode: parsed1?.incidentCode || baselineFallback.incidentCode,
      title: customTitle?.trim() || parsed1?.title || baselineFallback.title,
      rawLogs: rawLogs.trim(),
      severity: stage1Severity,
      confidence:
        typeof parsed1?.confidence === "number"
          ? parsed1.confidence
          : baselineFallback.confidence,
      summary: stage1Summary,
      blastRadius: parsed1?.blastRadius || baselineFallback.blastRadius,
      affectedServices:
        Array.isArray(parsed1?.affectedServices) &&
        parsed1.affectedServices.length > 0
          ? parsed1.affectedServices
          : baselineFallback.affectedServices,
      errorSignatures:
        Array.isArray(parsed1?.errorSignatures) &&
        parsed1.errorSignatures.length > 0
          ? parsed1.errorSignatures
          : baselineFallback.errorSignatures,
      timeline:
        Array.isArray(parsed1?.timeline) && parsed1.timeline.length > 0
          ? parsed1.timeline
          : baselineFallback.timeline,
      rootCauses:
        Array.isArray(parsed2?.rootCauses) && parsed2.rootCauses.length > 0
          ? parsed2.rootCauses
          : baselineFallback.rootCauses,
      nextSteps:
        Array.isArray(parsed2?.nextSteps) && parsed2.nextSteps.length > 0
          ? parsed2.nextSteps
          : baselineFallback.nextSteps,
      postmortemMarkdown:
        typeof parsed2?.postmortemMarkdown === "string" &&
        parsed2.postmortemMarkdown.length > 40
          ? parsed2.postmortemMarkdown
          : baselineFallback.postmortemMarkdown,
      telemetry: {
        mode: "live",
        gatewayProvider: "Mozilla Otari / any-llm Live Gateway",
        endpointUrl: endpoint,
        model1: {
          id: model1,
          role: "Incident Summarizer & Severity Classifier",
          latencyMs: latencyM1,
          promptTokens:
            data1?.usage?.prompt_tokens ||
            baselineFallback.telemetry.model1.promptTokens,
          completionTokens:
            data1?.usage?.completion_tokens ||
            baselineFallback.telemetry.model1.completionTokens,
          status: "completed",
        },
        model2: {
          id: model2,
          role: "Root-Cause & Remediation Planner",
          latencyMs: latencyM2,
          promptTokens:
            data2?.usage?.prompt_tokens ||
            baselineFallback.telemetry.model2.promptTokens,
          completionTokens:
            data2?.usage?.completion_tokens ||
            baselineFallback.telemetry.model2.completionTokens,
          status: "completed",
        },
        totalDurationMs: Date.now() - startTotal,
        timestampIso: new Date().toISOString(),
      },
    };
  } catch {
    // Graceful fallback if live endpoint fails or times out
    return {
      ...baselineFallback,
      telemetry: {
        ...baselineFallback.telemetry,
        mode: "mock",
        gatewayProvider:
          "Mozilla Otari / any-llm Gateway (Auto-Fallback to Mock)",
        endpointUrl: endpoint,
        model1: {
          ...baselineFallback.telemetry.model1,
          id: model1,
          status: "fallback-mock",
        },
        model2: {
          ...baselineFallback.telemetry.model2,
          id: model2,
          status: "fallback-mock",
        },
      },
    };
  }
}

function safeParseJson(raw: string): Record<string, any> | null {
  try {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    return JSON.parse(cleaned);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
