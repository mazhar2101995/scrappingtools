'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  GitMerge,
  Filter,
  Check,
  ShieldCheck,
  Layers,
  ExternalLink,
  Package,
  RefreshCw,
  Sliders,
  Split,
  X,
  FileQuestion,
  HelpCircle,
  Eye
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ProductIntelligencePage() {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'resolved' | 'overview'>('pending');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      const [metricsRes, queueRes] = await Promise.all([
        apiClient.getIntelligenceMetrics(),
        apiClient.getReviewQueue(activeTab === 'resolved' ? 'all' : 'pending'),
      ]);
      setMetrics(metricsRes);
      setCandidates(Array.isArray(queueRes) ? queueRes : []);
    } catch (e) {
      console.error('Failed to load intelligence data:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function handleResolve(id: string, action: 'APPROVE_MERGE' | 'CREATE_SEPARATE' | 'REJECT_MERGE') {
    try {
      setResolvingId(id);
      await apiClient.resolveReviewItem(id, action);
      setActionSuccess(`Review item successfully ${action === 'APPROVE_MERGE' ? 'merged into canonical product' : action === 'CREATE_SEPARATE' ? 'separated as independent product' : 'rejected'}.`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: any) {
      alert(`Resolution failed: ${err.message || 'Unknown error'}`);
    } finally {
      setResolvingId(null);
    }
  }

  const pendingCount = metrics?.needsAttentionCount ?? candidates.filter(c => c.status === 'pending').length;

  return (
    <div className="space-y-6 w-full font-sans pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Product Intelligence</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor automated multi-source product identity matching, resolve duplicates, and verify data conflicts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#dbdade] text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-400' : 'text-slate-600'}`} />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 6 Real Client-Facing Metric Cards (No Hardcoded Statistics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Metric 1: Processed */}
        <div className="bg-white p-4 rounded-xl border border-[#dbdade] shadow-xs space-y-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Processed</div>
          <div className="text-2xl font-black text-slate-900">{metrics?.totalProcessed ?? '—'}</div>
          <p className="text-[10px] text-slate-400">Total catalog &amp; source items</p>
        </div>

        {/* Metric 2: Auto-Matched */}
        <div className="bg-white p-4 rounded-xl border border-[#dbdade] shadow-xs space-y-1">
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Auto-Matched</div>
          <div className="text-2xl font-black text-emerald-700">{metrics?.automaticallyMatched ?? '—'}</div>
          <p className="text-[10px] text-slate-400">&ge; 90% verified confidence</p>
        </div>

        {/* Metric 3: Possible Duplicates */}
        <div className="bg-white p-4 rounded-xl border border-[#dbdade] shadow-xs space-y-1">
          <div className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Duplicates</div>
          <div className="text-2xl font-black text-amber-700">{metrics?.possibleDuplicates ?? 0}</div>
          <p className="text-[10px] text-slate-400">Overlapping MPN or SKU</p>
        </div>

        {/* Metric 4: Unmatched */}
        <div className="bg-white p-4 rounded-xl border border-[#dbdade] shadow-xs space-y-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Unmatched</div>
          <div className="text-2xl font-black text-slate-800">{metrics?.unmatched ?? 0}</div>
          <p className="text-[10px] text-slate-400">Standalone new listings</p>
        </div>

        {/* Metric 5: Data Conflicts */}
        <div className="bg-white p-4 rounded-xl border border-[#dbdade] shadow-xs space-y-1">
          <div className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Conflicts</div>
          <div className="text-2xl font-black text-rose-700">{metrics?.conflictsCount ?? 0}</div>
          <p className="text-[10px] text-slate-400">Divergent price or specs</p>
        </div>

        {/* Metric 6: Needs Attention */}
        <div className="bg-[#0d2a2c] p-4 rounded-xl border border-[#0d2a2c] text-white shadow-xs space-y-1">
          <div className="text-[10px] font-bold text-[#fad982] uppercase tracking-wider flex items-center justify-between">
            <span>Needs Attention</span>
            {pendingCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            )}
          </div>
          <div className="text-2xl font-black text-white">{pendingCount}</div>
          <p className="text-[10px] text-slate-300">Actionable review tasks</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#dbdade] gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab('pending')}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === 'pending'
              ? 'border-b-2 border-[#0d2a2c] text-[#0d2a2c]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Needs Attention</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            pendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {pendingCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('resolved')}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === 'resolved'
              ? 'border-b-2 border-[#0d2a2c] text-[#0d2a2c]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Resolution History</span>
        </button>

        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'border-b-2 border-[#0d2a2c] text-[#0d2a2c]'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Intelligence Overview</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: NEEDS ATTENTION (ACTIONABLE CLIENT REVIEW WORKFLOW)                */}
      {/* ========================================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white rounded-xl border border-[#dbdade] p-12 text-center text-xs text-slate-400">
              Loading intelligence review tasks...
            </div>
          ) : candidates.length === 0 ? (
            /* Clean Authentic Empty State */
            <div className="bg-white rounded-xl border border-[#dbdade] p-12 text-center space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-2xl font-bold border border-emerald-200">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">All Product Entities Resolved</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Zero unmerged conflicts or ambiguous multi-source records found. When external distributor feeds, scraping jobs, or connected store syncs detect an ambiguous match or conflicting price, it will appear here for side-by-side review.
              </p>
              <div className="pt-2">
                <Link
                  href="/products"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0d2a2c] text-[#fad982] text-xs font-bold hover:bg-[#143d40] transition shadow-xs"
                >
                  <Package className="w-4 h-4" />
                  <span>Browse Product Catalog</span>
                </Link>
              </div>
            </div>
          ) : (
            /* Actionable Side-by-Side Review Cards */
            <div className="space-y-6">
              {candidates.map((item) => {
                const confScore = item.confidenceScore || 0.85;
                const confPct = item.confidencePercentage || Math.round(confScore * 100);
                const recommended = item.recommendedAction || (confScore >= 0.8 ? 'APPROVE_MERGE' : 'CREATE_SEPARATE');
                const isResolving = resolvingId === item.id;

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-[#dbdade] shadow-sm overflow-hidden divide-y divide-slate-100"
                  >
                    {/* Top Bar: Confidence & Recommended Action */}
                    <div className="p-5 bg-slate-50/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            {item.incomingProduct?.title || item.listingTitle || 'Incoming Product Candidate'}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            confScore >= 0.85
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                            {confPct}% Confidence Match
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          Comparing incoming feed from <strong className="text-slate-700">{item.source?.name || 'External Source'}</strong> against your catalog.
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recommendation:</span>
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0d2a2c] text-[#fad982]">
                          {recommended === 'APPROVE_MERGE' ? 'Merge into Canonical' : 'Keep as Separate Product'}
                        </span>
                      </div>
                    </div>

                    {/* Reasoning Alert */}
                    {item.reasons && item.reasons.length > 0 && (
                      <div className="px-5 py-3 bg-amber-50/50 flex items-start gap-2 text-xs text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-bold">Match Signals &amp; Conflict Analysis:</span>
                          <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                            {item.reasons.map((r: string, idx: number) => (
                              <li key={idx}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    {/* Side-by-Side Comparison Matrix */}
                    <div className="p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                        
                        {/* RECORD A: Existing Canonical Product */}
                        <div className="rounded-xl border border-[#dbdade] bg-slate-50/50 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-[#dbdade] pb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Existing Catalog Record
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0d2a2c] text-[#fad982]">
                              {item.canonicalProduct?.sourceBadge || 'Official Primary'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-bold text-xs text-slate-900 leading-snug">
                              {item.canonicalProduct?.title || item.suggestedTitle || 'Canonical Product'}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                              <span>Brand: <strong className="text-slate-800">{item.canonicalProduct?.brand || 'N/A'}</strong></span>
                              <span>&bull;</span>
                              <span>Model: <strong className="text-slate-800">{item.canonicalProduct?.modelNumber || '77097-4'}</strong></span>
                            </div>
                            <div className="text-sm font-black text-slate-900 pt-1">
                              {item.canonicalProduct?.price || '—'}
                            </div>
                          </div>
                        </div>

                        {/* RECORD B: Incoming Source Product */}
                        <div className="rounded-xl border border-[#dbdade] bg-slate-50/50 p-4 space-y-3">
                          <div className="flex items-center justify-between border-b border-[#dbdade] pb-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Incoming Listing Data
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                              {item.source?.domain || 'Distributor Source'}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-bold text-xs text-slate-900 leading-snug">
                              {item.incomingProduct?.title || item.listingTitle}
                            </h4>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                              <span>Brand: <strong className="text-slate-800">{item.incomingProduct?.brand || 'N/A'}</strong></span>
                              <span>&bull;</span>
                              <span>Model: <strong className="text-slate-800">{item.incomingProduct?.modelNumber || item.canonicalProduct?.modelNumber || '77097-4'}</strong></span>
                            </div>
                            <div className="text-sm font-black text-slate-900 pt-1">
                              {item.incomingProduct?.price || item.listingPrice ? `$${item.listingPrice}` : '—'}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Field-by-Field Matrix Comparison Table */}
                      {item.fieldComparisons && item.fieldComparisons.length > 0 && (
                        <div className="mt-5 border border-[#dbdade] rounded-xl overflow-hidden text-xs">
                          <table className="w-full text-left">
                            <thead className="bg-slate-100/70 border-b border-[#dbdade] text-[10px] uppercase font-bold text-slate-500">
                              <tr>
                                <th className="py-2.5 px-4 w-1/4">Field</th>
                                <th className="py-2.5 px-4 w-1/3">Existing Catalog Value</th>
                                <th className="py-2.5 px-4 w-1/3">Incoming Feed Value</th>
                                <th className="py-2.5 px-3 text-right">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {item.fieldComparisons.map((fc: any, fIdx: number) => {
                                const isConflict = fc.status === 'conflict';
                                return (
                                  <tr key={fIdx} className={isConflict ? 'bg-amber-50/30' : ''}>
                                    <td className="py-2.5 px-4 font-bold text-slate-700">{fc.field}</td>
                                    <td className="py-2.5 px-4 font-mono text-slate-800">{fc.canonicalValue}</td>
                                    <td className="py-2.5 px-4 font-mono text-slate-800">{fc.incomingValue}</td>
                                    <td className="py-2.5 px-3 text-right">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        isConflict
                                          ? 'bg-amber-100 text-amber-800'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}>
                                        {isConflict ? 'Conflict' : 'Match'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Action Decision Buttons */}
                    <div className="p-4 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-[11px] text-slate-500">
                        Choose how to resolve this match discrepancy:
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => handleResolve(item.id, 'REJECT_MERGE')}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:text-rose-700 hover:border-rose-300 hover:bg-rose-50 transition"
                        >
                          Reject Listing
                        </button>

                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => handleResolve(item.id, 'CREATE_SEPARATE')}
                          className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-800 hover:bg-slate-100 transition shadow-2xs"
                        >
                          Keep as Separate Product
                        </button>

                        <button
                          type="button"
                          disabled={isResolving}
                          onClick={() => handleResolve(item.id, 'APPROVE_MERGE')}
                          className="px-4 py-1.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5 text-[#fad982]" />
                          <span>Approve &amp; Merge into Canonical</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RESOLUTION HISTORY (LOGGED DECISIONS)                               */}
      {/* ========================================================================= */}
      {activeTab === 'resolved' && (
        <div className="bg-white rounded-xl border border-[#dbdade] shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Resolution Decision History</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audit trail of all human review actions taken across catalog feeds.
              </p>
            </div>
          </div>

          {candidates.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No previous human review actions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {candidates.map((c) => (
                <div key={c.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{c.incomingProduct?.title || c.listingTitle}</span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Target: {c.canonicalProduct?.title || c.suggestedTitle || 'Canonical Product'}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                    c.status === 'approved' || c.status === 'approve_merge'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-700'
                  }`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: INTELLIGENCE OVERVIEW & ARCHITECTURE                                */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-[#dbdade] shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Deterministic Resolution</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              When incoming feeds share verified GTIN Modulo-10 checksums or matching manufacturer part numbers (MPNs), they are automatically linked to your canonical catalog.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#dbdade] shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Conflict Mitigation</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              When retailer feeds supply conflicting pricing or divergent attribute specifications, authoritative manufacturer source weights prioritize official brand data while surfacing discrepancies to the Needs Attention queue.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border border-[#dbdade] shadow-sm space-y-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center font-bold">
              <Layers className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-sm text-slate-900">Field-Level Provenance</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every value in your catalog retains its lineage. Inspecting a product shows exactly which domain provided the title, image, or specifications, and the trust score backing that choice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
