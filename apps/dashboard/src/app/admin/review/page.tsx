'use client';

import React, { useEffect, useState } from 'react';
import { ShieldAlert, Check, X, Split, RefreshCw, AlertCircle } from 'lucide-react';
import { apiClient, ReviewQueueItem } from '@/lib/api-client';

export default function AdminReviewQueuePage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  async function loadQueue() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getReviewQueue('pending');
      setItems(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load review queue');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
  }, []);

  async function handleResolve(id: string, action: 'approve' | 'reject' | 'separate') {
    try {
      setActionLoading(id);
      await apiClient.resolveReviewItem(id, action, 'Manual reviewer override via Platform Admin');
      setSuccessMsg(`Action '${action}' applied successfully to item.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      await loadQueue();
    } catch (err: any) {
      setError(err.message || `Failed to execute action ${action}`);
    } finally {
      setActionLoading(null);
    }
  }

  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-wider">
              Identity Resolution
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Human Review Queue</h1>
          <p className="text-sm text-slate-400 mt-1">
            Deterministic match conflicts and ambiguous cross-store identity merges requiring human verification.
          </p>
        </div>

        <button 
          onClick={loadQueue}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-200 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Review Queue List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40 text-slate-500 text-sm">
            Loading identity review queue...
          </div>
        ) : safeItems.length === 0 ? (
          <div className="p-12 text-center rounded-xl border border-slate-800 bg-slate-900/40">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-white">Zero Pending Ambiguities</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              All multi-source entities have passed automated 7-signal deterministic thresholds cleanly.
            </p>
          </div>
        ) : (
          safeItems.map((item) => (
            <div key={item.id} className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                    Confidence: {(Number(item.matchConfidence || item.confidenceScore || 0) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Candidate: {item.listingTitle || item.candidateProductId || item.id}
                  </span>
                </div>
                <span className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
              </div>

              {/* Match Reason */}
              <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-850 text-xs font-mono text-slate-300">
                <span className="text-slate-500 uppercase text-[10px] block mb-1">Conflict / Resolution Reason</span>
                {Array.isArray(item.matchReasons) ? item.matchReasons.join(', ') : item.reason || 'Ambiguous attribute alignment'}
              </div>

              {/* Resolution Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
                <button
                  disabled={actionLoading === item.id}
                  onClick={() => handleResolve(item.id, 'separate')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-300 transition"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Separate as Distinct</span>
                </button>
                <button
                  disabled={actionLoading === item.id}
                  onClick={() => handleResolve(item.id, 'reject')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject Match</span>
                </button>
                <button
                  disabled={actionLoading === item.id}
                  onClick={() => handleResolve(item.id, 'approve')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Merge</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
