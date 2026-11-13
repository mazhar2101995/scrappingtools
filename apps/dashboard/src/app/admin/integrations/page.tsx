'use client';

import React, { useState, useEffect } from 'react';
import {
  Radio,
  KeyRound,
  Webhook,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminIntegrationsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await (apiClient as any).fetchJson('/metrics/admin/integrations');
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const stats = data?.stats || {
    totalApiKeys: 0,
    activeApiKeys: 0,
    totalWebhooks: 0,
    deliveredEvents: 0,
    failedEvents: 0,
  };

  return (
    <div className="space-y-8 w-full font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dbdade] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Integration API &amp; Traffic Gateway</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
              PLATFORM OPERATIONAL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global monitoring of external tenant API keys, traffic ingress, rate protections, and webhook delivery status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="http://localhost:4000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Interactive OpenAPI Explorer</span>
          </a>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh Traffic"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Global Integration KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white border border-[#dbdade] rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Issued API Keys</span>
            <KeyRound className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalApiKeys}</div>
          <div className="text-[10px] text-slate-400">Tenant integration credentials</div>
        </div>

        <div className="p-4 bg-white border border-[#dbdade] rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Keys (7d)</span>
            <Activity className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{stats.activeApiKeys}</div>
          <div className="text-[10px] text-slate-400">Currently executing traffic</div>
        </div>

        <div className="p-4 bg-white border border-[#dbdade] rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Webhook Subs</span>
            <Webhook className="w-4 h-4 text-teal-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalWebhooks}</div>
          <div className="text-[10px] text-slate-400">Registered target endpoints</div>
        </div>

        <div className="p-4 bg-white border border-[#dbdade] rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Delivered Events</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.deliveredEvents}</div>
          <div className="text-[10px] text-emerald-600 font-medium">Signed HMAC dispatched</div>
        </div>

        <div className="p-4 bg-white border border-[#dbdade] rounded-xl shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-bold uppercase tracking-wider">Delivery Failures</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600">{stats.failedEvents}</div>
          <div className="text-[10px] text-slate-400">Endpoint timeout or error</div>
        </div>
      </div>

      {/* Grid: Recent Keys & Webhook Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Integration Keys */}
        <div className="bg-white border border-[#dbdade] rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recent Tenant Integration Keys</h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Global Registry</span>
          </div>

          <div className="divide-y divide-slate-100">
            {!data?.recentKeys || data.recentKeys.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No integration keys registered yet.</div>
            ) : (
              data.recentKeys.map((k: any) => (
                <div key={k.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{k.name}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                      Prefix: {k.keyPrefix}... • Org: {k.organizationId.substring(0, 8)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700">
                      {Array.isArray(k.permissions) ? `${k.permissions.length} scopes` : 'read:write'}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {k.lastUsedAt ? `Used ${new Date(k.lastUsedAt).toLocaleDateString()}` : 'Never'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Webhook Dispatch Activity */}
        <div className="bg-white border border-[#dbdade] rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-teal-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Live Webhook Dispatch Events</h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Audited Pipeline</span>
          </div>

          <div className="divide-y divide-slate-100">
            {!data?.recentWebhookEvents || data.recentWebhookEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No webhook events logged yet.</div>
            ) : (
              data.recentWebhookEvents.map((w: any) => (
                <div key={w.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-800 font-mono text-[11px]">{w.eventType}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(w.createdAt).toLocaleTimeString()} • Attempts: {w.attemptCount}
                    </div>
                  </div>
                  <div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {w.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

