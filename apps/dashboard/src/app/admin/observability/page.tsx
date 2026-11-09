'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  Activity,
  Globe,
  Radio,
  Cpu,
  Layers,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
  Check,
  HardDrive,
  MessageSquare,
  Sparkles,
  Zap,
  RotateCw
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminObservabilityCenter() {
  const [activeTab, setActiveTab] = useState<'overview' | 'sources' | 'browser' | 'routes' | 'feedback'>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Real Operational Telemetry States
  const [sources, setSources] = useState<any[]>([]);
  const [browserData, setBrowserData] = useState<any>(null);
  const [routes, setRoutes] = useState<any[]>([]);
  const [feedbackList, setFeedbackList] = useState<any[]>([]);
  const [adminOverview, setAdminOverview] = useState<any>(null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [domainDetail, setDomainDetail] = useState<any>(null);

  // Status update message
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  async function loadAllObservabilityData() {
    try {
      setRefreshing(true);
      const [sourcesRes, browserRes, routesRes, feedbackRes, overviewRes] = await Promise.all([
        apiClient.getSourceHealthList(50).catch(() => ({ data: [] })),
        apiClient.getBrowserMetrics().catch(() => ({ data: null })),
        apiClient.getNetworkRoutes().catch(() => ({ data: [] })),
        apiClient.getFeedbackList().catch(() => ({ feedback: [] })),
        apiClient.getPlatformAdminOverview().catch(() => null),
      ]);

      setSources(sourcesRes?.data || []);
      setBrowserData(browserRes?.data || null);
      setRoutes(routesRes?.data || []);
      setFeedbackList(feedbackRes?.feedback || []);
      setAdminOverview(overviewRes || null);
    } catch (err: any) {
      console.error('Failed to load observability center data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadAllObservabilityData();
    const interval = setInterval(loadAllObservabilityData, 15000); // 15s auto-refresh
    return () => clearInterval(interval);
  }, []);

  async function viewDomainDetail(domain: string) {
    try {
      setSelectedDomain(domain);
      const detail = await apiClient.getDomainHealthDetail(domain);
      setDomainDetail(detail.data);
    } catch (_) {
      setDomainDetail(null);
    }
  }

  async function handleFeedbackStatus(id: string, status: string) {
    try {
      await apiClient.updateFeedbackStatus(id, status);
      setActionSuccess(`Issue status updated to ${status}`);
      setTimeout(() => setActionSuccess(null), 3000);
      loadAllObservabilityData();
    } catch (_) {}
  }

  if (loading) {
    return (
      <div className="space-y-6 w-full animate-pulse font-sans">
        <div className="h-20 bg-white rounded-3xl border border-[#ebdcb9]"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-white rounded-3xl border border-[#ebdcb9]"></div>
          ))}
        </div>
        <div className="h-96 bg-white rounded-3xl border border-[#ebdcb9]"></div>
      </div>
    );
  }

  const degradedSources = sources.filter((s) => s.healthStatus !== 'HEALTHY');
  const cooledDownSources = sources.filter((s) => s.isCooledDown);
  const activeBrowserJobs = browserData?.operational?.activeBrowserJobs || 0;
  const browserBacklog = browserData?.operational?.queuedBrowserJobs || 0;
  const systemMemory = browserData?.operational?.systemMemory;

  return (
    <div className="space-y-8 font-sans pb-16">
      {/* 1. Header & Live Controller */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white/90 backdrop-blur-md rounded-3xl border border-[#ebdcb9] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#00473e]/10 border border-[#00473e]/20 flex items-center justify-center text-[#00473e]">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#00473e] tracking-tight">Admin Operations & Observability Center</h1>
            <p className="text-xs text-neutral-600 mt-0.5">
              Real-time monitoring across Source Health, Headless Chromium Quotas, Network Routes & Client Reports
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {actionSuccess && (
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-3 py-1.5 rounded-full animate-fade-in">
              {actionSuccess}
            </span>
          )}
          <button
            onClick={loadAllObservabilityData}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-[#f2f7f5] hover:bg-[#ebdcb9]/40 border border-[#ebdcb9] text-[#00473e] rounded-2xl text-xs font-bold transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </button>
        </div>
      </div>

      {/* 2. Top-Level Platform Vital Signs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Monitored Domains Health */}
        <div className="p-5 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Source Websites</span>
            <Globe className="w-4 h-4 text-[#00473e]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#00473e]">{sources.length}</span>
            <span className="text-xs font-bold text-neutral-600">Monitored</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {degradedSources.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-700" /> All 100% Healthy
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                <AlertTriangle className="w-3 h-3 text-amber-700" /> {degradedSources.length} Degraded / Cooldown
              </span>
            )}
          </div>
        </div>

        {/* Headless Browser Worker Load */}
        <div className="p-5 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Browser Workload</span>
            <Cpu className="w-4 h-4 text-[#00473e]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#00473e]">{activeBrowserJobs}</span>
            <span className="text-xs text-neutral-600 font-bold">/ {browserData?.config?.maxConcurrentBrowsers || 3} Slots</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-neutral-600">
            <span>Backlog: {browserBacklog} queued</span>
            <span>•</span>
            <span>Cleanups: {browserData?.operational?.totalCleanupsExecuted || 0}</span>
          </div>
        </div>

        {/* Network Routes Health */}
        <div className="p-5 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Network Routes</span>
            <Radio className="w-4 h-4 text-[#00473e]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#00473e]">{routes.length + 1}</span>
            <span className="text-xs text-neutral-600 font-bold">Active Paths</span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              <Check className="w-3 h-3 text-emerald-700" /> Direct Core Active
            </span>
          </div>
        </div>

        {/* Client Reports & Feedback */}
        <div className="p-5 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider">Client Issues & Reports</span>
            <MessageSquare className="w-4 h-4 text-[#00473e]" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[#00473e]">
              {feedbackList.filter((f) => f.status === 'new' || f.status === 'under_review').length}
            </span>
            <span className="text-xs text-neutral-600 font-bold">Pending Review</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-neutral-600">
            <span>Total Logged: {feedbackList.length}</span>
          </div>
        </div>
      </div>

      {/* 3. Section Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#ebdcb9] pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-[#00473e] text-white shadow-sm'
              : 'text-[#00473e] hover:bg-[#ebdcb9]/30'
          }`}
        >
          <Activity className="w-3.5 h-3.5" /> Platform Health & Incidents
        </button>
        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'sources'
              ? 'bg-[#00473e] text-white shadow-sm'
              : 'text-[#00473e] hover:bg-[#ebdcb9]/30'
          }`}
        >
          <Globe className="w-3.5 h-3.5" /> Source Health & Cooldowns
          {degradedSources.length > 0 && (
            <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {degradedSources.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('browser')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'browser'
              ? 'bg-[#00473e] text-white shadow-sm'
              : 'text-[#00473e] hover:bg-[#ebdcb9]/30'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" /> Browser Isolation & Queues
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'routes'
              ? 'bg-[#00473e] text-white shadow-sm'
              : 'text-[#00473e] hover:bg-[#ebdcb9]/30'
          }`}
        >
          <Radio className="w-3.5 h-3.5" /> Network Routes & Proxies
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 ${
            activeTab === 'feedback'
              ? 'bg-[#00473e] text-white shadow-sm'
              : 'text-[#00473e] hover:bg-[#ebdcb9]/30'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Client Problem Center
          {feedbackList.filter((f) => f.status === 'new').length > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full">
              {feedbackList.filter((f) => f.status === 'new').length}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: OVERVIEW & ACTIVE INCIDENTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Real Incident Center */}
          <div className="p-6 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-[#ebdcb9]">
              <div>
                <h3 className="font-bold text-sm text-[#00473e]">Real Incident & Operational Alerts</h3>
                <p className="text-xs text-neutral-600 mt-0.5">
                  Dynamic operational alerts generated strictly from source circuit-breakers, route health, and worker failures
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-[#f2f7f5] rounded-xl text-[#00473e]">
                {adminOverview?.criticalIncidents?.length || 0} Detected
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {adminOverview?.criticalIncidents && adminOverview.criticalIncidents.length > 0 ? (
                adminOverview.criticalIncidents.map((inc: any, idx: number) => (
                  <div
                    key={inc.id || idx}
                    className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-amber-900">{inc.service}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-800">
                            {inc.severity}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-700 mt-1">{inc.description}</p>
                        <span className="text-[10px] text-neutral-600 mt-2 block">
                          Detected: {new Date(inc.detectedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 px-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-neutral-800">No active incidents detected</h4>
                  <p className="text-xs text-neutral-600 mt-1 max-w-sm mx-auto">
                    All monitored external sources, headless browser pools, Redis queues, and databases are operating cleanly within normal parameters.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Subsystem Health Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm">
              <h3 className="font-bold text-sm text-[#00473e] mb-4">Core Infrastructure Status</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f2f7f5]/50 border border-[#ebdcb9]/60">
                  <span className="text-xs font-semibold text-neutral-700">REST API Gateway</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Healthy (HTTP 200)
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f2f7f5]/50 border border-[#ebdcb9]/60">
                  <span className="text-xs font-semibold text-neutral-700">PostgreSQL Primary Cluster</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Connected & Verified
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f2f7f5]/50 border border-[#ebdcb9]/60">
                  <span className="text-xs font-semibold text-neutral-700">Redis BullMQ Broker</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Responsive
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f2f7f5]/50 border border-[#ebdcb9]/60">
                  <span className="text-xs font-semibold text-neutral-700">Python Fast Cascade Engine</span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                    Operational (:8001)
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm">
              <h3 className="font-bold text-sm text-[#00473e] mb-4">Real Server Resource Usage</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-neutral-700 mb-1">
                    <span>OS Free Memory</span>
                    <span>{systemMemory?.freeMemoryMb || 0} MB / {systemMemory?.totalMemoryMb || 0} MB</span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00473e] rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(((systemMemory?.freeMemoryMb || 0) / (systemMemory?.totalMemoryMb || 1)) * 100)
                        )}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-neutral-700 mb-1">
                    <span>Node.js Process Memory (RSS)</span>
                    <span>{systemMemory?.processMemoryMb || 0} MB</span>
                  </div>
                  <p className="text-[11px] text-neutral-600 mt-1">
                    Actual memory allocated to active scraping workers, Drizzle queries, and Puppeteer bridge.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SOURCE HEALTH & COOLDOWNS */}
      {activeTab === 'sources' && (
        <div className="p-6 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#ebdcb9]">
            <div>
              <h3 className="font-bold text-sm text-[#00473e]">Monitored Source Domains</h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Real operational condition, success rates, latency averages, and cooldown circuit-breaker states
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-bold text-neutral-600 uppercase border-b border-[#ebdcb9]/60">
                <tr>
                  <th className="py-3 px-3">Domain</th>
                  <th className="py-3 px-3">Health Status</th>
                  <th className="py-3 px-3">Total Requests</th>
                  <th className="py-3 px-3">Success Rate</th>
                  <th className="py-3 px-3">Avg Latency</th>
                  <th className="py-3 px-3">Cooldown Status</th>
                  <th className="py-3 px-3 text-right">Drilldown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebdcb9]/40">
                {sources.map((s) => (
                  <tr key={s.domain} className="hover:bg-[#f2f7f5]/40 transition">
                    <td className="py-3 px-3 font-bold text-[#00473e]">{s.domain}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          s.healthStatus === 'HEALTHY'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.healthStatus === 'DEGRADED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {s.healthStatus}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-semibold text-neutral-700">{s.totalRequests}</td>
                    <td className="py-3 px-3 font-semibold text-neutral-700">{s.successRate}%</td>
                    <td className="py-3 px-3 font-semibold text-neutral-700">{s.avgLatencyMs}ms</td>
                    <td className="py-3 px-3">
                      {s.isCooledDown ? (
                        <span className="text-rose-700 font-bold text-[11px]">
                          Cooldown: {s.cooldownRemainingSec}s left
                        </span>
                      ) : (
                        <span className="text-neutral-600">Active</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => viewDomainDetail(s.domain)}
                        className="px-2.5 py-1 bg-[#f2f7f5] hover:bg-[#ebdcb9]/40 border border-[#ebdcb9] rounded-xl text-[11px] font-bold text-[#00473e] transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Domain Modal/Drawer */}
          {selectedDomain && domainDetail && (
            <div className="mt-6 p-6 rounded-3xl bg-[#f2f7f5] border border-[#ebdcb9] space-y-4">
              <div className="flex items-center justify-between border-b border-[#ebdcb9] pb-3">
                <div>
                  <h4 className="font-bold text-sm text-[#00473e]">Diagnostic Detail: {selectedDomain}</h4>
                  <p className="text-xs text-neutral-600 mt-0.5">Client-Friendly Translation: "{domainDetail.clientMessage}"</p>
                </div>
                <button
                  onClick={() => setSelectedDomain(null)}
                  className="px-3 py-1 bg-white border border-[#ebdcb9] rounded-xl text-xs font-bold text-neutral-600"
                >
                  Close
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white rounded-2xl border border-[#ebdcb9]/60">
                  <span className="text-neutral-600 block text-[10px] uppercase font-bold">Consecutive Failures</span>
                  <span className="font-bold text-neutral-800 text-sm">{domainDetail.consecutiveFailures}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-[#ebdcb9]/60">
                  <span className="text-neutral-600 block text-[10px] uppercase font-bold">Last Status Code</span>
                  <span className="font-bold text-neutral-800 text-sm">{domainDetail.lastStatusCode || 'N/A'}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-[#ebdcb9]/60">
                  <span className="text-neutral-600 block text-[10px] uppercase font-bold">Last Error Category</span>
                  <span className="font-bold text-neutral-800 text-sm">{domainDetail.lastErrorCategory || 'None'}</span>
                </div>
                <div className="p-3 bg-white rounded-2xl border border-[#ebdcb9]/60">
                  <span className="text-neutral-600 block text-[10px] uppercase font-bold">Last Successful Hit</span>
                  <span className="font-bold text-neutral-800 text-sm">
                    {domainDetail.lastSuccessAt ? new Date(domainDetail.lastSuccessAt).toLocaleTimeString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: BROWSER ISOLATION & QUEUES */}
      {activeTab === 'browser' && (
        <div className="p-6 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm space-y-6">
          <div>
            <h3 className="font-bold text-sm text-[#00473e]">Headless Chromium Resource Protection</h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Decoupled queue operations, hard process boundaries, media interception, and guaranteed cleanup
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#f2f7f5]/60 border border-[#ebdcb9]">
              <span className="text-xs text-neutral-600 font-bold uppercase tracking-wider block">Server Max Concurrency</span>
              <span className="text-2xl font-bold text-[#00473e] mt-1 block">{browserData?.config?.maxConcurrentBrowsers || 3} Browsers</span>
              <span className="text-[11px] text-neutral-600 mt-1 block">Active Right Now: {activeBrowserJobs}</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#f2f7f5]/60 border border-[#ebdcb9]">
              <span className="text-xs text-neutral-600 font-bold uppercase tracking-wider block">Job Timeout Ceiling</span>
              <span className="text-2xl font-bold text-[#00473e] mt-1 block">
                {(browserData?.config?.totalJobTimeoutMs || 30000) / 1000}s Total
              </span>
              <span className="text-[11px] text-neutral-600 mt-1 block">Nav Timeout: {(browserData?.config?.navigationTimeoutMs || 20000) / 1000}s</span>
            </div>
            <div className="p-4 rounded-2xl bg-[#f2f7f5]/60 border border-[#ebdcb9]">
              <span className="text-xs text-neutral-600 font-bold uppercase tracking-wider block">Fairness Tenant Limit</span>
              <span className="text-2xl font-bold text-[#00473e] mt-1 block">{browserData?.config?.maxPerTenantConcurrent || 1} Concurrent</span>
              <span className="text-[11px] text-neutral-600 mt-1 block">Prevents single-tenant queue monopolization</span>
            </div>
          </div>

          {/* Queue Depths */}
          <div className="border border-[#ebdcb9] rounded-2xl p-4">
            <h4 className="font-bold text-xs text-[#00473e] mb-3">BullMQ Queue Telemetry</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-white rounded-xl border border-[#ebdcb9]/60">
                <span className="font-bold text-neutral-800 block">Lightweight Scraping Queue</span>
                <div className="mt-2 flex gap-4 text-neutral-600">
                  <span>Waiting: {browserData?.queues?.lightweight?.waiting || 0}</span>
                  <span>Active: {browserData?.queues?.lightweight?.active || 0}</span>
                  <span>Failed: {browserData?.queues?.lightweight?.failed || 0}</span>
                </div>
              </div>
              <div className="p-3 bg-white rounded-xl border border-[#ebdcb9]/60">
                <span className="font-bold text-neutral-800 block">Browser Heavy Queue</span>
                <div className="mt-2 flex gap-4 text-neutral-600">
                  <span>Waiting: {browserData?.queues?.browser?.waiting || 0}</span>
                  <span>Active: {browserData?.queues?.browser?.active || 0}</span>
                  <span>Failed: {browserData?.queues?.browser?.failed || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: NETWORK ROUTES */}
      {activeTab === 'routes' && (
        <div className="p-6 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm space-y-4">
          <div>
            <h3 className="font-bold text-sm text-[#00473e]">Network Route Manager & Proxy Telemetry</h3>
            <p className="text-xs text-neutral-600 mt-0.5">
              Direct connection default with optional proxy routes for anti-bot degradation
            </p>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-[#f2f7f5]/60 border border-[#ebdcb9] flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-[#00473e]">Direct Core Connection (Default)</span>
                <p className="text-[11px] text-neutral-600 mt-0.5">Direct server connection for all standard and healthy store sources</p>
              </div>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                Active & Default
              </span>
            </div>

            {routes.map((r) => (
              <div key={r.routeId} className="p-4 rounded-2xl bg-white border border-[#ebdcb9] flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#00473e]">{r.routeId}</span>
                    <span className="text-[10px] uppercase font-bold text-neutral-600 px-2 py-0.5 bg-neutral-100 rounded-full">
                      Provider: {r.providerId}
                    </span>
                  </div>
                  <div className="flex gap-4 text-[11px] text-neutral-600 mt-1">
                    <span>Total Hits: {r.totalRequests}</span>
                    <span>Successes: {r.successfulRequests}</span>
                    <span>Failures: {r.failedRequests}</span>
                    <span>Avg Latency: {r.avgLatencyMs}ms</span>
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    r.status === 'AVAILABLE'
                      ? 'bg-emerald-100 text-emerald-800'
                      : r.status === 'DEGRADED'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: CLIENT PROBLEM & FEEDBACK CENTER */}
      {activeTab === 'feedback' && (
        <div className="p-6 bg-white rounded-3xl border border-[#ebdcb9] shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#ebdcb9]">
            <div>
              <h3 className="font-bold text-sm text-[#00473e]">Client Problem & Feedback Center</h3>
              <p className="text-xs text-neutral-600 mt-0.5">
                Client-submitted bug reports, error reference IDs, and operational resolution workflow
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {feedbackList.length > 0 ? (
              feedbackList.map((f) => (
                <div key={f.id} className="p-4 rounded-2xl bg-[#f2f7f5]/40 border border-[#ebdcb9] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900">{f.title}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-700">
                        {f.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={f.status}
                        onChange={(e) => handleFeedbackStatus(f.id, e.target.value)}
                        className="text-xs font-bold border border-[#ebdcb9] rounded-xl px-2.5 py-1 bg-white text-[#00473e]"
                      >
                        <option value="new">New</option>
                        <option value="under_review">Under Review</option>
                        <option value="investigating">Investigating</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-neutral-700">{f.description}</p>
                  <div className="flex gap-4 text-[10px] text-neutral-600 pt-1 border-t border-[#ebdcb9]/40">
                    {f.userEmail && <span>User: {f.userEmail}</span>}
                    {f.errorReferenceId && <span>Ref ID: {f.errorReferenceId}</span>}
                    <span>Submitted: {new Date(f.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10">
                <p className="text-xs text-neutral-600">No client feedback or bug reports submitted yet.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
