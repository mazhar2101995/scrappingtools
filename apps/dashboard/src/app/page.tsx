'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Boxes,
  Cpu,
  Layers,
  ShoppingBag,
  AlertTriangle,
  Calendar,
  Plus,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { apiClient, ClientWorkspaceData } from '@/lib/api-client';

export default function ClientDashboardOverview() {
  const [data, setData] = useState<ClientWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('Catalog Admin');

  async function loadData() {
    try {
      setLoading(true);
      const res = await apiClient.getClientWorkspace();
      setData(res);
    } catch (e) {
      console.error('Failed to load workspace overview:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saas_current_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u.fullName) setUserName(u.fullName);
        } catch (_) {}
      }
    }
  }, []);

  const totalProducts = data?.metrics?.totalProducts ?? 0;
  const updatedProducts = data?.metrics?.recentlyUpdated ?? 0;
  const aiProcessed = data?.metrics?.aiProcessed ?? 0;
  const activeJobsCount = data?.metrics?.activeJobs ?? 0;
  const storesCount = data?.metrics?.connectedStoresCount ?? 0;
  const needsReview = data?.metrics?.pendingReviewCount ?? 0;
  const dataQualityScore = data?.metrics?.dataQualityScore ?? (totalProducts > 0 ? 100 : 0);

  const activeJobs = data?.activeJobs || [];
  const recentProducts = data?.recentProducts || [];
  const connectedStoresList = data?.stores || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800 pb-12">
      {/* 1. Header & Greeting Bar (100% Dynamic) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0d2a2c] text-[#fad982] shadow-sm flex items-center justify-center font-bold text-base uppercase">
            {userName.substring(0, 2).toUpperCase() || 'WS'}
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Welcome back, {userName}!
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Live workspace telemetry for {data?.organization?.name || 'your workspace'}.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/products"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Metric Cards (Dynamic DB Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Products */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">📦</span>
            <span className="text-[11px] text-slate-600">Total Products</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{totalProducts.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
              Mapped in workspace
            </div>
          </div>
        </div>

        {/* Card 2: Updated Products */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">📑</span>
            <span className="text-[11px] text-slate-600">Updated (7d)</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{updatedProducts.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
              Active synchronizations
            </div>
          </div>
        </div>

        {/* Card 3: AI Processed */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">🤖</span>
            <span className="text-[11px] text-slate-600">AI Enriched</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{aiProcessed.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-[#0d2a2c] mt-0.5">
              Prompts applied
            </div>
          </div>
        </div>

        {/* Card 4: Active Jobs */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">⚡</span>
            <span className="text-[11px] text-slate-600">Active Jobs</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{activeJobsCount}</div>
            <div className="text-[10px] font-medium text-slate-500 mt-0.5">
              Queued or running
            </div>
          </div>
        </div>

        {/* Card 5: Connected Stores */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">🏪</span>
            <span className="text-[11px] text-slate-600">Connected Stores</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{storesCount}</div>
            <div className="text-[10px] font-bold text-slate-400 mt-0.5">
              Shopify &amp; WooCommerce
            </div>
          </div>
        </div>

        {/* Card 6: Needs Review */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">⚠️</span>
            <span className="text-[11px] text-slate-600">Needs Review</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{needsReview}</div>
            <div className="text-[10px] font-bold text-amber-600 mt-0.5">
              Action items
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Ingestion Summary & Real Data Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Ingestion & Processing Telemetry */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Catalog Processing Telemetry</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time ingestion balance between raw extractions and prompt-enriched catalog entities.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-700">
              Live
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Total Entities Mapped</span>
              <div className="text-xl font-black text-slate-900">{totalProducts}</div>
              <p className="text-[11px] text-slate-500">Live catalog entities</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">AI Enriched Rate</span>
              <div className="text-xl font-black text-amber-600">
                {totalProducts > 0 ? Math.round((aiProcessed / totalProducts) * 100) : 0}%
              </div>
              <p className="text-[11px] text-slate-500">{aiProcessed} of {totalProducts} enriched</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-500">Quality Index</span>
              <div className="text-xl font-black text-emerald-600">{dataQualityScore}%</div>
              <p className="text-[11px] text-slate-500">Provenance completeness</p>
            </div>
          </div>
        </div>

        {/* Right: Data Quality Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-900">Data Quality Score</h3>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {dataQualityScore}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Completeness of verified MPN, manufacturer specifications, and high-res imagery.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>Catalog Integrity</span>
                  <span>{dataQualityScore}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-[#0d2a2c] h-full rounded-full transition-all duration-500"
                    style={{ width: `${dataQualityScore}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between font-bold text-slate-700 mb-1">
                  <span>AI Standardization</span>
                  <span>{totalProducts > 0 ? Math.round((aiProcessed / totalProducts) * 100) : 0}%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${totalProducts > 0 ? (aiProcessed / totalProducts) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Requires Attention:</span>
            <span className="font-bold text-slate-900">{needsReview} items</span>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: Real Database Activity Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Recent Products */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Recent Products</h3>
              <Link href="/products" className="text-xs font-semibold text-[#0d2a2c] hover:underline">
                View All &rarr;
              </Link>
            </div>

            {recentProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No products added yet. Click &quot;Add Product&quot; to begin.
              </div>
            ) : (
              <div className="space-y-3">
                {recentProducts.slice(0, 4).map((p) => (
                  <Link
                    key={p.mappingId}
                    href={`/products/${p.globalProductId}`}
                    className="flex items-center justify-between gap-3 p-2 rounded-xl hover:bg-slate-50 transition border border-transparent hover:border-slate-100"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {p.canonicalTitle}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        MPN: {p.modelNumber || p.customerInternalSku || '—'}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                      {p.verificationStatus || 'Verified'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: Active Background Jobs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Active Job Pipelines</h3>
              <Link href="/jobs" className="text-xs font-semibold text-[#0d2a2c] hover:underline">
                Monitor &rarr;
              </Link>
            </div>

            {activeJobs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                All scraping and sync queues are idle.
              </div>
            ) : (
              <div className="space-y-3">
                {activeJobs.slice(0, 4).map((j: any) => (
                  <div key={j.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate">{j.jobType || 'EXTRACTION'}</span>
                      <span className="px-2 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 uppercase">
                        {j.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate font-mono">{j.targetUrl}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: Connected Stores */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900">Connected Stores</h3>
              <Link href="/stores" className="text-xs font-semibold text-[#0d2a2c] hover:underline">
                Manage &rarr;
              </Link>
            </div>

            {connectedStoresList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No stores connected yet. Connect your Shopify or WooCommerce store.
              </div>
            ) : (
              <div className="space-y-2.5">
                {connectedStoresList.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-900">{s.storeName}</div>
                      <div className="text-[10px] text-slate-400 font-mono uppercase">{s.platformType}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {s.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
