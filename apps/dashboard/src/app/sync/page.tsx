'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  Layers,
  ShoppingBag,
  Sparkles,
  Search
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function SyncIntegrationPage() {
  const [syncHistory, setSyncHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load recent sync jobs
        const res = await apiClient.getJobs();
        setSyncHistory(Array.isArray(res) ? res : []);
      } catch (e) {
        console.error(e);
        setSyncHistory([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  return (
    <div className="space-y-6 w-full font-sans text-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Sync &amp; Store Integration Pipeline</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor real-time bidirectional product pushes, catalog pulls, inventory webhook dispatches, and conflict resolutions.
          </p>
        </div>

        <Link
          href="/stores"
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Manage Connected Stores</span>
        </Link>
      </div>

      {/* Sync Pipeline Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Automated Sync Frequency</span>
            <span className="text-[#0d2a2c] text-sm">Hourly</span>
          </div>
          <div className="text-xl font-black text-slate-900">Active Sync Engine</div>
          <p className="text-[11px] text-slate-400">Scheduled background jobs verify store inventory and pricing updates.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Conflict Resolution Protocol</span>
            <span className="text-emerald-600 text-sm">Zero Data Loss</span>
          </div>
          <div className="text-xl font-black text-slate-900">Field-Level Overrides</div>
          <p className="text-[11px] text-slate-400">Local canonical intelligence preserves customer edits over store data.</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Webhook Reliability</span>
            <span className="text-emerald-600 text-sm">100%</span>
          </div>
          <div className="text-xl font-black text-slate-900">HMAC-SHA256 Signed</div>
          <p className="text-[11px] text-slate-400">Instant event-driven synchronization for stock and order changes.</p>
        </div>
      </div>

      {/* Sync Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Recent Synchronization Dispatches</h3>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
            Live History
          </span>
        </div>

        {syncHistory.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-400">
            No synchronization tasks executed yet. Trigger a sync from the Connected Stores page.
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="py-3 px-4">Task ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {syncHistory.map((h) => (
                <tr key={h.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{h.id.slice(0, 12)}...</td>
                  <td className="py-3 px-4 font-sans text-slate-600">{h.jobType || 'CATALOG_SYNC'}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                      {h.status || 'completed'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400 font-sans">
                    {new Date(h.createdAt || Date.now()).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

