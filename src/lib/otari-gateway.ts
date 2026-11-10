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

// ---------------------------------------------------------------------------
// Otari feature: routing policy with cross-model fallback + per-key budget cap
// ---------------------------------------------------------------------------
// Stage routing policy: Stage 1 (classification) is routed to the fast
// instruction-tuned model; Stage 2 (root-cause planning) is routed to the
// code-specialized model. If the routed model fails or times out, the same
// stage is retried once on the OTHER model through the same Otari gateway -
// a real fallback policy executed per-request, recorded in telemetry.

const MODEL_PRICE_PER_MILLION_USD: Record<string, { in: number; out: number }> = {
  "meta/llama-3.3-70b-instruct": { in: 0.1, out: 0.32 },
  "alibaba/qwen3-coder-30b-a3b-instruct": { in: 0.07, out: 0.28 },
};
const DEFAULT_PRICE_PER_MILLION_USD = { in: 0.25, out: 0.75 };

// Per-key budget cap: the Otari API key used by this app is limited to this
// spend per server session. 0 disables the cap. Overridable via env.
const BUDGET_CAP_USD = Number(process.env.OTARI_BUDGET_USD || "0.25");
const sessionSpendUsd = { total: 0 };

function estimateStageCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const price = MODEL_PRICE_PER_MILLION_USD[model] || DEFAULT_PRICE_PER_MILLION_USD;
  return (promptTokens * price.in + completionTokens * price.out) / 1_000_000;
}

class BudgetExceededError extends Error {
  constructor(
    public readonly spentUsd: number,
    public readonly capUsd: number,
    public readonly source: "local-counter" | "otari-server" = "local-counter",
    detail?: string
  ) {
    super(
      source === "otari-server"
        ? `Otari server enforced the key budget: ${detail || "budget exceeded"}`
        : `Otari key budget cap reached: $${spentUsd.toFixed(4)} of $${capUsd.toFixed(2)}`
    );
  }
}

function looksLikeBudgetRejection(status: number, body: string): boolean {
  if (status === 402) return true;
  if (status !== 403 && status !== 429 && status !== 400) return false;
  return /budget|ceiling|spend|insufficient|balance/i.test(body);
}

