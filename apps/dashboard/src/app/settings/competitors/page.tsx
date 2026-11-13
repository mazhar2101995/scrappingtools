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
  Layers
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function CompetitorSpyPage() {
  const [monitors, setMonitors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  // History Drawer / Modal
  const [activeHistoryMonitor, setActiveHistoryMonitor] = useState<any | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setErrorMsg('');
      const [monitorsList, prodsRes] = await Promise.all([
        apiClient.getCompetitorMonitors(),
        apiClient.getProducts({ limit: 100 }),
      ]);
      setMonitors(monitorsList);
      setProducts(Array.isArray(prodsRes?.data) ? prodsRes.data : []);
      if (prodsRes?.data && prodsRes.data.length > 0 && !selectedProductId) {
        setSelectedProductId(prodsRes.data[0].id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load competitor monitors');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMonitor(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId || !competitorUrl.trim() || !floorPrice) {
      alert('Product, Competitor URL, and Floor Price are required');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
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
      alert(`[Price Spy Check Complete]\n${statusText}\nFloor Protected: ${r.floorTriggered ? 'YES' : 'NO'}`);
      loadData();
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
      alert(`[Competitor Audit Complete]\nScanned: ${res.scanned} competitors\nPrice Reprices Detected: ${res.priceChangesCount}\nStore Syncs: ${res.syncedStoresTotal}`);
      loadData();
    } catch (err: any) {
      alert(`Full scan error: ${err.message}`);
    } finally {
      setScanningAll(false);
    }
  }

  async function handleOpenHistory(m: any) {
    setActiveHistoryMonitor(m);
    try {
      setLoadingHistory(true);
      const hist = await apiClient.getCompetitorPriceHistory(m.id);
      setHistoryLogs(hist);
    } catch (err) {
      console.error(err);
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove monitor for "${name}"?`)) return;
    try {
      await apiClient.deleteCompetitorMonitor(id);
      setSuccessMsg('Monitor removed');
      loadData();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Crosshair className="w-6 h-6 text-rose-600" />
            <span>Competitor Price Spy &amp; Auto-Undercut Engine</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor rival e-commerce stores in real time. Automatically beat their prices by $1 or 5% while protecting your minimum profit margin floor.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleScanAll}
            disabled={scanningAll || monitors.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
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
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
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

      {/* Feature Value Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <TrendingDown className="w-4 h-4 text-rose-600" />
            <span>Smart Dynamic Undercutting</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Choose whether to beat the rival by a fixed dollar amount (e.g. -$1.00) or percentage (-5%) with auto-psychological .99 rounding.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Guaranteed Profit Floor</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Never sell at a loss. If the competitor sells unrealistically cheap, the engine stops at your configured minimum Floor Price.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <ShoppingBag className="w-4 h-4 text-blue-600" />
            <span>Autonomous Store Push</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            As soon as a competitor changes their price, the new undercut price is automatically pushed to your connected OpenCart &amp; Shopify stores.
          </p>
        </div>
      </div>

      {/* Tracked Competitors Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-sm text-slate-900">Live Tracked Competitor Products ({monitors.length})</h2>
          <span className="text-[11px] text-slate-400 font-mono">Real-time Scraping &amp; Auto-Repricing</span>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading competitor monitors...</div>
          ) : monitors.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No competitors being tracked yet. Click &quot;Track New Competitor&quot; above to spy on rival prices.
            </div>
          ) : (
            monitors.map((m) => {
              const compPrice = m.latestCompetitorPrice ? `$${m.latestCompetitorPrice}` : 'Pending';
              const ourPrice = m.latestCalculatedPrice ? `$${m.latestCalculatedPrice}` : 'Pending';

              return (
                <div key={m.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition">
                  <div className="space-y-1 max-w-md">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/products/${m.globalProductId}`}
                        className="font-bold text-xs text-slate-900 hover:text-emerald-700 hover:underline line-clamp-1"
                      >
                        {m.productTitle}
                      </Link>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        m.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {m.status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-700">{m.competitorName}:</span>
                      <a
                        href={m.competitorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-0.5 font-mono text-[10px] max-w-[200px] truncate"
                      >
                        <span>{m.competitorUrl}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                      <span>•</span>
                      <span className="font-mono text-slate-600">
                        Strategy: {m.strategy === 'UNDERCUT_BY_AMOUNT' ? `-$${m.strategyValue}` : m.strategy === 'UNDERCUT_BY_PERCENT' ? `-${m.strategyValue}%` : 'Match'}
                      </span>
                      <span>•</span>
                      <span className="text-emerald-700 font-semibold">Floor: ${m.floorPrice}</span>
                    </div>
                  </div>

                  {/* Price Comparison Widget */}
                  <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-medium">Competitor Price</div>
                      <div className="text-sm font-black text-rose-600 font-mono">{compPrice}</div>
                    </div>

                    <ArrowDownRight className="w-4 h-4 text-emerald-600 shrink-0" />

                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">Our Selling Price</div>
                      <div className="text-sm font-black text-emerald-700 font-mono">{ourPrice}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={checkingId === m.id}
                      onClick={() => handleCheckSingle(m.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition disabled:opacity-50"
                      title="Fetch live competitor price and update store now"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-rose-600 ${checkingId === m.id ? 'animate-spin' : ''}`} />
                      <span>{checkingId === m.id ? 'Spying...' : 'Spy Now'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenHistory(m)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                      title="View Price Tracking History"
                    >
                      <History className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(m.id, m.competitorName)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                      title="Delete monitor"
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

      {/* Add Competitor Monitor Modal */}
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
                  Protection guarantee: Even if the competitor sets $10, our price will never go below this floor price.
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoPushToStores}
                    onChange={(e) => setAutoPushToStores(e.target.checked)}
                    className="rounded text-[#0d2a2c] accent-[#0d2a2c]"
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
                  className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Setting up Spy...' : 'Start Tracking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {activeHistoryMonitor && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-sm text-slate-900">Price Spy History</h3>
              </div>
              <button
                onClick={() => setActiveHistoryMonitor(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {loadingHistory ? (
                <div className="p-6 text-center text-xs text-slate-400">Loading history...</div>
              ) : historyLogs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">No price history recorded yet.</div>
              ) : (
                historyLogs.map((h) => (
                  <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono flex items-center justify-between">
                    <div>
                      <div className="text-slate-500 text-[10px]">{new Date(h.recordedAt).toLocaleString()}</div>
                      <div className="text-rose-600 font-bold">Rival: ${h.competitorPrice}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-700 font-black">Our Price: ${h.ourCalculatedPrice}</div>
                      <div className="text-[10px] text-slate-400">{h.isInStock ? 'In Stock' : 'Out of Stock'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveHistoryMonitor(null)}
                className="px-4 py-2 bg-slate-100 text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
