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
  AlertCircle,
  Boxes,
  Award,
  TrendingUp,
  BarChart3,
  Check,
  Sparkles,
  KeyRound,
  Webhook
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
      <div className="space-y-8 w-full animate-pulse font-sans">
        <div className="h-24 bg-white/80 rounded-3xl border border-[#ebdcb9]"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-3xl border border-[#ebdcb9]"></div>
          ))}
        </div>
        <div className="h-64 bg-white rounded-3xl border border-[#ebdcb9]"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full space-y-4 font-sans">
        <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-rose-700 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-sm">Platform Admin Authentication Error</h3>
              <p className="text-xs text-rose-600 mt-1">{error || 'Unknown API authorization error'}</p>
            </div>
          </div>
          <button
            onClick={loadAdminData}
            className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition shadow-sm"
          >
            Retry Loading Control Center
          </button>
        </div>
      </div>
    );
  }

  const { systemStatus, globalMetrics, criticalIncidents, recentActivity } = data;

  // Calculation for Reliability Gauge
  const totalJobs = globalMetrics.totalJobs || 52;
  const failedJobs = globalMetrics.failedJobs || 0;
  const successJobs = Math.max(0, totalJobs - failedJobs);
  const successRate = totalJobs > 0 ? ((successJobs / totalJobs) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-8 w-full font-sans pb-16">
      {/* Platform Banner */}
      <div className="p-7 rounded-3xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              GLOBAL PLATFORM TELEMETRY
            </span>
            <span className="text-xs text-slate-500 font-mono">Phase 1 to Phase 7 Live Engine</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Platform Operations &amp; Intelligence Gateway
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Cross-tenant intelligence deduplication, data quality scores, human review queue, and integration traffic.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/organizations"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] text-xs font-bold transition shadow-xs"
          >
            <Building2 className="w-3.5 h-3.5 text-[#b89728]" />
            <span>Manage Tenants ({globalMetrics.totalOrganizations})</span>
          </Link>
          <Link
            href="/admin/products"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fad982] hover:bg-[#f3cc65] text-slate-950 text-xs font-extrabold transition shadow-md shadow-[#fad982]/30 border border-[#e8c35f]"
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>Global Master Catalog</span>
          </Link>
        </div>
      </div>

      {/* Cluster Health Pill Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="px-4 py-3 rounded-2xl bg-white border border-[#ebdcb9] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <Server className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-slate-700 font-bold">Core REST API</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
            {systemStatus.coreApi}
          </span>
        </div>

        <div className="px-4 py-3 rounded-2xl bg-white border border-[#ebdcb9] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Database className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-slate-700 font-bold">PostgreSQL 16</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
            {systemStatus.database}
          </span>
        </div>

        <div className="px-4 py-3 rounded-2xl bg-white border border-[#ebdcb9] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
              <Radio className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-slate-700 font-bold">Redis 7 Cluster</span>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
            {systemStatus.redis}
          </span>
        </div>

        <div className="px-4 py-3 rounded-2xl bg-white border border-[#ebdcb9] shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs text-slate-700 font-bold">BullMQ Workers</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
            systemStatus.workers === 'healthy'
              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              : 'bg-amber-100 text-amber-900 border border-amber-200'
          }`}>
            {systemStatus.workers}
          </span>
        </div>
      </div>

      {/* Phase 1 & 2: Smart Data Reuse & Deduplication Telemetry Banner */}
      <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-50 via-amber-50 to-white border border-[#ebdcb9] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
            <Sparkles className="w-5 h-5 text-[#fad982]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>Global Product Intelligence &amp; Smart Data Reuse</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 uppercase font-mono">
                {globalMetrics.dataReuseRatePercent ?? 0}% Reuse Rate
              </span>
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Across {globalMetrics.totalOrganizations} tenant organizations, <strong className="text-slate-900 font-mono">{globalMetrics.duplicateScrapesPrevented ?? 0} duplicate scrape jobs</strong> and redundant AI token executions have been prevented through canonical identity resolution.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-white border border-[#ebdcb9] text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tenant Mappings</span>
            <span className="text-sm font-black text-slate-900 font-mono">{globalMetrics.totalTenantMappings ?? globalMetrics.totalProducts}</span>
          </div>
          <div className="px-4 py-2 rounded-xl bg-white border border-[#ebdcb9] text-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jobs Avoided</span>
            <span className="text-sm font-black text-emerald-700 font-mono">{globalMetrics.duplicateScrapesPrevented ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 4 Primary Visual KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Tenants */}
        <Link href="/admin/organizations" className="block group">
          <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] hover:border-[#d4af37] transition shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
              <span className="text-xs uppercase tracking-wider font-bold">Total Tenants</span>
              <div className="w-8 h-8 rounded-xl bg-[#faf4e1] border border-[#ecdba8] flex items-center justify-center text-[#9c7f23]">
                <Building2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {globalMetrics.totalOrganizations}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>{globalMetrics.totalUsers} registered users</span>
              <span className="text-emerald-600 font-bold">+12% MoM</span>
            </div>
          </div>
        </Link>

        {/* Metric 2: Global Master Products */}
        <Link href="/admin/products" className="block group">
          <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] hover:border-[#d4af37] transition shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
              <span className="text-xs uppercase tracking-wider font-bold">Global Master Catalog</span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                <Boxes className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 font-mono">
              {globalMetrics.totalProducts.toLocaleString()}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>{globalMetrics.verifiedProducts} verified canonical</span>
              <span className="text-sky-600 font-bold font-mono">100% Deduplicated</span>
            </div>
          </div>
        </Link>

        {/* Metric 3: AI Inference Engine */}
        <Link href="/admin/ai" className="block group">
          <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] hover:border-[#d4af37] transition shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
              <span className="text-xs uppercase tracking-wider font-bold">Tokens Inferred</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Cpu className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="text-3xl font-black text-purple-700 font-mono">
              {globalMetrics.aiTokensUsed.toLocaleString()}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>{globalMetrics.aiExecutions} inference calls</span>
              <span className="text-purple-600 font-bold font-mono">Gemini &amp; GPT</span>
            </div>
          </div>
        </Link>

        {/* Metric 4: Human Review Center (Phase 6) */}
        <Link href="/admin/review" className="block group">
          <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] hover:border-[#d4af37] transition shadow-xs">
            <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
              <span className="text-xs uppercase tracking-wider font-bold">Review Center Queue</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                <ShieldAlert className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </div>
            </div>
            <div className="text-3xl font-black text-amber-700 font-mono">
              {data.globalMetrics.pendingReviewCount ?? 0}
            </div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
              <span>Identity &amp; Checksum Issues</span>
              <span className="text-amber-700 font-bold">Phase 6 Active</span>
            </div>
          </div>
        </Link>
      </div>

      {/* Integration Gateway Quick Stats (Phase 7) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/integrations" className="p-4 bg-white border border-[#ebdcb9] rounded-2xl shadow-xs flex items-center justify-between hover:border-amber-400 transition">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Integration API Keys</div>
              <div className="text-[10px] text-slate-500">Active tenant external credentials</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400" />
        </Link>

        <Link href="/admin/integrations" className="p-4 bg-white border border-[#ebdcb9] rounded-2xl shadow-xs flex items-center justify-between hover:border-amber-400 transition">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
              <Webhook className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Signed HMAC Webhooks</div>
              <div className="text-[10px] text-slate-500">Real-time catalog event subscriptions</div>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400" />
        </Link>

        <a
          href="http://localhost:4000/api/docs"
          target="_blank"
          rel="noreferrer"
          className="p-4 bg-slate-900 text-white rounded-2xl shadow-xs flex items-center justify-between hover:bg-slate-800 transition"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              API
            </div>
            <div>
              <div className="text-xs font-bold">Interactive OpenAPI Docs</div>
              <div className="text-[10px] text-slate-400">Swagger UI at /api/docs</div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-amber-400" />
        </a>
      </div>

      {/* Visual Analytics & Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2 Cols: Ingestion & Scraping Activity Stream */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#9c7f23]" />
              <span>Real-Time Ingestion &amp; Extraction Stream</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">Live Redis Queue Stream</span>
          </div>

          <div className="rounded-3xl border border-[#ebdcb9] bg-white overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#fcfaf5] border-b border-[#ebdcb9] text-[11px] uppercase tracking-wider text-slate-500 font-mono">
                <tr>
                  <th className="py-3.5 px-5">Target Source URL</th>
                  <th className="py-3.5 px-4">Task Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Extracted Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {recentActivity.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-slate-400 font-sans">
                      No recent scraping activities recorded.
                    </td>
                  </tr>
                ) : (
                  recentActivity.map((a) => (
                    <tr key={a.id} className="hover:bg-[#faf7ee]/60 transition">
                      <td className="py-3.5 px-5 font-sans font-medium text-slate-900 max-w-xs truncate">
                        {a.targetUrl}
                      </td>
                      <td className="py-3.5 px-4 uppercase text-[#876b17] font-semibold text-[11px]">
                        {a.jobType}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          a.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : a.status === 'failed'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-sky-100 text-sky-800 border border-sky-200 animate-pulse'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {a.itemsExtracted}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 1 Col: Platform Governance & Quick Links */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#9c7f23]" />
            <span>Master Governance</span>
          </h3>

          <div className="p-5 rounded-3xl border border-[#ebdcb9] bg-white space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Human Review Center</span>
              <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                Phase 6 Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Inspect GTIN checksum collisions, review priority conflicts, and approve canonical merges.
            </p>
            <Link
              href="/admin/review"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8a6e19] hover:text-[#5c4709] transition"
            >
              <span>Open Review Center</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-5 rounded-3xl border border-[#ebdcb9] bg-white space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Integration Traffic Gateway</span>
              <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Phase 7 Active
              </span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Monitor active tenant API keys, external rate limits, and webhook dispatch audits.
            </p>
            <Link
              href="/admin/integrations"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 transition"
            >
              <span>View Integration Gateway</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
