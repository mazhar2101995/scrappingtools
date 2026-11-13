'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  ShoppingBag,
  Clock,
  Play,
  Pause,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  Globe,
  Sparkles
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function SyncIntegrationPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningScheduleId, setRunningScheduleId] = useState<string | null>(null);

  // New Schedule Modal States
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<'HOURLY' | 'EVERY_6_HOURS' | 'DAILY' | 'WEEKLY'>('DAILY');
  const [storeId, setStoreId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadData() {
    try {
      setLoading(true);
      const [schedRes, storesRes, brandsRes] = await Promise.allSettled([
        apiClient.getSyncSchedules(),
        apiClient.getStores(),
        apiClient.getBrands(),
      ]);

      if (schedRes.status === 'fulfilled') {
        setSchedules(schedRes.value?.schedules || []);
      }
      if (storesRes.status === 'fulfilled') {
        const val: any = storesRes.value;
        const sList = Array.isArray(val) ? val : (val?.stores || []);
        setStores(sList);
        if (sList.length > 0 && !storeId) {
          setStoreId(sList[0].id);
        }
      }
      if (brandsRes.status === 'fulfilled') {
        setBrands(Array.isArray(brandsRes.value) ? brandsRes.value : []);
      }
    } catch (e) {
      console.error('Error loading sync schedule data:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Schedule name is required');
      return;
    }
    if (!storeId) {
      setErrorMsg('Target store destination is required');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await apiClient.createSyncSchedule({
        name: name.trim(),
        frequency,
        storeId,
        brandId: brandId || undefined,
        targetLanguage,
        autoTranslate: true,
        scheduleType: 'STORE_PUSH',
      });
      setShowModal(false);
      setName('');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create schedule');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(sched: any) {
    const newStatus = sched.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await apiClient.updateSyncSchedule(sched.id, { status: newStatus });
      setSchedules((prev) =>
        prev.map((s) => (s.id === sched.id ? { ...s, status: newStatus } : s))
      );
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  }

  async function handleDelete(schedId: string, schedName: string) {
    if (!confirm(`Are you sure you want to delete schedule "${schedName}"?`)) return;
    try {
      await apiClient.deleteSyncSchedule(schedId);
      setSchedules((prev) => prev.filter((s) => s.id !== schedId));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  }

  async function handleRunNow(schedId: string) {
    try {
      setRunningScheduleId(schedId);
      const res = await apiClient.triggerScheduleRunNow(schedId);
      alert(`Schedule triggered!\nStatus: ${res.result?.status}\n${res.result?.summary}`);
      loadData();
    } catch (err: any) {
      alert(`Run failed: ${err.message}`);
    } finally {
      setRunningScheduleId(null);
    }
  }

  return (
    <div className="space-y-6 w-full font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Automated Background Sync &amp; Schedules
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure autonomous schedules to keep connected OpenCart/Shopify stores continuously updated with newly scraped &amp; verified products.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              setShowModal(true);
              setErrorMsg('');
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-[#fad982]" />
            <span>Create Sync Schedule</span>
          </button>
          <Link
            href="/stores"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            <ShoppingBag className="w-4 h-4 text-slate-500" />
            <span>Manage Stores</span>
          </Link>
        </div>
      </div>

      {/* Sync Pipeline Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Automated Engine Runner</span>
            <span className="text-emerald-600 font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live (Every 60s)
            </span>
          </div>
          <div className="text-xl font-black text-slate-900">
            {schedules.filter((s) => s.status === 'ACTIVE').length} Active Schedules
          </div>
          <p className="text-[11px] text-slate-400">
            Autonomous cron worker evaluates schedules and pushes delta changes to stores.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Safety &amp; Verification</span>
            <span className="text-[#0d2a2c] text-sm">Idempotent</span>
          </div>
          <div className="text-xl font-black text-slate-900">Zero-Overwrite Safety</div>
          <p className="text-[11px] text-slate-400">
            Field change plans ensure existing manual edits and custom tabs are preserved.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Multilingual Sync</span>
            <span className="text-purple-600 font-bold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              AI Enabled
            </span>
          </div>
          <div className="text-xl font-black text-slate-900">Auto-Translation</div>
          <p className="text-[11px] text-slate-400">
            Syncs localized descriptions and titles for Dutch, German, French &amp; English.
          </p>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0d2a2c]" />
            <h3 className="font-bold text-sm text-slate-900">Configured Background Schedules</h3>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg">
            {schedules.length} Schedules
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400">
            Loading scheduled sync automations...
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-16 text-center">
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#0d2a2c]/5 flex items-center justify-center mx-auto text-[#0d2a2c]">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No automated schedules configured</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Set up recurring schedules to automatically sync entire brands or catalog updates to your connected OpenCart or Shopify stores.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-[#0d2a2c] text-[#fad982] text-xs font-bold rounded-xl hover:bg-[#143d40] transition shadow-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create Your First Schedule</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="py-3 px-4">Schedule Name</th>
                  <th className="py-3 px-4">Destination Store</th>
                  <th className="py-3 px-4">Brand Scope</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4">Language</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Run Result</th>
                  <th className="py-3 px-4">Next Run</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {schedules.map((sched) => (
                  <tr key={sched.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 block">{sched.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {sched.scheduleType || 'STORE_PUSH'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700">
                        <ShoppingBag className="w-3 h-3 text-slate-500" />
                        {sched.storeName || 'Connected Store'} ({String(sched.platformType || '').toUpperCase()})
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {sched.brandName ? (
                        <span className="px-2 py-0.5 rounded bg-[#0d2a2c]/5 text-[#0d2a2c] font-bold text-[11px]">
                          {sched.brandName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Entire Catalog</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800">{sched.frequency}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">
                        {sched.targetLanguage || 'en'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleStatus(sched)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition ${
                          sched.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {sched.status === 'ACTIVE' ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>ACTIVE</span>
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3" />
                            <span>PAUSED</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      {sched.lastRunAt ? (
                        <div>
                          <div className="flex items-center gap-1 text-[11px]">
                            {sched.lastRunStatus === 'SUCCESS' ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                            ) : (
                              <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            )}
                            <span className="font-bold text-slate-700">
                              {sched.lastRunStatus || 'DONE'}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 truncate mt-0.5" title={sched.lastRunSummary}>
                            {sched.lastRunSummary || new Date(sched.lastRunAt).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Never run</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {sched.nextRunAt ? new Date(sched.nextRunAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRunNow(sched.id)}
                          disabled={runningScheduleId === sched.id}
                          title="Trigger Run Now"
                          className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50 transition border border-transparent hover:border-emerald-200 disabled:opacity-50"
                        >
                          {runningScheduleId === sched.id ? (
                            <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(sched.id, sched.name)}
                          title="Delete Schedule"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition border border-transparent hover:border-rose-200"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Schedule Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#0d2a2c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#fad982]/20 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-[#fad982]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Create Automated Background Schedule</h3>
                  <p className="text-[11px] text-slate-300">Continuous sync without manual button clicks</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Schedule Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Daily Madison Liquidators OpenCart Push"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Frequency <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={frequency}
                    onChange={(e: any) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  >
                    <option value="HOURLY">Hourly (High Frequency)</option>
                    <option value="EVERY_6_HOURS">Every 6 Hours</option>
                    <option value="DAILY">Daily (Recommended)</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Language
                  </label>
                  <select
                    value={targetLanguage}
                    onChange={(e) => setTargetLanguage(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  >
                    <option value="en">English (Default)</option>
                    <option value="nl">Dutch (Nederlands)</option>
                    <option value="de">German (Deutsch)</option>
                    <option value="fr">French (Français)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Destination Store <span className="text-rose-500">*</span>
                </label>
                {stores.length === 0 ? (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                    No active stores connected. Connect OpenCart or Shopify in Store Settings first.
                  </div>
                ) : (
                  <select
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  >
                    {stores.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.platform.toUpperCase()})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Brand Filter (Optional)
                </label>
                <select
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                >
                  <option value="">All Brands (Entire Organization Catalog)</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || stores.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Save Schedule</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
