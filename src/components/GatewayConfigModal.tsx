"use client";

import React from "react";
import { Server, Key, Cpu, X, Check, Sparkles } from "lucide-react";

export interface ClientGatewaySettings {
  forceMock: boolean;
  baseUrl: string;
  apiKey: string;
  model1Id: string;
  model2Id: string;
}

interface GatewayConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ClientGatewaySettings;
  onChangeSettings: (next: ClientGatewaySettings) => void;
  hasServerApiKey: boolean;
}

export function GatewayConfigModal({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  hasServerApiKey,
}: GatewayConfigModalProps) {
  if (!isOpen) return null;

  const isLiveReady =
    !settings.forceMock && (Boolean(settings.apiKey.trim()) || hasServerApiKey);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-lg border border-[#1E2633] bg-[#11151C] text-[#F1F5F9] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1E2633] bg-[#161B24] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-[#8B5CF6]/40 bg-[#8B5CF6]/15 text-[#8B5CF6]">
              <Server className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Mozilla Otari / any-llm Gateway Configuration
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Configure dual open-weight model routing or deterministic mock fallback
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-[#1E2633] bg-[#090B0E] p-1.5 text-[#94A3B8] hover:text-white"
            aria-label="Close gateway settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6 text-xs">
          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                onChangeSettings({ ...settings, forceMock: true })
              }
              className={`flex flex-col items-start rounded-md border p-3.5 text-left transition-all ${
                settings.forceMock
                  ? "border-[#FFB020] bg-[#FFB020]/10 text-white"
                  : "border-[#1E2633] bg-[#090B0E] text-[#94A3B8] hover:border-[#334155]"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="font-mono text-[11px] font-bold uppercase text-[#FFB020]">
                  Mock Mode (Default)
                </span>
                {settings.forceMock && (
                  <Check className="h-4 w-4 text-[#FFB020]" />
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-snug">
                Zero API key required. Uses deterministic dual-model simulation & dynamic log parser.
              </p>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeSettings({ ...settings, forceMock: false })
              }
              className={`flex flex-col items-start rounded-md border p-3.5 text-left transition-all ${
                !settings.forceMock
                  ? "border-[#10B981] bg-[#10B981]/10 text-white"
                  : "border-[#1E2633] bg-[#090B0E] text-[#94A3B8] hover:border-[#334155]"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="font-mono text-[11px] font-bold uppercase text-[#10B981]">
                  Live any-llm Gateway
                </span>
                {!settings.forceMock && (
                  <Check className="h-4 w-4 text-[#10B981]" />
                )}
              </div>
              <p className="text-[11px] text-[#94A3B8] leading-snug">
                Routes Stage 1 & Stage 2 prompts via OpenAI-compatible{" "}
                <code className="font-mono">/v1/chat/completions</code>.
              </p>
            </button>
          </div>

          {/* Gateway Base URL */}
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-wider text-[#94A3B8] mb-1.5">
              Gateway Base URL (Mozilla Otari / any-llm / Ollama / OpenRouter)
            </label>
            <input
              type="text"
              value={settings.baseUrl}
              onChange={(e) =>
                onChangeSettings({ ...settings, baseUrl: e.target.value })
              }
              placeholder="https://gateway.otari.mozilla.ai/v1"
              className="w-full rounded-md border border-[#1E2633] bg-[#090B0E] px-3 py-2 font-mono text-xs text-white focus:border-[#8B5CF6] focus:outline-none"
            />
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-mono text-[11px] uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-[#8B5CF6]" />
                <span>Gateway API Key (Optional — Mock Mode active if blank)</span>
              </label>
              {hasServerApiKey && (
                <span className="rounded bg-[#10B981]/15 px-2 py-0.5 font-mono text-[10px] text-[#10B981]">
                  Server ENV Key Detected
                </span>
              )}
            </div>
            <input
              type="password"
              value={settings.apiKey}
              onChange={(e) =>
                onChangeSettings({
                  ...settings,
                  apiKey: e.target.value,
                  forceMock: e.target.value.trim() ? false : settings.forceMock,
                })
              }
              placeholder={
                hasServerApiKey
                  ? "Using server OTARI_API_KEY / ANY_LLM_API_KEY..."
                  : "Enter Bearer token or leave blank for Mock Mode"
              }
              className="w-full rounded-md border border-[#1E2633] bg-[#090B0E] px-3 py-2 font-mono text-xs text-white focus:border-[#8B5CF6] focus:outline-none"
            />
          </div>

          {/* Open-Weight Models */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-[#38BDF8] mb-1.5 flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5" />
                <span>Model 1: Summarizer & Classifier</span>
              </label>
              <input
                type="text"
                value={settings.model1Id}
                onChange={(e) =>
                  onChangeSettings({ ...settings, model1Id: e.target.value })
                }
                className="w-full rounded-md border border-[#1E2633] bg-[#090B0E] px-3 py-2 font-mono text-xs text-white focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-mono text-[11px] uppercase tracking-wider text-[#FF6B2B] mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Model 2: Remediation & Postmortem</span>
              </label>
              <input
                type="text"
                value={settings.model2Id}
                onChange={(e) =>
                  onChangeSettings({ ...settings, model2Id: e.target.value })
                }
                className="w-full rounded-md border border-[#1E2633] bg-[#090B0E] px-3 py-2 font-mono text-xs text-white focus:border-[#FF6B2B] focus:outline-none"
              />
            </div>
          </div>

          {/* Status Indicator */}
          <div className="rounded-md border border-[#1E2633] bg-[#090B0E] p-3 flex items-center justify-between">
            <span className="text-[#94A3B8]">Effective Gateway Routing:</span>
            {isLiveReady ? (
              <span className="font-mono font-semibold text-[#10B981]">
                LIVE GATEWAY ({settings.baseUrl})
              </span>
            ) : (
              <span className="font-mono font-semibold text-[#FFB020]">
                DETERMINISTIC MOCK MODE (No API Key Required)
              </span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[#1E2633] bg-[#161B24] px-6 py-3">
          <button
            onClick={onClose}
            className="rounded-md bg-[#FF6B2B] px-4 py-2 text-xs font-semibold text-white hover:bg-[#FF6B2B]/90 transition-colors"
          >
            Save Gateway Config
          </button>
        </div>
      </div>
    </div>
  );
}
