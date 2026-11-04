'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Globe,
  Bell,
  Save,
  Check,
  Shield,
  Sliders,
  CreditCard,
  Zap,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function WorkspaceSettingsPage() {
  const [orgName, setOrgName] = useState('Acme Corp');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [notifyOnSyncFailure, setNotifyOnSyncFailure] = useState(true);
  const [notifyOnReviewItem, setNotifyOnReviewItem] = useState(true);
  const [saved, setSaved] = useState(false);
  const [planTier, setPlanTier] = useState('pro');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedOrg = localStorage.getItem('saas_current_org_name');
      if (storedOrg) setOrgName(storedOrg);
    }
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem('saas_current_org_name', orgName);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans text-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Workspace Settings</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure organization branding, default catalog currency, timezones, and automated notification alerts.
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-sm">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>Settings Saved</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* General Details */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#0d2a2c]" />
            <span>Organization Profile</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Workspace Name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Base Catalog Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
              >
                <option value="USD">USD ($) United States Dollar</option>
                <option value="EUR">EUR (€) Euro</option>
                <option value="GBP">GBP (£) British Pound</option>
                <option value="INR">INR (₹) Indian Rupee</option>
              </select>
            </div>
          </div>
        </div>

        {/* SaaS Subscription & Usage Quota Management */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Subscription Plan &amp; Usage Quotas</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Current billing tier, live monthly extraction quotas, and AI token allowances.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-[#0d2a2c] text-[#fad982] self-start sm:self-auto">
              {planTier} Tier
            </span>
          </div>

          {/* Usage Meter Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Monthly Product Scrapes</span>
                <span className="font-mono font-bold text-slate-900">42 / 2,500</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="bg-[#0d2a2c] h-2 rounded-full" style={{ width: '1.7%' }}></div>
              </div>
              <p className="text-[10px] text-slate-500">Resets on the 1st of every month</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">AI Prompt Enrichments</span>
                <span className="font-mono font-bold text-slate-900">18 / 1,000</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="bg-amber-500 h-2 rounded-full" style={{ width: '1.8%' }}></div>
              </div>
              <p className="text-[10px] text-slate-500">Gemini 1.5 Pro &amp; Claude 3.5 Sonnet</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-700">Connected E-Com Stores</span>
                <span className="font-mono font-bold text-slate-900">1 / 5 Stores</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                <div className="bg-emerald-600 h-2 rounded-full" style={{ width: '20%' }}></div>
              </div>
              <p className="text-[10px] text-slate-500">Shopify &amp; WooCommerce</p>
            </div>
          </div>

          {/* Pricing Tier Selector */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-slate-700 mb-2">Change Workspace Plan</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'starter', name: 'Starter', price: '$49/mo', desc: '500 products/mo, 1 store, standard scraping' },
                { id: 'pro', name: 'Professional', price: '$149/mo', desc: '2,500 products/mo, 5 stores, AI prompt engine, Shopify push' },
                { id: 'enterprise', name: 'Enterprise', price: '$499/mo', desc: 'Unlimited products, BYOK AI keys, headless proxies & dedicated support' },
              ].map((tier) => (
                <div
                  key={tier.id}
                  onClick={() => setPlanTier(tier.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition ${
                    planTier === tier.id
                      ? 'border-[#0d2a2c] bg-[#0d2a2c]/5 ring-1 ring-[#0d2a2c]'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-900">{tier.name}</span>
                    <span className="text-xs font-black text-[#0d2a2c]">{tier.price}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-1">{tier.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Operational Alerts &amp; Notifications</span>
          </h3>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnSyncFailure}
                onChange={(e) => setNotifyOnSyncFailure(e.target.checked)}
                className="w-4 h-4 rounded text-[#0d2a2c] accent-[#0d2a2c]"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Store Sync Failures</span>
                <span className="text-[11px] text-slate-500">Email team administrator if OpenCart or Shopify push encounters errors.</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={notifyOnReviewItem}
                onChange={(e) => setNotifyOnReviewItem(e.target.checked)}
                className="w-4 h-4 rounded text-[#0d2a2c] accent-[#0d2a2c]"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Ambiguous Match Alerts</span>
                <span className="text-[11px] text-slate-500">Notify when products require human review due to low entity confidence.</span>
              </div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 text-xs font-bold transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>Save Workspace Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
}

