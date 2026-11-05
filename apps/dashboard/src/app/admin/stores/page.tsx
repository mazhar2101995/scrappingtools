'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Radio,
  Server,
  Download,
  Building2
} from 'lucide-react';
import { apiClient, StoreItem } from '@/lib/api-client';

export default function AdminStoresPage() {
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadStores() {
    try {
      setLoading(true);
      const res = await apiClient.getStores();
      setStores(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStores();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider font-mono">
              E-Commerce Bridge Observability
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Connected Stores & Universal Bridges</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Monitor client store endpoints, OpenCart Universal Bridge v2.0 deployments, and catalog publishing status.
          </p>
        </div>

        <button
          onClick={loadStores}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Stores</span>
        </button>
      </div>

      {/* Stores List */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#0b0f19] border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            <tr>
              <th className="py-3 px-4">Store Name & Platform</th>
              <th className="py-3 px-4">Store Target URL</th>
              <th className="py-3 px-4">Capabilities</th>
              <th className="py-3 px-4">Health Status</th>
              <th className="py-3 px-4 text-right">Last Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                  Loading connected stores across tenants...
                </td>
              </tr>
            ) : stores.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-500 font-sans">
                  No active store connections detected.
                </td>
              </tr>
            ) : (
              stores.map((s) => (
                <tr key={s.id} className="hover:bg-slate-850/60 transition">
                  <td className="py-3 px-4">
                    <div className="font-semibold text-white flex items-center gap-2">
                      <ShoppingBag className="w-3.5 h-3.5 text-purple-400" />
                      <span>{s.storeName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase">{s.platformType}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-300 font-sans truncate max-w-xs">
                    <a
                      href={s.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-purple-400 inline-flex items-center gap-1"
                    >
                      <span>{s.storeUrl}</span>
                      <ExternalLink className="w-3 h-3 text-slate-500" />
                    </a>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(s.capabilities || []).map((c: string) => (
                        <span
                          key={c}
                          className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 font-mono"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{s.status}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400 font-sans">
                    {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : 'Never synced'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Universal Connector Downloads for Platform Admin */}
      <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Universal Bridge v2.0 Distribution Package</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Distribute pre-compiled single-file bridge scripts to tenant stores without manual PHP code modifications.
            </p>
          </div>
        </div>

        <a
          href="http://localhost:4000/api/v1/stores/download-bridge"
          download="saas_bridge.php"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white transition shadow-md shadow-purple-600/20"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download saas_bridge.php</span>
        </a>
      </div>
    </div>
  );
}
