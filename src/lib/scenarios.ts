import type {
  GatewayTelemetry,
  RemediationStep,
  RootCauseHypothesis,
  TimelineEvent,
} from "@/db/schema";

export interface PresetScenario {
  key: string;
  name: string;
  shortLabel: string;
  badgeSeverity: "SEV-1" | "SEV-2" | "SEV-3";
  category: string;
  description: string;
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

export const MODEL_1_ID = "meta/llama-3.3-70b-instruct";
export const MODEL_2_ID = "alibaba/qwen3-coder-30b-a3b-instruct";

export const PRESET_SCENARIOS: PresetScenario[] = [
  {
    key: "redis-pool-exhaustion",
    name: "Redis Connection Pool Exhaustion",
    shortLabel: "Redis Pool Exhaustion",
    badgeSeverity: "SEV-1",
    category: "Data Tier / Session Store",
    description:
      "Cascading connection pool starvation on primary Redis cluster following auth-service v2.14.0 rollout.",
    incidentCode: "INC-4092",
    title: "Auth-Service Redis Pool Starvation & API Gateway 504 Cascade",
    rawLogs: `2026-03-29T14:01:12.104Z [INFO]  [deploy-controller] Rollout completed: service=auth-service image=ghcr.io/otari/auth-service:v2.14.0 replicas=12/12
2026-03-29T14:02:45.882Z [WARN]  [auth-service-7f9b8c-x2k9p] redis_pool_utilization=88% active_conns=880 max_conns=1000 wait_queue=142
2026-03-29T14:03:09.310Z [WARN]  [redis-cluster-01] client_connected=994 maxclients=1000 evicted_keys=0blocked_clients=67
2026-03-29T14:03:18.004Z [ERROR] [auth-service-7f9b8c-x2k9p] RedisTimeoutError: PoolAcquireTimeout: Unable to acquire connection from pool within 2500ms (tx_pipeline_unclosed=true)
2026-03-29T14:03:19.412Z [CRITICAL] [redis-cluster-01] ERR max number of clients reached (maxclients=1000) - rejecting new TCP handshake from 10.24.18.92
2026-03-29T14:03:22.771Z [ERROR] [api-gateway-edge-04] upstream timed out (110: Connection timed out) while reading response header from upstream: http://auth-service.prod.svc:8080/v1/session/verify
2026-03-29T14:03:35.919Z [CRITICAL] [datadog-monitor] ALERT [P1]: Edge API 5xx error rate breached 34.8% threshold (current=41.2%, p99_latency=4890ms)
2026-03-29T14:04:02.115Z [ERROR] [checkout-service-5c4d1a] SessionValidationFailed: upstream auth-service returned HTTP 504 Gateway Timeout for 1,840 concurrent requests`,
    severity: "SEV-1",
    confidence: 96,
    summary:
      "A connection leak introduced in auth-service v2.14.0 (`tx_pipeline_unclosed=true`) rapidly saturated the 1,000-client ceiling on `redis-cluster-01` within 2 minutes of deployment. Because `/v1/session/verify` blocks on Redis pool acquisition, API Gateway and Checkout requests are failing with HTTP 504 timeouts at a 41.2% error rate.",
    blastRadius:
      "41.2% of global authenticated API traffic; checkout session verification failing with p99 latency at 4,890ms.",
    affectedServices: [
      "auth-service",
      "redis-cluster-01",
      "api-gateway-edge",
      "checkout-service",
    ],
    errorSignatures: [
      "RedisTimeoutError: PoolAcquireTimeout (2500ms)",
      "ERR max number of clients reached (maxclients=1000)",
      "HTTP 504 Gateway Timeout on /v1/session/verify",
    ],
    timeline: [
      {
        id: "tl-1",
        timestamp: "14:01:12 UTC",
        service: "deploy-controller",
        level: "INFO",
        event:
          "Rollout of auth-service:v2.14.0 completed across all 12 production pods.",
        rawSnippet:
          "Rollout completed: service=auth-service image=ghcr.io/otari/auth-service:v2.14.0 replicas=12/12",
        isTrigger: true,
      },
      {
        id: "tl-2",
        timestamp: "14:02:45 UTC",
        service: "auth-service",
        level: "WARN",
        event:
          "Redis connection pool utilization spiked to 88% (880/1000 active) with 142 requests queued.",
        rawSnippet:
          "redis_pool_utilization=88% active_conns=880 max_conns=1000 wait_queue=142",
      },
      {
        id: "tl-3",
        timestamp: "14:03:18 UTC",
        service: "auth-service",
        level: "ERROR",
        event:
          "PoolAcquireTimeout after 2500ms; diagnostic flag indicates unclosed Redis transaction pipeline (`tx_pipeline_unclosed=true`).",
        rawSnippet:
          "RedisTimeoutError: PoolAcquireTimeout: Unable to acquire connection from pool within 2500ms (tx_pipeline_unclosed=true)",
      },
      {
        id: "tl-4",
        timestamp: "14:03:19 UTC",
        service: "redis-cluster-01",
        level: "CRITICAL",
        event:
          "Primary Redis node hit hard `maxclients=1000` ceiling, rejecting new TCP handshakes from auth pods.",
        rawSnippet:
          "ERR max number of clients reached (maxclients=1000) - rejecting new TCP handshake from 10.24.18.92",
      },
      {
        id: "tl-5",
        timestamp: "14:03:35 UTC",
        service: "api-gateway-edge",
        level: "CRITICAL",
        event:
          "P1 Alert triggered: Global 5xx error rate reached 41.2% with p99 latency at 4,890ms.",
        rawSnippet:
          "ALERT [P1]: Edge API 5xx error rate breached 34.8% threshold (current=41.2%, p99_latency=4890ms)",
      },
      {
        id: "tl-6",
        timestamp: "14:04:02 UTC",
        service: "checkout-service",
        level: "ERROR",
        event:
          "Cascading failure into checkout flow: 1,840 concurrent checkout sessions failed validation.",
        rawSnippet:
          "SessionValidationFailed: upstream auth-service returned HTTP 504 Gateway Timeout for 1,840 concurrent requests",
      },
    ],
    rootCauses: [
      {
        id: "rc-1",
        rank: 1,
        title: "Unclosed Redis Multi/Exec Pipeline in auth-service v2.14.0",
        probability: 94,
        category: "Code Regression / Resource Leak",
        mechanism:
          "Release v2.14.0 introduced a Redis transaction pipeline during session token refresh that omits `.release()` or `finally` cleanup on early return paths, leaking connections until `maxclients=1000` is exhausted across 12 pods.",
        supportingEvidence: [
          "14:01:12Z Rollout completed: service=auth-service:v2.14.0",
          "14:03:18Z PoolAcquireTimeout ... (tx_pipeline_unclosed=true)",
        ],
        verificationCommand:
          "redis-cli -h redis-cluster-01.prod CLIENT LIST | awk '{print $4, $8}' | sort | uniq -c | sort -nr | head -n 10",
      },
      {
        id: "rc-2",
        rank: 2,
        title: "Uncapped Per-Pod Pool Size Exceeding Redis `maxclients` Ceiling",
        probability: 78,
        category: "Configuration Drift",
        mechanism:
          "12 replicas of auth-service each configured with `MAX_POOL_SIZE=100` can collectively open 1,200 connections, exceeding the Redis instance limit of `maxclients=1000` even without leaks under peak load.",
        supportingEvidence: [
          "14:01:12Z replicas=12/12",
          "14:03:19Z ERR max number of clients reached (maxclients=1000)",
        ],
        verificationCommand:
          "kubectl get deploy auth-service -n prod -o jsonpath='{.spec.template.spec.containers[0].env}' | jq .",
      },
      {
        id: "rc-3",
        rank: 3,
        title: "Missing Circuit Breaker & Local JWT Fallback on `/v1/session/verify`",
        probability: 61,
        category: "Resilience Architecture",
        mechanism:
          "Session verification synchronously blocks on Redis revocation lookup for 2,500ms rather than degrading gracefully to stateless JWT signature validation when Redis latency exceeds 150ms.",
        supportingEvidence: [
          "14:03:22Z upstream timed out while reading response header from http://auth-service.prod.svc:8080/v1/session/verify",
        ],
        verificationCommand:
          "curl -s http://auth-service.prod.svc:8080/metrics | grep -E 'circuit_breaker|redis_pool'",
      },
    ],
    nextSteps: [
      {
        id: "ns-1",
        phase: "IMMEDIATE",
        title: "Roll back auth-service to last known good release (v2.13.9)",
        rationale:
          "Immediately stops the `tx_pipeline_unclosed=true` connection leak introduced at 14:01:12Z and drains orphaned TCP sockets.",
        command:
          "kubectl rollout undo deployment/auth-service -n prod && kubectl rollout status deployment/auth-service -n prod",
        rollbackNote:
          "v2.13.9 uses identical DB/Redis schema; safe zero-migration rollback.",
        completed: false,
        ownerRole: "Incident Commander / SRE",
      },
      {
        id: "ns-2",
        phase: "IMMEDIATE",
        title: "Purge idle orphaned client connections on redis-cluster-01",
        rationale:
          "Frees connection slots stuck in `idle > 30s` state from terminated or wedged auth-service pods.",
        command:
          "redis-cli -h redis-cluster-01.prod CLIENT KILL TYPE normal IDLETIME 30",
        rollbackNote:
          "Active healthy requests automatically reconnect on next command retry.",
        completed: false,
        ownerRole: "Database Reliability Engineer",
      },
      {
        id: "ns-3",
        phase: "STABILIZE",
        title: "Raise Redis `maxclients` buffer and cap per-pod pool size to 50",
        rationale:
          "Prevents 12 replicas (12 × 50 = 600 conns) from ever starving the cluster ceiling (`maxclients=2500`).",
        command:
          "redis-cli -h redis-cluster-01.prod CONFIG SET maxclients 2500 && kubectl set env deployment/auth-service -n prod REDIS_POOL_MAX=50",
        rollbackNote:
          "Revert via `CONFIG SET maxclients 1000` if Redis memory overhead exceeds 75%.",
        completed: false,
        ownerRole: "Platform Infra Lead",
      },
      {
        id: "ns-4",
        phase: "PREVENT",
        title: "Enforce `try/finally` connection release lint rule & stateless JWT circuit breaker",
        rationale:
          "Ensures unclosed pipelines fail CI builds and allows `/v1/session/verify` to fall back to stateless cryptographic verification if Redis latency breaches 200ms.",
        command:
          "git revert --no-edit HEAD && npm run test:integration -- --grep 'redis pool leak'",
        rollbackNote: "Standard PR review gate prior to re-attempting v2.14.1.",
        completed: false,
        ownerRole: "Auth Service Maintainer",
      },
    ],
    postmortemMarkdown: `# Blameless Postmortem: INC-4092 — Auth-Service Redis Pool Starvation

**Date:** 2026-03-29  
**Severity:** SEV-1 (Critical)  
**Status:** Mitigated / Postmortem Draft  
**AI Triage Pipeline:** \`meta/llama-3.3-70b-instruct\` (Classifier) + \`alibaba/qwen3-coder-30b-a3b-instruct\` (Remediation) via Mozilla Otari \`any-llm\` Gateway

---

## 1. Executive Summary
On March 29, 2026 at 14:01 UTC, deployment of \`auth-service:v2.14.0\` introduced an unclosed Redis transaction pipeline (\`tx_pipeline_unclosed=true\`) during session token verification. Within 127 seconds, all 1,000 available client connections on \`redis-cluster-01\` were exhausted, causing \`/v1/session/verify\` calls to block for 2,500ms before failing. This triggered a cascading HTTP 504 outage across \`api-gateway-edge\` and \`checkout-service\`, impacting 41.2% of authenticated traffic.

## 2. Customer & System Impact
- **Peak Error Rate:** 41.2% HTTP 5xx at API Edge (threshold: 34.8%)
- **Latency Degradation:** p99 latency surged to 4,890ms
- **Checkout Impact:** 1,840 concurrent checkout session validations failed
- **Detection to Triage Time:** < 3 minutes via Signal Room dual-model telemetry analysis

## 3. Chronological Timeline (UTC)
- **14:01:12** — \`deploy-controller\` completes rollout of \`auth-service:v2.14.0\` across 12 replicas.
- **14:02:45** — \`auth-service\` logs warning: Redis pool utilization hits 88% (880/1000 conns), wait queue reaches 142.
- **14:03:18** — \`PoolAcquireTimeout\` errors begin firing with diagnostic tag \`tx_pipeline_unclosed=true\`.
- **14:03:19** — \`redis-cluster-01\` reaches hard ceiling (\`maxclients=1000\`) and rejects new TCP connections.
- **14:03:35** — Datadog P1 monitor triggers on 41.2% Edge 5xx rate.
- **14:04:02** — \`checkout-service\` reports 1,840 failed session validations due to upstream 504 timeouts.

## 4. Root Cause & Contributing Factors
1. **Primary Root Cause:** An early return branch in \`SessionVerifier.verifyAndTouch()\` created a dedicated Redis \`MULTI\` pipeline connection without releasing it in a \`finally\` block.
2. **Contributing Factor 1 (Capacity Math):** 12 pods configured with 100 max pool connections allowed a theoretical demand of 1,200 connections against a Redis ceiling of 1,000.
3. **Contributing Factor 2 (Tight Coupling):** \`/v1/session/verify\` lacked a fast-fail circuit breaker to fall back to stateless JWT signature validation when Redis revocation checks time out.

## 5. Action Items
| Priority | Action Item | Owner | Target |
| :--- | :--- | :--- | :--- |
| **P0** | Roll back \`auth-service\` to \`v2.13.9\` and kill orphaned Redis clients | SRE On-Call | Immediate |
| **P0** | Cap \`REDIS_POOL_MAX=50\` per pod and set Redis \`maxclients=2500\` | Infra Lead | Today |
| **P1** | Patch pipeline leak in \`v2.14.1\` with \`using\` / \`try-finally\` resource guard | Auth Team | +24h |
| **P2** | Add 150ms circuit breaker fallback to stateless JWT check on Redis timeout | Auth Team | +1 Week |`,
    telemetry: {
      mode: "mock",
      gatewayProvider: "Mozilla Otari / any-llm Gateway (Deterministic Mock)",
      endpointUrl: "https://otari.ai/api/v1/chat/completions",
      model1: {
        id: MODEL_1_ID,
        role: "Incident Summarizer & Severity Classifier",
        latencyMs: 640,
        promptTokens: 518,
        completionTokens: 342,
        status: "completed",
      },
      model2: {
        id: MODEL_2_ID,
        role: "Root-Cause & Remediation Planner",
        latencyMs: 890,
        promptTokens: 860,
        completionTokens: 715,
        status: "completed",
      },
      totalDurationMs: 1530,
      timestampIso: "2026-03-29T14:04:30.000Z",
    },
  },
  {
    key: "stripe-webhook-signature",
    name: "Payment Webhook Signature Failure",
    shortLabel: "Webhook HMAC Failure",
    badgeSeverity: "SEV-2",
    category: "Payments / Secret Rotation",
    description:
      "Stripe webhook HMAC-SHA256 verification failures stalling order fulfillment after Vault secret rotation.",
    incidentCode: "INC-4108",
    title: "Billing-Webhook Stripe HMAC Signature Mismatch & Order Queue Stall",
    rawLogs: `2026-03-29T16:10:00.012Z [INFO]  [vault-agent-sidecar] Secret rotated: path=secret/data/prod/stripe/webhook_secret version=19 -> version=20
2026-03-29T16:10:04.450Z [WARN]  [billing-webhook-6d8a9f-m4p2x] EnvReloadSkipped: SIGHUP handler ignored STRIPE_WEBHOOK_SECRET update (cachedSingleton=true)
2026-03-29T16:10:19.108Z [ERROR] [billing-webhook-6d8a9f-m4p2x] StripeSignatureVerificationError: No signatures found matching the expected signature for payload (header=t=1743264619,v1=9a8f7c...)
2026-03-29T16:10:24.890Z [ERROR] [billing-webhook-6d8a9f-k9w1b] HTTP 400 Bad Request returned to Stripe Webhook Delivery (event_type=checkout.session.completed, evt_id=evt_3R8xK2L9)
2026-03-29T16:11:15.302Z [WARN]  [order-fulfillment-worker] QueueLagWarning: zero 'checkout.session.completed' events ingested in last 75s (expected_rate=42/min)
2026-03-29T16:12:01.774Z [CRITICAL] [pagerduty-bridge] ALERT [SEV-2]: Stripe webhook failure rate = 100% over 2m window (84 failed deliveries, paid orders stuck in PENDING_PAYMENT)`,
    severity: "SEV-2",
    confidence: 95,
    summary:
      "HashiCorp Vault rotated `secret/data/prod/stripe/webhook_secret` from v19 to v20 at 16:10:00Z, but `billing-webhook` pods cached the old secret in an in-memory singleton (`cachedSingleton=true`) and ignored `SIGHUP`. All incoming `checkout.session.completed` webhooks are failing HMAC-SHA256 signature verification with HTTP 400, leaving paid customer orders stuck in `PENDING_PAYMENT`.",
    blastRadius:
      "100% of asynchronous Stripe webhook deliveries failing (84 orders delayed in 2m); customer card charges succeed on Stripe, so Stripe's exponential backoff retry window prevents data loss.",
    affectedServices: [
      "billing-webhook",
      "vault-agent-sidecar",
      "order-fulfillment-worker",
    ],
    errorSignatures: [
      "StripeSignatureVerificationError: No signatures found matching the expected signature",
      "EnvReloadSkipped: SIGHUP handler ignored STRIPE_WEBHOOK_SECRET update",
      "QueueLagWarning: zero 'checkout.session.completed' events ingested",
    ],
    timeline: [
      {
        id: "tl-201",
        timestamp: "16:10:00 UTC",
        service: "vault-agent-sidecar",
        level: "INFO",
        event:
          "Vault rotated production Stripe webhook secret from version 19 to version 20.",
        rawSnippet:
          "Secret rotated: path=secret/data/prod/stripe/webhook_secret version=19 -> version=20",
        isTrigger: true,
      },
      {
        id: "tl-202",
        timestamp: "16:10:04 UTC",
        service: "billing-webhook",
        level: "WARN",
        event:
          "Application SIGHUP handler skipped reloading STRIPE_WEBHOOK_SECRET due to cached singleton client.",
        rawSnippet:
          "EnvReloadSkipped: SIGHUP handler ignored STRIPE_WEBHOOK_SECRET update (cachedSingleton=true)",
      },
      {
        id: "tl-203",
        timestamp: "16:10:19 UTC",
        service: "billing-webhook",
        level: "ERROR",
        event:
          "Stripe HMAC-SHA256 verification failed against incoming `v1` signature payload.",
        rawSnippet:
          "StripeSignatureVerificationError: No signatures found matching the expected signature for payload",
      },
      {
        id: "tl-204",
        timestamp: "16:11:15 UTC",
        service: "order-fulfillment-worker",
        level: "WARN",
        event:
          "Fulfillment throughput dropped to 0 events/min vs expected baseline of 42/min.",
        rawSnippet:
          "QueueLagWarning: zero 'checkout.session.completed' events ingested in last 75s (expected_rate=42/min)",
      },
      {
        id: "tl-205",
        timestamp: "16:12:01 UTC",
        service: "pagerduty-bridge",
        level: "CRITICAL",
        event:
          "SEV-2 Alert: 100% webhook rejection rate (84 failed deliveries); orders stuck in PENDING_PAYMENT.",
        rawSnippet:
          "ALERT [SEV-2]: Stripe webhook failure rate = 100% over 2m window (84 failed deliveries, paid orders stuck in PENDING_PAYMENT)",
      },
    ],
    rootCauses: [
      {
        id: "rc-201",
        rank: 1,
        title: "Stale In-Memory Webhook Secret Singleton After Vault Rotation",
        probability: 97,
        category: "Secret Management / Hot-Reload Bug",
        mechanism:
          "`billing-webhook` initializes the Stripe webhook verifier once at boot using `process.env.STRIPE_WEBHOOK_SECRET` and does not re-read the mounted Vault secret file when `SIGHUP` is received.",
        supportingEvidence: [
          "16:10:00Z Secret rotated: path=secret/data/prod/stripe/webhook_secret version=19 -> version=20",
          "16:10:04Z EnvReloadSkipped: SIGHUP handler ignored STRIPE_WEBHOOK_SECRET update (cachedSingleton=true)",
        ],
        verificationCommand:
          "kubectl logs -l app=billing-webhook -n prod --tail=50 | grep -E 'EnvReloadSkipped|StripeSignatureVerificationError'",
      },
      {
        id: "rc-202",
        rank: 2,
        title: "Single-Key Verification Without Dual-Secret Grace Window",
        probability: 83,
        category: "Zero-Downtime Secret Rotation Design",
        mechanism:
          "The webhook handler validates against a single secret string instead of an array of `[currentSecret, previousSecret]`, causing immediate failures whenever rotation occurs before all pods restart.",
        supportingEvidence: [
          "16:10:19Z StripeSignatureVerificationError: No signatures found matching the expected signature",
        ],
        verificationCommand:
          "vault kv metadata get secret/prod/stripe/webhook_secret",
      },
    ],
    nextSteps: [
      {
        id: "ns-201",
        phase: "IMMEDIATE",
        title: "Trigger rolling restart of `billing-webhook` deployment to pick up Vault secret v20",
        rationale:
          "Forces pods to re-initialize the singleton verifier with the freshly mounted v20 secret from Vault sidecar.",
        command:
          "kubectl rollout restart deployment/billing-webhook -n prod && kubectl rollout status deployment/billing-webhook -n prod",
        rollbackNote:
          "Rolling restart maintains 100% pod availability via PodDisruptionBudget.",
        completed: false,
        ownerRole: "Payments On-Call Engineer",
      },
      {
        id: "ns-202",
        phase: "STABILIZE",
        title: "Replay failed `checkout.session.completed` events from last 15 minutes via Stripe CLI",
        rationale:
          "Immediately clears the 84 stuck `PENDING_PAYMENT` orders without waiting for Stripe's 1-hour automated retry backoff.",
        command:
          "stripe events resend --type checkout.session.completed --created-gte 1743264600 --live",
        rollbackNote:
          "Idempotency keys (`evt_id`) in `order-fulfillment-worker` guarantee zero duplicate fulfillments.",
        completed: false,
        ownerRole: "Billing Ops Lead",
      },
      {
        id: "ns-203",
        phase: "PREVENT",
        title: "Implement dual-secret verifier ring `[v_current, v_previous]` and hot file watcher",
        rationale:
          "Allows zero-downtime secret rotation by validating against both v20 and v19 during a 24h overlap window.",
        command:
          "npm run test -- src/webhooks/__tests__/stripe-dual-secret.spec.ts",
        rollbackNote: "Falls back to primary secret if secondary is undefined.",
        completed: false,
        ownerRole: "Payments Platform Team",
      },
    ],
    postmortemMarkdown: `# Blameless Postmortem: INC-4108 — Stripe Webhook Signature Mismatch

**Date:** 2026-03-29  
**Severity:** SEV-2 (High)  
**Status:** Mitigated / Postmortem Draft  
**AI Triage Pipeline:** \`meta/llama-3.3-70b-instruct\` (Classifier) + \`alibaba/qwen3-coder-30b-a3b-instruct\` (Remediation) via Mozilla Otari \`any-llm\` Gateway

---

## 1. Executive Summary
At 16:10:00 UTC, an automated HashiCorp Vault rotation updated \`stripe/webhook_secret\` from version 19 to version 20. Because \`billing-webhook\` cached the signing secret in a startup singleton and ignored the sidecar \`SIGHUP\` reload signal, 100% of incoming Stripe webhook deliveries failed HMAC verification with HTTP 400. 84 customer orders were delayed in \`PENDING_PAYMENT\` state before pods were restarted and events replayed.

## 2. Customer & System Impact
- **Orders Delayed:** 84 paid checkouts held in \`PENDING_PAYMENT\` for ~4 minutes
- **Data Loss:** 0 lost orders (recovered via idempotent Stripe event replay)
- **Webhook Error Rate:** 100% HTTP 400 during the 2-minute detection window

## 3. Chronological Timeline (UTC)
- **16:10:00** — \`vault-agent-sidecar\` rotates \`secret/data/prod/stripe/webhook_secret\` to v20.
- **16:10:04** — \`billing-webhook\` logs \`EnvReloadSkipped\` due to \`cachedSingleton=true\`.
- **16:10:19** — First \`StripeSignatureVerificationError\` logged on \`checkout.session.completed\`.
- **16:11:15** — \`order-fulfillment-worker\` raises \`QueueLagWarning\` (0 events in 75s).
- **16:12:01** — PagerDuty SEV-2 alert triggers after 84 failed webhook deliveries.

## 4. Root Cause & Contributing Factors
1. **Primary Root Cause:** \`StripeWebhookVerifier\` cached \`STRIPE_WEBHOOK_SECRET\` at process startup and did not re-initialize on \`SIGHUP\`.
2. **Contributing Factor:** Secret rotation lacked a dual-key grace period (\`STRIPE_WEBHOOK_SECRET_PREVIOUS\`).

## 5. Action Items
| Priority | Action Item | Owner | Target |
| :--- | :--- | :--- | :--- |
| **P0** | Rolling restart \`billing-webhook\` and resend 84 failed events | Payments On-Call | Immediate |
| **P1** | Support dual-secret array verification \`[current, previous]\` | Payments Team | +48h |
| **P2** | Add integration test verifying \`SIGHUP\` secret reload in CI | Platform Sec | +1 Week |`,
    telemetry: {
      mode: "mock",
      gatewayProvider: "Mozilla Otari / any-llm Gateway (Deterministic Mock)",
      endpointUrl: "https://otari.ai/api/v1/chat/completions",
      model1: {
        id: MODEL_1_ID,
        role: "Incident Summarizer & Severity Classifier",
        latencyMs: 580,
        promptTokens: 462,
        completionTokens: 310,
        status: "completed",
      },
      model2: {
        id: MODEL_2_ID,
        role: "Root-Cause & Remediation Planner",
        latencyMs: 810,
        promptTokens: 772,
        completionTokens: 645,
        status: "completed",
      },
      totalDurationMs: 1390,
      timestampIso: "2026-03-29T16:12:30.000Z",
    },
  },
  {
    key: "k8s-oom-crashloop",
    name: "K8s OOMKilled Pod CrashLoop",
    shortLabel: "K8s OOM CrashLoop",
    badgeSeverity: "SEV-1",
    category: "Kubernetes / Compute Memory",
    description:
      "Vector ingestion worker pods hitting cgroup 4Gi memory ceiling (Exit Code 137) on unchunked 480MB PDF batch.",
    incidentCode: "INC-4115",
    title: "Embedding-Worker K8s OOMKilled (Exit 137) CrashLoopBackOff on Poison Batch",
    rawLogs: `2026-03-29T18:40:02.119Z [INFO]  [doc-ingest-queue] Dispatched batch_id=batch_99281 (doc_count=14, total_bytes=503316480, chunk_strategy=NONE) to embedding-worker-pool
2026-03-29T18:40:14.551Z [WARN]  [embedding-worker-9c4b2-p8z1q] MemoryPressureWarning: RSS=3892MB heap_used=3410MB cgroup_limit=4096MB batch_id=batch_99281
2026-03-29T18:40:16.002Z [CRITICAL] [kubelet-node-gpu-07] Memory cgroup out of memory: Killed process 41829 (python3) total-vm:8421300kB, anon-rss:4194104kB, file-rss:12400kB
2026-03-29T18:40:16.410Z [ERROR] [k8s-event-exporter] Pod embedding-worker-9c4b2-p8z1q terminated: Reason=OOMKilled ExitCode=137 (restartCount=6)
2026-03-29T18:40:18.905Z [WARN]  [doc-ingest-queue] Message visibility timeout expired for batch_id=batch_99281; redelivering to embedding-worker-9c4b2-v3m8n (attempt=7/10)
2026-03-29T18:40:31.220Z [CRITICAL] [k8s-event-exporter] Pod embedding-worker-9c4b2-v3m8n terminated: Reason=OOMKilled ExitCode=137 - entering CrashLoopBackOff (8/8 worker pods unhealthy)`,
    severity: "SEV-1",
    confidence: 98,
    summary:
      "A 480MB document ingestion payload (`batch_id=batch_99281`) was enqueued with `chunk_strategy=NONE`, causing `embedding-worker` pods to allocate >4.0GiB of anonymous RSS memory and get terminated by the Linux kernel OOM killer (`ExitCode=137`). Because the queue message is not acknowledged before pod death, `batch_99281` is repeatedly redelivered across the worker pool (`attempt=7/10`), knocking all 8/8 worker pods into `CrashLoopBackOff`.",
    blastRadius:
      "100% of RAG vector embedding & document indexing pipelines offline (8/8 worker pods in CrashLoopBackOff); poison pill message blocking 1,400 queued jobs.",
    affectedServices: [
      "embedding-worker",
      "doc-ingest-queue",
      "kubelet-node-gpu-07",
    ],
    errorSignatures: [
      "Memory cgroup out of memory: Killed process 41829 (python3)",
      "Terminated: Reason=OOMKilled ExitCode=137",
      "Poison message redelivery loop on batch_id=batch_99281 (chunk_strategy=NONE)",
    ],
    timeline: [
      {
        id: "tl-301",
        timestamp: "18:40:02 UTC",
        service: "doc-ingest-queue",
        level: "INFO",
        event:
          "Unchunked 480MB batch (`batch_id=batch_99281`, `chunk_strategy=NONE`) dispatched to worker pool.",
        rawSnippet:
          "Dispatched batch_id=batch_99281 (doc_count=14, total_bytes=503316480, chunk_strategy=NONE)",
        isTrigger: true,
      },
      {
        id: "tl-302",
        timestamp: "18:40:14 UTC",
        service: "embedding-worker",
        level: "WARN",
        event:
          "Worker RSS memory climbed to 3,892MB against a 4,096MB cgroup limit while processing `batch_99281`.",
        rawSnippet:
          "MemoryPressureWarning: RSS=3892MB heap_used=3410MB cgroup_limit=4096MB batch_id=batch_99281",
      },
      {
        id: "tl-303",
        timestamp: "18:40:16 UTC",
        service: "kubelet-node-gpu-07",
        level: "CRITICAL",
        event:
          "Kernel cgroup OOM killer terminated `python3` worker process at 4,194MB RSS (ExitCode=137).",
        rawSnippet:
          "Memory cgroup out of memory: Killed process 41829 (python3) ... Reason=OOMKilled ExitCode=137",
      },
      {
        id: "tl-304",
        timestamp: "18:40:18 UTC",
        service: "doc-ingest-queue",
        level: "WARN",
        event:
          "Visibility timeout expired on crashed pod; poison batch redelivered to next healthy worker (attempt 7/10).",
        rawSnippet:
          "Message visibility timeout expired for batch_id=batch_99281; redelivering to embedding-worker-9c4b2-v3m8n",
      },
      {
        id: "tl-305",
        timestamp: "18:40:31 UTC",
        service: "k8s-event-exporter",
        level: "CRITICAL",
        event:
          "Second worker pod OOMKilled; entire 8-pod worker fleet now in CrashLoopBackOff.",
        rawSnippet:
          "Pod embedding-worker-9c4b2-v3m8n terminated: Reason=OOMKilled ExitCode=137 - entering CrashLoopBackOff (8/8 worker pods unhealthy)",
      },
    ],
    rootCauses: [
      {
        id: "rc-301",
        rank: 1,
        title: "Poison-Pill Redelivery Loop on Unchunked 480MB Batch (`batch_99281`)",
        probability: 96,
        category: "Queue Poison Message / Memory Spike",
        mechanism:
          "`batch_id=batch_99281` bypassed pre-ingestion document chunking (`chunk_strategy=NONE`). Loading 503MB of raw PDF tensors into RAM expands ~8x in Python heap, breaching the 4Gi container limit and killing each worker that picks up the redelivered message.",
        supportingEvidence: [
          "18:40:02Z Dispatched batch_id=batch_99281 (total_bytes=503316480, chunk_strategy=NONE)",
          "18:40:18Z redelivering to embedding-worker-9c4b2-v3m8n (attempt=7/10)",
        ],
        verificationCommand:
          "kubectl describe pod -l app=embedding-worker -n prod | grep -A 6 'Last State:'",
      },
      {
        id: "rc-302",
        rank: 2,
        title: "High Queue `maxReceiveCount=10` Allowing Fleet-Wide Crash Cascade",
        probability: 84,
        category: "Queue Resilience Config",
        mechanism:
          "With 8 worker replicas and `maxReceiveCount=10` before Dead-Letter Queue (DLQ) eviction, a single OOM-inducing message crashes every pod in the replica set before being quarantined.",
        supportingEvidence: [
          "18:40:18Z redelivering ... (attempt=7/10)",
          "18:40:31Z entering CrashLoopBackOff (8/8 worker pods unhealthy)",
        ],
        verificationCommand:
          "redis-cli -h ingest-queue.prod HGETALL 'queue:batch_99281:meta'",
      },
    ],
    nextSteps: [
      {
        id: "ns-301",
        phase: "IMMEDIATE",
        title: "Quarantine poison payload `batch_99281` to Dead-Letter Queue (DLQ)",
        rationale:
          "Breaks the OOM redelivery loop immediately so restarting worker pods can drain the remaining healthy queue backlog.",
        command:
          "redis-cli -h ingest-queue.prod SMOVE ingest:active:batches ingest:dlq:batches batch_99281",
        rollbackNote:
          "Payload remains preserved in `ingest:dlq:batches` for chunked reprocessing.",
        completed: false,
        ownerRole: "ML Platform On-Call",
      },
      {
        id: "ns-302",
        phase: "IMMEDIATE",
        title: "Reset CrashLoopBackOff timers by rolling restart of `embedding-worker`",
        rationale:
          "Restores all 8 worker pods immediately rather than waiting 5+ minutes for exponential Kubernetes backoff timers.",
        command:
          "kubectl rollout restart deployment/embedding-worker -n prod && kubectl rollout status deployment/embedding-worker -n prod",
        rollbackNote: "Safe once `batch_99281` is moved out of active queue.",
        completed: false,
        ownerRole: "Kubernetes SRE",
      },
      {
        id: "ns-303",
        phase: "PREVENT",
        title: "Enforce 25MB max payload admission guard & lower DLQ `maxReceiveCount` to 2",
        rationale:
          "Rejects `chunk_strategy=NONE` batches >25MB at producer API and quarantines any crashing job after 2 retries.",
        command:
          "kubectl set env deployment/embedding-worker -n prod MAX_BATCH_BYTES=26214400 DLQ_MAX_RECEIVES=2",
        rollbackNote: "Oversized batches will automatically trigger streaming chunker.",
        completed: false,
        ownerRole: "Ingestion Pipeline Maintainer",
      },
    ],
    postmortemMarkdown: `# Blameless Postmortem: INC-4115 — K8s OOMKilled Worker Fleet CrashLoop

**Date:** 2026-03-29  
**Severity:** SEV-1 (Critical)  
**Status:** Mitigated / Postmortem Draft  
**AI Triage Pipeline:** \`meta/llama-3.3-70b-instruct\` (Classifier) + \`alibaba/qwen3-coder-30b-a3b-instruct\` (Remediation) via Mozilla Otari \`any-llm\` Gateway

---

## 1. Executive Summary
At 18:40:02 UTC, a 480MB unchunked document batch (\`batch_id=batch_99281\`, \`chunk_strategy=NONE\`) was dispatched to the \`embedding-worker\` fleet. Processing the unchunked batch consumed >4.0GiB of RAM, triggering the Linux cgroup OOM killer (\`ExitCode=137\`). Because the message visibility timeout expired upon pod termination, the poison batch was redelivered 7 times across the fleet, placing all 8/8 worker pods into \`CrashLoopBackOff\`.

## 2. Customer & System Impact
- **Service Availability:** 8/8 \`embedding-worker\` pods unhealthy (100% ingestion stall)
- **Backlog Impact:** 1,400 healthy ingestion jobs blocked behind poison batch
- **Recovery Time:** < 2 minutes after moving \`batch_99281\` to Dead-Letter Queue

## 3. Chronological Timeline (UTC)
- **18:40:02** — \`doc-ingest-queue\` dispatches 480MB \`batch_99281\` with \`chunk_strategy=NONE\`.
- **18:40:14** — \`embedding-worker-9c4b2-p8z1q\` logs \`MemoryPressureWarning\` at 3,892MB RSS.
- **18:40:16** — Kernel OOM killer terminates worker process with \`ExitCode=137\`.
- **18:40:18** — Queue redelivers \`batch_99281\` to next pod (\`attempt=7/10\`).
- **18:40:31** — All 8/8 worker pods enter \`CrashLoopBackOff\`.

## 4. Root Cause & Contributing Factors
1. **Primary Root Cause:** Missing admission validation allowed a 480MB payload with \`chunk_strategy=NONE\` into the worker queue.
2. **Contributing Factor:** \`maxReceiveCount=10\` allowed a single poison message to crash all 8 replicas before DLQ quarantine.

## 5. Action Items
| Priority | Action Item | Owner | Target |
| :--- | :--- | :--- | :--- |
| **P0** | Evict \`batch_99281\` to DLQ and restart \`embedding-worker\` | ML SRE | Immediate |
| **P1** | Lower \`DLQ_MAX_RECEIVES\` from 10 to 2 | Platform Team | Today |
| **P1** | Enforce mandatory streaming chunker for payloads > 25MB | Ingestion Team | +48h |`,
    telemetry: {
      mode: "mock",
      gatewayProvider: "Mozilla Otari / any-llm Gateway (Deterministic Mock)",
      endpointUrl: "https://otari.ai/api/v1/chat/completions",
      model1: {
        id: MODEL_1_ID,
        role: "Incident Summarizer & Severity Classifier",
        latencyMs: 615,
        promptTokens: 488,
        completionTokens: 328,
        status: "completed",
      },
      model2: {
        id: MODEL_2_ID,
        role: "Root-Cause & Remediation Planner",
        latencyMs: 855,
        promptTokens: 816,
        completionTokens: 690,
        status: "completed",
      },
      totalDurationMs: 1470,
      timestampIso: "2026-03-29T18:41:00.000Z",
    },
  },
];

/**
 * Dynamic Mock Dual-Model Triage Engine:
 * If the user pastes one of the 3 preset scenarios (or close to it), returns that rich scenario with updated timestamps.
 * If the user pastes ANY custom logs/alerts, parses lines, timestamps, services, error codes, and constructs a tailored
 * dual-model triage output (`llama-3.3-70b-instruct` + `qwen3-coder-30b-a3b-instruct`).
 */
export function runMockDualModelTriage(
  rawLogs: string,
  customTitle?: string
): Omit<PresetScenario, "key" | "name" | "shortLabel" | "badgeSeverity" | "category" | "description"> & {
  scenarioKey: string;
} {
  const trimmed = rawLogs.trim();
  const nowIso = new Date().toISOString();

  // Check if input matches one of the 3 presets
  for (const preset of PRESET_SCENARIOS) {
    if (
      trimmed.includes(preset.errorSignatures[0]?.slice(0, 22) || "__none__") ||
      trimmed === preset.rawLogs.trim()
    ) {
      return {
        scenarioKey: preset.key,
        incidentCode: preset.incidentCode,
        title: customTitle?.trim() || preset.title,
        rawLogs: trimmed,
        severity: preset.severity,
        confidence: preset.confidence,
        summary: preset.summary,
        blastRadius: preset.blastRadius,
        affectedServices: preset.affectedServices,
        errorSignatures: preset.errorSignatures,
        timeline: preset.timeline,
        rootCauses: preset.rootCauses,
        nextSteps: preset.nextSteps,
        postmortemMarkdown: preset.postmortemMarkdown,
        telemetry: {
          ...preset.telemetry,
          timestampIso: nowIso,
        },
      };
    }
  }

  // Otherwise, dynamically parse the custom pasted logs!
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const detectedServices = new Set<string>();
  const errorSignatures: string[] = [];
  const timeline: TimelineEvent[] = [];

  let criticalCount = 0;
  let errorCount = 0;
  let warnCount = 0;

  lines.forEach((line, idx) => {
    // Extract timestamp if present
    const tsMatch =
      line.match(/\d{4}-\d{2}-\d{2}[T\s](\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/) ||
      line.match(/\b(\d{2}:\d{2}:\d{2})\b/);
    const timestamp = tsMatch
      ? `${tsMatch[1].replace(/\.\d+Z?$/, "")} UTC`
      : `T+${idx * 12}s`;

    // Detect level
    let level: "CRITICAL" | "ERROR" | "WARN" | "INFO" = "INFO";
    if (/CRITICAL|FATAL|PANIC|OOMKilled|SEV-1|P1|emerg/i.test(line)) {
      level = "CRITICAL";
      criticalCount++;
    } else if (/ERROR|ERR|Exception|500|502|503|504|Failed|Timeout|Refused/i.test(line)) {
      level = "ERROR";
      errorCount++;
    } else if (/WARN|WARNING|Slow|Retry|Lag|High/i.test(line)) {
      level = "WARN";
      warnCount++;
    }

    // Detect service bracket or key=value
    const bracketMatches = [...line.matchAll(/\[([a-zA-Z0-9_-]{3,32})\]/g)].map(
      (m) => m[1]
    );
    const nonLevelBracket = bracketMatches.find(
      (b) => !/^(INFO|WARN|WARNING|ERROR|ERR|CRITICAL|FATAL|DEBUG|P1|P2|SEV-1|SEV-2)$/i.test(b)
    );
    const kvServiceMatch = line.match(/(?:service|app|pod|component|host)=([a-zA-Z0-9_.-]+)/i);
    const service =
      nonLevelBracket ||
      (kvServiceMatch ? kvServiceMatch[1] : null) ||
      "core-service";

    detectedServices.add(service);

    // Strip timestamp and brackets for cleaner event description
    const cleanedEvent = line
      .replace(/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\s*/, "")
      .replace(/^\[[A-Z]+\]\s*/i, "")
      .slice(0, 180);

    if ((level === "CRITICAL" || level === "ERROR") && errorSignatures.length < 4) {
      errorSignatures.push(cleanedEvent.slice(0, 95));
    }

    timeline.push({
      id: `custom-tl-${idx + 1}`,
      timestamp,
      service,
      level,
      event: cleanedEvent || line.slice(0, 140),
      rawSnippet: line,
      isTrigger: idx === 0,
    });
  });

  const servicesList = Array.from(detectedServices).slice(0, 5);
  if (servicesList.length === 0) servicesList.push("application-runtime");
  if (errorSignatures.length === 0) {
    errorSignatures.push(lines[0]?.slice(0, 90) || "Anomalous telemetry pattern detected");
  }

  const severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4" =
    criticalCount > 0 || errorCount >= 3
      ? "SEV-1"
      : errorCount > 0
      ? "SEV-2"
      : warnCount > 0
      ? "SEV-3"
      : "SEV-4";

  const incidentCode = `INC-${Math.floor(4200 + (trimmed.length % 700))}`;
  const primaryService = servicesList[0];
  const generatedTitle =
    customTitle?.trim() ||
    `${primaryService} ${severity === "SEV-1" ? "Critical Outage" : "Service Degradation"} (${errorSignatures[0].slice(0, 48)})`;

  const summary = `Model 1 (${MODEL_1_ID}) analyzed ${lines.length} telemetry log events across ${servicesList.join(", ")}. Detected ${criticalCount} critical and ${errorCount} error signatures starting at ${timeline[0]?.timestamp || "T+0s"}, primary signature: "${errorSignatures[0]}". Immediate isolation and service state verification recommended.`;

  const blastRadius =
    severity === "SEV-1"
      ? `High-severity failure impacting ${servicesList.join(", ")} (${criticalCount + errorCount} error events across ${lines.length} log lines).`
      : `Scoped degradation in ${servicesList.join(", ")} with elevated warning/error telemetry.`;

  const rootCauses: RootCauseHypothesis[] = [
    {
      id: "rc-custom-1",
      rank: 1,
      title: `Primary Fault in ${primaryService}: ${errorSignatures[0].slice(0, 58)}`,
      probability: 88,
      category: "Runtime Exception / Upstream Failure",
      mechanism: `Log correlation shows cascading ${levelLabel(severity)} events originating in ${primaryService}. The initial trigger at ${timeline[0]?.timestamp} propagated across dependent handlers.`,
      supportingEvidence: timeline.slice(0, 2).map((t) => `${t.timestamp} [${t.service}] ${t.event}`),
      verificationCommand: `kubectl logs -l app=${primaryService} --tail=100 | grep -iE "error|critical|warn|exception"`,
    },
    {
      id: "rc-custom-2",
      rank: 2,
      title: `Resource Saturation or Downstream Timeout in ${servicesList[1] || primaryService}`,
      probability: 67,
      category: "Capacity / Dependency Latency",
      mechanism: `Secondary error propagation suggests exhausted worker threads, connection timeouts, or misconfigured retry backoffs under load.`,
      supportingEvidence: timeline.slice(-2).map((t) => `${t.timestamp} [${t.service}] ${t.event}`),
      verificationCommand: `kubectl top pods -A | grep -E "${servicesList.join("|")}"`,
    },
  ];

  const nextSteps: RemediationStep[] = [
    {
      id: "ns-custom-1",
      phase: "IMMEDIATE",
      title: `Inspect live pod state and recent rollout history for ${primaryService}`,
      rationale: "Confirm whether a recent deployment or config change correlates with the first anomaly.",
      command: `kubectl rollout history deployment/${primaryService} && kubectl get pods -l app=${primaryService}`,
      rollbackNote: `Run 'kubectl rollout undo deployment/${primaryService}' if regression is confirmed.`,
      completed: false,
      ownerRole: "Incident Commander / On-Call SRE",
    },
    {
      id: "ns-custom-2",
      phase: "STABILIZE",
      title: `Isolate failing instances and drain degraded connections in ${servicesList.join(", ")}`,
      rationale: "Stops error amplification while preserving diagnostic heap/log artifacts.",
      command: `kubectl rollout restart deployment/${primaryService} && kubectl rollout status deployment/${primaryService}`,
      rollbackNote: "PodDisruptionBudget ensures minimum healthy quorum during restart.",
      completed: false,
      ownerRole: "Service Owner",
    },
    {
      id: "ns-custom-3",
      phase: "PREVENT",
      title: "Add structured alerting & circuit-breaker guard for detected error signature",
      rationale: `Prevents recurrence of "${errorSignatures[0].slice(0, 50)}" from cascading into downstream services.`,
      command: `grep -rn "${errorSignatures[0].slice(0, 24).replace(/"/g, "")}" src/ || true`,
      rollbackNote: "Verify in staging with synthetic fault injection.",
      completed: false,
      ownerRole: "Platform Engineering",
    },
  ];

  const postmortemMarkdown = `# Blameless Postmortem: ${incidentCode} — ${generatedTitle}

**Date:** ${nowIso.slice(0, 10)}  
**Severity:** ${severity}  
**Status:** Investigating / Draft  
**AI Triage Pipeline:** \`${MODEL_1_ID}\` (Classifier) + \`${MODEL_2_ID}\` (Remediation) via Mozilla Otari \`any-llm\` Gateway

---

## 1. Executive Summary
${summary}

## 2. Impact & Blast Radius
- **Affected Services:** ${servicesList.map((s) => `\`${s}\``).join(", ")}
- **Blast Radius:** ${blastRadius}
- **Key Error Signatures:**
${errorSignatures.map((sig) => `  - \`${sig}\``).join("\n")}

## 3. Chronological Timeline
${timeline
  .map((t) => `- **${t.timestamp}** [\`${t.service}\` / **${t.level}**] — ${t.event}`)
  .join("\n")}

## 4. Root-Cause Hypotheses
${rootCauses
  .map(
    (rc) =>
      `### ${rc.rank}. ${rc.title} (${rc.probability}% confidence)\n- **Category:** ${rc.category}\n- **Mechanism:** ${rc.mechanism}\n- **Verification CLI:** \`${rc.verificationCommand}\``
  )
  .join("\n\n")}

## 5. Remediation & Follow-Up Action Items
| Phase | Action Item | Owner | CLI Verification |
| :--- | :--- | :--- | :--- |
${nextSteps
  .map((s) => `| **${s.phase}** | ${s.title} | ${s.ownerRole} | \`${s.command}\` |`)
  .join("\n")}
`;

  const promptTokens1 = Math.max(220, Math.round(trimmed.length / 3.5));
  const completionTokens1 = 310;
  const promptTokens2 = promptTokens1 + completionTokens1 + 140;
  const completionTokens2 = 620;

  return {
    scenarioKey: "custom",
    incidentCode,
    title: generatedTitle,
    rawLogs: trimmed,
    severity,
    confidence: 89,
    summary,
    blastRadius,
    affectedServices: servicesList,
    errorSignatures,
    timeline,
    rootCauses,
    nextSteps,
    postmortemMarkdown,
    telemetry: {
      mode: "mock",
      gatewayProvider: "Mozilla Otari / any-llm Gateway (Deterministic Mock)",
      endpointUrl: "https://otari.ai/api/v1/chat/completions",
      model1: {
        id: MODEL_1_ID,
        role: "Incident Summarizer & Severity Classifier",
        latencyMs: 590,
        promptTokens: promptTokens1,
        completionTokens: completionTokens1,
        status: "completed",
      },
      model2: {
        id: MODEL_2_ID,
        role: "Root-Cause & Remediation Planner",
        latencyMs: 840,
        promptTokens: promptTokens2,
        completionTokens: completionTokens2,
        status: "completed",
      },
      totalDurationMs: 1430,
      timestampIso: nowIso,
    },
  };
}

function levelLabel(sev: string): string {
  if (sev === "SEV-1") return "critical outage";
  if (sev === "SEV-2") return "high-severity error";
  return "degraded performance";
}
