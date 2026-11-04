'use client';

import React, { useEffect, useState } from 'react';
import { Cpu, DollarSign, Activity, FileCode, Plus, Check } from 'lucide-react';
import { apiClient, AiMetrics, AiPromptTemplate } from '@/lib/api-client';

export default function AdminAiPromptsPage() {
  const [metrics, setMetrics] = useState<AiMetrics | null>(null);
  const [prompts, setPrompts] = useState<AiPromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadAiData() {
      try {
        setLoading(true);
        const [metricsRes, promptsRes] = await Promise.all([
          apiClient.getAiMetrics(),
          apiClient.getAiPrompts(),
        ]);
        setMetrics(metricsRes);
        setPrompts(Array.isArray(promptsRes) ? promptsRes : []);
      } catch (err: any) {
        setError(err.message || 'Failed to load AI administration telemetry');
      } finally {
        setLoading(false);
      }
    }
    loadAiData();
  }, []);

  const totalTokens = metrics?.totalTokensUsed ?? 0;
  const totalCalls = metrics?.totalExecutions ?? 0;
  const cost = metrics?.estimatedCostUsd ?? 0;
  const latency = metrics?.avgLatencyMs ?? 0;
  const safePrompts = Array.isArray(prompts) ? prompts : [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
              Prompt & Cost Control
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">AI Engine & Global Prompts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Global LLM token consumption, inference cost accounting, and version-controlled prompt templates.
          </p>
        </div>

        <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-purple-600 hover:bg-purple-500 text-white transition shadow-sm">
          <Plus className="w-4 h-4" />
          <span>New Prompt Template</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <strong>API Error:</strong> {error}
        </div>
      )}

      {/* Real Token & Cost Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Tokens Consumed</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '...' : totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Average Latency: <span className="text-slate-300 font-mono">{latency}ms</span> per call
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Estimated Expenditure</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {loading ? '...' : `$${cost.toFixed(4)}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Calculated across Gemini 1.5 & Claude 3.5 price tiers
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Inference Executions</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {loading ? '...' : totalCalls.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Attribute extraction, normalization & multi-source enrichment
          </div>
        </div>
      </div>

      {/* Prompt Templates Table */}
      <div className="space-y-4">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <FileCode className="w-4 h-4 text-purple-400" />
          <span>Active Prompt Templates</span>
        </h3>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="py-3 px-4">Template Name</th>
                <th className="py-3 px-4">Domain / Task</th>
                <th className="py-3 px-4">Version</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    Loading templates from database...
                  </td>
                </tr>
              ) : safePrompts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                    No custom templates configured yet. System default prompts are active.
                  </td>
                </tr>
              ) : (
                safePrompts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-850/50 transition">
                    <td className="py-3 px-4 font-sans font-medium text-white">{p.name || p.slug}</td>
                    <td className="py-3 px-4 text-slate-400">{p.taskType}</td>
                    <td className="py-3 px-4 text-purple-400">v{p.version}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <button className="text-xs text-purple-400 hover:text-purple-300 font-medium transition">
                        Edit Prompt →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
