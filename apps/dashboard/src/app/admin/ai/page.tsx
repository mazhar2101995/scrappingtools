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
    <div className="space-y-8 w-full font-sans">
      <div className="p-7 rounded-xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              PROMPT & COST CONTROL
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            AI Engine & Global Prompt Registry
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Global LLM token consumption, inference cost accounting, and version-controlled prompt templates.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <strong>API Error:</strong> {error}
        </div>
      )}

      {/* Real Token & Cost Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Tokens Consumed</span>
            <Cpu className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            {loading ? '...' : totalTokens.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Average Latency: <span className="text-slate-900 font-bold font-mono">{latency}ms</span> per call
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Estimated Expenditure</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700 font-mono">
            {loading ? '...' : `$${cost.toFixed(4)}`}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Calculated across Gemini 1.5 & Claude 3.5 price tiers
          </div>
        </div>

        <div className="p-5 rounded-xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Inference Executions</span>
            <Activity className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            {loading ? '...' : totalCalls.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            Attribute extraction, normalization & enrichment
          </div>
        </div>
      </div>

      {/* Prompt Templates Table */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#8a6e19]" />
          <span>Active Prompt Templates</span>
        </h3>

        <div className="rounded-xl border border-[#ebdcb9] bg-white overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-[#fcfaf5] border-b border-[#ebdcb9] text-[11px] uppercase tracking-wider text-slate-500 font-mono">
              <tr>
                <th className="py-3.5 px-5">Template Name</th>
                <th className="py-3.5 px-4">Domain / Task</th>
                <th className="py-3.5 px-4">Version</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-5 text-right">Model Preference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    Loading templates from database...
                  </td>
                </tr>
              ) : safePrompts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                    No custom templates configured yet.
                  </td>
                </tr>
              ) : (
                safePrompts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#faf7ee]/60 transition">
                    <td className="py-3.5 px-5 font-sans font-bold text-slate-900">{p.name || p.slug}</td>
                    <td className="py-3.5 px-4 text-slate-500">{p.taskType}</td>
                    <td className="py-3.5 px-4 text-[#8a6e19] font-bold">v{p.version}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase">
                        Active
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-slate-600 font-semibold">
                      {p.modelPreference || 'gpt-4o-mini'}
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
