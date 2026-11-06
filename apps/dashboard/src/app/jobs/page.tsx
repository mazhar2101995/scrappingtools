'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Filter,
  Plus,
  Info,
  X,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedJob, setSelectedJob] = useState<any | null>(null);

  async function loadJobs() {
    try {
      setLoading(true);
      const res = await apiClient.getJobs();
      setJobs(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  const filtered = jobs.filter((j) => {
    if (statusFilter === 'ALL') return true;
    return j.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Background Job Pipelines</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Monitor real-time asynchronous scraping, normalization, identity matching, and persistence jobs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
            Total Jobs: {jobs.length}
          </span>
          <Link
            href="/brands"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Scraping Task</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar matching Brand Style */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5">
          {['ALL', 'ACTIVE', 'COMPLETED', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-[#0d2a2c] text-[#fad982] shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-900">{filtered.length}</span> pipelines
        </div>
      </div>

      {/* Jobs Table in Clean White/Teal Brand Theme */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading pipeline tasks from Redis/DB...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
              ⚡
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Jobs Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
              Your client workspace currently has no jobs matching the selected filter. Run a scraping or sync task to populate pipelines.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th className="py-3.5 px-5">Job ID &amp; Target</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Extracted Items</th>
                <th className="py-3.5 px-4">Created</th>
                <th className="py-3.5 px-5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-5 max-w-sm">
                    <span className="font-bold text-slate-900 block truncate font-mono text-[11px]">{job.id}</span>
                    <span className="text-[11px] text-slate-400 truncate block mt-0.5">{job.targetUrl}</span>
                  </td>
                  <td className="py-4 px-4 font-mono uppercase text-slate-600">
                    {job.jobType || 'SCRAPING'}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        job.status === 'completed'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : job.status === 'failed'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {job.status}
                      </span>
                      {job.status === 'failed' && (
                        <button
                          type="button"
                          onClick={() => setSelectedJob(job)}
                          title="Click to view failure reason"
                          className="p-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-900 font-mono">
                    {job.itemsExtracted || 0}
                  </td>
                  <td className="py-4 px-4 text-slate-400 font-sans text-xs">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                  <td className="py-4 px-5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedJob(job)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      <Info className="w-3.5 h-3.5 text-[#0d2a2c]" />
                      <span>Info</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Failure Reason & Job Details Modal */}
      {selectedJob && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className={`px-6 py-4 text-white flex items-center justify-between ${
              selectedJob.status === 'failed' ? 'bg-rose-900' : 'bg-[#0d2a2c]'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white font-black text-sm">
                  {selectedJob.status === 'failed' ? (
                    <AlertTriangle className="w-4 h-4 text-rose-300" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold leading-tight">Pipeline Job Information</h3>
                  <p className="text-[11px] text-slate-300">Execution diagnostics &amp; error analysis</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedJob(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs text-slate-700">
              {/* Status Header Pill */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Execution Status</span>
                  <span className={`inline-flex items-center gap-1 font-bold text-xs uppercase ${
                    selectedJob.status === 'completed'
                      ? 'text-emerald-700'
                      : selectedJob.status === 'failed'
                      ? 'text-rose-700'
                      : 'text-amber-700'
                  }`}>
                    {selectedJob.status === 'failed' && <AlertCircle className="w-3.5 h-3.5" />}
                    {selectedJob.status}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Extracted Items</span>
                  <span className="font-mono font-bold text-slate-900">{selectedJob.itemsExtracted || 0}</span>
                </div>
              </div>

              {/* Target URL */}
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Target Scrape URL</span>
                <a
                  href={selectedJob.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-[11px] text-[#0d2a2c] hover:underline flex items-center justify-between break-all"
                >
                  <span>{selectedJob.targetUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0 ml-2 text-slate-400" />
                </a>
              </div>

              {/* Failure Reason Alert (if failed) */}
              {selectedJob.status === 'failed' && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Failure Reason (Error Log):</span>
                  </div>
                  <pre className="text-[11px] font-mono bg-white/80 p-2.5 rounded border border-rose-200 text-rose-700 whitespace-pre-wrap break-all leading-relaxed">
                    {selectedJob.errorMessage || 'Unknown extraction error occurred during parsing.'}
                  </pre>
                  <p className="text-[10px] text-rose-600 leading-normal">
                    This error occurred when parsing the target HTML with the brand selector or connecting to the remote host. The selector union parser has now been patched.
                  </p>
                </div>
              )}

              {/* Timeline */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px]">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Created At</span>
                  <span className="font-mono text-slate-700">{new Date(selectedJob.createdAt).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Completed At</span>
                  <span className="font-mono text-slate-700">
                    {selectedJob.completedAt ? new Date(selectedJob.completedAt).toLocaleString() : 'In Progress / Queued'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedJob(null)}
                className="px-4 py-2 bg-[#0d2a2c] text-[#fad982] text-xs font-bold rounded-xl hover:bg-[#143d40] transition"
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
