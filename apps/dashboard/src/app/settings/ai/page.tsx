'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Sparkles, Sliders, Check, Key, Save, AlertCircle, FileText, CheckCircle2, Globe, Languages, Download, Database } from 'lucide-react';
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

  // Step 6: In-House AI Self-Training Dataset States
  const [trainingStats, setTrainingStats] = useState<any | null>(null);
  const [recentExamples, setRecentExamples] = useState<any[]>([]);

  // Multi-Language Workspace Custom Prompts
  const [storeLanguages, setStoreLanguages] = useState<{ primary: string; supported: string[] }>({
    primary: 'en',
    supported: ['en'],
  });
  const [activePromptLang, setActivePromptLang] = useState('en');
  const [languagePrompts, setLanguagePrompts] = useState<Record<string, { rules?: string; titlePrompt?: string; descriptionPrompt?: string }>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch tenant AI configuration and languages from API on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true);
        setErrorMsg('');
        const [res, langsRes, statsRes, datasetRes] = await Promise.allSettled([
          apiClient.getAiSettings(),
          apiClient.getStoreLanguages(),
          apiClient.getAiTrainingStats(),
          apiClient.getAiTrainingDataset({ limit: 5 }),
        ]);

        if (statsRes.status === 'fulfilled') {
          setTrainingStats(statsRes.value?.stats || null);
        }
        if (datasetRes.status === 'fulfilled') {
          setRecentExamples(datasetRes.value?.dataset || []);
        }

        if (langsRes.status === 'fulfilled' && langsRes.value?.supported) {
          setStoreLanguages(langsRes.value);
          setActivePromptLang(langsRes.value.primary || 'en');
        }

        if (res.status === 'fulfilled' && res.value?.data) {
          const cfg = res.value.data;
          if (cfg.model) setSelectedModel(cfg.model);
          if (cfg.temperature !== undefined) setTemperature(Number(cfg.temperature));
          if (cfg.globalRules) setGlobalRules(cfg.globalRules);
          if (cfg.titlePrompt) setTitlePrompt(cfg.titlePrompt);
          if (cfg.descriptionPrompt) setDescriptionPrompt(cfg.descriptionPrompt);
          if (cfg.apiKey) setCustomApiKey(cfg.apiKey);
          if (cfg.languagePrompts) setLanguagePrompts(cfg.languagePrompts);
        }
      } catch (err: any) {
        console.warn('Could not load AI settings from API, using defaults:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleUpdateLangPrompt = (langCode: string, field: 'rules' | 'titlePrompt' | 'descriptionPrompt', value: string) => {
    if (langCode === 'en') {
      if (field === 'rules') setGlobalRules(value);
      if (field === 'titlePrompt') setTitlePrompt(value);
      if (field === 'descriptionPrompt') setDescriptionPrompt(value);
    } else {
      setLanguagePrompts((prev) => ({
        ...prev,
        [langCode]: {
          ...(prev[langCode] || {}),
          [field]: value,
        },
      }));
    }
  };

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
        languagePrompts,
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
    <div className="space-y-6 w-full font-sans text-slate-800 pb-16">
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

        {/* Global Prompt Rules & Templates with Multi-Language Tabs */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Workspace Global AI Rules &amp; Multi-Language Prompts</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure universal catalog directives and language-specific prompt overrides for every supported store language.
              </p>
            </div>

            {/* Language Switcher Tabs */}
            {storeLanguages.supported && storeLanguages.supported.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-slate-100 rounded-xl">
                {storeLanguages.supported.map((code) => {
                  const isActive = activePromptLang === code;
                  const isPrimary = code === storeLanguages.primary;
                  return (
                    <button
                      type="button"
                      key={code}
                      onClick={() => setActivePromptLang(code)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#0d2a2c] text-[#fad982] shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <span className="uppercase">{code}</span>
                      {isPrimary && (
                        <span className={`text-[10px] font-normal px-1 rounded ${isActive ? 'bg-teal-900 text-amber-200' : 'bg-slate-200 text-slate-600'}`}>
                          Main
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Language Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-emerald-700" />
              <span className="text-xs font-bold text-slate-800">
                Editing Prompt Template for: <span className="uppercase font-mono text-emerald-800">[{activePromptLang}]</span>
              </span>
            </div>
            {activePromptLang !== 'en' && (
              <span className="text-[11px] text-slate-500 italic">
                Empty fields will automatically inherit the primary English rules.
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {activePromptLang === 'en' ? 'Global Workspace Rules (Universal Catalog Directives)' : `Language Directives & Tone Guidelines [${activePromptLang.toUpperCase()}]`}
              </label>
              <textarea
                rows={3}
                value={activePromptLang === 'en' ? globalRules : (languagePrompts[activePromptLang]?.rules || '')}
                onChange={(e) => handleUpdateLangPrompt(activePromptLang, 'rules', e.target.value)}
                placeholder={activePromptLang === 'en' ? "e.g. Ensure all product titles follow standardized e-commerce taxonomy. Never fabricate unlisted specs..." : `e.g. Custom instructions for ${activePromptLang.toUpperCase()} catalog generation...`}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Product Title Normalization Template [{activePromptLang.toUpperCase()}]
              </label>
              <textarea
                rows={2}
                value={activePromptLang === 'en' ? titlePrompt : (languagePrompts[activePromptLang]?.titlePrompt || '')}
                onChange={(e) => handleUpdateLangPrompt(activePromptLang, 'titlePrompt', e.target.value)}
                placeholder={activePromptLang === 'en' ? "Format: [Brand] + [Model Name] + [Scale/Category] + [Key Specification/Color]. Maintain strict manufacturer part numbers." : `Language specific title prompt formula for ${activePromptLang.toUpperCase()}...`}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                SEO &amp; Product Description Generation Template [{activePromptLang.toUpperCase()}]
              </label>
              <textarea
                rows={4}
                value={activePromptLang === 'en' ? descriptionPrompt : (languagePrompts[activePromptLang]?.descriptionPrompt || '')}
                onChange={(e) => handleUpdateLangPrompt(activePromptLang, 'descriptionPrompt', e.target.value)}
                placeholder={activePromptLang === 'en' ? "Act as an expert technical e-commerce copywriter. Using the provided manufacturer specifications and features, craft a compelling, SEO-optimized product title and 3-paragraph product description highlighting durability, scale specifications, and compatibility." : `Language specific description and SEO prompt for ${activePromptLang.toUpperCase()}...`}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
              />
            </div>
          </div>
        </div>

        {/* In-House AI Self-Training Dataset & Feedback Section (Step 6) */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-600" />
                <span>In-House AI Self-Training Pipeline</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Catalog edits, manual translations, and attribute corrections are automatically captured as training pairs for fine-tuning your local models.
              </p>
            </div>

            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/v1/ai-training/export`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition shrink-0"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export Fine-Tuning JSONL</span>
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
              <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wide block">Collected Examples</span>
              <span className="text-xl font-black text-purple-700 font-mono mt-1 block">
                {trainingStats?.totalExamples || 0}
              </span>
              <span className="text-[10px] text-purple-600/80">Ready for Llama / Mistral tuning</span>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wide block">Correction Memory</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-1 block">
                Active
              </span>
              <span className="text-[10px] text-emerald-600/80">Auto-updates translation cache</span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block">Dataset Format</span>
              <span className="text-xl font-black text-slate-800 font-mono mt-1 block">
                JSONL
              </span>
              <span className="text-[10px] text-slate-500">OpenAI / Unsloth compliant</span>
            </div>
          </div>

          {recentExamples.length > 0 && (
            <div className="mt-3 space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Recent Training Pairs Captured:</span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {recentExamples.map((ex) => (
                  <div key={ex.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] font-mono space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold text-purple-700 uppercase">{ex.taskType} ({ex.languageCode})</span>
                      <span>{new Date(ex.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-slate-600 truncate"><span className="text-slate-400 font-bold">Input:</span> {ex.sourceText}</div>
                    <div className="text-emerald-700 font-semibold truncate"><span className="text-emerald-500 font-bold">Trained Output:</span> {ex.correctedOutput}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
