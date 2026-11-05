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
      <div className="p-7 rounded-3xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              CONNECTOR GATEWAY
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Connected Stores & Universal Bridges
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor client store endpoints, OpenCart Universal Bridge v2.0 deployments, and catalog publishing status.
          </p>
        </div>

        <button
          onClick={loadStores}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Stores</span>
        </button>
      </div>

      {/* Stores List */}
      <div className="rounded-3xl border border-[#ebdcb9] bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-[#fcfaf5] border-b border-[#ebdcb9] text-[11px] uppercase tracking-wider text-slate-500 font-mono">
            <tr>
              <th className="py-3.5 px-5">Store Name & Platform</th>
              <th className="py-3.5 px-4">Store Target URL</th>
              <th className="py-3.5 px-4">Capabilities</th>
              <th className="py-3.5 px-4">Health Status</th>
              <th className="py-3.5 px-5 text-right">Last Sync</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                  Loading connected stores across tenants...
                </td>
              </tr>
            ) : stores.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 font-sans">
                  No active store connections detected.
                </td>
              </tr>
            ) : (
              stores.map((s) => (
                <tr key={s.id} className="hover:bg-[#faf7ee]/60 transition">
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-slate-900 flex items-center gap-2 font-sans">
                      <ShoppingBag className="w-4 h-4 text-[#8a6e19]" />
                      <span>{s.storeName}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">{s.platformType}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-sans truncate max-w-xs">
                    <a
                      href={s.storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#7a5e12] inline-flex items-center gap-1 font-semibold"
                    >
                      <span className="truncate">{s.storeUrl}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </a>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(s.capabilities || []).map((c: string) => (
                        <span
                          key={c}
                          className="px-2 py-0.5 rounded text-[9px] bg-[#fdfbf7] border border-[#ebdcb9] text-slate-700 font-mono font-medium"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{s.status}</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right text-slate-400 font-sans">
                    {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : 'Never synced'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Universal Connector Downloads */}
      <div className="p-6 rounded-3xl bg-white border border-[#ebdcb9] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#fad982]/40 border border-[#ebd085] flex items-center justify-center text-[#7a5e12] shrink-0">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Universal Bridge v2.0 Distribution Package</h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribute pre-compiled single-file bridge scripts to tenant stores without manual PHP code modifications.
            </p>
          </div>
        </div>

        <a
          href="http://localhost:4000/api/v1/stores/download-bridge"
          download="saas_bridge.php"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-[#fad982] hover:bg-[#f3cc65] text-slate-950 transition shadow-md shadow-[#fad982]/30 border border-[#e8c35f] shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Download saas_bridge.php</span>
        </a>
      </div>
    </div>
  );
}
