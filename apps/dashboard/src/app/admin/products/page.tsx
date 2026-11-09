'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Search,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Layers,
  Sparkles,
  ShoppingBag,
  Building2,
  Tag
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminGlobalProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  async function loadProducts() {
    try {
      setLoading(true);
      const res = await apiClient.getProducts({ limit: 100 });
      setProducts(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProducts();
  }, []);

  const filtered = products.filter((p) =>
    p.canonicalTitle?.toLowerCase().includes(search.toLowerCase()) ||
    p.modelNumber?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full font-sans">
      {/* Header */}
      <div className="p-7 rounded-3xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              GLOBAL DATA LAKE
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges Active</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Global Master Product Catalog
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Cross-tenant deduplicated master product database, canonical models, multi-source variants, and verified gallery assets.
          </p>
        </div>

        <button
          onClick={loadProducts}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search global master catalog by title, MPN, brand..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#ebdcb9] rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#d4af37] transition shadow-xs"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-bold">{filtered.length}</span> canonical master products
        </div>
      </div>

      {/* Global Catalog Table */}
      <div className="rounded-3xl border border-[#ebdcb9] bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-[#fcfaf5] border-b border-[#ebdcb9] text-[11px] uppercase tracking-wider text-slate-500 font-mono">
            <tr>
              <th className="py-3.5 px-5">Canonical Title & Product</th>
              <th className="py-3.5 px-4">Brand</th>
              <th className="py-3.5 px-4">Model / MPN</th>
              <th className="py-3.5 px-4">Est. Price</th>
              <th className="py-3.5 px-4">Verification</th>
              <th className="py-3.5 px-5 text-right">Extracted At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                  Querying global cross-tenant product catalog...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                  No products found matching criteria.
                </td>
              </tr>
            ) : (
              filtered.map((prod) => (
                <tr key={prod.id} className="hover:bg-[#faf7ee]/60 transition">
                  <td className="py-3.5 px-5 font-sans font-medium text-slate-900 flex items-center gap-3 max-w-sm">
                    {prod.primaryImageUrl ? (
                      <img
                        src={prod.primaryImageUrl}
                        alt=""
                        className="w-9 h-9 rounded-xl object-contain bg-slate-50 border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                        📦
                      </div>
                    )}
                    <div className="truncate">
                      <span className="font-bold text-slate-900 block truncate">{prod.canonicalTitle}</span>
                      <span className="text-[10px] text-slate-400 font-mono">UUID: {prod.id.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-sans font-bold text-[#876b17]">
                    {prod.brand || 'General'}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-mono truncate max-w-[150px]">
                    {prod.modelNumber || prod.gtinEan || '—'}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {prod.priceEstimate || '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Canonical</span>
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right text-slate-400 font-sans">
                    {new Date(prod.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

