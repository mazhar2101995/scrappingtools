'use client';

import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Building2,
  Users,
  CheckCircle2,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ShieldAlert,
  Download
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminRevenueBillingPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRevenue() {
    try {
      setLoading(true);
      const res = await apiClient.getAdminRevenue();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRevenue();
  }, []);

  const mrr = data?.mrr || 0;
  const arr = data?.arr || 0;
  const arpu = data?.arpu || 0;
  const totalTenants = data?.totalTenants || 0;
  const plans = data?.plans || {};
  const tiers = data?.tierDistribution || [];

  return (
    <div className="space-y-6 w-full font-sans">
      {/* Header */}
      <div className="p-7 rounded-3xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              FINANCIAL TELEMETRY
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges Active</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            SaaS Revenue, MRR & Subscription Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time monthly recurring revenue, annual projections, tenant plan tier breakdown, and billing automation.
          </p>
        </div>

        <button
          onClick={loadRevenue}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Accounting</span>
        </button>
      </div>

      {/* 4 Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
            <span className="text-[10px] uppercase font-bold tracking-wider">Monthly Recurring (MRR)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            ${mrr.toLocaleString()}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Normalized active billing</span>
            <span className="text-emerald-600 font-bold font-mono">+18% MoM</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
            <span className="text-[10px] uppercase font-bold tracking-wider">Annual Run Rate (ARR)</span>
            <div className="w-8 h-8 rounded-xl bg-[#faf4e1] border border-[#ecdba8] flex items-center justify-center text-[#9c7f23]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#876b17] font-mono">
            ${arr.toLocaleString()}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Projected annualized run rate</span>
            <span className="text-slate-900 font-bold font-mono">12x MRR</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
            <span className="text-[10px] uppercase font-bold tracking-wider">Avg. Revenue / Account</span>
            <div className="w-8 h-8 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            ${arpu}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Blended customer ARPU</span>
            <span className="text-sky-600 font-bold">Standard/Pro</span>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-white border border-[#ebdcb9] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2 font-medium">
            <span className="text-[10px] uppercase font-bold tracking-wider">Active Paying Tenants</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono">
            {totalTenants}
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
            <span>Across e-commerce niches</span>
            <span className="text-emerald-600 font-bold font-mono">0% Churn</span>
          </div>
        </div>
      </div>

      {/* Plan Tiers & Features Management Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#8a6e19]" />
          <span>Configured Subscription Plan Tiers</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {Object.values(plans).map((p: any) => (
            <div
              key={p.id}
              className="p-6 rounded-3xl bg-white border border-[#ebdcb9] space-y-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-black text-base text-slate-900">{p.name}</h4>
                  <span className="text-[10px] text-slate-400 uppercase font-mono font-bold">ID: {p.id}</span>
                </div>
                <span className="text-xl font-black text-[#876b17] font-mono">
                  ${p.priceMonthly}<span className="text-xs text-slate-400 font-normal">/mo</span>
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-[#fdfbf7] border border-[#ebdcb9] text-xs font-mono space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Products Cap:</span>
                  <span className="font-bold text-slate-900">{p.productLimit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Store Endpoints:</span>
                  <span className="font-bold text-slate-900">{p.storeLimit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">AI Token Quota:</span>
                  <span className="font-bold text-purple-700">{p.aiTokenLimit.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                {(p.features || []).map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

