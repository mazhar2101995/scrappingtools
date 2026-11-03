'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

export default function SettingsSecurityPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState([
    {
      id: 'key_live_01',
      name: 'Production Ingestion Worker',
      prefix: 'sk_live_prod_9918...',
      createdAt: '2026-10-24',
      lastUsed: '4 mins ago',
      role: 'ingestion:write',
    },
    {
      id: 'key_live_02',
      name: 'Readonly Analytics Agent',
      prefix: 'sk_live_ro_2841...',
      createdAt: '2026-11-01',
      lastUsed: '1 hour ago',
      role: 'catalog:read',
    },
  ]);

  const handleCopy = (keyText: string) => {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(keyText);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">API Keys &amp; Tenant Security</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage tenant-scoped API authentication tokens, cryptographic key rotation, and role-based access.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Organization Overview */}
        <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Acme Corp Global</h3>
              <span className="text-xs text-slate-400 font-mono">Tenant ID: org_acme_prod</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Subscription Tier:</span>
              <span className="text-emerald-400 font-semibold uppercase">Enterprise AI Pro</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Monthly Product Limit:</span>
              <span className="text-slate-200 font-mono">100,000 / Unlimited</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rate Limit Ceiling:</span>
              <span className="text-slate-200 font-mono">1,000 req/min</span>
            </div>
          </div>
        </div>

        {/* Right: API Keys Management */}
        <div className="lg:col-span-2 bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-semibold text-white text-sm">Active Secret API Keys</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sha-256 hashed at rest in PostgreSQL. Never share secret keys in client-side code.
              </p>
            </div>
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition">
              <Plus className="w-3.5 h-3.5" />
              <span>Generate Key</span>
            </button>
          </div>

          <div className="divide-y divide-slate-800 border-y border-slate-800">
            {apiKeys.map((key) => (
              <div key={key.id} className="py-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-200">{key.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-750 text-slate-400">
                      {key.role}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-1 flex items-center gap-2">
                    <span>{key.prefix}</span>
                    <button
                      onClick={() => handleCopy(key.prefix)}
                      className="text-slate-400 hover:text-sky-400 transition"
                      title="Copy Key"
                    >
                      {copiedKey === key.prefix ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <div className="text-slate-300">Created {key.createdAt}</div>
                    <div className="text-[10px] text-slate-400">Last used: {key.lastUsed}</div>
                  </div>
                  <button className="p-1.5 rounded hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

