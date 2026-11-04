'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

const CONNECTED_STORES = [
  {
    id: 'store_oc_01',
    name: 'Acme EU OpenCart Shop',
    platform: 'OpenCart 3.0',
    storeUrl: 'https://opencart-shop.acme.com',
    status: 'connected',
    productsSynced: 842,
    conflictsPending: 0,
    lastSync: '12 mins ago',
    capabilities: ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'MULTILINGUAL'],
  },
  {
    id: 'store_sh_01',
    name: 'Shopify US Direct Store',
    platform: 'Shopify',
    storeUrl: 'https://acme-rc-usa.myshopify.com',
    status: 'connected',
    productsSynced: 295,
    conflictsPending: 1,
    lastSync: '1 hour ago',
    capabilities: ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'UPDATE_STOCK', 'WEBHOOK_CHANGES'],
  },
  {
    id: 'store_wc_01',
    name: 'WooCommerce B2B Wholesale',
    platform: 'WooCommerce',
    storeUrl: 'https://wholesale.acme-rc.de',
    status: 'connected',
    productsSynced: 111,
    conflictsPending: 0,
    lastSync: '3 hours ago',
    capabilities: ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'PRODUCT_VARIANTS'],
  },
];

export default function StoresPage() {
  const [stores, setStores] = useState(CONNECTED_STORES);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);

  const handleTriggerSync = (storeId: string) => {
    setIsSyncing(storeId);
    setTimeout(() => {
      setIsSyncing(null);
      setStores((prev) =>
        prev.map((s) => (s.id === storeId ? { ...s, lastSync: 'Just now' } : s))
      );
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Universal Connected E-Commerce Stores</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect OpenCart, Shopify, and WooCommerce stores to sync verified canonical catalog data and manage field-level overrides.
          </p>
        </div>
        <div>
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition shadow-sm">
            <Plus className="w-4 h-4" />
            <span>Connect New Store</span>
          </button>
        </div>
      </div>

      {/* Connected Stores Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stores.map((store) => (
          <div
            key={store.id}
            className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition"
          >
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {store.platform}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Active Link</span>
                </span>
              </div>

              <h3 className="font-semibold text-white text-base mt-4">{store.name}</h3>

              <a
                href={store.storeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-mono mt-1"
              >
                <Globe className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{store.storeUrl}</span>
                <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
              </a>

              <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Synced Products</div>
                  <div className="font-mono text-white font-bold text-sm mt-0.5">{store.productsSynced}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Field Conflicts</div>
                  <div className={`font-mono font-bold text-sm mt-0.5 ${store.conflictsPending > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {store.conflictsPending}
                  </div>
                </div>
              </div>

              {/* Declared capabilities */}
              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">Declared Capabilities</div>
                <div className="flex flex-wrap gap-1.5">
                  {store.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-900 border border-slate-750 text-slate-400"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400">Sync: {store.lastSync}</span>
              <button
                onClick={() => handleTriggerSync(store.id)}
                disabled={isSyncing === store.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-750 text-sky-400 hover:border-sky-500 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing === store.id ? 'animate-spin' : ''}`} />
                <span>{isSyncing === store.id ? 'Syncing...' : 'Sync Store'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

