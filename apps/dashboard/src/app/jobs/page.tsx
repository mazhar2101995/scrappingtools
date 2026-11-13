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
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Layers,
  Database
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function JobsPage() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);

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

  async function loadJobTransparency(id: string) {
    try {
      setSelectedJobId(id);
      setLoadingDetail(true);
      const res = await apiClient.getJobDetail(id);
      setJobDetail(res);
    } catch (e) {
      console.error('Failed to load job detail:', e);
      setJobDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleRetry(id: string) {
    try {
      setRetrying(true);
      await apiClient.retryJob(id);
      setFeedbackSuccess('Job successfully scheduled for automated re-processing');
      setTimeout(() => setFeedbackSuccess(null), 4000);
      loadJobs();
      loadJobTransparency(id);
    } catch (e: any) {
      alert(`Retry failed: ${e.message}`);
    } finally {
      setRetrying(false);
    }
  }

  useEffect(() => {
    loadJobs();
    // 10s auto-refresh for client job list
    const timer = setInterval(loadJobs, 10000);
    return () => clearInterval(timer);
  }, []);

  const filtered = jobs.filter((j) => {
    if (statusFilter === 'ALL') return true;
    return j.status?.toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#dbdade] pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Product Processing Transparency</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time stage transparency, source acquisition status, data quality checkpoints, and automated recovery
          </p>
        </div>

        <div className="flex items-center gap-3">
          {feedbackSuccess && (
            <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-full">
              {feedbackSuccess}
            </span>
          )}
          <span className="px-3 py-1.5 rounded-lg bg-white border border-[#dbdade] text-xs font-bold text-slate-700 shadow-sm">
            Total Requests: {jobs.length}
          </span>
          <Link
            href="/products"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#00473e] hover:bg-[#003831] text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ingest Product URL</span>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#dbdade] shadow-sm">
        <div className="flex items-center gap-1.5">
          {['ALL', 'QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                statusFilter === st
                  ? 'bg-[#00473e] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-900">{filtered.length}</span> product pipelines
        </div>
      </div>

      {/* Main Jobs Layout: Split Screen with Real Processing Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Pipeline List */}
        <div className={`${selectedJobId ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white rounded-xl border border-[#dbdade] shadow-sm overflow-hidden transition-all`}>
          {loading && jobs.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading pipeline tasks from Redis/DB...</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 font-medium">No processing jobs matching this filter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 border-b border-[#dbdade] text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Target Product URL</th>
                    <th className="py-3 px-4">Current Stage</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Submitted</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filtered.map((j) => {
                    const isSelected = selectedJobId === j.id;
                    const isCompleted = j.status === 'completed';
                    const isFailed = j.status === 'failed';
                    const isQueued = j.status === 'queued';

                    return (
                      <tr
                        key={j.id}
                        onClick={() => loadJobTransparency(j.id)}
                        className={`cursor-pointer transition ${
                          isSelected ? 'bg-emerald-50/60' : 'hover:bg-slate-50/70'
                        }`}
                      >
                        <td className="py-3 px-4 max-w-[240px]">
                          <span className="font-bold text-slate-900 truncate block">{j.targetUrl}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Job: {j.id.substring(0, 8)}...</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-slate-700 font-semibold block">
                            {isCompleted ? 'Saved to Catalog' : isFailed ? 'Requires Attention' : isQueued ? 'Waiting in Queue' : 'Collecting Data'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              isCompleted
                                ? 'bg-emerald-100 text-emerald-800'
                                : isFailed
                                ? 'bg-rose-100 text-rose-800'
                                : isQueued
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-600' : isFailed ? 'bg-rose-600' : 'bg-amber-600 animate-pulse'}`} />
                            {j.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadJobTransparency(j.id);
                            }}
                            className="px-3 py-1 bg-slate-100 hover:bg-[#00473e] hover:text-white rounded-lg text-slate-700 font-bold transition text-[11px]"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Dedicated Client Transparency Drawer */}
        {selectedJobId && (
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#dbdade] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#dbdade]">
              <div>
                <h3 className="font-bold text-sm text-[#00473e]">Real-Time Processing Transparency</h3>
                <p className="text-xs text-slate-500 mt-0.5">Live workflow progress and data validation milestones</p>
              </div>
              <button
                onClick={() => {
                  setSelectedJobId(null);
                  setJobDetail(null);
                }}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="py-12 text-center text-xs text-slate-400 animate-pulse">Loading live job transparency...</div>
            ) : jobDetail?.clientTransparency ? (
              <div className="space-y-6">
                {/* Active Client-Friendly State Card */}
                <div
                  className={`p-4 rounded-xl border ${
                    jobDetail.clientTransparency.clientStatus === 'completed'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : jobDetail.clientTransparency.clientStatus === 'failed'
                      ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        Current Status
                      </span>
                      <h4 className="font-bold text-sm mt-0.5">{jobDetail.clientTransparency.clientMessage}</h4>
                      {jobDetail.clientTransparency.itemsExtracted > 0 && (
                        <p className="text-xs mt-1 font-semibold">
                          Attributes Processed: {jobDetail.clientTransparency.itemsExtracted}
                        </p>
                      )}
                    </div>
                    {jobDetail.clientTransparency.canRetry && (
                      <button
                        onClick={() => handleRetry(jobDetail.clientTransparency.jobId)}
                        disabled={retrying}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shrink-0"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                        Retry Request
                      </button>
                    )}
                  </div>
                </div>

                {/* Step-by-Step Milestone Progression */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Processing Milestones</h4>
                  <div className="space-y-2">
                    {jobDetail.clientTransparency.stages.map((stage: any, idx: number) => {
                      const isDone = stage.status === 'completed';
                      const isCurrent = stage.status === 'current';
                      const isFailed = stage.status === 'failed';

                      return (
                        <div
                          key={stage.key}
                          className={`p-3 rounded-xl border flex items-center justify-between text-xs transition ${
                            isDone
                              ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-900'
                              : isCurrent
                              ? 'bg-blue-50 border-blue-300 text-blue-900 font-bold ring-2 ring-blue-100'
                              : isFailed
                              ? 'bg-rose-50 border-rose-200 text-rose-800'
                              : 'bg-slate-50 border-[#dbdade] text-slate-400'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {isDone ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : isCurrent ? (
                              <RefreshCw className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
                            ) : isFailed ? (
                              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center text-[9px] text-slate-400">
                                {idx + 1}
                              </div>
                            )}
                            <span>{stage.label}</span>
                          </div>

                          <span className="text-[10px] font-bold uppercase tracking-wider">
                            {isDone ? 'Completed' : isCurrent ? 'In Progress' : isFailed ? 'Failed' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timing Provenance */}
                <div className="p-3 bg-slate-50 rounded-xl border border-[#dbdade] text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Submitted:</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(jobDetail.clientTransparency.timing.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  {jobDetail.clientTransparency.timing.startedAt && (
                    <div className="flex justify-between">
                      <span>Started Processing:</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(jobDetail.clientTransparency.timing.startedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {jobDetail.clientTransparency.timing.completedAt && (
                    <div className="flex justify-between">
                      <span>Completed At:</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(jobDetail.clientTransparency.timing.completedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500">Could not parse transparency records.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
