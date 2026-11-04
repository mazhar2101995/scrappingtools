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
  Sliders
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function WorkspaceSettingsPage() {
  const [orgName, setOrgName] = useState('Acme Corp');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [notifyOnSyncFailure, setNotifyOnSyncFailure] = useState(true);
  const [notifyOnReviewItem, setNotifyOnReviewItem] = useState(true);
  const [saved, setSaved] = useState(false);

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

