'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Sparkles, Sliders, Check, Key, Save, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ClientAiSettingsPage() {
  const [selectedModel, setSelectedModel] = useState('gemini-1.5-pro');
  const [temperature, setTemperature] = useState(0.3);
  const [globalRules, setGlobalRules] = useState(
    'Ensure all product titles follow standardized e-commerce taxonomy. Emphasize manufacturing durability, verified specifications, and OEM part compatibility.'
  );
  const [titlePrompt, setTitlePrompt] = useState(
    'Format: [Brand] + [Model Name] + [Scale/Category] + [Key Specification/Color]. Maintain strict manufacturer part numbers.'
  );
  const [descriptionPrompt, setDescriptionPrompt] = useState(
    'Act as an expert technical e-commerce copywriter. Using the provided manufacturer specifications and features, craft a compelling, SEO-optimized product title and 3-paragraph product description highlighting durability, scale specifications, and compatibility.'
  );
  const [customApiKey, setCustomApiKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch tenant AI configuration from API on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setErrorMsg('');
        const res = await apiClient.getAiSettings();
        if (res?.data) {
          const cfg = res.data;
          if (cfg.model) setSelectedModel(cfg.model);
          if (cfg.temperature !== undefined) setTemperature(Number(cfg.temperature));
          if (cfg.globalRules) setGlobalRules(cfg.globalRules);
          if (cfg.titlePrompt) setTitlePrompt(cfg.titlePrompt);
          if (cfg.descriptionPrompt) setDescriptionPrompt(cfg.descriptionPrompt);
          if (cfg.apiKey) setCustomApiKey(cfg.apiKey);
        }
      } catch (err: any) {
        console.warn('Could not load AI settings from API, using defaults:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg('');

      await apiClient.saveAiSettings({
        model: selectedModel,
        provider: selectedModel.startsWith('gemini') ? 'Google AI' : selectedModel.startsWith('claude') ? 'Anthropic' : 'OpenAI',
        temperature,
        apiKey: customApiKey,
        globalRules,
        titlePrompt,
        descriptionPrompt,
      });

      // Also sync to localStorage for client-side offline cache
      if (typeof window !== 'undefined') {
        localStorage.setItem('saas_client_ai_model', selectedModel);
        localStorage.setItem('saas_client_ai_temp', String(temperature));
        localStorage.setItem('saas_client_ai_global_rules', globalRules);
        localStorage.setItem('saas_client_ai_desc_prompt', descriptionPrompt);
        localStorage.setItem('saas_client_ai_title_prompt', titlePrompt);
        if (customApiKey) localStorage.setItem('saas_client_ai_byok', customApiKey);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save AI configuration');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200">
        <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold text-slate-500">Loading workspace AI configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto font-sans text-slate-800 pb-16">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#0d2a2c]/10 text-[#0d2a2c] uppercase tracking-wider">
              Tenant AI Configuration
            </span>
            <span className="text-xs text-slate-400 font-mono">Workspace Scope</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">AI Models & Prompt Rules</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure the default LLM engine, global prompt hierarchy, and API keys used across all catalog extractions.
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-sm animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>AI Configuration Saved</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Model Selection Card */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#0d2a2c]" />
              <span>Active Inference Engine</span>
            </h3>
            <span className="text-xs text-slate-500 font-medium">Select primary model for product enrichment</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google AI', desc: 'Highest reasoning, complex spec sheets & technical translation.' },
              { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google AI', desc: 'Sub-second latency, optimal for high-volume catalog crawling.' },
              { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', desc: 'Superior nuanced copy and structured JSON attribute parsing.' },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={`p-4 rounded-xl border cursor-pointer transition ${
                  selectedModel === m.id
                    ? 'border-[#0d2a2c] bg-[#0d2a2c]/5 ring-1 ring-[#0d2a2c]'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">{m.name}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{m.provider}</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-2">{m.desc}</p>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-700 font-bold">Model Temperature: {temperature}</span>
              <span className="text-slate-500 font-mono">{temperature < 0.4 ? 'Deterministic & Exact' : 'Creative Copy'}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#0d2a2c] h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
          </div>
        </div>

        {/* Global Prompt Rules & Templates */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Workspace Global AI Rules</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These rules apply universally to all products across every brand profile before brand-specific rules are executed.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Global Workspace Rules (Universal Catalog Directives)
              </label>
              <textarea
                rows={3}
                value={globalRules}
                onChange={(e) => setGlobalRules(e.target.value)}
                placeholder="e.g. Ensure all product titles follow standardized e-commerce taxonomy. Never fabricate unlisted specs..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Product Title Normalization Template
              </label>
              <textarea
                rows={2}
                value={titlePrompt}
                onChange={(e) => setTitlePrompt(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                SEO & Product Description Generation Template
              </label>
              <textarea
                rows={4}
                value={descriptionPrompt}
                onChange={(e) => setDescriptionPrompt(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* BYOK Section */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Key className="w-4 h-4 text-emerald-600" />
            <span>Bring Your Own API Key (Optional)</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Leave blank to utilize our managed SaaS LLM token pools, or supply your own OpenAI/Gemini/Anthropic API key for direct billing and zero rate limits.
          </p>

          <input
            type="password"
            placeholder="AIzaSy... or sk-ant-... or sk-proj-..."
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            className="w-full max-w-md p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving Settings...' : 'Save AI Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
