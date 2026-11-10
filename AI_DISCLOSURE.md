# AI-Assistance & Open-Weight Model Disclosure

**Project:** Signal Room — Incident-Triage Copilot  
**Event:** Mozilla Otari 'Devs Wilding Online' Hackathon  
**Architecture:** Next.js + TypeScript + PostgreSQL (Drizzle ORM) + Dual Open-Weight Model Gateway (`any-llm`)

---

## 1. Development-Time AI Assistance
In accordance with the Mozilla Otari 'Devs Wilding Online' hackathon guidelines:
- **Code Generation & Scaffolding:** AI coding assistance was utilized to accelerate the implementation of the Next.js App Router API routes (`/api/triage`, `/api/incidents`), TypeScript interfaces, Drizzle ORM schema (`src/db/schema.ts`), and the Tactical Obsidian dark-mode user interface (`src/components/SignalRoomClient.tsx`).
- **Synthetic Incident Telemetry:** The three realistic production outage log streams (`INC-4092` Redis Pool Exhaustion, `INC-4108` Stripe Webhook HMAC Mismatch, and `INC-4115` K8s OOMKilled CrashLoopBackOff) were crafted with AI assistance to mirror authentic SRE telemetry without exposing any real proprietary production logs or PII.

## 2. Runtime Open-Weight Model Pipeline (`any-llm` Gateway)
Signal Room uses a sequential **two-model open-weight pipeline** accessed via a Mozilla Otari / `any-llm` OpenAI-compatible gateway (`/v1/chat/completions`):

| Stage | Open-Weight Model | Responsibility | Output Artifacts |
| :--- | :--- | :--- | :--- |
| **Stage 1** | `meta-llama/Llama-3.3-70B-Instruct` | Incident Summarizer & Severity Classifier | Severity (`SEV-1`..`SEV-4`), Confidence %, Executive Summary, Blast Radius, Affected Services, Chronological Timeline |
| **Stage 2** | `Qwen/Qwen2.5-Coder-32B-Instruct` | Root-Cause & Remediation Planner | Ranked Root-Cause Hypotheses, Verification CLI Commands, Prioritized Remediation Runbook, Blameless Postmortem Markdown |

## 3. Deterministic Mock Mode & Data Privacy
- When no `OTARI_API_KEY` or `ANY_LLM_API_KEY` is provided, Signal Room defaults to **Deterministic Mock Mode**.
- In Mock Mode, no external network requests are made to third-party LLM providers; pasted logs are processed locally by the built-in log parser (`src/lib/scenarios.ts`).

## 4. Human-in-the-Loop SRE Safety Guardrail
- Signal Room is strictly an **advisory copilot**.
- All generated CLI commands (`kubectl`, `redis-cli`, `stripe`, etc.) require explicit human review, copy-paste confirmation, and verification against target production namespaces before execution.
