'use client';

import React, { useState } from 'react';
import {
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';

interface DisplayJob {
  id: string;
  brand: string;
  targetUrl: string;
  status: string;
  worker: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  durationMs: number;
  createdAt: string;
  error?: string | null;
}

const JOBS_DATA: DisplayJob[] = [
  {
    id: 'job_scrape_traxxas_slash',
    brand: 'Traxxas',
    targetUrl: 'https://traxxas.com/products/models/electric/slash-4x4-vxl',
    status: 'completed',
    worker: 'scraping-worker-01',
    priority: 1,
    attempts: 1,
    maxAttempts: 3,
    durationMs: 1420,
    createdAt: '12 mins ago',
  },
  {
    id: 'job_norm_traxxas_slash',
    brand: 'Traxxas',
    targetUrl: 'internal://normalization/prod_68086-4',
    status: 'completed',
    worker: 'normalization-worker-01',
    priority: 1,
    attempts: 1,
    maxAttempts: 3,
    durationMs: 310,
    createdAt: '11 mins ago',
  },
  {
    id: 'job_scrape_xray_x4_2024',
    brand: 'Xray',
    targetUrl: 'https://teamxray.com/x4/2024/',
    status: 'active',
    worker: 'scraping-worker-02',
    priority: 2,
    attempts: 1,
    maxAttempts: 3,
    durationMs: 890,
    createdAt: 'Just now',
  },
  {
    id: 'job_scrape_bitty_hyper_hr',
    brand: 'Bittydesign',
    targetUrl: 'https://bittydesign.net/en/hyper-hr-body',
    status: 'completed',
    worker: 'scraping-worker-01',
    priority: 3,
    attempts: 1,
    maxAttempts: 3,
    durationMs: 1120,
    createdAt: '45 mins ago',
  },
  {
    id: 'job_scrape_amain_invalid_sku',
    brand: 'Unknown',
    targetUrl: 'https://example-retailer.com/non-existent-product',
    status: 'failed',
    worker: 'scraping-worker-03',
    priority: 5,
    attempts: 3,
    maxAttempts: 3,
    durationMs: 5040,
    createdAt: '2 hours ago',
    error: 'HTTP 404: Remote resource not found after 3 exponential backoff attempts',
  },
];

export default function JobsPage() {
  const [jobs, setJobs] = useState(JOBS_DATA);
  const [filter, setFilter] = useState('ALL');

  const filteredJobs = jobs.filter((job) => {
    if (filter === 'ALL') return true;
    return job.status === filter;
  });

  const handleRetry = (jobId: string) => {
    setJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: 'active', error: null, attempts: 1 } : j))
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">BullMQ Background Job Pipelines</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor real-time asynchronous scraping, normalization, identity matching, and persistence jobs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            Total Jobs in Redis: <strong className="text-white font-mono">{jobs.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 bg-[#0e1626] p-2 rounded-xl border border-slate-800">
        {['ALL', 'active', 'completed', 'failed'].map((st) => (
          <button
            key={st}
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
              filter === st
                ? 'bg-sky-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {/* Jobs Table */}
      <div className="bg-[#0e1626] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Job ID &amp; Target</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Worker &amp; Attempts</th>
                <th className="py-3 px-4">Execution Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-4 px-4 max-w-sm">
                    <div className="font-mono font-medium text-slate-100">{job.id}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">{job.targetUrl}</div>
                    {job.error && (
                      <div className="mt-1 text-[11px] text-rose-400 bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                        {job.error}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {job.brand}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    {job.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    )}
                    {job.status === 'active' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse">
                        <Clock className="w-3 h-3" />
                        <span>Processing</span>
                      </span>
                    )}
                    {job.status === 'failed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px]">
                    <div className="text-slate-300">{job.worker}</div>
                    <div className="text-slate-500">
                      Attempts: {job.attempts}/{job.maxAttempts}
                    </div>
                  </td>
                  <td className="py-4 px-4 font-mono text-slate-300">
                    {job.durationMs}ms
                  </td>
                  <td className="py-4 px-4 text-right">
                    {job.status === 'failed' && (
                      <button
                        onClick={() => handleRetry(job.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-750 text-sky-400 hover:border-sky-500 transition text-xs"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
