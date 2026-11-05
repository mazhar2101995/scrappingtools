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
  Plus,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Activity,
  ShieldCheck,
  AlertCircle,
  Search,
  KeyRound,
  FileText,
  Radio,
  Check,
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

  const qualityDist = data?.metrics?.qualityDistribution || {
    verified: totalProducts > 0 ? totalProducts : 0,
    highConfidence: 0,
    needsReview: needsReview,
    incomplete: 0,
    conflict: 0,
    stale: 0,
  };

  const intelligenceVal = data?.metrics?.intelligenceValue || {
    reusedFromIntelligence: 0,
    discoveredFromTrusted: 0,
    enrichedWithAi: aiProcessed,
    duplicateMergesPrevented: 0,
  };

  const activeJobs = data?.activeJobs || [];
  const recentProducts = data?.recentProducts || [];
  const needsAttentionList = data?.needsAttention || [];

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-sans text-slate-800 pb-16">
      {/* 1. Header & Greeting Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#0d2a2c] text-[#fad982] shadow-sm flex items-center justify-center font-bold text-lg uppercase tracking-tight">
            {userName.substring(0, 2).toUpperCase() || 'WS'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {data?.organization?.name || 'Workspace Overview'}
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#fad982]/30 text-amber-900 border border-amber-300 uppercase">
                {data?.organization?.planTier || 'Standard'} Tier
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Live Product Intelligence, verified data health, and external integrations.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
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
            <span>Discover &amp; Add</span>
          </Link>
        </div>
      </div>

      {/* 2. Primary Product Intelligence Metrics (Phase 1 to Phase 6) */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Catalog</span>
            <Boxes className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalProducts}</div>
          <div className="text-[10px] text-slate-400">Active tenant products</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Verified Products</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600">{qualityDist.verified}</div>
          <div className="text-[10px] text-emerald-600 font-medium">100% Verified Quality</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Needs Review</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600">{needsReview}</div>
          <div className="text-[10px] text-amber-600 font-medium">Discrepancy / Conflict</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">AI Enriched</span>
            <Cpu className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-black text-teal-700">{aiProcessed}</div>
          <div className="text-[10px] text-slate-400">Prompt normalized</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Connected Stores</span>
            <ShoppingBag className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900">{storesCount}</div>
          <div className="text-[10px] text-slate-400">Shopify &amp; WooCommerce</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Data Quality</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{dataQualityScore}%</div>
          <div className="text-[10px] text-emerald-600 font-medium">Quality Index</div>
        </div>
      </div>

      {/* 3. Data Quality Distribution & Action Required Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quality Distribution (Phase 6) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Data Quality Distribution</h2>
            </div>
            <Link href="/products" className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
              View Catalog &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Verified', count: qualityDist.verified, color: 'bg-emerald-500', text: 'text-emerald-700' },
              { label: 'High Confidence', count: qualityDist.highConfidence, color: 'bg-teal-500', text: 'text-teal-700' },
              { label: 'Needs Review', count: qualityDist.needsReview, color: 'bg-amber-500', text: 'text-amber-700' },
              { label: 'Incomplete', count: qualityDist.incomplete, color: 'bg-slate-400', text: 'text-slate-600' },
              { label: 'Conflict / Stale', count: qualityDist.stale, color: 'bg-rose-500', text: 'text-rose-700' },
            ].map((tier) => (
              <div key={tier.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${tier.color}`} />
                  <span className="font-medium text-slate-700">{tier.label}</span>
                </div>
                <span className={`font-bold font-mono ${tier.text}`}>{tier.count}</span>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl text-[11px] text-slate-500 space-y-1">
            <div className="font-bold text-slate-700">Multi-Source Confidence Scoring:</div>
            <div>Fields are validated with GTIN checksum verification, source trust ratings, and audit provenance.</div>
          </div>
        </div>

        {/* Action Required (Phase 2 & Phase 6 Human Review Center) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Action Required For Your Products</h2>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-50 text-amber-800 border border-amber-200">
              {needsAttentionList.length} Active Items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {needsAttentionList.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                <div className="text-xs font-bold text-slate-800">Your Product Catalog is in Good Health</div>
                <div className="text-[11px] text-slate-400">No unresolved conflicts, stale sources, or sync failures detected.</div>
              </div>
            ) : (
              needsAttentionList.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{item.title}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                          item.severity === 'critical'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {item.severity}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">{item.description}</p>
                  </div>
                  <Link
                    href={item.actionUrl}
                    className="shrink-0 px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Intelligence Value & Smart Reuse (Phase 1, 4 & 5 Provenance) */}
      <div className="bg-gradient-to-r from-slate-900 via-[#0d2a2c] to-slate-900 text-white rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
              Intelligence Value Delivered (Dynamic Telemetry)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-amber-400/90 font-bold">
            Real Data Metrics Across Workspace
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="space-y-1">
            <div className="text-[11px] text-slate-400">Reused From Global Intelligence</div>
            <div className="text-2xl font-black text-amber-300 font-mono">{intelligenceVal.reusedFromIntelligence}</div>
            <div className="text-[10px] text-slate-400">Pre-scrape verified reuses</div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-slate-400">Trusted Source Discoveries</div>
            <div className="text-2xl font-black text-emerald-300 font-mono">{intelligenceVal.discoveredFromTrusted}</div>
            <div className="text-[10px] text-slate-400">Official brand &amp; distributor sources</div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-slate-400">AI Standardized Products</div>
            <div className="text-2xl font-black text-sky-300 font-mono">{intelligenceVal.enrichedWithAi}</div>
            <div className="text-[10px] text-slate-400">Taxonomy &amp; copy enhancements</div>
          </div>

          <div className="space-y-1">
            <div className="text-[11px] text-slate-400">Duplicate Merges Prevented</div>
            <div className="text-2xl font-black text-purple-300 font-mono">{intelligenceVal.duplicateMergesPrevented}</div>
            <div className="text-[10px] text-slate-400">Identity resolution gates</div>
          </div>
        </div>
      </div>

      {/* 5. Recent Products & External Integrations Quick-Access */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Products */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recently Added Products</h2>
            </div>
            <Link href="/products" className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
              View All ({totalProducts}) &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No products added yet. Click "Discover &amp; Add" above to start.
              </div>
            ) : (
              recentProducts.map((p) => (
                <div key={p.mappingId} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <Link
                      href={`/products/${p.globalProductId}`}
                      className="font-bold text-slate-900 hover:text-amber-600 transition"
                    >
                      {p.canonicalTitle}
                    </Link>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      MPN: {p.modelNumber || 'N/A'} • Imported {new Date(p.importedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.verificationStatus === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {p.verificationStatus}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Phase 7 Integration Platform Shortcut */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">External API Access</h2>
            </div>
            <Link href="/settings/integrations" className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
              Manage &rarr;
            </Link>
          </div>

          <p className="text-xs text-slate-500">
            Connect external headless stores, ERP workers, and automated scrapers via your organization API key.
          </p>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-700">Integration REST API:</span>
              <span className="font-mono text-emerald-600 font-bold">ONLINE</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">Rate Limit: 120 req/min</div>
            <div className="text-[10px] text-slate-500 font-mono">Webhooks: HMAC SHA-256</div>
          </div>

          <div className="pt-2">
            <Link
              href="/settings/integrations"
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Configure API Keys &amp; Webhooks</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
