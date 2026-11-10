# Live Otari verification (hosted gateway)

Verified 2026-11-11 ~00:31 IST (2026-11-10 19:01 UTC) against the hosted Otari
gateway at `https://otari.ai/api/v1` from the workspace holding the hackathon
API key (US region).

- `GET /api/v1/models` -> HTTP 200, 165 models across 10 providers.
- Model 1 `meta/llama-3.3-70b-instruct`: `POST /api/v1/chat/completions`
  -> HTTP 200, completion "OK", usage {prompt_tokens: 40, completion_tokens: 2,
  cost_usd: "0.000030"}.
- Model 2 `alibaba/qwen3-coder-30b-a3b-instruct`: same request -> HTTP 200,
  completion "OK", cost_usd "0.000003".
- Both `Otari-Key: <key>` and OpenAI-style `Authorization: Bearer <key>`
  authenticate; the app's client uses `Authorization: Bearer` unchanged.

Notes for judges:

- The gateway model catalog spells model IDs as
  `meta/llama-3.3-70b-instruct` and does not list `Qwen/Qwen2.5-Coder-32B-Instruct`;
  the closest current coder model, `alibaba/qwen3-coder-30b-a3b-instruct`,
  is used as the Stage 2 default. Both defaults are overridable with
  `OTARI_MODEL_1` / `OTARI_MODEL_2` or the in-app Gateway Config modal.
- Earlier scaffold referenced `https://gateway.otari.mozilla.ai/v1`; the live
  hosted endpoint is `https://otari.ai/api/v1` (see the Models page "Make your
  first call" snippet and the Otari quickstart).
- Account balance at signup: USD 2.00 credit (US region). Each smoke test
  above cost under $0.0001.

## Dashboard-configured features (2026-11-11 ~04:58 IST)

Configured in the hosted Otari dashboard (workspace "Default workspace",
org pritahir417@gmail.com) and consumed by the app:

### Key budget (Spend & budgets / API keys)

- The app's API key was renamed to `signal-room` and given a real per-key
  budget: USD 0.25 per month (dashboard > API keys > Edit key > Budget
  (optional) > Custom amount). The keys table shows "$0.00 of $0.25" for the
  `signal-room` key; requests on it "spend against your budget".
- App behavior: `src/lib/otari-gateway.ts` keeps a per-session spend estimate
  (`OTARI_BUDGET_USD`, default 0.25) and, more importantly, detects Otari's
  server-side budget rejection (HTTP 402, or 400/403/429 whose body mentions
  budget/ceiling/spend/balance) and converts it into a graceful deterministic
  fallback with a telemetry event, instead of failing the triage.
  The UI renders a "KEY BUDGET $x / $cap - CAP ENFORCED" chip when that happens.

### Routing policy (Routing > Policies)

- Created fallback policy `signal-room-triage`: callers send
  `model: "signal-room-triage"`; the gateway serves it with
  Llama 3.3 70B Instruct on Amazon Bedrock and, if that fails before the
  answer starts, Qwen3-Coder 30B-A3B Instruct on Amazon Bedrock
  ("If unavailable, use ... including a rate limit ... or when the remaining
  budget cannot cover a pricier backup").
- Stage 1 of the app defaults to this policy name (`OTARI_MODEL_1` overrides),
  so model selection AND cross-model fallback happen inside Otari, visible in
  the Requests table ROUTING column. The app keeps its own cross-model retry
  as a second safety net and records every fallback in telemetry.

### Web search (Tools > otari_web_search, backend: tavily)

- After Stage 1 extracts error signatures, the app calls Otari's server-side
  search API `POST /api/v1/search` (`{query, max_results: 5}`) and injects the
  top 3 results into Stage 2's remediation prompt, so the runbook cites
  current documentation. Telemetry records `webSearch: {tool, query,
  resultCount, topResults}` and the UI shows an "OTARI WEB SEARCH" chip.

### Requests / observability

- Dashboard > Overview > Requests lists every call with API KEY
  (`signal-room`), MODEL, ROUTING, input/output tokens, COST (e.g. $0.00003
  for a 40-token Llama call) and STATUS - the same calls the app makes.
