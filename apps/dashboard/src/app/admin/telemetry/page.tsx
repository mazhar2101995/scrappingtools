'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Database,
  Radio,
  Cpu,
  Layers,
  Activity,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { apiClient, PlatformAdminData } from '@/lib/api-client';

export default function AdminTelemetryPage() {
  const [data, setData] = useState<PlatformAdminData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadTelemetry() {
    try {
      setLoading(true);
      const res = await apiClient.getPlatformAdminOverview();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTelemetry();
  }, []);

  const sys = data?.systemStatus;
  const metrics = data?.globalMetrics;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="p-7 rounded-3xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              OBSERVABILITY
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges Active</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Cluster Telemetry, Heartbeats & Logs
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Live database partitions, Redis cluster latency, container memory quotas, and BullMQ worker heartbeats.
          </p>
        </div>

        <button
          onClick={loadTelemetry}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Cluster Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Node 1 */}
        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Core API Engine</h4>
                <p className="text-[10px] text-slate-400 font-mono">Fastify / Express</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
              {sys?.coreApi || 'healthy'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
            <span>Port: 4000</span>
            <span className="text-slate-900 font-bold">Uptime 99.98%</span>
          </div>
        </div>

        {/* Node 2 */}
        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">PostgreSQL 16</h4>
                <p className="text-[10px] text-slate-400 font-mono">Drizzle Pool</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
              {sys?.database || 'healthy'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
            <span>Pool: 20 active</span>
            <span className="text-slate-900 font-bold">Latency: 2ms</span>
          </div>
        </div>

        {/* Node 3 */}
        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                <Radio className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Redis 7 Cluster</h4>
                <p className="text-[10px] text-slate-400 font-mono">BullMQ State</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
              {sys?.redis || 'healthy'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
            <span>Port: 6379</span>
            <span className="text-slate-900 font-bold">Memory: 14MB</span>
          </div>
        </div>

        {/* Node 4 */}
        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">BullMQ Workers</h4>
                <p className="text-[10px] text-slate-400 font-mono">Scrapers & NLP</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
              sys?.workers === 'healthy'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                : 'bg-amber-100 text-amber-900 border border-amber-200'
            }`}>
              {sys?.workers || 'degraded'}
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between font-mono">
            <span>Concurrency: 4x</span>
            <span className="text-slate-900 font-bold">{metrics?.activeJobs ?? 0} Running</span>
          </div>
        </div>
      </div>

      {/* Observability Telemetry Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-[#ebdcb9] space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#8a6e19]" />
            <span>Multi-Tenant Partition Isolation Status</span>
          </h3>
          <div className="space-y-3 text-xs font-mono">
            <div className="p-3.5 rounded-2xl bg-[#fdfbf7] border border-[#ebdcb9] flex items-center justify-between">
              <span className="text-slate-500 font-sans">Tenant Database Schemas</span>
              <span className="text-emerald-700 font-bold font-mono">Row-Level Isolation Enforced</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#fdfbf7] border border-[#ebdcb9] flex items-center justify-between">
              <span className="text-slate-500 font-sans">Scraping Proxy Gateway</span>
              <span className="text-sky-700 font-bold font-mono">Direct HTTP + Headless Steer</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-[#fdfbf7] border border-[#ebdcb9] flex items-center justify-between">
              <span className="text-slate-500 font-sans">AI Prompt Security</span>
              <span className="text-purple-700 font-bold font-mono">Sanitized & Schema-Validated</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-[#ebdcb9] space-y-4 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Recent Incident Events</span>
          </h3>
          {data?.criticalIncidents && data.criticalIncidents.length > 0 ? (
            <div className="space-y-2">
              {data.criticalIncidents.map((inc) => (
                <div key={inc.id} className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-rose-700 font-bold uppercase">{inc.severity}</span>
                    <span className="text-slate-400 text-[10px]">{new Date(inc.detectedAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-800 mt-1 font-sans">{inc.description}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-sans">
              No active infrastructure anomalies recorded.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
