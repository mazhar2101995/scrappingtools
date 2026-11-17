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
  AlertCircle,
  Check,
  X,
  AlertTriangle,
  Sliders,
  RefreshCw,
  ExternalLink
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
  const availablePlans: any[] = data?.availablePlans || [];
  const services: any[] = data?.services || [];
  const invoices: any[] = data?.invoices || [];

  return (
    <div className="space-y-8 w-full font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#dbdade] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#0d2a2c] text-[#fad982] uppercase tracking-wider">
              SUBSCRIPTION & DYNAMIC QUOTAS
            </span>
            <span className="text-xs text-slate-500 font-mono">Current Plan: {currentPlan?.name}</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Subscription, Service Limits & Usage
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Real-time, database-governed quotas for product discovery, AI enrichment, image processing, and store exports.
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

      {/* Dynamic Services & Quotas Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#7a5e12]" />
            <span>Platform Services & Usage Entitlements</span>
          </h2>
          <span className="text-xs text-slate-500 font-mono">Active Plan: {currentPlan?.name}</span>
        </div>

        <div className="bg-white rounded-xl border border-[#dbdade] shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-[#dbdade] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Service</th>
                <th className="py-3 px-4">Entitlement Status</th>
                <th className="py-3 px-4">Usage / Quota</th>
                <th className="py-3 px-4">Remaining</th>
                <th className="py-3 px-4">Reset Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {services.map((svc) => {
                const isExceeded = svc.status === 'quota_exceeded';
                const isBlockedGlobally = svc.status === 'globally_disabled';
                const isNotInPlan = svc.status === 'not_included_in_plan';
                const isUnlimited = svc.isUnlimited;

                const percent = isUnlimited ? 0 : Math.min(100, Math.round(((svc.currentUsage || 0) / (svc.usageLimit || 1)) * 100));

                return (
                  <tr key={svc.code} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{svc.name}</div>
                      <div className="text-[11px] text-slate-400">{svc.description}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {isBlockedGlobally ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                          <AlertTriangle className="w-3 h-3 text-slate-400" />
                          Temporarily Unavailable
                        </span>
                      ) : isNotInPlan ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Upgrade Required
                        </span>
                      ) : isExceeded ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                          Limit Reached
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 min-w-[180px]">
                      <div className="flex justify-between text-[11px] font-mono font-bold text-slate-800 mb-1">
                        <span>{svc.currentUsage?.toLocaleString() || 0} {svc.unit}</span>
                        <span>{isUnlimited ? 'Unlimited' : svc.usageLimit?.toLocaleString()}</span>
                      </div>
                      {!isUnlimited && (
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-[#0d2a2c]'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold">
                      {isUnlimited ? (
                        <span className="text-emerald-600">Unlimited</span>
                      ) : (
                        <span className={svc.remaining === 0 ? 'text-rose-600' : 'text-slate-700'}>
                          {svc.remaining?.toLocaleString()} {svc.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 capitalize font-medium">
                      {svc.resetPeriod === 'never' ? 'Never (Lifetime)' : `Renews ${svc.resetPeriod}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Available Dynamic Subscription Plans */}
      <div className="space-y-4 pt-4">
        <div>
          <h2 className="text-base font-black text-slate-900">Available Subscription Tiers</h2>
          <p className="text-xs text-slate-500">
            Switch plans anytime. Upgrades take effect immediately; downgrades preserve your catalog assets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {availablePlans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            const price = billingCycle === 'annual' ? plan.priceAnnual : plan.priceMonthly;

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-2xl bg-white border transition shadow-xs flex flex-col justify-between ${
                  isCurrent
                    ? 'border-2 border-[#0d2a2c] ring-4 ring-[#fad982]/20'
                    : 'border-[#dbdade] hover:border-slate-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                      {plan.planType}
                    </span>
                    {isCurrent && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#0d2a2c] text-[#fad982] uppercase tracking-wider">
                        Current
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{plan.description}</p>

                  <div className="my-5 pt-4 border-t border-slate-100">
                    <div className="text-3xl font-black text-slate-900 font-mono">
                      ${parseFloat(price).toLocaleString()}
                      <span className="text-xs text-slate-400 font-sans font-normal">
                        {' '}/ {billingCycle === 'annual' ? 'year' : 'month'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-slate-600 mb-6">
                    {Array.isArray(plan.features) &&
                      plan.features.map((feat: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <button
                  disabled={isCurrent || updatingPlan === plan.id}
                  onClick={() => handleSelectPlan(plan.id)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                    isCurrent
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'bg-[#0d2a2c] text-[#fad982] hover:bg-[#153f42] shadow-xs'
                  }`}
                >
                  {updatingPlan === plan.id ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isCurrent ? (
                    'Current Plan'
                  ) : (
                    <>
                      <span>Select {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Invoices History Table */}
      <div className="space-y-3 pt-6 border-t border-[#dbdade]">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-slate-600" />
          <span>Billing History & Invoices</span>
        </h2>

        <div className="bg-white rounded-xl border border-[#dbdade] shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-[#dbdade] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No billing invoices generated yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4 text-slate-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">${inv.amountPaidUsd} USD</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {inv.hostedInvoiceUrl ? (
                        <a
                          href={inv.hostedInvoiceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-amber-700 hover:underline flex items-center justify-end gap-1"
                        >
                          <span>View PDF</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-400">Paid Direct</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
