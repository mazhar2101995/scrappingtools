'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Globe,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldCheck,
  X,
  Store
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [platformType, setPlatformType] = useState('opencart');

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

  const handleTriggerSync = async (storeId: string) => {
    try {
      setIsSyncing(storeId);
      await apiClient.triggerStoreSync(storeId);
      await loadStores();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Connected E-Commerce Stores</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Connect OpenCart, Shopify, and WooCommerce stores to sync verified canonical catalog data and manage field-level overrides.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Connect New Store</span>
        </button>
      </div>

      {/* Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Connect E-Commerce Store</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setShowAddModal(false); }} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My RC Shop Germany"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Platform *</label>
                <select
                  value={platformType}
                  onChange={(e) => setPlatformType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                >
                  <option value="opencart">OpenCart 3.x / 4.x</option>
                  <option value="shopify">Shopify</option>
                  <option value="woocommerce">WooCommerce</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Store URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://myshop.com"
                  value={storeUrl}
                  onChange={(e) => setStoreUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-[#0d2a2c] text-white rounded-lg hover:bg-[#143d40]"
                >
                  Connect Store
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stores Grid in Clean Brand Style */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
          Loading connected stores...
        </div>
      ) : stores.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
            🏪
          </div>
          <h3 className="text-sm font-bold text-slate-900">No Stores Connected Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            Link your first OpenCart, Shopify, or WooCommerce store to enable automated two-way catalog synchronization.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stores.map((store) => (
            <div
              key={store.id}
              className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:border-slate-300 transition flex flex-col justify-between space-y-4"
            >
              <div>
                {/* Store Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-slate-100 text-slate-700 uppercase">
                    {store.platformType}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Active Link</span>
                  </div>
                </div>

                <h3 className="font-bold text-base text-slate-900 leading-tight">{store.storeName}</h3>
                <a
                  href={store.storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-400 hover:text-[#0d2a2c] flex items-center gap-1 mt-1 truncate"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{store.storeUrl}</span>
                </a>

                {/* Metrics Box in Clean Brand Style */}
                <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-100 rounded-xl my-4 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Synced Products</span>
                    <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                      {store.syncedCount || 0}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Field Conflicts</span>
                    <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                      {store.conflictsCount || 0}
                    </div>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Declared Capabilities
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(store.capabilities || ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING']).map((cap: string) => (
                      <span
                        key={cap}
                        className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-[9px] font-mono font-medium"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sync Trigger Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400">
                  {store.lastSyncAt ? `Sync ${new Date(store.lastSyncAt).toLocaleTimeString()}` : 'Never synced'}
                </span>
                <button
                  onClick={() => handleTriggerSync(store.id)}
                  disabled={isSyncing === store.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold rounded-lg text-xs transition shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing === store.id ? 'animate-spin' : ''}`} />
                  <span>{isSyncing === store.id ? 'Syncing...' : 'Sync Store'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
