'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Cpu,
  ShoppingBag,
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  KeyRound,
  ArrowUpRight,
  TrendingUp,
  Activity,
  Layers,
  ArrowRight,
  SlidersHorizontal,
  Flame,
  Check,
  ExternalLink
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

  const recentProducts = data?.recentProducts || [];
  const needsAttentionList = data?.needsAttention || [];

  return (
    <div className="space-y-6 w-full font-sans text-slate-900 pb-12">
      {/* 1. Header Bar with Rich Gradient Pill and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950">
              {data?.organization?.name || 'Workspace Overview'}
            </h1>
            <span className="shimmer-badge px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold text-[#0d2a2c] border border-amber-300 shadow-2xs">
              {data?.organization?.planTier || 'Enterprise'} Tier
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time catalog intelligence, multichannel sync status, and automated enrichment health.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200/90 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs hover:border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/products"
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-[#fad982] to-amber-300 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-sm hover:shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Discover Products</span>
          </Link>
        </div>
      </div>

      {/* 2. MagicUI Bento-style Interactive Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Catalog */}
        <div className="glass-card rounded-2xl p-4 shadow-subtle hover:shadow-elevated transition-all border border-slate-200/90 space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
          <div className="flex items-center justify-between text-slate-500 relative z-10">
            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase font-mono text-[10px]">Catalog Size</span>
            <div className="p-1.5 rounded-lg bg-teal-50 text-[#0d2a2c]">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-black text-slate-950 font-mono tracking-tight">{totalProducts}</span>
            <span className="text-[10px] font-bold font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Active
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium relative z-10 flex items-center justify-between">
            <span>Canonical Entities</span>
            <Link href="/products" className="text-[10px] font-bold text-[#0d2a2c] hover:underline">View &rarr;</Link>
          </div>
        </div>

        {/* Verified Data Quality */}
        <div className="glass-card rounded-2xl p-4 shadow-subtle hover:shadow-elevated transition-all border border-slate-200/90 space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
          <div className="flex items-center justify-between text-slate-500 relative z-10">
            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase font-mono text-[10px]">Quality Index</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-black text-emerald-600 font-mono tracking-tight">{dataQualityScore}%</span>
            <span className="text-[10px] font-bold font-mono text-emerald-800 bg-emerald-100/60 px-2 py-0.5 rounded-full">
              {qualityDist.verified} Verified
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium relative z-10">
            GTIN &amp; schema checksum score
          </div>
        </div>

        {/* AI Enriched */}
        <div className="glass-card rounded-2xl p-4 shadow-subtle hover:shadow-elevated transition-all border border-slate-200/90 space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
          <div className="flex items-center justify-between text-slate-500 relative z-10">
            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase font-mono text-[10px]">AI Enriched</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-black text-slate-950 font-mono tracking-tight">{aiProcessed}</span>
            <span className="text-[10px] font-bold font-mono text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
              Normalized
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium relative z-10">
            Multilingual &amp; SEO ready
          </div>
        </div>

        {/* Connected Channels */}
        <div className="glass-card rounded-2xl p-4 shadow-subtle hover:shadow-elevated transition-all border border-slate-200/90 space-y-3 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:scale-125 transition-transform"></div>
          <div className="flex items-center justify-between text-slate-500 relative z-10">
            <span className="text-xs font-bold text-slate-700 tracking-wide uppercase font-mono text-[10px]">Connected Stores</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between relative z-10">
            <span className="text-3xl font-black text-slate-950 font-mono tracking-tight">{storesCount}</span>
            <Link href="/stores" className="text-[10px] font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200 hover:bg-indigo-100">
              Manage &rarr;
            </Link>
          </div>
          <div className="text-[11px] text-slate-500 font-medium relative z-10">
            Shopify &amp; OpenCart channels
          </div>
        </div>
      </div>

      {/* 3. MagicUI Bento Grid: Quality Distribution & Real Required Action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quality Distribution Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Quality Distribution</h2>
            </div>
            <Link href="/products" className="text-[11px] font-bold text-slate-500 hover:text-slate-900">
              Catalog &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Verified Complete', count: qualityDist.verified, dot: 'bg-emerald-500', text: 'text-emerald-700' },
              { label: 'High Confidence', count: qualityDist.highConfidence, dot: 'bg-teal-500', text: 'text-teal-700' },
              { label: 'Needs Review', count: qualityDist.needsReview, dot: 'bg-amber-500', text: 'text-amber-700' },
              { label: 'Incomplete / Stale', count: qualityDist.incomplete + qualityDist.stale, dot: 'bg-slate-300', text: 'text-slate-600' },
            ].map((tier) => (
              <div key={tier.label} className="flex items-center justify-between text-xs py-0.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${tier.dot}`} />
                  <span className="font-semibold text-slate-700">{tier.label}</span>
                </div>
                <span className={`font-bold font-mono ${tier.text}`}>{tier.count}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Every attribute is verified with multi-source checksums and provenance logging.
          </div>
        </div>

        {/* Action Items List */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Required Client Actions</h2>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {needsAttentionList.length} Items
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {needsAttentionList.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                <div className="text-xs font-bold text-slate-800">Product Catalog in Full Sync</div>
                <div className="text-[11px] text-slate-400">No unresolved discrepancies or export blocks.</div>
              </div>
            ) : (
              needsAttentionList.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 truncate">{item.title}</span>
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
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">{item.description}</p>
                  </div>
                  <Link
                    href={item.actionUrl}
                    className="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition shadow-2xs"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Telemetry Banner (Dark Teal with MagicUI Dot Pattern) */}
      <div className="rounded-2xl p-5 shadow-elevated space-y-3 bg-[#0d2a2c] text-white border border-[#194c50] relative overflow-hidden">
        <div className="absolute inset-0 bg-dot-pattern-dark pointer-events-none opacity-30"></div>

        <div className="flex items-center justify-between border-b border-[#143d40] pb-3 relative z-10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#fad982]" />
            <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
              Intelligence Automation Telemetry
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#fad982] font-bold">
            Live Workspace Telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 relative z-10">
          <div className="space-y-0.5">
            <div className="text-[11px] text-teal-200/80">Reused Intelligence</div>
            <div className="text-2xl font-black text-[#fad982] font-mono">{intelligenceVal.reusedFromIntelligence}</div>
            <div className="text-[10px] text-teal-300/60">Pre-verified catalog reuse</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] text-teal-200/80">Trusted Discoveries</div>
            <div className="text-2xl font-black text-emerald-300 font-mono">{intelligenceVal.discoveredFromTrusted}</div>
            <div className="text-[10px] text-teal-300/60">Direct distributor sources</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] text-teal-200/80">AI Standardized</div>
            <div className="text-2xl font-black text-sky-300 font-mono">{intelligenceVal.enrichedWithAi}</div>
            <div className="text-[10px] text-teal-300/60">Taxonomy &amp; copy normalized</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] text-teal-200/80">Duplicate Gates</div>
            <div className="text-2xl font-black text-purple-300 font-mono">{intelligenceVal.duplicateMergesPrevented}</div>
            <div className="text-[10px] text-teal-300/60">Identity collisions averted</div>
          </div>
        </div>
      </div>

      {/* 5. Recent Products & API Keys */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Products */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-700" />
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Recently Added Products</h2>
            </div>
            <Link href="/products" className="text-[11px] font-bold text-slate-500 hover:text-slate-900">
              View All ({totalProducts}) &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No products added yet. Click &quot;Discover Products&quot; above to begin.
              </div>
            ) : (
              recentProducts.map((p) => (
                <div key={p.mappingId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${p.globalProductId}`}
                      className="font-bold text-slate-900 hover:text-[#0d2a2c] transition truncate block"
                    >
                      {p.canonicalTitle}
                    </Link>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      MPN: {p.modelNumber || 'N/A'} • Imported {new Date(p.importedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
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

        {/* Integration API Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-subtle space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Direct API Access</h2>
              </div>
              <span className="font-mono text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Automate catalog updates and connect headless stores using secure tenant tokens and HMAC webhooks.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] font-mono space-y-1.5 text-slate-600">
              <div className="flex justify-between">
                <span>Protocol:</span>
                <span className="text-slate-900 font-bold">REST / JSON</span>
              </div>
              <div className="flex justify-between">
                <span>Rate Limit:</span>
                <span className="text-slate-900 font-bold">120 req/min</span>
              </div>
              <div className="flex justify-between">
                <span>Signatures:</span>
                <span className="text-slate-900 font-bold">HMAC-SHA256</span>
              </div>
            </div>
          </div>

          <Link
            href="/settings/workspace"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs rounded-xl transition shadow-xs"
          >
            <span>Workspace Settings &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