// Otari built-in Web Search (otari_web_search, tavily backend) - server-side
// search API. Stage 1's error signatures are searched and the top results are
// injected into Stage 2's prompt, so the remediation plan cites current docs.
async function otariWebSearch(opts: {
  baseUrl: string;
  apiKey: string;
  query: string;
  maxResults: number;
  timeoutMs: number;
}): Promise<{ results: { title: string; url: string; snippet: string }[]; tool: string } | null> {
  try {
    const res = await fetch(`${opts.baseUrl}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
        "Otari-Key": opts.apiKey,
      },
      body: JSON.stringify({ query: opts.query, max_results: opts.maxResults }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results = Array.isArray(data?.results) ? data.results : [];
    return {
      results: results.slice(0, opts.maxResults).map((r: any) => ({
        title: String(r?.title || "").slice(0, 140),
        url: String(r?.url || "").slice(0, 300),
        snippet: String(r?.snippet || "").slice(0, 400),
      })),
      tool: String(data?.search_tool || "otari_web_search"),
    };
  } catch {
    return null;
  }
}

interface GatewayCallOutcome {
  data: any;
  modelUsed: string;
  servedModel?: string;
  latencyMs: number;
  fellBack: boolean;
}

async function callGatewayWithFallback(opts: {
  endpoint: string;
  apiKey: string;
  primaryModel: string;
  fallbackModel: string;
  temperature: number;
  system: string;
  user: string;
  timeoutMs: number;
  stageLabel: string;
  fallbackEvents: string[];
}): Promise<GatewayCallOutcome> {
  if (BUDGET_CAP_USD > 0 && sessionSpendUsd.total >= BUDGET_CAP_USD) {
    throw new BudgetExceededError(sessionSpendUsd.total, BUDGET_CAP_USD);
  }
  const attempt = async (model: string) => {
    const start = Date.now();
    const res = await fetch(opts.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: opts.temperature,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      if (looksLikeBudgetRejection(res.status, errBody)) {
        throw new BudgetExceededError(
          sessionSpendUsd.total,
          BUDGET_CAP_USD,
          "otari-server",
          `HTTP ${res.status}: ${errBody.slice(0, 200)}`
        );
      }
      throw new Error(`${opts.stageLabel} on ${model}: HTTP ${res.status} ${errBody.slice(0, 120)}`);
    }
    return { data: await res.json(), latencyMs: Date.now() - start };
  };

  try {
    const r = await attempt(opts.primaryModel);
    const u = r.data?.usage || {};
    sessionSpendUsd.total += estimateStageCostUsd(
      opts.primaryModel, u.prompt_tokens || 0, u.completion_tokens || 0
    );
    return { data: r.data, modelUsed: opts.primaryModel, servedModel: r.data?.model, latencyMs: r.latencyMs, fellBack: false };
  } catch (primaryErr) {
    if (primaryErr instanceof BudgetExceededError) throw primaryErr;
    // Fallback: retry the same stage on the other model via the same gateway.
    if (BUDGET_CAP_USD > 0 && sessionSpendUsd.total >= BUDGET_CAP_USD) {
      throw new BudgetExceededError(sessionSpendUsd.total, BUDGET_CAP_USD);
    }
    const r = await attempt(opts.fallbackModel);
    const u = r.data?.usage || {};
    sessionSpendUsd.total += estimateStageCostUsd(
      opts.fallbackModel, u.prompt_tokens || 0, u.completion_tokens || 0
    );
    opts.fallbackEvents.push(
      `${opts.stageLabel}: ${opts.primaryModel} failed (${primaryErr instanceof Error ? primaryErr.message : "error"}); retried on ${opts.fallbackModel} via Otari gateway`
    );
    return { data: r.data, modelUsed: opts.fallbackModel, servedModel: r.data?.model, latencyMs: r.latencyMs, fellBack: true };
  }
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
    // Stage 1 routes through the Otari workspace routing policy
    // "signal-room-triage" (dashboard > Routing): the gateway serves it with
    // Llama-3.3-70B on Bedrock and falls back to Qwen3-Coder-30B server-side.
    model1Default: process.env.OTARI_MODEL_1 || "signal-room-triage",
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

    const fallbackEvents: string[] = [];
    void startM1;
    const call1 = await callGatewayWithFallback({
      endpoint,
      apiKey: effectiveApiKey,
      primaryModel: model1,
      fallbackModel: model2,
      temperature: 0.1,
      system:
        "You are an expert SRE incident classifier. Always respond with raw valid JSON only.",
      user: stage1Prompt,
      timeoutMs: 25000,
      stageLabel: "Stage 1 (classify)",
      fallbackEvents,
    });
    const data1 = call1.data;
    const latencyM1 = call1.latencyMs;
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

    // OTARI WEB SEARCH (otari_web_search): search current web/runbooks for the
    // top error signature, then feed results into Stage 2's planning prompt.
    const sigs: string[] =
      Array.isArray(parsed1?.errorSignatures) && parsed1.errorSignatures.length > 0
        ? parsed1.errorSignatures.slice(0, 2)
        : baselineFallback.errorSignatures.slice(0, 2);
    const svc: string =
      (Array.isArray(parsed1?.affectedServices) && parsed1.affectedServices[0]) ||
      baselineFallback.affectedServices[0] ||
      "production service";
    const searchQuery = `${svc} ${sigs[0] || "outage"} runbook remediation`;
    const search = await otariWebSearch({
      baseUrl: effectiveBaseUrl,
      apiKey: effectiveApiKey,
      query: searchQuery,
      maxResults: 5,
      timeoutMs: 15000,
    });
    if (search) {
      fallbackEvents.push(
        `Otari web search (${search.tool}): "${searchQuery}" -> ${search.results.length} results injected into Stage 2`
      );
    } else {
      fallbackEvents.push(
        `Otari web search unavailable for "${searchQuery}"; Stage 2 proceeded without web context`
      );
    }
    const webContext =
      search && search.results.length > 0
        ? `

CURRENT WEB CONTEXT (via Otari otari_web_search, query: "${searchQuery}"):
` +
          search.results
            .slice(0, 3)
            .map((r, i) => `${i + 1}. ${r.title} - ${r.url}\n   ${r.snippet}`)
            .join("\n") +
          `\nUse this current documentation to ground the remediation commands.\n`
        : "";

    // STAGE 2: Model 2 (Root-Cause Hypotheses + Remediation Runbook + Postmortem Draft)
    const startM2 = Date.now();
    const stage2Prompt = `You are Model 2 (Root-Cause & Remediation Planner) in Signal Room, an incident-triage copilot.
Model 1 (${model1}) classified this incident as ${stage1Severity}: "${stage1Summary}".
${webContext}

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

    const call2 = await callGatewayWithFallback({
      endpoint,
      apiKey: effectiveApiKey,
      primaryModel: model2,
      fallbackModel: model1,
      temperature: 0.2,
      system:
        "You are an expert Staff SRE remediation planner. Always respond with raw valid JSON only.",
      user: stage2Prompt,
      timeoutMs: 30000,
      stageLabel: "Stage 2 (plan)",
      fallbackEvents,
    });
    const data2 = call2.data;
    const latencyM2 = call2.latencyMs;
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
        routingPolicy:
          "Otari workspace routing policy 'signal-room-triage' (Llama-3.3-70B Bedrock -> Qwen3-Coder-30B Bedrock, server-side) + in-app cross-model retry on failure",
        fallbackEvents: fallbackEvents.length ? fallbackEvents : undefined,
        webSearch: search
          ? {
              tool: `${search.tool} (Otari otari_web_search)`,
              query: searchQuery,
              resultCount: search.results.length,
              topResults: search.results.slice(0, 3).map((r) => ({ title: r.title, url: r.url })),
              usedInStage: "Stage 2 (root-cause & remediation) prompt",
            }
          : undefined,
        budget: {
          capUsd: BUDGET_CAP_USD > 0 ? BUDGET_CAP_USD : null,
          sessionSpentUsd: Number(sessionSpendUsd.total.toFixed(6)),
          exceeded: false,
        },
        model1: {
          id: call1.servedModel || call1.modelUsed,
          role: `Incident Summarizer & Severity Classifier (requested: ${call1.modelUsed})`,
          latencyMs: latencyM1,
          promptTokens:
            data1?.usage?.prompt_tokens ||
            baselineFallback.telemetry.model1.promptTokens,
          completionTokens:
            data1?.usage?.completion_tokens ||
            baselineFallback.telemetry.model1.completionTokens,
          status: call1.fellBack ? "completed-via-fallback" : "completed",
        },
        model2: {
          id: call2.servedModel || call2.modelUsed,
          role: `Root-Cause & Remediation Planner (requested: ${call2.modelUsed})`,
          latencyMs: latencyM2,
          promptTokens:
            data2?.usage?.prompt_tokens ||
            baselineFallback.telemetry.model2.promptTokens,
          completionTokens:
            data2?.usage?.completion_tokens ||
            baselineFallback.telemetry.model2.completionTokens,
          status: call2.fellBack ? "completed-via-fallback" : "completed",
        },
        totalDurationMs: Date.now() - startTotal,
        timestampIso: new Date().toISOString(),
      },
    };
  } catch (err) {
    const budgetHit = err instanceof BudgetExceededError;
    // Graceful fallback if live endpoint fails, times out, or the key budget cap is hit
    return {
      ...baselineFallback,
      telemetry: {
        ...baselineFallback.telemetry,
        mode: "mock",
        budget: {
          capUsd: BUDGET_CAP_USD > 0 ? BUDGET_CAP_USD : null,
          sessionSpentUsd: Number(sessionSpendUsd.total.toFixed(6)),
          exceeded: budgetHit,
        },
        fallbackEvents: budgetHit
          ? [err instanceof BudgetExceededError && err.source === "otari-server"
              ? `Otari server rejected the call: ${err.message}. Signal Room caught the rejection and served the deterministic fallback instead of failing the triage.`
              : `Budget cap enforced: live calls stopped at $${sessionSpendUsd.total.toFixed(4)} of $${BUDGET_CAP_USD.toFixed(2)}; served deterministic fallback instead of spending more.`]
          : [`Live gateway call failed (${err instanceof Error ? err.message : "error"}); served deterministic fallback.`],
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
