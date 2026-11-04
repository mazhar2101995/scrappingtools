'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Cpu,
  Layers,
  Activity,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Users,
  RefreshCw,
  ExternalLink,
  ArrowUpRight,
  Server,
  Database,
  Radio,
  FileCode,
  AlertCircle
} from 'lucide-react';
import { apiClient, PlatformAdminData } from '@/lib/api-client';

export default function PlatformAdminControlCenter() {
  const [data, setData] = useState<PlatformAdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAdminData() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getPlatformAdminOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load platform admin control telemetry');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl mx-auto animate-pulse">
        <div className="h-20 bg-slate-900/60 rounded-xl border border-slate-800"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-900/40 rounded-xl border border-slate-800"></div>
          ))}
        </div>
        <div className="h-64 bg-slate-900/40 rounded-xl border border-slate-800"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Platform Admin Authentication / Connection Error</h3>
              <p className="text-xs text-rose-300 mt-1">{error || 'Unknown API authorization error'}</p>
            </div>
          </div>
          <button
            onClick={loadAdminData}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium transition"
          >
            Retry Loading Control Center
          </button>
        </div>
      </div>
    );
  }

  const { systemStatus, globalMetrics, criticalIncidents, recentActivity } = data;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* A. Platform Status Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider">
              Control Center
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges Active</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Global SaaS Control Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time infrastructure health, cross-tenant telemetry, and LLM inference accounting.
          </p>
        </div>

        {/* B. Admin Action Center */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/review"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition shadow-sm"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>Review Queue ({globalMetrics.pendingReviewCount})</span>
          </Link>
          <Link
            href="/admin/organizations"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 text-xs font-medium transition shadow-sm"
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Manage Tenants</span>
          </Link>
          <Link
            href="/admin/ai"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition shadow-sm"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Prompts & Costs</span>
          </Link>
        </div>
      </div>

      {/* Cluster Health Pill Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="px-3.5 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-xs text-slate-300 font-medium">Core API</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 uppercase">
            {systemStatus.coreApi}
          </span>
        </div>

        <div className="px-3.5 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs text-slate-300 font-medium">PostgreSQL 16</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 uppercase">
            {systemStatus.database}
          </span>
        </div>

        <div className="px-3.5 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-xs text-slate-300 font-medium">Redis 7 Cluster</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 uppercase">
            {systemStatus.redis}
          </span>
        </div>

        <div className="px-3.5 py-2.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-slate-300 font-medium">BullMQ Workers</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
            systemStatus.workers === 'healthy' 
              ? 'bg-emerald-500/10 text-emerald-400' 
              : 'bg-amber-500/10 text-amber-400'
          }`}>
            {systemStatus.workers}
          </span>
        </div>
      </div>

      {/* C. GLOBAL PLATFORM METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Link href="/admin/organizations" className="block group">
          <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 transition shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Total Tenants</span>
              <Building2 className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">
              {globalMetrics.totalOrganizations}
            </div>
            <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
              <span className="text-indigo-400 font-medium">{globalMetrics.totalUsers} users</span> across organizations
            </div>
          </div>
        </Link>

        {/* Metric 2 */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Global Products</span>
            <Layers className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {globalMetrics.totalProducts.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="text-emerald-400 font-medium">{globalMetrics.verifiedProducts} verified</span> canonical items
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">AI Tokens Consumed</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {globalMetrics.aiTokensUsed.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="text-purple-400 font-medium">{globalMetrics.aiExecutions} inference calls</span> executed
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Estimated AI Cost</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            ${globalMetrics.aiEstimatedCostUsd.toFixed(4)}
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <span className="text-slate-400">Blended LLM token accounting</span>
          </div>
        </div>
      </div>

      {/* D. CRITICAL ATTENTION / INCIDENTS */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Critical Platform Alerts & Incidents ({criticalIncidents.length})</span>
        </h2>

        {criticalIncidents.length === 0 ? (
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-slate-200">Zero Critical Incidents</h4>
              <p className="text-[11px] text-slate-400">
                All database partitions, BullMQ job queues, and FastAPI scraping containers are operating within baseline latency.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {criticalIncidents.map((inc) => (
              <div
                key={inc.id}
                className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/20 text-rose-300 uppercase">
                      {inc.severity}
                    </span>
                    <span className="text-xs font-semibold text-white">{inc.service}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{inc.description}</p>
                </div>
                <span className="text-[11px] text-slate-500">{new Date(inc.detectedAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* E & H: Bottom Grid - Recent Global Platform Activity & Subsystem Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Global Ingestion Pipeline */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              <span>Global Ingestion & Scraping Activity</span>
            </h3>
            <span className="text-xs text-slate-500">Live BullMQ Stream</span>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-3 px-4">Target Source URL</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Extracted Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 font-sans">
                      No recent jobs recorded.
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3 px-4 font-sans font-medium text-white max-w-xs truncate">
                        {a.targetUrl}
                      </td>
                      <td className="py-3 px-4 uppercase text-purple-400">{a.jobType}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          a.status === 'completed'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : a.status === 'failed'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-200">
                        {a.itemsExtracted}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 1 Col: Quick Control Modules */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-purple-400" />
            <span>Platform Governance</span>
          </h3>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Identity Resolution</span>
              <span className="text-xs font-mono text-amber-400">{globalMetrics.pendingReviewCount} items</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Multi-source entity resolution conflicts and low-confidence merges.
            </p>
            <Link
              href="/admin/review"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition"
            >
              <span>Manage review queue</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">AI Inference Accounting</span>
              <span className="text-xs font-mono text-emerald-400">${globalMetrics.aiEstimatedCostUsd.toFixed(4)}</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Audit prompt templates, token budgets, and LLM inference performance.
            </p>
            <Link
              href="/admin/ai"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-purple-400 hover:text-purple-300 transition"
            >
              <span>Open AI studio</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
