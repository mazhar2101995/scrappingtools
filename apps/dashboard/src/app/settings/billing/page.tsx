'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Zap,
  Shield,
  Layers,
  Cpu,
  ShoppingBag,
  Sparkles,
  ArrowRight,
  Clock,
  Download,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ClientBillingPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [updatingPlan, setUpdatingPlan] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadBilling() {
    try {
      setLoading(true);
      const res = await apiClient.getMySubscription();
      setData(res);
      if (res?.subscription?.billingCycle) {
        setBillingCycle(res.subscription.billingCycle);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBilling();
  }, []);

  async function handleSelectPlan(planId: string) {
    try {
      setUpdatingPlan(planId);
      setMessage(null);
      await apiClient.changePlan(planId, billingCycle);
      setMessage(`Plan successfully upgraded to ${planId.toUpperCase()}!`);
      await loadBilling();
    } catch (e: any) {
      alert(`Failed to update plan: ${e.message}`);
    } finally {
      setUpdatingPlan(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl mx-auto animate-pulse font-sans">
        <div className="h-32 bg-white rounded-xl border border-[#dbdade]"></div>
        <div className="grid grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-96 bg-white rounded-xl border border-[#dbdade]"></div>
          ))}
        </div>
      </div>
    );
  }

  const currentPlan = data?.plan;
  const plans = data?.plans || {};
  const usage = data?.usage;

  return (
    <div className="space-y-8 w-full font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#dbdade] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0d2a2c] text-[#fad982] uppercase tracking-wider">
              SUBSCRIPTION & LIMITS
            </span>
            <span className="text-xs text-slate-500 font-mono">Current Tier: {currentPlan?.name}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Subscription, Usage Quotas & Billing
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage your merchant catalog limits, active connected stores, and AI enrichment token quotas.
          </p>
        </div>

        {/* Monthly / Annual Billing Toggle */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-[#dbdade]">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              billingCycle === 'monthly'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('annual')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              billingCycle === 'annual'
                ? 'bg-[#fad982] text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>Annual</span>
            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full">Save 20%</span>
          </button>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Real-time Usage Progress Card */}
      <div className="p-6 rounded-xl bg-white border border-[#dbdade] shadow-xs space-y-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>Current Billing Cycle Usage ({usage?.currentPeriod})</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Products Usage */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 font-bold">Catalog Products</span>
              <span className="text-slate-900 font-mono font-bold">
                {usage?.products?.used || 0} / {usage?.products?.limit?.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-[#0d2a2c] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, usage?.products?.percentage || 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">Scraped & normalized active SKUs</p>
          </div>

          {/* Connected Stores */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 font-bold">Connected Stores</span>
              <span className="text-slate-900 font-mono font-bold">
                {usage?.stores?.used || 0} / {usage?.stores?.limit}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(10, usage?.stores?.percentage || 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">Active OpenCart / Shopify bridge endpoints</p>
          </div>

          {/* AI Tokens */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600 font-bold">AI Processing Tokens</span>
              <span className="text-slate-900 font-mono font-bold">
                {usage?.aiTokens?.used || 0} / {usage?.aiTokens?.limit?.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, usage?.aiTokens?.percentage || 0)}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-400">LLM title, spec table & enrichment tokens</p>
          </div>
        </div>
      </div>

      {/* Subscription Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.values(plans).map((plan: any) => {
          const isCurrent = currentPlan?.id === plan.id;
          const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;

          return (
            <div
              key={plan.id}
              className={`p-7 rounded-xl bg-white border transition relative flex flex-col justify-between ${
                isCurrent
                  ? 'border-[#0d2a2c] ring-2 ring-[#0d2a2c]/20 shadow-lg'
                  : plan.popular
                  ? 'border-amber-300 shadow-md ring-1 ring-amber-300'
                  : 'border-[#dbdade] hover:border-slate-300 shadow-xs'
              }`}
            >
              {plan.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982] text-slate-950 uppercase tracking-wider border border-amber-300 shadow-xs">
                  Most Popular
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0d2a2c] text-white uppercase tracking-wider shadow-xs">
                  Your Current Plan
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900 font-mono">${price}</span>
                    <span className="text-xs text-slate-400 font-medium">
                      /{billingCycle === 'annual' ? 'year' : 'month'}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  {(plan.features || []).map((f: string, i: number) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100">
                <button
                  disabled={isCurrent || updatingPlan === plan.id}
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : plan.popular
                      ? 'bg-[#fad982] hover:bg-[#f3cc65] text-slate-950 shadow-md shadow-[#fad982]/30 border border-amber-300'
                      : 'bg-[#0d2a2c] hover:bg-[#143d40] text-white shadow-sm'
                  }`}
                >
                  {isCurrent ? (
                    <span>Active Plan</span>
                  ) : updatingPlan === plan.id ? (
                    <span>Switching...</span>
                  ) : (
                    <>
                      <span>Upgrade to {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

