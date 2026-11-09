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
  Lock,
  Languages
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const PRESET_LANGUAGES = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'nl', name: 'Dutch', native: 'Nederlands' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
];

export default function WorkspaceSettingsPage() {
  const [orgName, setOrgName] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('UTC');
  const [notifyOnSyncFailure, setNotifyOnSyncFailure] = useState(true);
  const [notifyOnReviewItem, setNotifyOnReviewItem] = useState(true);
  const [saved, setSaved] = useState(false);
  const [planTier, setPlanTier] = useState('pro');

  // Multi-Language Store Configuration
  const [primaryLanguage, setPrimaryLanguage] = useState('en');
  const [supportedLanguages, setSupportedLanguages] = useState<string[]>(['en']);
  const [customLangInput, setCustomLangInput] = useState('');
  const [availableLanguages, setAvailableLanguages] = useState(PRESET_LANGUAGES);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedOrg = localStorage.getItem('saas_current_org_name');
      if (storedOrg) setOrgName(storedOrg);
    }

    // Load store languages
    apiClient.getStoreLanguages().then((res) => {
      if (res) {
        if (res.primary) setPrimaryLanguage(res.primary);
        const supp = Array.isArray(res.supported) && res.supported.length > 0 ? res.supported : ['en'];
        setSupportedLanguages(supp);

        const newPresets = [...PRESET_LANGUAGES];
        supp.forEach((code) => {
          if (!newPresets.some((p) => p.code === code)) {
            newPresets.push({
              code,
              name: code.toUpperCase(),
              native: code.toUpperCase(),
            });
          }
        });
        setAvailableLanguages(newPresets);
      }
    }).catch((err) => console.warn('Could not load store languages:', err));
  }, []);

  const toggleLanguage = (code: string) => {
    if (code === primaryLanguage) return;
    if (supportedLanguages.includes(code)) {
      setSupportedLanguages(supportedLanguages.filter((l) => l !== code));
    } else {
      setSupportedLanguages([...supportedLanguages, code]);
    }
  };

  const handleAddCustomLang = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = customLangInput.trim().toLowerCase();
    if (!clean) return;

    if (!supportedLanguages.includes(clean)) {
      setSupportedLanguages([...supportedLanguages, clean]);
    }
    if (!availableLanguages.some((l) => l.code === clean)) {
      setAvailableLanguages([
        ...availableLanguages,
        { code: clean, name: clean.toUpperCase(), native: clean.toUpperCase() },
      ]);
    }
    setCustomLangInput('');
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('saas_current_org_name', orgName);
      }
      // Save languages to backend API
      await apiClient.updateStoreLanguages({
        primary: primaryLanguage,
        supported: supportedLanguages,
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans text-slate-800">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Workspace Settings</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure organization branding, default catalog currency, store languages, timezones, and automated notification alerts.
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

        {/* Store Languages Configuration */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-700" />
              <h3 className="text-sm font-bold text-slate-900">Store &amp; Catalog Languages</h3>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {supportedLanguages.length} Active Language{supportedLanguages.length > 1 ? 's' : ''}
            </span>
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Configure the languages your store uses (e.g. English, Hindi, Arabic, Dutch, etc.). The AI pipeline and scraping engine will enrich, structure, and translate catalog titles, descriptions, and SEO metadata into all selected languages.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
            {/* Primary Language */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Primary Store Language
              </label>
              <select
                value={primaryLanguage}
                onChange={(e) => {
                  const val = e.target.value;
                  setPrimaryLanguage(val);
                  if (!supportedLanguages.includes(val)) {
                    setSupportedLanguages([val, ...supportedLanguages]);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-medium focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
              >
                {availableLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} ({lang.native}) [{lang.code.toUpperCase()}]
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400">
                Primary catalog reference used for default syncing and normalization.
              </p>
            </div>

            {/* Multi-Select Supported Languages Grid */}
            <div className="md:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Supported Languages (Multi-Select)
                </label>
                <span className="text-[11px] text-slate-400">Click to toggle languages on/off</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {availableLanguages.map((lang) => {
                  const isSelected = supportedLanguages.includes(lang.code);
                  const isPrimary = lang.code === primaryLanguage;
                  return (
                    <button
                      type="button"
                      key={lang.code}
                      onClick={() => toggleLanguage(lang.code)}
                      className={`flex items-center justify-between p-2 rounded-xl border text-left text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-400 text-emerald-950 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="truncate pr-1">
                        <span className="block truncate font-bold">{lang.name}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {lang.native} {isPrimary ? '• Primary' : ''}
                        </span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Add Custom Language */}
              <div className="mt-3 flex items-center gap-1.5">
                <input
                  type="text"
                  value={customLangInput}
                  onChange={(e) => setCustomLangInput(e.target.value)}
                  onKeyDown={handleAddCustomLang}
                  placeholder="Add custom language code (e.g. sv, pl, tr, el, ja)..."
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddCustomLang}
                  className="px-3.5 py-1.5 bg-[#0d2a2c] text-[#fad982] rounded-lg text-xs font-bold hover:bg-[#143d40] transition shrink-0"
                >
                  Add Language
                </button>
              </div>
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

