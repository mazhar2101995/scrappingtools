'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingDown,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Shield,
  Activity,
  CheckCircle2,
  AlertCircle,
  X,
  Crosshair,
  DollarSign,
  ArrowDownRight,
  ShoppingBag,
  History,
  Layers,
  Sparkles,
  ArrowRight,
  Check,
  ChevronRight,
  Sliders,
  TrendingUp,
  Percent,
  Clock,
  ShieldAlert,
  Search,
  Filter
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function CompetitorSpyPage() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Scanning all
  const [scanningAll, setScanningAll] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedProductId, setSelectedProductId] = useState('');
  const [competitorName, setCompetitorName] = useState('Amazon / Competitor Store');
  const [competitorUrl, setCompetitorUrl] = useState('');
  const [strategy, setStrategy] = useState('UNDERCUT_BY_AMOUNT');
  const [strategyValue, setStrategyValue] = useState('1.00');
  const [floorPrice, setFloorPrice] = useState('25.00');
  const [autoPushToStores, setAutoPushToStores] = useState(true);

  // Slide-over Drawer State for Deep Inspection
  const [selectedMonitorForDrawer, setSelectedMonitorForDrawer] = useState<any | null>(null);
  const [drawerHistory, setDrawerHistory] = useState<any[]>([]);
  const [loadingDrawerHistory, setLoadingDrawerHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMsg('');
      const mons = await apiClient.getCompetitorMonitors();
      setMonitors(mons);

      const prodsRes = await apiClient.getProducts({ limit: 100 });
      const prodsList = prodsRes?.products || prodsRes?.data || [];
      setProducts(prodsList);

      if (prodsList.length > 0 && !selectedProductId) {
        setSelectedProductId(prodsList[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load competitor data');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMonitor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId || !competitorUrl) return;

    try {
      setSubmitting(true);
      await apiClient.addCompetitorMonitor({
        globalProductId: selectedProductId,
        competitorName: competitorName.trim() || 'Competitor',
        competitorUrl: competitorUrl.trim(),
        strategy,
        strategyValue: parseFloat(strategyValue) || 1.00,
        floorPrice: parseFloat(floorPrice) || 0,
        autoPushToStores,
      });

      setSuccessMsg(`Competitor monitor added for product! Initial check dispatched.`);
      setShowAddModal(false);
      setCompetitorUrl('');
      loadData();
    } catch (err: any) {
      alert(`Add error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCheckSingle(id: string) {
    try {
      setCheckingId(id);
      const res = await apiClient.checkCompetitorNow(id);
      const r = res.result;
      const statusText = r.priceChanged
        ? `Competitor Price: $${r.currentCompetitorPrice} ➔ Our Repriced: $${r.ourCalculatedPrice} (Stores auto-updated: ${r.syncedStoresCount})`
        : `Verified price: $${r.currentCompetitorPrice} (No change)`;
      setSuccessMsg(`[Price Spy Verified] ${statusText} • Floor Guard: ${r.floorTriggered ? 'TRIGGERED (PROTECTED)' : 'HEALTHY'}`);
      loadData();
      if (selectedMonitorForDrawer?.id === id) {
        openInspectionDrawer({ ...selectedMonitorForDrawer, latestCompetitorPrice: r.currentCompetitorPrice, latestCalculatedPrice: r.ourCalculatedPrice });
      }
    } catch (err: any) {
      alert(`Check failed: ${err.message}`);
    } finally {
      setCheckingId(null);
    }
  }

  async function handleScanAll() {
    if (!confirm('This will crawl all active competitor URLs, auto-undercut prices within floor limits, and push delta updates to connected stores. Proceed?')) {
      return;
    }

    try {
      setScanningAll(true);
      const res = await apiClient.scanAllCompetitors();
      setSuccessMsg(`[Competitor Audit Complete] Scanned: ${res.scanned} competitors | Reprices Detected: ${res.priceChangesCount} | Store Syncs: ${res.syncedStoresTotal}`);
      loadData();
    } catch (err: any) {
      alert(`Full scan error: ${err.message}`);
    } finally {
      setScanningAll(false);
    }
  }

  async function openInspectionDrawer(m: any) {
    setSelectedMonitorForDrawer(m);
    try {
      setLoadingDrawerHistory(true);
      const hist = await apiClient.getCompetitorPriceHistory(m.id);
      setDrawerHistory(hist);
    } catch (err) {
      setDrawerHistory([]);
    } finally {
      setLoadingDrawerHistory(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove monitor for "${name}"?`)) return;
    try {
      await apiClient.deleteCompetitorMonitor(id);
      setSuccessMsg('Monitor removed');
      if (selectedMonitorForDrawer?.id === id) {
        setSelectedMonitorForDrawer(null);
      }
      loadData();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  }

  // Filtered monitors
  const filteredMonitors = monitors.filter((m) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (m.productTitle || '').toLowerCase().includes(q) ||
      (m.competitorName || '').toLowerCase().includes(q) ||
      (m.competitorUrl || '').toLowerCase().includes(q)
    );
  });

  // Calculate Quick Stats
  const activeCount = monitors.filter((m) => m.status === 'ACTIVE').length;
  const undercuttingWins = monitors.filter((m) => m.latestCompetitorPrice && m.latestCalculatedPrice && parseFloat(m.latestCalculatedPrice) < parseFloat(m.latestCompetitorPrice)).length;

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12 relative">
      {/* Executive Command Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-rose-800 font-bold mb-1">
            <Crosshair className="w-3.5 h-3.5 text-rose-600" />
            <span>Autonomous Pricing Radar</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <TrendingDown className="w-6 h-6 text-rose-600" />
            <span>Competitor Price Spy &amp; Auto-Undercut Cockpit</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium max-w-2xl">
            Monitor rival e-commerce stores 24/7. Automatically beat competitor prices with dynamic margin offsets while guaranteeing absolute profit floor protection.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleScanAll}
            disabled={scanningAll || monitors.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 text-rose-600 ${scanningAll ? 'animate-spin' : ''}`} />
            <span>{scanningAll ? 'Auditing Rivals...' : 'Audit All Competitors'}</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Track New Competitor</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Visual Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Competitor Radars</span>
            <Crosshair className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{activeCount}</div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Real-time scraping active</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Undercut Advantage</span>
            <TrendingDown className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{undercuttingWins} SKUs</div>
          <div className="text-[10px] text-slate-400 mt-1">Winning the Buy Box against rivals</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Floor Guard Armor</span>
            <Shield className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-black text-teal-800 font-mono">100% Secure</div>
          <div className="text-[10px] text-slate-400 mt-1">Guaranteed zero loss selling safeguard</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Store Auto-Sync</span>
            <ShoppingBag className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">Connected</div>
          <div className="text-[10px] text-slate-400 mt-1">Instant delta push to OpenCart &amp; Shopify</div>
        </div>
      </div>

      {/* Main Tracked Competitors Table with Filter */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-rose-600" />
              <span>Tracked Competitor Targets ({filteredMonitors.length})</span>
            </h2>
            <span className="text-[11px] text-slate-400 font-medium">Click on any row to open the Price Radar Inspector Drawer</span>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by product or rival store..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-700 shadow-2xs"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <RefreshCw className="w-6 h-6 mx-auto animate-spin text-teal-700" />
              <p>Scanning competitor radar network...</p>
            </div>
          ) : filteredMonitors.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-2">
              <Crosshair className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-sm">No Competitor Targets Found</p>
              <p className="max-w-md mx-auto text-slate-400">
                Start tracking rival stores like Amazon, Horizon, or supplier websites to automatically undercut their prices.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-3 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Track First Competitor</span>
              </button>
            </div>
          ) : (
            filteredMonitors.map((m) => {
              const compPriceNum = m.latestCompetitorPrice ? parseFloat(m.latestCompetitorPrice) : null;
              const ourPriceNum = m.latestCalculatedPrice ? parseFloat(m.latestCalculatedPrice) : null;
              const floorNum = m.floorPrice ? parseFloat(m.floorPrice) : 0;
              const isFloorTriggered = ourPriceNum !== null && ourPriceNum <= floorNum;

              const isWinning = compPriceNum !== null && ourPriceNum !== null && ourPriceNum < compPriceNum;

              return (
                <div
                  key={m.id}
                  onClick={() => openInspectionDrawer(m)}
                  className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition cursor-pointer group"
                >
                  <div className="space-y-1.5 max-w-lg min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 group-hover:text-teal-800 transition line-clamp-1">
                        {m.productTitle}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {m.status}
                      </span>
                      {isWinning && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                          <span>Winning Price</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-700">{m.competitorName}:</span>
                      <a
                        href={m.competitorUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-teal-700 hover:underline flex items-center gap-0.5 font-mono text-[10px] max-w-[220px] truncate"
                      >
                        <span>{m.competitorUrl}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                      <span>•</span>
                      <span className="font-mono text-slate-600 font-medium">
                        Strategy:{' '}
                        {m.strategy === 'UNDERCUT_BY_AMOUNT'
                          ? `-$${m.strategyValue}`
                          : m.strategy === 'UNDERCUT_BY_PERCENT'
                          ? `-${m.strategyValue}%`
                          : 'Match'}
                      </span>
                      <span>•</span>
                      <span className="text-teal-800 font-semibold flex items-center gap-1">
                        <Shield className="w-3 h-3 text-teal-700" />
                        <span>Floor: ${m.floorPrice}</span>
                      </span>
                    </div>
                  </div>

                  {/* Visual Price Comparison Card */}
                  <div className="flex items-center gap-3 bg-slate-50/80 p-2.5 px-4 rounded-xl border border-slate-200 shrink-0">
                    <div className="text-right">
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Rival Price</div>
                      <div className="text-sm font-black text-rose-600 font-mono">
                        {compPriceNum ? `$${compPriceNum.toFixed(2)}` : 'Pending'}
                      </div>
                    </div>

                    <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-2xs">
                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                    </div>

                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Our Price</div>
                      <div className="text-sm font-black text-emerald-700 font-mono">
                        {ourPriceNum ? `$${ourPriceNum.toFixed(2)}` : 'Pending'}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Drawer Trigger */}
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      disabled={checkingId === m.id}
                      onClick={() => handleCheckSingle(m.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50 shadow-2xs"
                      title="Fetch live competitor price and auto-reprice now"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${checkingId === m.id ? 'animate-spin' : ''}`} />
                      <span>{checkingId === m.id ? 'Spying...' : 'Spy Now'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openInspectionDrawer(m)}
                      className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200 shadow-2xs"
                      title="Open Radar Drawer"
                    >
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(m.id, m.competitorName)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition border border-transparent hover:border-rose-200"
                      title="Delete Monitor"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* SLIDE-OVER DRAWER: PRICE RADAR INSPECTOR */}
      {selectedMonitorForDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl h-full flex flex-col animate-in slide-in-from-right duration-250">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-rose-700 font-bold">
                  <Crosshair className="w-3.5 h-3.5 text-rose-600" />
                  <span>Price Radar Inspector</span>
                </div>
                <h3 className="text-base font-black text-slate-900 line-clamp-1">
                  {selectedMonitorForDrawer.productTitle}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Rival: <span className="text-slate-800 font-bold">{selectedMonitorForDrawer.competitorName}</span>
                </p>
              </div>

              <button
                onClick={() => setSelectedMonitorForDrawer(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Radar Price Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Current Price Differential</span>
                  <span className="text-teal-800 font-mono">Real-time</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Competitor Price</span>
                    <div className="text-xl font-black text-rose-600 font-mono mt-0.5">
                      {selectedMonitorForDrawer.latestCompetitorPrice ? `$${selectedMonitorForDrawer.latestCompetitorPrice}` : 'N/A'}
                    </div>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Our Auto-Undercut</span>
                    <div className="text-xl font-black text-emerald-700 font-mono mt-0.5">
                      {selectedMonitorForDrawer.latestCalculatedPrice ? `$${selectedMonitorForDrawer.latestCalculatedPrice}` : 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-600">
                    <span>Floor Price Safeguard:</span>
                    <strong className="text-slate-900 font-mono">${selectedMonitorForDrawer.floorPrice}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Undercut Strategy:</span>
                    <strong className="text-slate-900 font-mono">{selectedMonitorForDrawer.strategy} ({selectedMonitorForDrawer.strategyValue})</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Auto-Push to Stores:</span>
                    <strong className="text-emerald-700 font-bold">{selectedMonitorForDrawer.autoPushToStores ? 'ENABLED' : 'PAUSED'}</strong>
                  </div>
                </div>
              </div>

              {/* Price Change Historical Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-teal-700" />
                    <span>Price Change Audit Trail</span>
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">{drawerHistory.length} logs recorded</span>
                </div>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden max-h-72 overflow-y-auto">
                  {loadingDrawerHistory ? (
                    <div className="py-8 text-center text-xs text-slate-400">Loading audit logs...</div>
                  ) : drawerHistory.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">No price change recorded yet.</div>
                  ) : (
                    drawerHistory.map((h) => (
                      <div key={h.id} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                        <div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{new Date(h.recordedAt).toLocaleString()}</span>
                          </div>
                          <div className="text-rose-600 font-bold mt-0.5">Rival: ${h.competitorPrice}</div>
                        </div>

                        <div className="text-right">
                          <div className="text-emerald-700 font-black">Our: ${h.ourCalculatedPrice}</div>
                          <div className="text-[10px] font-bold text-slate-500">
                            {h.isInStock ? '✓ In Stock' : '✗ Out of Stock'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Link
                href={`/products/${selectedMonitorForDrawer.globalProductId}`}
                className="text-xs font-bold text-teal-800 hover:underline flex items-center gap-1"
              >
                <span>Open Product Details</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                disabled={checkingId === selectedMonitorForDrawer.id}
                onClick={() => handleCheckSingle(selectedMonitorForDrawer.id)}
                className="px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingId === selectedMonitorForDrawer.id ? 'animate-spin' : ''}`} />
                <span>Re-Check Rival Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD COMPETITOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900">Track New Competitor</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMonitor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Catalog Product to Defend</label>
                <select
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.canonicalTitle} ({p.priceEstimate || 'No price'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Competitor Store Name</label>
                <input
                  type="text"
                  placeholder="e.g. RivalHobbies / Amazon / Horizon"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Competitor Product Live URL *</label>
                <input
                  type="url"
                  required
                  placeholder="https://competitor.com/products/example-part-123"
                  value={competitorUrl}
                  onChange={(e) => setCompetitorUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Undercut Strategy</label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  >
                    <option value="UNDERCUT_BY_AMOUNT">Undercut by Fixed Amount ($)</option>
                    <option value="UNDERCUT_BY_PERCENT">Undercut by Percentage (%)</option>
                    <option value="MATCH_PRICE">Match Competitor Price Exactly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Strategy Offset Value</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1.00 or 5"
                    value={strategyValue}
                    onChange={(e) => setStrategyValue(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Minimum Floor Price ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="20.00"
                  value={floorPrice}
                  onChange={(e) => setFloorPrice(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Protection guarantee: Even if the competitor sells for $5, our price will never go below this floor.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoPushToStores}
                    onChange={(e) => setAutoPushToStores(e.target.checked)}
                    className="rounded text-teal-700 accent-teal-700"
                  />
                  <span>Auto-Push Updated Price to Connected Stores (OpenCart/Shopify)</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Setting up Spy...' : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
