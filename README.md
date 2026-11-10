# Signal Room — Incident-Triage Copilot (`Mozilla Otari 'Devs Wilding Online' Hackathon`)

**Signal Room** is an incident-triage copilot built for the **Mozilla Otari 'Devs Wilding Online' Hackathon**. Engineers paste raw container logs, alerts, or stack traces (or load one of 3 realistic production outage scenarios), and Signal Room orchestrates a **2-stage open-weight model pipeline** via a Mozilla Otari / `any-llm` OpenAI-compatible gateway:

1. **Model 1 (`meta-llama/Llama-3.3-70B-Instruct` — Summarizer & Severity Classifier)**
   - Summarizes unstructured multi-service telemetry
   - Classifies incident severity (`SEV-1` Critical, `SEV-2` High, `SEV-3` Degraded, `SEV-4` Info) with a confidence score
   - Identifies customer/system blast radius, affected services, and primary error signatures
   - Extracts a chronological **Incident Timeline** with UTC timestamps and initial trigger detection
2. **Model 2 (`Qwen/Qwen2.5-Coder-32B-Instruct` — Root-Cause & Remediation Planner)**
   - Ingests the raw logs + Model 1's structured classification
   - Generates ranked **Root-Cause Hypotheses** with probability scores, mechanisms, supporting log evidence, and CLI verification commands
   - Proposes an interactive **Remediation Runbook / Next Steps** (`IMMEDIATE`, `STABILIZE`, `PREVENT`) with copyable CLI commands (`kubectl`, `redis-cli`, `stripe`, etc.) and rollback safety notes
   - Drafts a complete **Blameless Postmortem Markdown Document** ready to edit, persist to PostgreSQL, copy, or export as `.md`

---

## Key Features

- **Zero-Config Deterministic Mock Mode (No API Key Required):**
  When no `OTARI_API_KEY` or `ANY_LLM_API_KEY` is configured, Signal Room automatically runs in **Deterministic Mock Mode**. It includes pre-computed multi-stage telemetry for 3 flagship outage scenarios AND a dynamic log parser that extracts timestamps, services, and error signatures from any custom logs you paste.
- **Live Mozilla Otari / `any-llm` Gateway Support:**
  Point Signal Room at any `any-llm` / OpenAI-compatible `/v1/chat/completions` endpoint (Mozilla Otari Gateway, local Ollama, vLLM, OpenRouter, Together AI, Fireworks) via environment variables or the in-app **Gateway Config** modal.
- **PostgreSQL + Drizzle ORM Persistence:**
  All triaged incidents, interactive remediation checklist toggles, status transitions (`INVESTIGATING` -> `MITIGATING` -> `RESOLVED`), and edited postmortem Markdown drafts are persisted in PostgreSQL.
- **3 Pre-Loaded Production Incident Scenarios:**
  1. `INC-4092` — **Redis Connection Pool Exhaustion (`SEV-1`)**: Auth-Service v2.14.0 unclosed transaction pipeline leak starving `redis-cluster-01`.
  2. `INC-4108` — **Payment Webhook Signature Failure (`SEV-2`)**: Vault secret rotation v19 -> v20 ignored by cached singleton in `billing-webhook`.
  3. `INC-4115` — **K8s OOMKilled Pod CrashLoop (`SEV-1`)**: Unchunked 480MB PDF batch (`ExitCode=137`) causing a poison-pill redelivery loop across 8 worker pods.

---

## Setup & Local Development

### 1. Prerequisites
- **Node.js** 20+
- **PostgreSQL** 15+ (local instance or Docker container)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables (`.env`)
Create or update `.env` in the project root:

```env
# Required: PostgreSQL connection string
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db

# Optional: Mozilla Otari / any-llm OpenAI-compatible gateway settings
# Leave blank to run in Deterministic Mock Mode (100% functional without keys)
OTARI_BASE_URL=https://gateway.otari.mozilla.ai/v1
OTARI_API_KEY=

# Optional: Override open-weight model identifiers
OTARI_MODEL_1=meta-llama/Llama-3.3-70B-Instruct
OTARI_MODEL_2=Qwen/Qwen2.5-Coder-32B-Instruct
```

### 4. Push Database Schema & Run
```bash
npx drizzle-kit push
npm run dev
```
Open `http://localhost:3000` in your browser. On first load, Signal Room automatically creates the `incident_reports` table if missing and seeds the 3 flagship incident scenarios.

---

## Project Structure

```text
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── health/route.ts          # Healthcheck endpoint
│   │   │   ├── triage/route.ts          # Dual-model triage execution & DB persistence
│   │   │   └── incidents/
│   │   │       ├── route.ts             # List persisted triage sessions
│   │   │       └── [id]/route.ts        # Update checklist, status, postmortem, or delete
│   │   ├── globals.css                  # Tactical Obsidian Control theme & utilities
│   │   ├── layout.tsx                   # Space Grotesk, Inter, JetBrains Mono fonts
│   │   └── page.tsx                     # Server Component seeding & workspace bootstrap
│   ├── components/
│   │   ├── SignalRoomClient.tsx         # Split-screen incident war room UI
│   │   ├── GatewayConfigModal.tsx       # Live vs. Mock gateway & model configuration
│   │   └── AiDisclosureModal.tsx        # In-app AI-Assistance & safety disclosure modal
│   ├── db/
│   │   ├── index.ts                     # Drizzle ORM + node-postgres pool
│   │   └── schema.ts                    # incident_reports table & JSONB types
│   └── lib/
│       ├── otari-gateway.ts             # Dual-model any-llm client + mock fallback
│       ├── scenarios.ts                 # 3 preset scenarios + dynamic custom log parser
│       └── db-seed.ts                   # Idempotent table creation & initial seeding
├── AI_DISCLOSURE.md                     # Standalone AI-Assistance & Responsible Use Disclosure
└── README.md                            # Setup & architecture documentation
```

---

## AI-Assistance Disclosure

This project was created for the **Mozilla Otari 'Devs Wilding Online' Hackathon** with complete transparency regarding both **development-time AI assistance** and **runtime open-weight model inference**:

1. **AI-Assisted Software Engineering:**
   - Portions of the Next.js App Router TypeScript code, Tailwind CSS dark war-room UI components, Drizzle ORM database schema, and synthetic SRE incident log fixtures were drafted and refined with AI coding copilot assistance.
2. **Runtime Open-Weight LLM Architecture:**
   - Signal Room orchestrates two open-weight models via an `any-llm` / OpenAI-compatible gateway:
     - **Stage 1 (`meta-llama/Llama-3.3-70B-Instruct`):** Summarizes logs, classifies severity (`SEV-1` to `SEV-4`), and extracts chronological timeline events.
     - **Stage 2 (`Qwen/Qwen2.5-Coder-32B-Instruct`):** Generates ranked root-cause guesses, remediation runbook steps, and a blameless postmortem draft.
3. **Privacy & Mock Mode Guarantee:**
   - When running in Mock Mode (the default when no API key is provided), **zero log data is transmitted over the network**. All parsing and triage synthesis run locally and deterministically.
4. **Human-in-the-Loop Operational Safety:**
   - Signal Room is an advisory copilot. It **never** executes `kubectl`, `redis-cli`, or shell commands automatically. Engineers must verify every suggested command and rollback note before executing changes in production environments.
