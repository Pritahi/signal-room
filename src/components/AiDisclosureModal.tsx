"use client";

import React from "react";
import {
  ShieldCheck,
  Cpu,
  Terminal,
  AlertTriangle,
  X,
  FileCode2,
  GitBranch,
  CheckCircle2,
} from "lucide-react";

interface AiDisclosureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiDisclosureModal({ isOpen, onClose }: AiDisclosureModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg border border-[#1E2633] bg-[#11151C] text-[#F1F5F9] shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#1E2633] bg-[#161B24]/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 text-[#8B5CF6]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight text-white">
                  AI-Assistance & Open-Weight Model Disclosure
                </h2>
                <span className="rounded border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wider text-[#C4B5FD]">
                  Mozilla Otari Hackathon
                </span>
              </div>
              <p className="text-xs text-[#94A3B8]">
                Transparency statement for the Mozilla Otari &ldquo;Devs Wilding Online&rdquo; Hackathon
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-[#1E2633] bg-[#090B0E] p-1.5 text-[#94A3B8] hover:border-[#334155] hover:text-white transition-colors"
            aria-label="Close disclosure modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-6 p-6 text-sm leading-relaxed text-[#CBD5E1]">
          {/* Section 1: Runtime Dual Open-Weight Model Architecture */}
          <div className="rounded-md border border-[#1E2633] bg-[#090B0E] p-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#8B5CF6] mb-2">
              <Cpu className="h-4 w-4" />
              <span>1. Runtime Dual Open-Weight Model Pipeline (any-llm Gateway)</span>
            </div>
            <p className="text-xs text-[#94A3B8] mb-3">
              Signal Room routes incident logs through two specialized open-weight models via an{" "}
              <code className="font-mono text-[#F1F5F9]">any-llm</code> / Mozilla Otari OpenAI-compatible gateway:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded border border-[#1E2633] bg-[#11151C] p-3">
                <div className="font-mono text-xs font-semibold text-[#38BDF8]">
                  STAGE 1 // meta-llama/Llama-3.3-70B-Instruct
                </div>
                <div className="text-xs font-medium text-white mt-1">
                  Triage Summarizer & Severity Classifier
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Parses unstructured multi-service log streams, classifies severity (SEV-1 to SEV-4), calculates confidence & blast radius, and extracts a chronological event timeline.
                </p>
              </div>
              <div className="rounded border border-[#1E2633] bg-[#11151C] p-3">
                <div className="font-mono text-xs font-semibold text-[#FF6B2B]">
                  STAGE 2 // Qwen/Qwen2.5-Coder-32B-Instruct
                </div>
                <div className="text-xs font-medium text-white mt-1">
                  Root-Cause & Remediation Planner
                </div>
                <p className="text-xs text-[#94A3B8] mt-1">
                  Ingests raw logs plus Stage 1 structured context to formulate ranked root-cause hypotheses, copyable SRE CLI verification/remediation steps, and a blameless postmortem draft.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Development & AI-Assistance Disclosure */}
          <div className="rounded-md border border-[#1E2633] bg-[#090B0E] p-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#10B981] mb-2">
              <FileCode2 className="h-4 w-4" />
              <span>2. AI-Assisted Development Disclosure</span>
            </div>
            <ul className="space-y-2 text-xs text-[#CBD5E1]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Code & UI Engineering:</strong>{" "}
                  Portions of the Next.js App Router fullstack implementation, TypeScript schema definitions, Drizzle ORM persistence layer, and synthetic SRE incident scenarios were authored with AI coding copilot assistance.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Deterministic Mock Mode & Zero-Leakage Guarantee:</strong>{" "}
                  When no <code className="font-mono text-[#FFB020]">OTARI_API_KEY</code> or <code className="font-mono text-[#FFB020]">ANY_LLM_API_KEY</code> is configured, Signal Room operates in 100% local deterministic mock mode. No pasted logs leave your environment in Mock Mode.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Prompt & Attribution Transparency:</strong>{" "}
                  Every generated summary, root-cause hypothesis, remediation step, and postmortem explicitly attributes which open-weight model stage produced it, alongside token counts and gateway latency metrics.
                </span>
              </li>
            </ul>
          </div>

          {/* Section 3: Human-in-the-Loop Operational Safety */}
          <div className="rounded-md border border-[#FFB020]/40 bg-[#FFB020]/10 p-4">
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#FFB020] mb-1.5">
              <AlertTriangle className="h-4 w-4" />
              <span>3. Human-in-the-Loop SRE Safety Guardrail</span>
            </div>
            <p className="text-xs text-[#FDE68A]">
              Signal Room is an advisory decision-support copilot. It never executes shell, Kubernetes (<code className="font-mono">kubectl</code>), or database commands automatically. On-call engineers must review all suggested CLI commands, verify target namespaces/clusters, and validate rollback safety notes before running commands in production.
            </p>
          </div>

          {/* Section 4: Reproducibility & Open Gateway Spec */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#1E2633] pt-4 text-xs text-[#94A3B8]">
            <div className="flex items-center gap-2 font-mono">
              <GitBranch className="h-3.5 w-3.5 text-[#8B5CF6]" />
              <span>Gateway Protocol: OpenAI-Compatible / any-llm v1</span>
            </div>
            <div className="flex items-center gap-2 font-mono">
              <Terminal className="h-3.5 w-3.5 text-[#10B981]" />
              <span>Docs: See README.md & AI_DISCLOSURE.md in repo root</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-[#1E2633] bg-[#161B24] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-md bg-[#FF6B2B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF6B2B]/90 transition-colors"
          >
            Acknowledge & Return to Signal Room
          </button>
        </div>
      </div>
    </div>
  );
}
