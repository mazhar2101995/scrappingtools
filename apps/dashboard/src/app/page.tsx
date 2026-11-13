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
  const [brandsCount, setBrandsCount] = useState(0);
  const [schedulesCount, setSchedulesCount] = useState(0);
  const [dismissOnboarding, setDismissOnboarding] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [res, brandsRes, schedRes] = await Promise.allSettled([
        apiClient.getClientWorkspace(),
        apiClient.getBrands(),
        apiClient.getSyncSchedules(),
      ]);

      if (res.status === 'fulfilled') {
        setData(res.value);
      }
      if (brandsRes.status === 'fulfilled') {
        const b = Array.isArray(brandsRes.value) ? brandsRes.value : [];
        setBrandsCount(b.length);
      }
      if (schedRes.status === 'fulfilled') {
        const s = schedRes.value?.schedules || [];
        setSchedulesCount(s.length);
      }
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
      const dismissed = localStorage.getItem('saas_dismiss_onboarding');
      if (dismissed === 'true') {
        setDismissOnboarding(true);
      }
    }
  }, []);

  const totalProducts = data?.metrics?.totalProducts ?? 0;
  const updatedProducts = data?.metrics?.recentlyUpdated ?? 0;
  const aiProcessed = data?.metrics?.aiProcessed ?? 0;
  const storesCount = data?.metrics?.connectedStoresCount ?? 0;
  const needsReview = data?.metrics?.pendingReviewCount ?? 0;
  const dataQualityScore = data?.metrics?.dataQualityScore ?? (totalProducts > 0 ? 100 : 0);

  // Compute Onboarding Steps Progress
  const onboardingSteps = [
    {
      id: 'brand',
      title: 'Configure Brand Profile',
      desc: 'Set up your first brand domain, target selectors, and extraction rules.',
      done: brandsCount > 0,
      link: '/brands',
      actionText: 'Add Brand Profile',
    },
    {
      id: 'store',
      title: 'Connect Destination Store',
      desc: 'Link an OpenCart 3.x/4.x (via official OCMOD bridge) or Shopify store.',
      done: storesCount > 0,
      link: '/stores',
      actionText: 'Connect Store',
    },
    {
      id: 'product',
      title: 'Scrape / Discover Products',
      desc: 'Extract structured product attributes, custom fields, and high-res images.',
      done: totalProducts > 0,
      link: '/products',
      actionText: 'Add First Product',
    },
    {
      id: 'schedule',
      title: 'Setup Automated Sync Schedule',
      desc: 'Enable autonomous background delta exports to your connected stores.',
      done: schedulesCount > 0,
      link: '/sync',
      actionText: 'Create Schedule',
    },
  ];

  const completedStepsCount = onboardingSteps.filter((s) => s.done).length;
  const isAllComplete = completedStepsCount === onboardingSteps.length;

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
    <div className="space-y-6 w-full font-sans text-[#4b465c] pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#dbdade]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#4b465c]">
              {data?.organization?.name || 'Workspace Overview'}
            </h1>
            <span className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold text-[#0d2a2c] bg-[#fad982]/40 border border-[#fad982]">
              {data?.organization?.planTier || 'Enterprise'} Tier
            </span>
          </div>
          <p className="text-xs text-[#82808b] font-medium mt-1">
            Real-time catalog intelligence, multichannel sync status, and automated enrichment health.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-[#dbdade] rounded-xl text-xs font-semibold text-[#4b465c] hover:bg-[#f8f7fa] transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#82808b] ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/products"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-semibold text-xs rounded-xl transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#fad982]" />
            <span>Discover Products</span>
          </Link>
        </div>
      </div>

      {/* 1.5 Self-Serve Client Onboarding Checklist Wizard (Collapsible/Dismissible) */}
      {!dismissOnboarding && (
        <div className="rounded-xl border border-[#dbdade] bg-white p-5 shadow-xs relative overflow-hidden animate-in fade-in duration-300">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#dbdade]">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-800 border border-teal-200">
                  Getting Started Checklist
                </span>
                <span className="text-xs font-bold text-teal-700">
                  {completedStepsCount} of {onboardingSteps.length} Complete
                </span>
              </div>
              <h2 className="text-base font-bold tracking-tight text-[#4b465c] mt-1.5">
                {isAllComplete ? '🎉 Workspace Setup Complete!' : 'Complete your SaaS setup in 4 simple steps'}
              </h2>
              <p className="text-xs text-[#82808b] mt-0.5 max-w-xl">
                Configure your extraction profiles, store credentials, and recurring background schedules to activate full automated catalog operations.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Progress bar */}
              <div className="hidden sm:flex flex-col items-end gap-1.5">
                <span className="text-[11px] font-semibold text-[#82808b]">
                  {Math.round((completedStepsCount / onboardingSteps.length) * 100)}% Setup Complete
                </span>
                <div className="w-36 h-2 rounded-full bg-slate-100 overflow-hidden border border-[#dbdade]">
                  <div
                    className="h-full bg-[#0d2a2c] transition-all duration-500 rounded-full"
                    style={{ width: `${(completedStepsCount / onboardingSteps.length) * 100}%` }}
                  ></div>
                </div>
              </div>

              <button
                onClick={() => {
                  setDismissOnboarding(true);
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('saas_dismiss_onboarding', 'true');
                  }
                }}
                className="text-xs font-medium text-[#82808b] hover:text-[#4b465c] px-2.5 py-1.5 rounded-lg hover:bg-[#f8f7fa] transition"
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Interactive Steps Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 relative z-10">
            {onboardingSteps.map((step, idx) => (
              <div
                key={step.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  step.done
                    ? 'bg-[#f8f7fa]/60 border-emerald-300 text-[#4b465c]'
                    : 'bg-white border-[#dbdade] text-[#4b465c] hover:border-teal-600 hover:shadow-2xs'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-[#82808b]">
                      STEP 0{idx + 1}
                    </span>
                    {step.done ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Check className="w-3 h-3" />
                        Done
                      </span>
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    )}
                  </div>
                  <h3 className="text-xs font-bold text-[#4b465c] leading-snug">{step.title}</h3>
                  <p className="text-[11px] text-[#82808b] leading-relaxed">{step.desc}</p>
                </div>

                <div className="pt-3 mt-2 border-t border-[#dbdade]">
                  <Link
                    href={step.link}
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold transition ${
                      step.done
                        ? 'text-[#82808b] hover:text-[#4b465c]'
                        : 'text-teal-700 hover:underline'
                    }`}
                  >
                    <span>{step.done ? 'View Config' : step.actionText}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Vuexy Bordered KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Catalog */}
        <div className="bg-white rounded-xl p-4 border border-[#dbdade] space-y-3 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-[#82808b]">
            <span className="text-[11px] font-semibold tracking-wider uppercase">Catalog Size</span>
            <div className="p-2 rounded-lg bg-teal-50 text-[#0d2a2c] border border-teal-100">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#4b465c] font-mono tracking-tight">{totalProducts}</span>
            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active
            </span>
          </div>
          <div className="text-[11px] text-[#82808b] font-medium flex items-center justify-between pt-1 border-t border-[#dbdade]/50">
            <span>Canonical Entities</span>
            <Link href="/products" className="text-[11px] font-semibold text-teal-700 hover:underline">View &rarr;</Link>
          </div>
        </div>

        {/* Verified Data Quality */}
        <div className="bg-white rounded-xl p-4 border border-[#dbdade] space-y-3 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-[#82808b]">
            <span className="text-[11px] font-semibold tracking-wider uppercase">Quality Index</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-emerald-600 font-mono tracking-tight">{dataQualityScore}%</span>
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {qualityDist.verified} Verified
            </span>
          </div>
          <div className="text-[11px] text-[#82808b] font-medium pt-1 border-t border-[#dbdade]/50">
            GTIN &amp; schema checksum score
          </div>
        </div>

        {/* AI Enriched */}
        <div className="bg-white rounded-xl p-4 border border-[#dbdade] space-y-3 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-[#82808b]">
            <span className="text-[11px] font-semibold tracking-wider uppercase">AI Enriched</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#4b465c] font-mono tracking-tight">{aiProcessed}</span>
            <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              Normalized
            </span>
          </div>
          <div className="text-[11px] text-[#82808b] font-medium pt-1 border-t border-[#dbdade]/50">
            Multilingual &amp; SEO ready
          </div>
        </div>

        {/* Connected Channels */}
        <div className="bg-white rounded-xl p-4 border border-[#dbdade] space-y-3 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between text-[#82808b]">
            <span className="text-[11px] font-semibold tracking-wider uppercase">Connected Stores</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#4b465c] font-mono tracking-tight">{storesCount}</span>
            <Link href="/stores" className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 hover:bg-indigo-100">
              Manage &rarr;
            </Link>
          </div>
          <div className="text-[11px] text-[#82808b] font-medium pt-1 border-t border-[#dbdade]/50">
            Shopify &amp; OpenCart channels
          </div>
        </div>
      </div>

      {/* 3. Vuexy Bordered Split Grid: Quality Distribution & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quality Distribution Card */}
        <div className="bg-white rounded-xl border border-[#dbdade] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#dbdade]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-[#4b465c] uppercase tracking-wider">Quality Distribution</h2>
            </div>
            <Link href="/products" className="text-[11px] font-semibold text-teal-700 hover:underline">
              Catalog &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Verified Complete', count: qualityDist.verified, dot: 'bg-emerald-500', text: 'text-emerald-700' },
              { label: 'High Confidence', count: qualityDist.highConfidence, dot: 'bg-teal-500', text: 'text-teal-700' },
              { label: 'Needs Review', count: qualityDist.needsReview, dot: 'bg-amber-500', text: 'text-amber-700' },
              { label: 'Incomplete / Stale', count: qualityDist.incomplete + qualityDist.stale, dot: 'bg-slate-300', text: 'text-[#82808b]' },
            ].map((tier) => (
              <div key={tier.label} className="flex items-center justify-between text-xs py-0.5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${tier.dot}`} />
                  <span className="font-medium text-[#4b465c]">{tier.label}</span>
                </div>
                <span className={`font-bold font-mono ${tier.text}`}>{tier.count}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#dbdade] text-[11px] text-[#82808b]">
            Every attribute is verified with multi-source checksums and provenance logging.
          </div>
        </div>

        {/* Action Items List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#dbdade] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#dbdade]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <h2 className="text-xs font-bold text-[#4b465c] uppercase tracking-wider">Required Client Actions</h2>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
              {needsAttentionList.length} Items
            </span>
          </div>

          <div className="divide-y divide-[#dbdade]">
            {needsAttentionList.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
                <div className="text-xs font-bold text-[#4b465c]">Product Catalog in Full Sync</div>
                <div className="text-[11px] text-[#82808b]">No unresolved discrepancies or export blocks.</div>
              </div>
            ) : (
              needsAttentionList.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#4b465c] truncate">{item.title}</span>
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
                    <p className="text-[11px] text-[#82808b] mt-0.5 truncate">{item.description}</p>
                  </div>
                  <Link
                    href={item.actionUrl}
                    className="shrink-0 px-3 py-1.5 bg-[#0d2a2c] hover:bg-[#143d40] text-white rounded-xl text-xs font-semibold transition shadow-xs"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Vuexy Bordered Telemetry Strip */}
      <div className="bg-white rounded-xl p-5 border border-[#dbdade] shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#dbdade] pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-700" />
            <h2 className="text-xs font-bold tracking-wider uppercase text-[#4b465c]">
              Intelligence Automation Telemetry
            </h2>
          </div>
          <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
            Live Workspace Telemetry
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="space-y-0.5">
            <div className="text-[11px] text-[#82808b]">Reused Intelligence</div>
            <div className="text-2xl font-bold text-[#4b465c] font-mono">{intelligenceVal.reusedFromIntelligence}</div>
            <div className="text-[10px] text-[#82808b]">Pre-verified catalog reuse</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] text-[#82808b]">Trusted Discoveries</div>
            <div className="text-2xl font-bold text-emerald-600 font-mono">{intelligenceVal.discoveredFromTrusted}</div>
            <div className="text-[10px] text-[#82808b]">Direct distributor sources</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] text-[#82808b]">AI Standardized</div>
            <div className="text-2xl font-bold text-sky-600 font-mono">{intelligenceVal.enrichedWithAi}</div>
            <div className="text-[10px] text-[#82808b]">Taxonomy &amp; copy normalized</div>
          </div>

          <div className="space-y-0.5">
            <div className="text-[11px] text-[#82808b]">Duplicate Gates</div>
            <div className="text-2xl font-bold text-purple-600 font-mono">{intelligenceVal.duplicateMergesPrevented}</div>
            <div className="text-[10px] text-[#82808b]">Identity collisions averted</div>
          </div>
        </div>
      </div>

      {/* 5. Recent Products & API Keys */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Products */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#dbdade] p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#dbdade]">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-[#4b465c]" />
              <h2 className="text-xs font-bold text-[#4b465c] uppercase tracking-wider">Recently Added Products</h2>
            </div>
            <Link href="/products" className="text-[11px] font-semibold text-teal-700 hover:underline">
              View All ({totalProducts}) &rarr;
            </Link>
          </div>

          <div className="divide-y divide-[#dbdade]">
            {recentProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#82808b]">
                No products added yet. Click &quot;Discover Products&quot; above to begin.
              </div>
            ) : (
              recentProducts.map((p) => (
                <div key={p.mappingId} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <Link
                      href={`/products/${p.globalProductId}`}
                      className="font-bold text-[#4b465c] hover:text-teal-700 transition truncate block"
                    >
                      {p.canonicalTitle}
                    </Link>
                    <div className="text-[10px] text-[#82808b] font-mono mt-0.5">
                      MPN: {p.modelNumber || 'N/A'} • Imported {new Date(p.importedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase shrink-0 ${
                      p.verificationStatus === 'verified'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-[#4b465c] border border-[#dbdade]'
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
        <div className="bg-white rounded-xl border border-[#dbdade] p-5 shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#dbdade]">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <h2 className="text-xs font-bold text-[#4b465c] uppercase tracking-wider">Direct API Access</h2>
              </div>
              <span className="font-mono text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-[#82808b] leading-relaxed">
              Automate catalog updates and connect headless stores using secure tenant tokens and HMAC webhooks.
            </p>

            <div className="p-3 bg-[#f8f7fa] rounded-xl border border-[#dbdade] text-[11px] font-mono space-y-1.5 text-[#4b465c]">
              <div className="flex justify-between">
                <span className="text-[#82808b]">Protocol:</span>
                <span className="text-[#4b465c] font-bold">REST / JSON</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#82808b]">Rate Limit:</span>
                <span className="text-[#4b465c] font-bold">120 req/min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#82808b]">Signatures:</span>
                <span className="text-[#4b465c] font-bold">HMAC-SHA256</span>
              </div>
            </div>
          </div>

          <Link
            href="/settings/workspace"
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-semibold text-xs rounded-xl transition shadow-xs"
          >
            <span>Workspace Settings &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
