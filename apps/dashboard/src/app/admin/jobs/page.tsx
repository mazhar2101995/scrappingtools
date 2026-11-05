'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ChevronRight,
  Server
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminBullMqJobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  async function loadJobs() {
    try {
      setLoading(true);
      const res = await apiClient.getJobs();
      setJobs(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Failed to load jobs in admin:', e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const filtered = jobs.filter((j) => {
    const matchesFilter = statusFilter === 'ALL' || j.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesSearch =
      !search ||
      j.id?.toLowerCase().includes(search.toLowerCase()) ||
      j.targetUrl?.toLowerCase().includes(search.toLowerCase()) ||
      j.jobType?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalCompleted = jobs.filter((j) => j.status === 'completed').length;
  const totalFailed = jobs.filter((j) => j.status === 'failed').length;
  const totalQueued = jobs.filter((j) => ['queued', 'processing', 'active'].includes(j.status)).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="p-7 rounded-3xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              WORKER INFRASTRUCTURE
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            BullMQ Worker Engine & Job Queues
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time telemetry across multi-tenant BullMQ scraping workers, extraction pipelines, and failure dead-letter queues.
          </p>
        </div>

        <button
          onClick={loadJobs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue Status</span>
        </button>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span className="font-bold uppercase tracking-wider text-[10px]">Total Logged Tasks</span>
            <Layers className="w-4 h-4 text-[#9c7f23]" />
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">{jobs.length}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Cross-tenant execution events</div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span className="font-bold uppercase tracking-wider text-[10px]">Completed Successfully</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-black text-emerald-700 font-mono">{totalCompleted}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">
            {jobs.length > 0 ? ((totalCompleted / jobs.length) * 100).toFixed(0) : 100}% reliability rate
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span className="font-bold uppercase tracking-wider text-[10px]">Active / Queued</span>
            <Activity className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-3xl font-black text-sky-700 font-mono">{totalQueued}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Currently in Redis queue</div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-1 font-medium">
            <span className="font-bold uppercase tracking-wider text-[10px]">Failed Tasks</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-3xl font-black text-rose-700 font-mono">{totalFailed}</div>
          <div className="text-[11px] text-slate-500 mt-1 font-medium">Requires retry or proxy rotation</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['ALL', 'COMPLETED', 'QUEUED', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                statusFilter === st
                  ? 'bg-[#fad982] text-slate-950 border border-[#e8c35f] shadow-sm'
                  : 'bg-white border border-[#ebdcb9] text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by job ID, target URL or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#ebdcb9] rounded-2xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#d4af37] transition shadow-xs"
          />
        </div>
      </div>

      {/* Main Jobs Table */}
      <div className="rounded-3xl border border-[#ebdcb9] bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-[#fcfaf5] border-b border-[#ebdcb9] text-[11px] uppercase tracking-wider text-slate-500 font-mono">
            <tr>
              <th className="py-3.5 px-5">Job ID & Task Type</th>
              <th className="py-3.5 px-4">Target Source URL</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Extracted</th>
              <th className="py-3.5 px-4">Duration</th>
              <th className="py-3.5 px-5 text-right">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                  Loading active BullMQ queue state...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                  No background jobs matching selected filter.
                </td>
              </tr>
            ) : (
              filtered.map((j) => {
                const durationMs =
                  j.startedAt && j.completedAt
                    ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()
                    : null;

                return (
                  <tr
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="hover:bg-[#faf7ee]/60 transition cursor-pointer"
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-bold text-slate-900 truncate max-w-[180px]">{j.id}</div>
                      <div className="text-[10px] text-[#8a6e19] uppercase font-bold mt-0.5">{j.jobType}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-sans max-w-xs truncate">
                      {j.targetUrl || 'Internal Event'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          j.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : j.status === 'failed'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-sky-100 text-sky-800 border border-sky-200 animate-pulse'
                        }`}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {j.itemsExtracted ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono">
                      {durationMs !== null ? `${(durationMs / 1000).toFixed(2)}s` : '—'}
                    </td>
                    <td className="py-3.5 px-5 text-right text-slate-400 font-sans">
                      {new Date(j.createdAt).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-[#ebdcb9] p-7 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#f1ebd9] pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase bg-[#fad982]/40 text-[#7a5e12] px-2 py-0.5 rounded font-bold">
                  {selectedJob.jobType}
                </span>
                <h3 className="font-bold text-sm text-slate-900 mt-1">Job Execution Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-xs text-slate-400 hover:text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Job UUID</span>
                <span className="text-slate-900 break-all">{selectedJob.id}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">Target URL</span>
                <span className="text-slate-900 break-all font-sans">{selectedJob.targetUrl || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Status</span>
                  <span className="text-emerald-700 font-bold">{selectedJob.status}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase block">Items Extracted</span>
                  <span className="text-slate-900 font-bold">{selectedJob.itemsExtracted}</span>
                </div>
              </div>
              {selectedJob.errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  <span className="font-bold block mb-1">Execution Error:</span>
                  {selectedJob.errorMessage}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
