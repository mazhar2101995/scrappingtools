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
    const matchesSearch = !search || 
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider font-mono">
              Worker Infrastructure
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BullMQ Worker Engine & Job Queues</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Real-time telemetry across multi-tenant BullMQ scraping workers, extraction pipelines, and failure dead-letter queues.
          </p>
        </div>

        <button
          onClick={loadJobs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 transition shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Queue Status</span>
        </button>
      </div>

      {/* Top 3 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Total Logged Tasks</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">{jobs.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">Cross-tenant execution events</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Completed Successfully</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{totalCompleted}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {jobs.length > 0 ? ((totalCompleted / jobs.length) * 100).toFixed(0) : 100}% reliability rate
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Active / Queued</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-sky-400 font-mono">{totalQueued}</div>
          <div className="text-[11px] text-slate-500 mt-1">Currently processing in Redis queue</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1 font-medium">
            <span>Failed / Dead-Letter</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{totalFailed}</div>
          <div className="text-[11px] text-slate-500 mt-1">Requires retry or proxy rotation</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {['ALL', 'COMPLETED', 'QUEUED', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by job ID, target URL or type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition"
          />
        </div>
      </div>

      {/* Main Jobs Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#0b0f19] border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            <tr>
              <th className="py-3 px-4">Job ID & Task Type</th>
              <th className="py-3 px-4">Target Source URL</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Extracted</th>
              <th className="py-3 px-4">Duration</th>
              <th className="py-3 px-4 text-right">Created At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                  Loading active BullMQ queue state...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500 font-sans">
                  No background jobs matching selected filter.
                </td>
              </tr>
            ) : (
              filtered.map((j) => {
                const durationMs = j.startedAt && j.completedAt
                  ? new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime()
                  : null;

                return (
                  <tr
                    key={j.id}
                    onClick={() => setSelectedJob(j)}
                    className="hover:bg-slate-850/60 transition cursor-pointer"
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white truncate max-w-[180px]">{j.id}</div>
                      <div className="text-[10px] text-purple-400 uppercase mt-0.5">{j.jobType}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate">
                      {j.targetUrl || 'Internal Event'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        j.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : j.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-sky-500/10 text-sky-400 border border-sky-500/20 animate-pulse'
                      }`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200">
                      {j.itemsExtracted ?? 0}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {durationMs !== null ? `${(durationMs / 1000).toFixed(2)}s` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 font-sans">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0e1422] rounded-2xl max-w-xl w-full border border-slate-800 p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                  {selectedJob.jobType}
                </span>
                <h3 className="font-bold text-sm text-white mt-1">Job Inspection</h3>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Job UUID</span>
                <span className="text-slate-300 break-all">{selectedJob.id}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[10px] uppercase block">Target URL</span>
                <span className="text-slate-300 break-all font-sans">{selectedJob.targetUrl || '—'}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Status</span>
                  <span className="text-emerald-400">{selectedJob.status}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase block">Items Extracted</span>
                  <span className="text-white">{selectedJob.itemsExtracted}</span>
                </div>
              </div>
              {selectedJob.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
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
