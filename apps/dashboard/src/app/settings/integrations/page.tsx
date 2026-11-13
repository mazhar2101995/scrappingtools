'use client';

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Copy,
  Check,
  Plus,
  Trash2,
  Lock,
  Webhook,
  ExternalLink,
  Code2,
  AlertCircle,
  Radio,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function IntegrationsSettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    'products:read',
    'products:discover',
    'products:quality:read',
    'products:write',
  ]);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);
  const [createdWebhookSecret, setCreatedWebhookSecret] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [keys, whRes] = await Promise.allSettled([
        apiClient.getApiKeys(),
        apiClient.getWebhookSubscriptions(),
      ]);

      if (keys.status === 'fulfilled') {
        setApiKeys(keys.value);
      }
      if (whRes.status === 'fulfilled' && whRes.value?.subscriptions) {
        setWebhooks(whRes.value.subscriptions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  async function handleGenerateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await apiClient.generateApiKey(newKeyName, selectedScopes);
      setCreatedKeySecret(res.apiKey);
      setNewKeyName('');
      setIsGenerating(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to generate integration key');
    }
  }

  async function handleRevokeKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? External systems using it will lose access immediately.')) {
      return;
    }
    try {
      await apiClient.revokeApiKey(keyId);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to revoke key');
    }
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!webhookUrl.trim()) return;
    try {
      const res = await apiClient.createWebhookSubscription(webhookUrl, ['*']);
      setCreatedWebhookSecret(res.subscription?.secret || 'Created');
      setWebhookUrl('');
      setIsRegisteringWebhook(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to register webhook');
    }
  }

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  return (
    <div className="space-y-8 w-full font-sans pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#dbdade] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Integration Platform &amp; API Keys</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-100 text-teal-800 border border-teal-200">
              REST v1
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Connect external e-commerce stores, custom backend ERPs, and mobile applications to the verified Product Intelligence engine.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="http://localhost:4000/api/docs"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Interactive OpenAPI Docs</span>
          </a>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Secret Banner on Key Creation */}
      {createdKeySecret && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2 animate-in fade-in">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Your New Integration Secret Key (Save this immediately — it will not be displayed again):</span>
          </div>
          <div className="flex items-center justify-between bg-white px-3.5 py-2.5 rounded-lg border border-amber-200 font-mono text-xs text-slate-900 font-bold break-all shadow-inner">
            <span>{createdKeySecret}</span>
            <button
              onClick={() => handleCopy(createdKeySecret)}
              className="ml-3 shrink-0 px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-sans text-xs font-bold transition flex items-center gap-1"
            >
              {copiedKey === createdKeySecret ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKey === createdKeySecret ? 'Copied' : 'Copy Key'}</span>
            </button>
          </div>
        </div>
      )}

      {/* API Keys Section */}
      <div className="bg-white border border-[#dbdade] rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900">Authorized API Keys</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure, scoped credentials tied to this workspace tenant. Never share keys in client-side code.
            </p>
          </div>
          <button
            onClick={() => setIsGenerating(!isGenerating)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs transition shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New API Key</span>
          </button>
        </div>

        {/* Generate Key Form */}
        {isGenerating && (
          <form onSubmit={handleGenerateKey} className="p-4 bg-slate-50 rounded-xl border border-[#dbdade] space-y-4">
            <span className="text-xs font-bold text-slate-800 block">Create Integration Credential</span>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">Key Description / Client Name</label>
              <input
                type="text"
                placeholder="e.g. Shopify Staging Sync, ERP Stock Worker"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#0d2a2c]"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1.5">Authorized Scopes</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'products:read', label: 'products:read (Lookup & Catalog)' },
                  { id: 'products:discover', label: 'products:discover (AI & Extraction)' },
                  { id: 'products:quality:read', label: 'products:quality:read (Audit & Scores)' },
                  { id: 'products:write', label: 'products:write (Webhooks & Customizations)' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleScope(s.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-left text-[11px] font-medium border transition flex items-center justify-between ${
                      selectedScopes.includes(s.id)
                        ? 'bg-[#fad982]/30 border-[#fad982] text-slate-900 font-bold'
                        : 'bg-white border-[#dbdade] text-slate-500'
                    }`}
                  >
                    <span>{s.label}</span>
                    {selectedScopes.includes(s.id) && <Check className="w-3 h-3 text-amber-700" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsGenerating(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#0d2a2c] text-white text-xs font-bold rounded-lg hover:bg-[#143d40] shadow-sm"
              >
                Generate Credential
              </button>
            </div>
          </form>
        )}

        {/* Key List */}
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading credentials...</div>
          ) : apiKeys.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No integration API keys created yet. Generate one above to access the external REST API.
            </div>
          ) : (
            apiKeys.map((key) => {
              const scopes = Array.isArray(key.permissions)
                ? key.permissions
                : typeof key.permissions === 'string'
                ? JSON.parse(key.permissions || '[]')
                : [];

              return (
                <div key={key.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{key.name}</span>
                      <div className="flex gap-1 flex-wrap">
                        {scopes.map((s: string) => (
                          <span
                            key={s}
                            className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 border border-[#dbdade] text-slate-600"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-2">
                      <span className="text-slate-400">Prefix:</span>
                      <span className="font-bold text-slate-700">{key.keyPrefix}...</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="text-slate-700 font-medium">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {key.lastUsedAt ? `Last active: ${new Date(key.lastUsedAt).toLocaleString()}` : 'Never used'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition border border-transparent hover:border-rose-200"
                      title="Revoke API Key"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Webhook Foundation Section */}
      <div className="bg-white border border-[#dbdade] rounded-xl shadow-sm p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <Webhook className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900">Event-Driven Webhooks</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Receive real-time signed HTTP POST webhooks when products are created, quality scores change, or reviews resolve.
            </p>
          </div>
          <button
            onClick={() => setIsRegisteringWebhook(!isRegisteringWebhook)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Webhook Endpoint</span>
          </button>
        </div>

        {isRegisteringWebhook && (
          <form onSubmit={handleCreateWebhook} className="p-4 bg-slate-50 rounded-xl border border-[#dbdade] space-y-3">
            <span className="text-xs font-bold text-slate-800 block">Register Target Webhook URL</span>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://your-store.com/api/webhooks/product-intelligence"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                required
              />
              <button
                type="submit"
                className="px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-lg hover:bg-teal-800"
              >
                Subscribe
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {webhooks.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No active webhook endpoints registered. Click "Add Webhook Endpoint" to receive real-time updates.
            </div>
          ) : (
            webhooks.map((wh) => (
              <div key={wh.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-slate-800 font-mono text-[11px]">{wh.targetUrl}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Events: {Array.isArray(wh.events) ? wh.events.join(', ') : 'All (*)'} • Registered {new Date(wh.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ACTIVE
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Integration Code Snippet Quick Start */}
      <div className="bg-slate-900 text-slate-100 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold tracking-wide uppercase text-slate-300">Quick Start: Real-Time Product Lookup</h3>
        </div>
        <div className="p-3 bg-black/40 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto text-amber-200/90 border border-slate-800">
          <pre>{`// Example: Query verified product intelligence by EAN barcode or model number
curl -X GET "http://localhost:4000/api/v1/integrations/products/lookup?identifier=0020334680864" \\
  -H "X-API-Key: pk_your_key_here"`}</pre>
        </div>
      </div>
    </div>
  );
}

