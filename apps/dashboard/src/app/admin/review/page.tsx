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
      setSuccessMsg(`Action '${action}' applied successfully.`);
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
    <div className="space-y-6 w-full font-sans">
      <div className="p-7 rounded-xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              IDENTITY RESOLUTION
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Human Review Queue & Identity Merges
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Deterministic match conflicts and ambiguous cross-store identity merges requiring human verification.
          </p>
        </div>

        <button
          onClick={loadQueue}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Review Queue List */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-16 text-center rounded-xl border border-[#ebdcb9] bg-white text-slate-400 text-xs">
            Loading identity review queue...
          </div>
        ) : safeItems.length === 0 ? (
          <div className="p-16 text-center rounded-xl border border-[#ebdcb9] bg-white shadow-xs">
            <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Zero Pending Ambiguities</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              All multi-source entities have passed automated 7-signal deterministic thresholds cleanly.
            </p>
          </div>
        ) : (
          safeItems.map((item) => (
            <div key={item.id} className="p-6 rounded-xl border border-[#ebdcb9] bg-white shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase font-mono">
                    Confidence: {(Number(item.matchConfidence || item.confidenceScore || 0) * 100).toFixed(0)}%
                  </span>
                  <span className="text-xs text-slate-600 font-bold">
                    Candidate: {item.listingTitle || item.candidateProductId || item.id}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
              </div>

              {/* Match Reason */}
              <div className="p-3.5 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9] text-xs font-mono text-slate-700">
                <span className="text-slate-400 uppercase text-[10px] block mb-1">Conflict / Resolution Reason</span>
                {Array.isArray(item.matchReasons) ? item.matchReasons.join(', ') : item.reason || 'Ambiguous attribute alignment'}
              </div>

              {/* Resolution Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 font-sans">
                <button
                  disabled={actionLoading === item.id}
                  onClick={() => handleResolve(item.id, 'separate')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                >
                  <Split className="w-3.5 h-3.5" />
                  <span>Separate as Distinct</span>
                </button>
                <button
                  disabled={actionLoading === item.id}
                  onClick={() => handleResolve(item.id, 'reject')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reject Match</span>
                </button>
                <button
                  disabled={actionLoading === item.id}
                  onClick={() => handleResolve(item.id, 'approve')}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#fad982] hover:bg-[#f3cc65] text-slate-950 transition shadow-xs border border-[#e8c35f]"
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
