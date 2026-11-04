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
  Plus
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');

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
            href="/studio"
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
                <th className="py-3.5 px-5 text-right">Created</th>
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
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      job.status === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : job.status === 'failed'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-bold text-slate-900 font-mono">
                    {job.itemsExtracted || 0}
                  </td>
                  <td className="py-4 px-5 text-right text-slate-400 font-sans">
                    {new Date(job.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
