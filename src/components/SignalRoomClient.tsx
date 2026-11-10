"use client";

import React, { useState, useMemo } from "react";
import type {
  IncidentReport,
  RemediationStep,
} from "@/db/schema";
import {
  PRESET_SCENARIOS,
  MODEL_1_ID,
  MODEL_2_ID,
} from "@/lib/scenarios";
import { AiDisclosureModal } from "@/components/AiDisclosureModal";
import {
  GatewayConfigModal,
  type ClientGatewaySettings,
} from "@/components/GatewayConfigModal";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Database,
  Download,
  Eye,
  FileText,
  Flame,
  History,
  Info,
  Layers,
  Play,
  RotateCcw,
  Save,
  Server,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";

interface SignalRoomClientProps {
  initialIncidents: IncidentReport[];
  serverGatewayStatus: {
    hasServerApiKey: boolean;
    defaultBaseUrl: string;
    model1Default: string;
    model2Default: string;
  };
}

type ActiveTab = "timeline" | "root-causes" | "next-steps" | "postmortem";

export function SignalRoomClient({
  initialIncidents,
  serverGatewayStatus,
}: SignalRoomClientProps) {
  const [incidents, setIncidents] = useState<IncidentReport[]>(initialIncidents);
  const [activeIncident, setActiveIncident] = useState<IncidentReport>(
    initialIncidents[0] || ({
      id: 1,
      incidentCode: PRESET_SCENARIOS[0].incidentCode,
      title: PRESET_SCENARIOS[0].title,
      scenarioKey: PRESET_SCENARIOS[0].key,
      rawLogs: PRESET_SCENARIOS[0].rawLogs,
      severity: PRESET_SCENARIOS[0].severity,
      confidence: PRESET_SCENARIOS[0].confidence,
      status: "INVESTIGATING",
      summary: PRESET_SCENARIOS[0].summary,
      blastRadius: PRESET_SCENARIOS[0].blastRadius,
      affectedServices: PRESET_SCENARIOS[0].affectedServices,
      errorSignatures: PRESET_SCENARIOS[0].errorSignatures,
      timeline: PRESET_SCENARIOS[0].timeline,
      rootCauses: PRESET_SCENARIOS[0].rootCauses,
      nextSteps: PRESET_SCENARIOS[0].nextSteps,
      postmortemMarkdown: PRESET_SCENARIOS[0].postmortemMarkdown,
      telemetry: PRESET_SCENARIOS[0].telemetry,
      createdAt: new Date(),
    } as IncidentReport)
  );

  // Left pane editor state
  const [rawLogsInput, setRawLogsInput] = useState<string>(
    activeIncident.rawLogs
  );
  const [customTitleInput, setCustomTitleInput] = useState<string>(
    activeIncident.title
  );
  const [selectedPresetKey, setSelectedPresetKey] = useState<string>(
    activeIncident.scenarioKey || "redis-pool-exhaustion"
  );
  const [highlightLogLines, setHighlightLogLines] = useState<boolean>(false);

  // Pipeline execution state
  const [isTriaging, setIsTriaging] = useState<boolean>(false);
  const [pipelineStage, setPipelineStage] = useState<0 | 1 | 2>(0);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Right pane tabs & sub-view controls
  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline");
  const [viewAllPanels, setViewAllPanels] = useState<boolean>(false);
  const [timelineFilter, setTimelineFilter] = useState<
    "ALL" | "CRITICAL_ERROR" | "WARN_INFO"
  >("ALL");

  // Postmortem editor state
  const [postmortemEditMode, setPostmortemEditMode] = useState<boolean>(false);
  const [postmortemDraftText, setPostmortemDraftText] = useState<string>(
    activeIncident.postmortemMarkdown
  );
  const [isSavingPostmortem, setIsSavingPostmortem] = useState<boolean>(false);
  const [savedToast, setSavedToast] = useState<string | null>(null);

  // Clipboard state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals & Drawers
  const [isDisclosureOpen, setIsDisclosureOpen] = useState<boolean>(false);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState<boolean>(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState<boolean>(false);
  const [showRawTelemetryJson, setShowRawTelemetryJson] =
    useState<boolean>(false);

  // Gateway settings state
  const [gatewaySettings, setGatewaySettings] = useState<ClientGatewaySettings>({
    forceMock: !serverGatewayStatus.hasServerApiKey,
    baseUrl: serverGatewayStatus.defaultBaseUrl,
    apiKey: "",
    model1Id: serverGatewayStatus.model1Default || MODEL_1_ID,
    model2Id: serverGatewayStatus.model2Default || MODEL_2_ID,
  });

  const isEffectiveLiveMode =
    !gatewaySettings.forceMock &&
    (Boolean(gatewaySettings.apiKey.trim()) ||
      serverGatewayStatus.hasServerApiKey);

  // Live metrics from rawLogsInput
  const logStats = useMemo(() => {
    const lines = rawLogsInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let critical = 0;
    let errors = 0;
    let warns = 0;
    for (const line of lines) {
      if (/CRITICAL|FATAL|PANIC|OOMKilled|SEV-1|P1/i.test(line)) critical++;
      else if (/ERROR|ERR|Exception|504|502|500|Failed|Timeout/i.test(line))
        errors++;
      else if (/WARN|WARNING|Lag|High/i.test(line)) warns++;
    }
    return { totalLines: lines.length, critical, errors, warns, lines };
  }, [rawLogsInput]);

  // Select a preset scenario
  function handleSelectPreset(presetKey: string) {
    const preset = PRESET_SCENARIOS.find((p) => p.key === presetKey);
    if (!preset) return;
    setSelectedPresetKey(preset.key);
    setRawLogsInput(preset.rawLogs);
    setCustomTitleInput(preset.title);
    setErrorBanner(null);

    // Check if we already have this preset in saved incidents
    const existingSaved = incidents.find((inc) => inc.scenarioKey === preset.key);
    if (existingSaved) {
      setActiveIncident(existingSaved);
      setPostmortemDraftText(existingSaved.postmortemMarkdown);
    } else {
      const hydrated: IncidentReport = {
        id: Date.now(),
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
      };
      setActiveIncident(hydrated);
      setPostmortemDraftText(hydrated.postmortemMarkdown);
    }
  }

  // Execute Dual-Model Triage Pipeline
  async function handleRunTriage() {
    if (!rawLogsInput.trim()) {
      setErrorBanner(
        "Please paste raw incident logs/alerts or choose one of the 3 preset scenarios above."
      );
      return;
    }

    setErrorBanner(null);
    setIsTriaging(true);
    setPipelineStage(1);

    // Stage 1 -> Stage 2 visual progression
    const stageTimer = setTimeout(() => {
      setPipelineStage(2);
    }, 520);

    try {
      const response = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawLogs: rawLogsInput,
          title: customTitleInput,
          gatewayConfig: gatewaySettings,
          saveToDb: true,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.incident) {
        throw new Error(data?.error || "Dual-model triage request failed");
      }

      // Brief pause so user sees Stage 2 completion cleanly
      await new Promise((r) => setTimeout(r, 420));

      const newIncident: IncidentReport = data.incident;
      setActiveIncident(newIncident);
      setPostmortemDraftText(newIncident.postmortemMarkdown);
      setIncidents((prev) => [
        newIncident,
        ...prev.filter((i) => i.id !== newIncident.id),
      ]);
      showTemporaryToast(
        `Triaged ${newIncident.incidentCode} (${newIncident.severity}) via Dual-Model Pipeline`
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unexpected triage failure";
      setErrorBanner(message);
    } finally {
      clearTimeout(stageTimer);
      setIsTriaging(false);
      setPipelineStage(0);
    }
  }

  // Toggle remediation step completion & persist to PostgreSQL
  async function handleToggleStep(stepId: string) {
    const updatedSteps: RemediationStep[] = activeIncident.nextSteps.map((s) =>
      s.id === stepId ? { ...s, completed: !s.completed } : s
    );

    const optimistic: IncidentReport = {
      ...activeIncident,
      nextSteps: updatedSteps,
    };
    setActiveIncident(optimistic);
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === optimistic.id ? optimistic : inc))
    );

    try {
      await fetch(`/api/incidents/${activeIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextSteps: updatedSteps }),
      });
    } catch {
      // Keep optimistic state in UI
    }
  }

  // Update Incident Status (INVESTIGATING | MITIGATING | RESOLVED)
  async function handleStatusChange(newStatus: string) {
    const optimistic: IncidentReport = {
      ...activeIncident,
      status: newStatus,
    };
    setActiveIncident(optimistic);
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === optimistic.id ? optimistic : inc))
    );

    try {
      await fetch(`/api/incidents/${activeIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      showTemporaryToast(`Incident status updated to ${newStatus}`);
    } catch {
      // Ignore error
    }
  }

  // Save edited postmortem draft to PostgreSQL
  async function handleSavePostmortem() {
    setIsSavingPostmortem(true);
    try {
      const res = await fetch(`/api/incidents/${activeIncident.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postmortemMarkdown: postmortemDraftText }),
      });
      if (res.ok) {
        const updated: IncidentReport = {
          ...activeIncident,
          postmortemMarkdown: postmortemDraftText,
        };
        setActiveIncident(updated);
        setIncidents((prev) =>
          prev.map((inc) => (inc.id === updated.id ? updated : inc))
        );
        showTemporaryToast("Postmortem draft saved to PostgreSQL");
      }
    } finally {
      setIsSavingPostmortem(false);
    }
  }

  // Delete saved incident from history
  async function handleDeleteIncident(id: number) {
    try {
      await fetch(`/api/incidents/${id}`, { method: "DELETE" });
      const remaining = incidents.filter((inc) => inc.id !== id);
      setIncidents(remaining);
      if (activeIncident.id === id && remaining.length > 0) {
        setActiveIncident(remaining[0]);
        setRawLogsInput(remaining[0].rawLogs);
        setCustomTitleInput(remaining[0].title);
        setPostmortemDraftText(remaining[0].postmortemMarkdown);
      }
    } catch {
      // Ignore
    }
  }

  function handleCopyText(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  }

  function handleDownloadPostmortem() {
    const blob = new Blob([postmortemDraftText], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeIncident.incidentCode.toLowerCase()}-postmortem.md`;
    a.click();
    URL.revokeObjectURL(url);
    showTemporaryToast(
      `Downloaded ${activeIncident.incidentCode.toLowerCase()}-postmortem.md`
    );
  }

  function showTemporaryToast(msg: string) {
    setSavedToast(msg);
    setTimeout(() => {
      setSavedToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }

  const filteredTimeline = useMemo(() => {
    return activeIncident.timeline.filter((item) => {
      if (timelineFilter === "CRITICAL_ERROR") {
        return item.level === "CRITICAL" || item.level === "ERROR";
      }
      if (timelineFilter === "WARN_INFO") {
        return item.level === "WARN" || item.level === "INFO";
      }
      return true;
    });
  }, [activeIncident.timeline, timelineFilter]);

  const completedStepsCount = activeIncident.nextSteps.filter(
    (s) => s.completed
  ).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#090B0E] text-[#F1F5F9] tactical-grid-bg">
      {/* TOP TACTICAL TELEMETRY BAR */}
      <header className="sticky top-0 z-30 border-b border-[#1E2633] bg-[#161B24]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          {/* Left: Brand Mark & Hackathon Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#FF6B2B]/50 bg-[#FF6B2B]/15 text-[#FF6B2B] shadow-[0_0_15px_rgba(255,107,43,0.2)]">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tracking-tight text-white">
                  SIGNAL ROOM
                </span>
                <span className="rounded border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#C4B5FD]">
                  Mozilla Otari &apos;Devs Wilding Online&apos;
                </span>
              </div>
              <p className="text-[11px] text-[#94A3B8] hidden sm:block">
                Dual Open-Weight Model Incident-Triage Copilot via{" "}
                <code className="font-mono text-[#CBD5E1]">any-llm</code> Gateway
              </p>
            </div>
          </div>

          {/* Center: Dual Open-Weight Model Pipeline Pills */}
          <div className="hidden xl:flex items-center gap-2 rounded-md border border-[#1E2633] bg-[#090B0E]/90 px-3 py-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="h-2 w-2 rounded-full bg-[#38BDF8]" />
              <span className="text-[#94A3B8]">M1 [Classifier]:</span>
              <span className="font-semibold text-[#F1F5F9]">
                {gatewaySettings.model1Id.split("/").pop()}
              </span>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-[#475569]" />
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <span className="h-2 w-2 rounded-full bg-[#FF6B2B]" />
              <span className="text-[#94A3B8]">M2 [Planner]:</span>
              <span className="font-semibold text-[#F1F5F9]">
                {gatewaySettings.model2Id.split("/").pop()}
              </span>
            </div>
          </div>

          {/* Right: Gateway Mode Status Pill + History + AI Disclosure */}
          <div className="flex items-center gap-2">
            {/* Gateway Status Pill */}
            <button
              type="button"
              onClick={() => setIsGatewayModalOpen(true)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[11px] font-semibold transition-all ${
                isEffectiveLiveMode
                  ? "border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981] hover:bg-[#10B981]/25"
                  : "border-[#FFB020]/50 bg-[#FFB020]/15 text-[#FFB020] hover:bg-[#FFB020]/25"
              }`}
              title="Click to configure Mozilla Otari / any-llm Gateway or toggle Mock Mode"
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isEffectiveLiveMode
                    ? "bg-[#10B981] animate-pulse"
                    : "bg-[#FFB020]"
                }`}
              />
              <span>
                {isEffectiveLiveMode
                  ? "LIVE OTARI GATEWAY"
                  : "MOCK GATEWAY (NO API KEY)"}
              </span>
              <Settings className="h-3.5 w-3.5 opacity-80" />
            </button>

            {/* Saved Triage History Button */}
            <button
              type="button"
              onClick={() => setIsHistoryDrawerOpen(!isHistoryDrawerOpen)}
              className="flex items-center gap-1.5 rounded-md border border-[#1E2633] bg-[#11151C] px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] hover:border-[#334155] hover:text-white transition-colors"
            >
              <History className="h-3.5 w-3.5 text-[#38BDF8]" />
              <span className="hidden sm:inline">Saved Runs</span>
              <span className="rounded bg-[#1E2633] px-1.5 py-0.2 font-mono text-[10px] text-[#38BDF8]">
                {incidents.length}
              </span>
            </button>

            {/* AI Disclosure Modal Button */}
            <button
              type="button"
              onClick={() => setIsDisclosureOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-2.5 py-1.5 text-xs font-medium text-[#C4B5FD] hover:bg-[#8B5CF6]/25 transition-colors"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-[#8B5CF6]" />
              <span className="hidden md:inline">AI Disclosure</span>
            </button>
          </div>
        </div>
      </header>

      {/* FLOATING TOAST NOTIFICATION */}
      {savedToast && (
        <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-md border border-[#10B981]/50 bg-[#11151C] px-4 py-2.5 text-xs font-medium text-[#10B981] shadow-xl">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{savedToast}</span>
        </div>
      )}

      {/* COLLAPSIBLE SAVED INCIDENTS DRAWER BAR */}
      {isHistoryDrawerOpen && (
        <div className="border-b border-[#1E2633] bg-[#11151C] px-4 py-3 lg:px-6">
          <div className="mx-auto max-w-[1600px]">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#94A3B8]">
                <Database className="h-3.5 w-3.5 text-[#38BDF8]" />
                <span>
                  PostgreSQL Persisted Triage Sessions ({incidents.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="text-xs text-[#94A3B8] hover:text-white"
              >
                Close History
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {incidents.map((inc) => {
                const isSelected = inc.id === activeIncident.id;
                return (
                  <div
                    key={inc.id}
                    className={`flex items-center justify-between rounded-md border p-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#FF6B2B] bg-[#FF6B2B]/10"
                        : "border-[#1E2633] bg-[#090B0E] hover:border-[#334155]"
                    }`}
                    onClick={() => {
                      setActiveIncident(inc);
                      setRawLogsInput(inc.rawLogs);
                      setCustomTitleInput(inc.title);
                      setPostmortemDraftText(inc.postmortemMarkdown);
                      setSelectedPresetKey(inc.scenarioKey);
                    }}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${getSeverityBadgeStyle(
                            inc.severity
                          )}`}
                        >
                          {inc.severity}
                        </span>
                        <span className="font-mono text-xs font-semibold text-white">
                          {inc.incidentCode}
                        </span>
                        <span className="font-mono text-[10px] text-[#94A3B8]">
                          [{inc.status}]
                        </span>
                      </div>
                      <p className="truncate text-xs text-[#CBD5E1] mt-1">
                        {inc.title}
                      </p>
                    </div>
                    {incidents.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteIncident(inc.id);
                        }}
                        className="rounded p-1 text-[#475569] hover:bg-[#FF453A]/15 hover:text-[#FF453A]"
                        title="Delete incident report"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MAIN TWO-COLUMN TACTICAL WORKSPACE */}
      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-5 lg:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* ==============================================================
              LEFT COLUMN (5 COLS): TELEMETRY INGESTION & DUAL-MODEL PIPELINE
             ============================================================== */}
          <section className="lg:col-span-5 flex flex-col gap-5">
            {/* Card 1: Preset Scenario Quick-Loaders */}
            <div className="rounded-lg border border-[#1E2633] bg-[#11151C] p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#FF6B2B]" />
                  <h2 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                    1. Select Preset Scenario or Paste Custom Logs
                  </h2>
                </div>
                <span className="font-mono text-[11px] text-[#94A3B8]">
                  3 Curated Scenarios
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {PRESET_SCENARIOS.map((preset) => {
                  const active = selectedPresetKey === preset.key;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => handleSelectPreset(preset.key)}
                      className={`group flex items-start justify-between rounded-md border p-3 text-left transition-all ${
                        active
                          ? "border-[#FF6B2B] bg-[#FF6B2B]/10 shadow-[inset_2px_0_0_0_#FF6B2B]"
                          : "border-[#1E2633] bg-[#090B0E] hover:border-[#334155]"
                      }`}
                    >
                      <div className="pr-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${getSeverityBadgeStyle(
                              preset.badgeSeverity
                            )}`}
                          >
                            {preset.badgeSeverity}
                          </span>
                          <span className="font-display text-xs font-semibold text-white group-hover:text-[#FF6B2B] transition-colors">
                            {preset.name}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#94A3B8] leading-snug">
                          {preset.description}
                        </p>
                      </div>
                      <span className="shrink-0 rounded border border-[#1E2633] bg-[#11151C] px-2 py-0.5 font-mono text-[10px] text-[#94A3B8] group-hover:border-[#FF6B2B]/40 group-hover:text-white">
                        Load
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card 2: Raw Log & Alert Stream Console */}
            <div className="rounded-lg border border-[#1E2633] bg-[#11151C] p-4 shadow-lg">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-[#38BDF8]" />
                  <h2 className="font-display text-xs font-bold uppercase tracking-wider text-white">
                    2. Raw Log & Alert Telemetry Stream
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHighlightLogLines(!highlightLogLines)}
                    className={`rounded border px-2 py-1 font-mono text-[10px] transition-colors ${
                      highlightLogLines
                        ? "border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]"
                        : "border-[#1E2633] bg-[#090B0E] text-[#94A3B8] hover:text-white"
                    }`}
                  >
                    {highlightLogLines ? "Edit Raw Text" : "Syntax Highlight"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRawLogsInput("");
                      setCustomTitleInput("");
                      setSelectedPresetKey("custom");
                    }}
                    className="flex items-center gap-1 rounded border border-[#1E2633] bg-[#090B0E] px-2 py-1 font-mono text-[10px] text-[#94A3B8] hover:border-[#334155] hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear</span>
                  </button>
                </div>
              </div>

              {/* Optional Custom Incident Title */}
              <div className="mb-3">
                <label className="block font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                  Incident Title (Optional — Model 1 Auto-Generates if Blank)
                </label>
                <input
                  type="text"
                  value={customTitleInput}
                  onChange={(e) => setCustomTitleInput(e.target.value)}
                  placeholder="e.g., Auth-Service Redis Pool Starvation & API 504 Cascade"
                  className="w-full rounded-md border border-[#1E2633] bg-[#090B0E] px-3 py-1.5 text-xs text-white placeholder-[#475569] focus:border-[#FF6B2B] focus:outline-none"
                />
              </div>

              {/* Live Log Stream Metrics Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-md border border-b-0 border-[#1E2633] bg-[#090B0E] px-3 py-1.5 font-mono text-[11px]">
                <span className="text-[#94A3B8]">
                  LINES:{" "}
                  <strong className="text-white">{logStats.totalLines}</strong>
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[#FF453A]">
                    CRITICAL: <strong>{logStats.critical}</strong>
                  </span>
                  <span className="text-[#FF6B2B]">
                    ERROR: <strong>{logStats.errors}</strong>
                  </span>
                  <span className="text-[#FFB020]">
                    WARN: <strong>{logStats.warns}</strong>
                  </span>
                </div>
              </div>

              {/* Monospace Log Input or Syntax Highlighted View */}
              {!highlightLogLines ? (
                <textarea
                  value={rawLogsInput}
                  onChange={(e) => {
                    setRawLogsInput(e.target.value);
                    setSelectedPresetKey("custom");
                  }}
                  rows={11}
                  placeholder="Paste raw container logs, Datadog/Prometheus alerts, stack traces, or Kubernetes events here..."
                  className="w-full rounded-b-md border border-[#1E2633] bg-[#06080A] p-3 font-mono text-xs leading-relaxed text-[#E2E8F0] placeholder-[#475569] focus:border-[#FF6B2B] focus:outline-none resize-y"
                />
              ) : (
                <div className="max-h-[260px] overflow-y-auto rounded-b-md border border-[#1E2633] bg-[#06080A] p-3 font-mono text-[11px] leading-relaxed space-y-1.5">
                  {logStats.lines.map((line, idx) => {
                    const isCrit =
                      /CRITICAL|FATAL|PANIC|OOMKilled|SEV-1|P1/i.test(line);
                    const isErr =
                      !isCrit &&
                      /ERROR|ERR|Exception|504|502|500|Failed|Timeout/i.test(
                        line
                      );
                    const isWarn =
                      !isCrit && !isErr && /WARN|WARNING|Lag/i.test(line);
                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 rounded px-1.5 py-0.5 ${
                          isCrit
                            ? "bg-[#FF453A]/15 text-[#FECACA]"
                            : isErr
                            ? "bg-[#FF6B2B]/10 text-[#FDBA74]"
                            : isWarn
                            ? "bg-[#FFB020]/10 text-[#FDE68A]"
                            : "text-[#CBD5E1]"
                        }`}
                      >
                        <span className="select-none text-[#475569] w-5 shrink-0 text-right">
                          {idx + 1}
                        </span>
                        <span className="break-all">{line}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {errorBanner && (
                <div className="mt-3 flex items-center gap-2 rounded-md border border-[#FF453A]/50 bg-[#FF453A]/10 px-3 py-2 text-xs text-[#FCA5A5]">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[#FF453A]" />
                  <span>{errorBanner}</span>
                </div>
              )}

              {/* Primary CTA Button */}
              <button
                type="button"
                onClick={handleRunTriage}
                disabled={isTriaging}
                className="mt-4 w-full flex items-center justify-center gap-2.5 rounded-md bg-[#FF6B2B] px-5 py-3 font-display text-sm font-bold tracking-wide text-white shadow-[0_0_25px_rgba(255,107,43,0.3)] hover:bg-[#FF6B2B]/90 disabled:opacity-60 transition-all cursor-pointer"
              >
                {isTriaging ? (
                  <>
                    <Activity className="h-4 w-4 animate-spin" />
                    <span>
                      {pipelineStage === 1
                        ? "Stage 1/2: Llama-3.3-70B Classifying Severity & Timeline..."
                        : "Stage 2/2: Qwen3-Coder-30B Synthesizing Root Cause & Postmortem..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>Run Dual-Model Triage</span>
                  </>
                )}
              </button>

              {/* Animated Dual-Model Pipeline Visualizer */}
              <div className="mt-3 rounded-md border border-[#1E2633] bg-[#090B0E] p-3">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#94A3B8] mb-2">
                  <span>DUAL OPEN-WEIGHT MODEL PIPELINE</span>
                  <span className="text-[#8B5CF6]">
                    {activeIncident.telemetry.mode === "live"
                      ? "LIVE GATEWAY"
                      : "MOCK GATEWAY"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Stage 1 Box */}
                  <div
                    className={`rounded border p-2.5 transition-all ${
                      pipelineStage === 1
                        ? "border-[#38BDF8] bg-[#38BDF8]/15 animate-pulse"
                        : "border-[#1E2633] bg-[#11151C]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-[#38BDF8]">
                        STAGE 1 // SUMMARIZER
                      </span>
                      <span className="font-mono text-[10px] text-[#10B981]">
                        {activeIncident.telemetry.model1.latencyMs}ms
                      </span>
                    </div>
                    <div className="font-mono text-xs font-semibold text-white truncate mt-0.5">
                      {activeIncident.telemetry.model1.id}
                    </div>
                    <div className="text-[10px] text-[#94A3B8] mt-1">
                      Severity + Blast Radius + Timeline ({activeIncident.telemetry.model1.promptTokens + activeIncident.telemetry.model1.completionTokens} tok)
                    </div>
                  </div>

                  {/* Stage 2 Box */}
                  <div
                    className={`rounded border p-2.5 transition-all ${
                      pipelineStage === 2
                        ? "border-[#FF6B2B] bg-[#FF6B2B]/15 animate-pulse"
                        : "border-[#1E2633] bg-[#11151C]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-[#FF6B2B]">
                        STAGE 2 // PLANNER
                      </span>
                      <span className="font-mono text-[10px] text-[#10B981]">
                        {activeIncident.telemetry.model2.latencyMs}ms
                      </span>
                    </div>
                    <div className="font-mono text-xs font-semibold text-white truncate mt-0.5">
                      {activeIncident.telemetry.model2.id}
                    </div>
                    <div className="text-[10px] text-[#94A3B8] mt-1">
                      Root Causes + CLI Runbook + Postmortem ({activeIncident.telemetry.model2.promptTokens + activeIncident.telemetry.model2.completionTokens} tok)
                    </div>
                  </div>
                </div>

                {/* Otari feature chips: budget cap, web search, fallback */}
                {(activeIncident.telemetry.budget?.capUsd != null ||
                  activeIncident.telemetry.webSearch ||
                  (activeIncident.telemetry.fallbackEvents?.length ?? 0) > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-mono">
                    {activeIncident.telemetry.budget?.capUsd != null && (
                      <span
                        className={`rounded border px-1.5 py-0.5 ${
                          activeIncident.telemetry.budget.exceeded
                            ? "border-[#F43F5E] text-[#F43F5E]"
                            : "border-[#1E2633] text-[#94A3B8]"
                        }`}
                      >
                        KEY BUDGET ${activeIncident.telemetry.budget.sessionSpentUsd.toFixed(4)} / ${activeIncident.telemetry.budget.capUsd.toFixed(2)}
                        {activeIncident.telemetry.budget.exceeded ? " - CAP ENFORCED" : ""}
                      </span>
                    )}
                    {activeIncident.telemetry.webSearch && (
                      <span className="rounded border border-[#38BDF8]/40 px-1.5 py-0.5 text-[#38BDF8]">
                        OTARI WEB SEARCH: {activeIncident.telemetry.webSearch.resultCount} results into Stage 2
                      </span>
                    )}
                    {(activeIncident.telemetry.fallbackEvents?.length ?? 0) > 0 && (
                      <span
                        className="rounded border border-[#F59E0B]/40 px-1.5 py-0.5 text-[#F59E0B]"
                        title={activeIncident.telemetry.fallbackEvents!.join("\n")}
                      >
                        ROUTING/FALLBACK EVENTS x{activeIncident.telemetry.fallbackEvents!.length}
                      </span>
                    )}
                  </div>
                )}

                {/* Expandable Raw Gateway Telemetry Inspector */}
                <div className="mt-2.5 flex items-center justify-between border-t border-[#1E2633] pt-2 text-[11px] font-mono">
                  <span className="text-[#94A3B8] truncate max-w-[230px]">
                    Endpoint: {activeIncident.telemetry.endpointUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setShowRawTelemetryJson(!showRawTelemetryJson)
                    }
                    className="text-[#8B5CF6] hover:underline shrink-0"
                  >
                    {showRawTelemetryJson
                      ? "Hide Gateway JSON"
                      : "Inspect Gateway JSON"}
                  </button>
                </div>
                {showRawTelemetryJson && (
                  <pre className="mt-2 max-h-40 overflow-auto rounded border border-[#1E2633] bg-[#06080A] p-2 font-mono text-[10px] text-[#C4B5FD]">
                    {JSON.stringify(activeIncident.telemetry, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </section>

          {/* ==============================================================
              RIGHT COLUMN (7 COLS): MULTI-MODEL TRIAGE INTELLIGENCE DECK
             ============================================================== */}
          <section className="lg:col-span-7 flex flex-col gap-5">
            {/* EXECUTIVE TRIAGE SUMMARY BANNER */}
            <div
              className={`rounded-lg border border-[#1E2633] bg-[#11151C] p-5 shadow-lg ${getSeverityLeftBorder(
                activeIncident.severity
              )}`}
            >
              {/* Top Row: Severity Badge + Incident Code + Confidence + Status Selector */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 font-mono text-xs font-bold tracking-wider uppercase ${getSeverityBadgeStyle(
                      activeIncident.severity
                    )}`}
                  >
                    <AlertOctagon className="h-3.5 w-3.5" />
                    <span>{activeIncident.severity} CRITICALITY</span>
                  </span>
                  <span className="rounded border border-[#1E2633] bg-[#090B0E] px-2.5 py-1 font-mono text-xs font-semibold text-white">
                    {activeIncident.incidentCode}
                  </span>
                  <span className="rounded border border-[#1E2633] bg-[#090B0E] px-2.5 py-1 font-mono text-xs text-[#38BDF8]">
                    CONFIDENCE: <strong>{activeIncident.confidence}%</strong>
                  </span>
                </div>

                {/* Status Selector */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase text-[#94A3B8]">
                    State:
                  </span>
                  <select
                    value={activeIncident.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    aria-label="Incident Status"
                    className={`rounded border px-2.5 py-1 font-mono text-xs font-semibold focus:outline-none ${
                      activeIncident.status === "RESOLVED"
                        ? "border-[#10B981]/50 bg-[#10B981]/15 text-[#10B981]"
                        : activeIncident.status === "MITIGATING"
                        ? "border-[#FFB020]/50 bg-[#FFB020]/15 text-[#FFB020]"
                        : "border-[#FF453A]/50 bg-[#FF453A]/15 text-[#FF453A]"
                    }`}
                  >
                    <option value="INVESTIGATING" className="bg-[#11151C] text-white">
                      INVESTIGATING
                    </option>
                    <option value="MITIGATING" className="bg-[#11151C] text-white">
                      MITIGATING
                    </option>
                    <option value="RESOLVED" className="bg-[#11151C] text-white">
                      RESOLVED
                    </option>
                  </select>
                </div>
              </div>

              {/* Incident Title */}
              <h1 className="font-display text-xl font-bold tracking-tight text-white mb-2">
                {activeIncident.title}
              </h1>

              {/* Model 1 Executive Summary */}
              <p className="text-sm leading-relaxed text-[#E2E8F0] mb-4">
                {activeIncident.summary}
              </p>

              {/* Blast Radius & Affected Services Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border border-[#1E2633] bg-[#090B0E] p-3.5">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#FF6B2B] mb-1">
                    Customer & System Blast Radius
                  </div>
                  <p className="text-xs text-[#CBD5E1] leading-snug">
                    {activeIncident.blastRadius}
                  </p>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-[#38BDF8] mb-1.5">
                    Impacted Services & Signatures
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeIncident.affectedServices.map((srv) => (
                      <span
                        key={srv}
                        className="rounded border border-[#1E2633] bg-[#11151C] px-2 py-0.5 font-mono text-[11px] text-[#F1F5F9]"
                      >
                        {srv}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Model Attribution Footer */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#94A3B8]">
                <div className="flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-[#38BDF8]" />
                  <span>
                    Classified by{" "}
                    <strong className="text-[#CBD5E1]">
                      {activeIncident.telemetry.model1.id}
                    </strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#FF6B2B]" />
                  <span>
                    Remediation by{" "}
                    <strong className="text-[#CBD5E1]">
                      {activeIncident.telemetry.model2.id}
                    </strong>
                  </span>
                </div>
              </div>
            </div>

            {/* SUB-VIEW NAVIGATION BAR */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1E2633] bg-[#11151C] p-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("timeline");
                    setViewAllPanels(false);
                  }}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                    !viewAllPanels && activeTab === "timeline"
                      ? "bg-[#FF6B2B] text-white shadow"
                      : "text-[#94A3B8] hover:bg-[#161B24] hover:text-white"
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Timeline</span>
                  <span className="rounded bg-black/30 px-1.5 py-0.2 font-mono text-[10px]">
                    {activeIncident.timeline.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("root-causes");
                    setViewAllPanels(false);
                  }}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                    !viewAllPanels && activeTab === "root-causes"
                      ? "bg-[#FF6B2B] text-white shadow"
                      : "text-[#94A3B8] hover:bg-[#161B24] hover:text-white"
                  }`}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Root-Cause Guesses</span>
                  <span className="rounded bg-black/30 px-1.5 py-0.2 font-mono text-[10px]">
                    {activeIncident.rootCauses.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("next-steps");
                    setViewAllPanels(false);
                  }}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                    !viewAllPanels && activeTab === "next-steps"
                      ? "bg-[#FF6B2B] text-white shadow"
                      : "text-[#94A3B8] hover:bg-[#161B24] hover:text-white"
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Next Steps</span>
                  <span className="rounded bg-black/30 px-1.5 py-0.2 font-mono text-[10px]">
                    {completedStepsCount}/{activeIncident.nextSteps.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("postmortem");
                    setViewAllPanels(false);
                  }}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition-all ${
                    !viewAllPanels && activeTab === "postmortem"
                      ? "bg-[#FF6B2B] text-white shadow"
                      : "text-[#94A3B8] hover:bg-[#161B24] hover:text-white"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Postmortem Draft</span>
                </button>
              </div>

              {/* Toggle Stacked All-Panels Mode */}
              <button
                type="button"
                onClick={() => setViewAllPanels(!viewAllPanels)}
                className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
                  viewAllPanels
                    ? "border-[#8B5CF6] bg-[#8B5CF6]/20 text-white"
                    : "border-[#1E2633] bg-[#090B0E] text-[#94A3B8] hover:text-white"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>{viewAllPanels ? "Tabbed View" : "Expand All 4"}</span>
              </button>
            </div>

            {/* ==============================================================
                PANEL 1: INCIDENT TIMELINE
               ============================================================== */}
            {(viewAllPanels || activeTab === "timeline") && (
              <div className="rounded-lg border border-[#1E2633] bg-[#11151C] p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#38BDF8]" />
                      <h3 className="font-display text-base font-bold text-white">
                        Chronological Incident Timeline
                      </h3>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Extracted by Model 1 ({activeIncident.telemetry.model1.id}) from raw timestamped telemetry
                    </p>
                  </div>

                  {/* Severity Filter Pills */}
                  <div className="flex items-center gap-1 rounded-md border border-[#1E2633] bg-[#090B0E] p-1 font-mono text-[10px]">
                    <button
                      type="button"
                      onClick={() => setTimelineFilter("ALL")}
                      className={`rounded px-2 py-1 ${
                        timelineFilter === "ALL"
                          ? "bg-[#1E2633] text-white font-semibold"
                          : "text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      ALL ({activeIncident.timeline.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter("CRITICAL_ERROR")}
                      className={`rounded px-2 py-1 ${
                        timelineFilter === "CRITICAL_ERROR"
                          ? "bg-[#FF453A]/20 text-[#FF453A] font-semibold"
                          : "text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      CRIT/ERR
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimelineFilter("WARN_INFO")}
                      className={`rounded px-2 py-1 ${
                        timelineFilter === "WARN_INFO"
                          ? "bg-[#FFB020]/20 text-[#FFB020] font-semibold"
                          : "text-[#94A3B8] hover:text-white"
                      }`}
                    >
                      WARN/INFO
                    </button>
                  </div>
                </div>

                {/* Vertical Timeline Rail */}
                <div className="relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#1E2633]">
                  {filteredTimeline.map((item) => (
                    <div
                      key={item.id}
                      className="relative rounded-md border border-[#1E2633] bg-[#090B0E] p-3.5 hover:border-[#334155] transition-colors"
                    >
                      {/* Node Dot on Rail */}
                      <span
                        className={`absolute -left-[19px] top-4 h-3 w-3 rounded-full border-2 border-[#090B0E] ${getLevelDotColor(
                          item.level
                        )}`}
                      />

                      <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {item.timestamp}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${getLevelBadgeColor(
                              item.level
                            )}`}
                          >
                            {item.level}
                          </span>
                          <span className="rounded border border-[#1E2633] bg-[#11151C] px-2 py-0.5 font-mono text-[11px] text-[#38BDF8]">
                            {item.service}
                          </span>
                          {item.isTrigger && (
                            <span className="rounded border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#C4B5FD]">
                              INITIAL TRIGGER
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-[#F1F5F9] leading-relaxed mb-2">
                        {item.event}
                      </p>

                      <div className="rounded border border-[#1E2633] bg-[#06080A] px-2.5 py-1.5 font-mono text-[11px] text-[#94A3B8] break-all">
                        {item.rawSnippet}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                PANEL 2: ROOT-CAUSE GUESSES
               ============================================================== */}
            {(viewAllPanels || activeTab === "root-causes") && (
              <div className="rounded-lg border border-[#1E2633] bg-[#11151C] p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-[#FF6B2B]" />
                      <h3 className="font-display text-base font-bold text-white">
                        Ranked Root-Cause Hypotheses
                      </h3>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Synthesized by Model 2 ({activeIncident.telemetry.model2.id}) with log correlation & verification commands
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {activeIncident.rootCauses.map((rc) => (
                    <div
                      key={rc.id}
                      className="rounded-md border border-[#1E2633] bg-[#090B0E] p-4 hover:border-[#334155] transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#FF6B2B]/20 font-mono text-xs font-bold text-[#FF6B2B]">
                            #{rc.rank}
                          </span>
                          <h4 className="font-display text-sm font-bold text-white">
                            {rc.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded border border-[#1E2633] bg-[#11151C] px-2 py-0.5 font-mono text-[10px] text-[#94A3B8]">
                            {rc.category}
                          </span>
                          <span className="rounded bg-[#FF6B2B]/15 px-2 py-0.5 font-mono text-xs font-bold text-[#FF6B2B]">
                            {rc.probability}% Match
                          </span>
                        </div>
                      </div>

                      {/* Probability Bar */}
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E2633] mb-3">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#FF6B2B] to-[#FFB020]"
                          style={{ width: `${rc.probability}%` }}
                        />
                      </div>

                      <p className="text-xs leading-relaxed text-[#CBD5E1] mb-3">
                        {rc.mechanism}
                      </p>

                      {/* Supporting Evidence */}
                      <div className="mb-3">
                        <div className="font-mono text-[10px] uppercase tracking-wider text-[#94A3B8] mb-1">
                          Supporting Telemetry Evidence:
                        </div>
                        <div className="space-y-1">
                          {rc.supportingEvidence.map((ev, i) => (
                            <div
                              key={i}
                              className="rounded border border-[#1E2633] bg-[#06080A] px-2.5 py-1 font-mono text-[11px] text-[#38BDF8] break-all"
                            >
                              {ev}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Verification Command */}
                      <div className="flex items-center justify-between gap-2 rounded border border-[#1E2633] bg-[#11151C] px-3 py-2">
                        <div className="min-w-0">
                          <span className="block font-mono text-[10px] uppercase text-[#10B981]">
                            Diagnostic Verification Command:
                          </span>
                          <code className="font-mono text-xs text-white break-all">
                            $ {rc.verificationCommand}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleCopyText(rc.id, rc.verificationCommand)
                          }
                          className="shrink-0 flex items-center gap-1 rounded border border-[#1E2633] bg-[#090B0E] px-2.5 py-1.5 font-mono text-[11px] text-[#CBD5E1] hover:border-[#334155] hover:text-white"
                        >
                          {copiedId === rc.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#10B981]" />
                              <span className="text-[#10B981]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy CLI</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                PANEL 3: NEXT STEPS & REMEDIATION RUNBOOK
               ============================================================== */}
            {(viewAllPanels || activeTab === "next-steps") && (
              <div className="rounded-lg border border-[#1E2633] bg-[#11151C] p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-[#10B981]" />
                      <h3 className="font-display text-base font-bold text-white">
                        Actionable Next Steps & Remediation Runbook
                      </h3>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Generated by Model 2 ({activeIncident.telemetry.model2.id}) — Interactive checklist synced with PostgreSQL
                    </p>
                  </div>

                  <div className="rounded border border-[#1E2633] bg-[#090B0E] px-3 py-1 font-mono text-xs text-[#10B981]">
                    {completedStepsCount} / {activeIncident.nextSteps.length}{" "}
                    Completed
                  </div>
                </div>

                <div className="space-y-3">
                  {activeIncident.nextSteps.map((step) => (
                    <div
                      key={step.id}
                      className={`rounded-md border p-4 transition-all ${
                        step.completed
                          ? "border-[#10B981]/40 bg-[#10B981]/5"
                          : "border-[#1E2633] bg-[#090B0E]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={step.completed}
                            onChange={() => handleToggleStep(step.id)}
                            className="mt-1 h-4 w-4 rounded border-[#334155] bg-[#11151C] accent-[#10B981]"
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span
                                className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                  step.phase === "IMMEDIATE"
                                    ? "bg-[#FF453A]/20 text-[#FF453A]"
                                    : step.phase === "STABILIZE"
                                    ? "bg-[#FFB020]/20 text-[#FFB020]"
                                    : "bg-[#38BDF8]/20 text-[#38BDF8]"
                                }`}
                              >
                                {step.phase}
                              </span>
                              <span className="font-mono text-[11px] text-[#94A3B8]">
                                Owner: {step.ownerRole}
                              </span>
                            </div>
                            <h4
                              className={`font-display text-sm font-bold ${
                                step.completed
                                  ? "line-through text-[#94A3B8]"
                                  : "text-white"
                              }`}
                            >
                              {step.title}
                            </h4>
                            <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                              {step.rationale}
                            </p>
                          </div>
                        </label>
                      </div>

                      {/* Command Block */}
                      <div className="mt-3 flex items-center justify-between gap-2 rounded border border-[#1E2633] bg-[#06080A] px-3 py-2">
                        <code className="font-mono text-xs text-[#10B981] break-all">
                          $ {step.command}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyText(step.id, step.command)}
                          className="shrink-0 flex items-center gap-1 rounded border border-[#1E2633] bg-[#11151C] px-2.5 py-1 font-mono text-[11px] text-[#CBD5E1] hover:border-[#334155] hover:text-white"
                        >
                          {copiedId === step.id ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-[#10B981]" />
                              <span className="text-[#10B981]">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy CLI</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Rollback Note */}
                      <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-[#94A3B8]">
                        <Info className="h-3.5 w-3.5 text-[#FFB020] shrink-0" />
                        <span>Rollback / Safety: {step.rollbackNote}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ==============================================================
                PANEL 4: BLAMELESS POSTMORTEM DRAFT
               ============================================================== */}
            {(viewAllPanels || activeTab === "postmortem") && (
              <div className="rounded-lg border border-[#1E2633] bg-[#11151C] p-5 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#8B5CF6]" />
                      <h3 className="font-display text-base font-bold text-white">
                        Blameless Postmortem Draft
                      </h3>
                    </div>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Auto-drafted by dual-model pipeline — Edit Markdown, copy, or export <code className="font-mono">.md</code>
                    </p>
                  </div>

                  {/* Postmortem Action Toolbar */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPostmortemEditMode(!postmortemEditMode)}
                      className="flex items-center gap-1.5 rounded border border-[#1E2633] bg-[#090B0E] px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] hover:border-[#334155] hover:text-white"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#38BDF8]" />
                      <span>
                        {postmortemEditMode
                          ? "Formatted Preview"
                          : "Edit Markdown"}
                      </span>
                    </button>

                    {postmortemEditMode && (
                      <button
                        type="button"
                        onClick={handleSavePostmortem}
                        disabled={isSavingPostmortem}
                        className="flex items-center gap-1.5 rounded border border-[#10B981]/50 bg-[#10B981]/15 px-2.5 py-1.5 text-xs font-semibold text-[#10B981] hover:bg-[#10B981]/25"
                      >
                        <Save className="h-3.5 w-3.5" />
                        <span>
                          {isSavingPostmortem ? "Saving..." : "Save to DB"}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText("postmortem-copy", postmortemDraftText)
                      }
                      className="flex items-center gap-1.5 rounded border border-[#1E2633] bg-[#090B0E] px-2.5 py-1.5 text-xs font-medium text-[#CBD5E1] hover:border-[#334155] hover:text-white"
                    >
                      {copiedId === "postmortem-copy" ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-[#10B981]" />
                          <span className="text-[#10B981]">Copied MD</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Markdown</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadPostmortem}
                      className="flex items-center gap-1.5 rounded bg-[#8B5CF6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#8B5CF6]/90"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export .md</span>
                    </button>
                  </div>
                </div>

                {postmortemEditMode ? (
                  <textarea
                    value={postmortemDraftText}
                    onChange={(e) => setPostmortemDraftText(e.target.value)}
                    rows={18}
                    className="w-full rounded-md border border-[#1E2633] bg-[#06080A] p-4 font-mono text-xs leading-relaxed text-[#E2E8F0] focus:border-[#8B5CF6] focus:outline-none"
                  />
                ) : (
                  <div className="rounded-md border border-[#1E2633] bg-[#090B0E] p-5 font-mono text-xs leading-relaxed text-[#E2E8F0] whitespace-pre-wrap overflow-x-auto max-h-[540px] overflow-y-auto">
                    {postmortemDraftText}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* PERSISTENT AI-ASSISTANCE DISCLOSURE & HACKATHON FOOTER */}
      <footer className="mt-8 border-t border-[#1E2633] bg-[#11151C] px-4 py-5 lg:px-6">
        <div className="mx-auto max-w-[1600px] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#C4B5FD]">
                <ShieldCheck className="h-3 w-3" />
                AI-Assistance & Open-Weight Model Disclosure
              </span>
              <span className="font-mono text-xs font-semibold text-white">
                Signal Room MVP — Mozilla Otari &apos;Devs Wilding Online&apos; Hackathon
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] max-w-4xl leading-relaxed">
              This application was developed with AI coding assistance and uses a dual open-weight model pipeline (
              <code className="font-mono text-[#CBD5E1]">{MODEL_1_ID}</code> for severity classification/timeline &{" "}
              <code className="font-mono text-[#CBD5E1]">{MODEL_2_ID}</code> for root-cause/remediation planning) via an{" "}
              <code className="font-mono text-[#CBD5E1]">any-llm</code> OpenAI-compatible gateway. When no API key is configured, deterministic Mock Mode runs locally with zero external data transmission. Always verify CLI commands before running in production.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsGatewayModalOpen(true)}
              className="rounded border border-[#1E2633] bg-[#090B0E] px-3 py-1.5 font-mono text-xs text-[#CBD5E1] hover:border-[#334155] hover:text-white"
            >
              Configure Gateway
            </button>
            <button
              type="button"
              onClick={() => setIsDisclosureOpen(true)}
              className="rounded border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 px-3 py-1.5 font-mono text-xs font-semibold text-[#C4B5FD] hover:bg-[#8B5CF6]/25"
            >
              Read Full Disclosure
            </button>
          </div>
        </div>
      </footer>

      {/* MODALS */}
      <AiDisclosureModal
        isOpen={isDisclosureOpen}
        onClose={() => setIsDisclosureOpen(false)}
      />
      <GatewayConfigModal
        isOpen={isGatewayModalOpen}
        onClose={() => setIsGatewayModalOpen(false)}
        settings={gatewaySettings}
        onChangeSettings={setGatewaySettings}
        hasServerApiKey={serverGatewayStatus.hasServerApiKey}
      />
    </div>
  );
}

function getSeverityBadgeStyle(severity: string): string {
  switch (severity) {
    case "SEV-1":
      return "bg-[#FF453A]/20 text-[#FF453A] border border-[#FF453A]/40";
    case "SEV-2":
      return "bg-[#FF6B2B]/20 text-[#FF6B2B] border border-[#FF6B2B]/40";
    case "SEV-3":
      return "bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/40";
    default:
      return "bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/40";
  }
}

function getSeverityLeftBorder(severity: string): string {
  switch (severity) {
    case "SEV-1":
      return "border-l-4 border-l-[#FF453A]";
    case "SEV-2":
      return "border-l-4 border-l-[#FF6B2B]";
    case "SEV-3":
      return "border-l-4 border-l-[#FFB020]";
    default:
      return "border-l-4 border-l-[#38BDF8]";
  }
}

function getLevelBadgeColor(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "bg-[#FF453A]/20 text-[#FF453A]";
    case "ERROR":
      return "bg-[#FF6B2B]/20 text-[#FF6B2B]";
    case "WARN":
      return "bg-[#FFB020]/20 text-[#FFB020]";
    default:
      return "bg-[#38BDF8]/20 text-[#38BDF8]";
  }
}

function getLevelDotColor(level: string): string {
  switch (level) {
    case "CRITICAL":
      return "bg-[#FF453A] shadow-[0_0_8px_#FF453A]";
    case "ERROR":
      return "bg-[#FF6B2B]";
    case "WARN":
      return "bg-[#FFB020]";
    default:
      return "bg-[#38BDF8]";
  }
}
