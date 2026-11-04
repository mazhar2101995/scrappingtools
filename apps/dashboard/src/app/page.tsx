'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  Boxes,
  Cpu,
  Layers,
  ShoppingBag,
  AlertTriangle,
  Calendar,
  Plus,
  ArrowUpRight,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { apiClient, ClientWorkspaceData } from '@/lib/api-client';

export default function ClientDashboardOverview() {
  const [data, setData] = useState<ClientWorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const res = await apiClient.getClientWorkspace();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const totalProducts = data?.metrics?.totalProducts ?? 12846;
  const updatedProducts = data?.metrics?.recentlyUpdated ?? 1234;
  const aiProcessed = 8420;
  const activeJobsCount = data?.metrics?.activeJobs ?? 5;
  const storesCount = data?.metrics?.connectedStoresCount ?? 3;
  const needsReview = data?.metrics?.pendingReviewCount ?? 47;

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* 1. Header & Greeting Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-200 border-2 border-white shadow-sm flex items-center justify-center text-slate-700 font-bold overflow-hidden">
            <span className="text-xl">👨‍💼</span>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Good morning, John!</h1>
            <p className="text-xs text-slate-500 font-medium">Here's your product intelligence workspace at a glance.</p>
          </div>
        </div>

        {/* Date Filter & Action Button */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm cursor-pointer hover:bg-slate-50">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Last 30 Days</span>
          </div>

          <Link
            href="/studio"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-lg shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Scraping Job</span>
          </Link>
        </div>
      </div>

      {/* 2. Top Metric Cards (6 Cards Matching Screenshot) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Card 1: Total Products */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">📦</span>
            <span className="text-[11px] text-slate-600">Total Products</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{totalProducts.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>▲ +8.4%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Updated Products */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">📑</span>
            <span className="text-[11px] text-slate-600">Updated Products</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{updatedProducts.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>▲ +12.6%</span>
            </div>
          </div>
        </div>

        {/* Card 3: AI Processed */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">🤖</span>
            <span className="text-[11px] text-slate-600">AI Processed</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{aiProcessed.toLocaleString()}</div>
            <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
              <span>▲ +15.3%</span>
            </div>
          </div>
        </div>

        {/* Card 4: Active Jobs */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">⚡</span>
            <span className="text-[11px] text-slate-600">Active Jobs</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{activeJobsCount}</div>
            <div className="text-[10px] font-medium text-slate-500 mt-0.5">
              2 Scraping • 3 AI
            </div>
          </div>
        </div>

        {/* Card 5: Connected Stores */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">🏪</span>
            <span className="text-[11px] text-slate-600">Connected Stores</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{storesCount}</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-4 h-4 rounded bg-sky-500/10 text-sky-600 font-bold text-[9px] flex items-center justify-center">OC</span>
              <span className="w-4 h-4 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[9px] flex items-center justify-center">SP</span>
              <span className="w-4 h-4 rounded bg-purple-500/10 text-purple-600 font-bold text-[9px] flex items-center justify-center">WC</span>
            </div>
          </div>
        </div>

        {/* Card 6: Needs Review */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between hover:border-slate-300 transition">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
            <span className="text-amber-500 text-base">⚠️</span>
            <span className="text-[11px] text-slate-600">Needs Review</span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-black text-slate-900">{needsReview}</div>
            <div className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5 mt-0.5">
              <span>▲ +6 new</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Ingestion Chart + Donut Quality Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Product Ingestion & Processing Chart Card (2 Cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Product Ingestion & Processing</h3>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1b6b63]"></span>
                <span className="text-slate-600 text-[11px]">Ingested</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f39c12]"></span>
                <span className="text-slate-600 text-[11px]">AI Processed</span>
              </div>
            </div>
          </div>

          {/* SVG Graph Curve matching screenshot aesthetic */}
          <div className="h-52 w-full pt-2">
            <svg viewBox="0 0 700 200" className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="tealGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1b6b63" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#1b6b63" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f39c12" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f39c12" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="40" y1="30" x2="680" y2="30" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="75" x2="680" y2="75" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="120" x2="680" y2="120" stroke="#f1f5f9" strokeWidth="1" />
              <line x1="40" y1="165" x2="680" y2="165" stroke="#f1f5f9" strokeWidth="1" />

              {/* Y Axis Labels */}
              <text x="25" y="34" fontSize="10" fill="#94a3b8" textAnchor="end">800</text>
              <text x="25" y="79" fontSize="10" fill="#94a3b8" textAnchor="end">600</text>
              <text x="25" y="124" fontSize="10" fill="#94a3b8" textAnchor="end">400</text>
              <text x="25" y="169" fontSize="10" fill="#94a3b8" textAnchor="end">200</text>

              {/* Ingested Path (Teal) */}
              <path
                d="M 50 160 Q 150 130 250 120 T 450 80 T 600 45 T 670 55 L 670 180 L 50 180 Z"
                fill="url(#tealGrad)"
              />
              <path
                d="M 50 160 Q 150 130 250 120 T 450 80 T 600 45 T 670 55"
                fill="none"
                stroke="#1b6b63"
                strokeWidth="2.5"
              />

              {/* AI Processed Path (Amber) */}
              <path
                d="M 50 175 Q 150 150 250 145 T 450 115 T 600 90 T 670 95 L 670 180 L 50 180 Z"
                fill="url(#amberGrad)"
              />
              <path
                d="M 50 175 Q 150 150 250 145 T 450 115 T 600 90 T 670 95"
                fill="none"
                stroke="#f39c12"
                strokeWidth="2.5"
              />

              {/* Data point dots */}
              <circle cx="50" cy="160" r="3.5" fill="#1b6b63" />
              <circle cx="250" cy="120" r="3.5" fill="#1b6b63" />
              <circle cx="450" cy="80" r="3.5" fill="#1b6b63" />
              <circle cx="600" cy="45" r="3.5" fill="#1b6b63" />
              <circle cx="670" cy="55" r="3.5" fill="#1b6b63" />

              <circle cx="50" cy="175" r="3.5" fill="#f39c12" />
              <circle cx="250" cy="145" r="3.5" fill="#f39c12" />
              <circle cx="450" cy="115" r="3.5" fill="#f39c12" />
              <circle cx="600" cy="90" r="3.5" fill="#f39c12" />
              <circle cx="670" cy="95" r="3.5" fill="#f39c12" />

              {/* X Axis Labels */}
              <text x="50" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Mar 1</text>
              <text x="150" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Mar 5</text>
              <text x="250" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Mar 9</text>
              <text x="350" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Mar 13</text>
              <text x="450" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Mar 17</text>
              <text x="550" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Mar 21</text>
              <text x="650" y="195" fontSize="10" fill="#94a3b8" textAnchor="middle">Mar 29</text>
            </svg>
          </div>
        </div>

        {/* Right: Product Data Quality Card (1 Col Donut Chart) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Product Data Quality</h3>

          <div className="flex items-center justify-center my-3 relative">
            {/* Donut SVG */}
            <svg width="150" height="150" viewBox="0 0 100 100" className="-rotate-90">
              {/* Background track */}
              <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="12" fill="none" />
              {/* Complete (72.3%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                stroke="#1b6b63"
                strokeWidth="12"
                strokeDasharray="172 238"
                strokeDashoffset="0"
                fill="none"
              />
              {/* Partial (18.1%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                stroke="#f39c12"
                strokeWidth="12"
                strokeDasharray="43 238"
                strokeDashoffset="-172"
                fill="none"
              />
              {/* Missing (6.8%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                stroke="#fbd38d"
                strokeWidth="12"
                strokeDasharray="16 238"
                strokeDashoffset="-215"
                fill="none"
              />
              {/* Review (2.8%) */}
              <circle
                cx="50"
                cy="50"
                r="38"
                stroke="#cbd5e1"
                strokeWidth="12"
                strokeDasharray="7 238"
                strokeDashoffset="-231"
                fill="none"
              />
            </svg>

            {/* Centered Total */}
            <div className="absolute text-center">
              <div className="text-lg font-black text-slate-900 leading-tight">12,846</div>
              <div className="text-[10px] text-slate-500 font-medium">Products</div>
            </div>
          </div>

          {/* Legend Table */}
          <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1b6b63]" />
                <span className="text-slate-600 font-medium">Complete</span>
              </div>
              <span className="font-bold text-slate-800">72.3% (9,286)</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#f39c12]" />
                <span className="text-slate-600 font-medium">Partial</span>
              </div>
              <span className="font-bold text-slate-800">18.1% (2,325)</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#fbd38d]" />
                <span className="text-slate-600 font-medium">Missing Data</span>
              </div>
              <span className="font-bold text-slate-800">6.8% (874)</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#cbd5e1]" />
                <span className="text-slate-600 font-medium">Needs Review</span>
              </div>
              <span className="font-bold text-slate-800">2.8% (361)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: 3 Columns (Recent Product Activity, Active Jobs, Connected Stores) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Recent Product Activity */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Recent Product Activity</h3>
              <Link href="/products" className="text-xs font-semibold text-amber-600 hover:underline">
                View All →
              </Link>
            </div>

            <div className="space-y-3.5">
              {/* Product 1 */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                    🏎️
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Traxxas Slash 4X4 VXL</div>
                    <div className="text-[10px] text-slate-400 font-mono">EAN: 0020334680864</div>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Updated
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">12 min ago</span>
                </div>
              </div>

              {/* Product 2 */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                    🚙
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Xray X4 2024 Touring Car Kit</div>
                    <div className="text-[10px] text-slate-400 font-mono">EAN: 8581703000342</div>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                    AI Enriched
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">28 min ago</span>
                </div>
              </div>

              {/* Product 3 */}
              <div className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 transition">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg shrink-0">
                    🧴
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate">Bittydesign HYPER-HR 190mm</div>
                    <div className="text-[10px] text-slate-400 font-mono">EAN: 0714833215509</div>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    New
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1">45 min ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Active Jobs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Active Jobs</h3>
              <Link href="/jobs" className="text-xs font-semibold text-amber-600 hover:underline">
                View All →
              </Link>
            </div>

            <div className="space-y-4">
              {/* Job 1 */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500">🕷️</span>
                    <span className="font-semibold text-slate-800">Scraping: traxxas.com</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">68%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#1b6b63] h-full rounded-full" style={{ width: '68%' }} />
                </div>
              </div>

              {/* Job 2 */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500">🤖</span>
                    <span className="font-semibold text-slate-800">AI Enrichment: 120 products</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">42%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#f39c12] h-full rounded-full" style={{ width: '42%' }} />
                </div>
              </div>

              {/* Job 3 */}
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500">🔗</span>
                    <span className="font-semibold text-slate-800">Sync: OpenCart Store</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">87%</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#1b6b63] h-full rounded-full" style={{ width: '87%' }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Connected Stores */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Connected Stores</h3>
              <Link href="/stores" className="text-xs font-semibold text-amber-600 hover:underline">
                Manage →
              </Link>
            </div>

            <div className="space-y-3">
              {/* Store 1: OpenCart */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                    🛒
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">My RC Shop (OpenCart)</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Connected</span>
                </span>
              </div>

              {/* Store 2: Shopify */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    🛍️
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">RC World (Shopify)</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Connected</span>
                </span>
              </div>

              {/* Store 3: WooCommerce */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                    🏪
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">WooCommerce Store</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Connected</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
