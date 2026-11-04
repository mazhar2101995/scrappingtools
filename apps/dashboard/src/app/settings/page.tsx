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
  Building2,
  Users,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function SettingsSecurityPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgData, setOrgData] = useState<any>({
    name: 'Workspace Organization',
    planTier: 'STANDARD',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKeySecret, setCreatedKeySecret] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load real organization and API keys
        const [clientWs, keysRes] = await Promise.allSettled([
          apiClient.getClientWorkspace(),
          apiClient.getApiKeys(),
        ]);

        if (clientWs.status === 'fulfilled' && clientWs.value?.organization) {
          setOrgData(clientWs.value.organization);
        } else if (typeof window !== 'undefined') {
          const stored = localStorage.getItem('saas_current_user');
          if (stored) {
            try {
              const u = JSON.parse(stored);
              setOrgData({
                name: u.organizationName || u.fullName + "'s Org" || 'Client Workspace',
                planTier: 'STANDARD',
              });
            } catch (_) {}
          }
        }

        if (keysRes.status === 'fulfilled') {
          setApiKeys(keysRes.value);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCopy = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(keyText);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  async function handleGenerateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    try {
      const res = await apiClient.generateApiKey(newKeyName);
      setCreatedKeySecret(res.apiKey);
      setApiKeys((prev) => [
        {
          id: res.apiKey,
          name: res.name,
          keyPrefix: res.keyPrefix + '...',
          createdAt: res.createdAt,
          lastUsedAt: null,
        },
        ...prev,
      ]);
      setNewKeyName('');
      setIsGenerating(false);
    } catch (err: any) {
      alert(err.message || 'Failed to generate key');
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">API Keys &amp; Tenant Security</h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Manage tenant-scoped API authentication tokens, cryptographic key rotation, and role-based access.
        </p>
      </div>

      {createdKeySecret && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <div className="font-bold flex items-center justify-between mb-1">
            <span>Secret API Key Generated! Copy it now (will not be displayed again):</span>
            <button
              onClick={() => handleCopy(createdKeySecret)}
              className="text-xs px-2.5 py-1 bg-emerald-700 text-white rounded font-semibold hover:bg-emerald-800"
            >
              {copiedKey === createdKeySecret ? 'Copied!' : 'Copy Key'}
            </button>
          </div>
          <code className="bg-emerald-100 px-2 py-1 rounded block text-emerald-950 font-mono text-[11px] select-all">
            {createdKeySecret}
          </code>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Organization Overview in Clean White/Teal Brand Theme */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">{orgData.name}</h3>
              <span className="text-[11px] text-slate-400 font-mono">Workspace ID: {orgData.id?.slice(0, 8) || 'client_ws'}</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-2 text-xs font-medium">
            <div className="flex justify-between">
              <span className="text-slate-500">Subscription Tier:</span>
              <span className="text-[#0d2a2c] font-bold uppercase">{orgData.planTier || 'STANDARD'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Monthly Product Limit:</span>
              <span className="text-slate-800 font-bold font-mono">10,000 / Unlimited</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Rate Limit Ceiling:</span>
              <span className="text-slate-800 font-bold font-mono">1,000 req/min</span>
            </div>
          </div>
        </div>

        {/* Right: API Keys Management in Clean White Brand Theme */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Active Secret API Keys</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Sha-256 hashed at rest in PostgreSQL. Never share secret keys in client-side code.
              </p>
            </div>
            <button
              onClick={() => setIsGenerating(!isGenerating)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs transition shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Key</span>
            </button>
          </div>

          {isGenerating && (
            <form onSubmit={handleGenerateKey} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <span className="text-xs font-bold text-slate-800 block">Create New API Key</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Key name (e.g. My OpenCart Sync)"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#0d2a2c]"
                />
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[#0d2a2c] text-white text-xs font-bold rounded-lg hover:bg-[#143d40]"
                >
                  Confirm &amp; Create
                </button>
              </div>
            </form>
          )}

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading API keys from database...</div>
            ) : apiKeys.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No active API keys found for this workspace. Click "Generate Key" above to create one.
              </div>
            ) : (
              apiKeys.map((key) => (
                <div key={key.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-900">{key.name}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-100 border border-slate-200 text-slate-600">
                        read:write
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-2">
                      <span>{key.keyPrefix}</span>
                      <button
                        onClick={() => handleCopy(key.keyPrefix)}
                        className="text-slate-400 hover:text-slate-700 transition"
                        title="Copy Key Prefix"
                      >
                        {copiedKey === key.keyPrefix ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <div className="text-slate-700 font-medium">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {key.lastUsedAt ? `Used ${new Date(key.lastUsedAt).toLocaleTimeString()}` : 'Never used'}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
