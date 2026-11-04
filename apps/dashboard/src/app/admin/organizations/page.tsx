'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Plus, Shield, Search } from 'lucide-react';
import { apiClient, OrganizationItem } from '@/lib/api-client';

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<OrganizationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function loadOrgs() {
      try {
        setLoading(true);
        const res = await apiClient.getOrganizations();
        setOrgs(res || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch organizations');
      } finally {
        setLoading(false);
      }
    }
    loadOrgs();
  }, []);

  const filtered = orgs.filter(o => 
    o.name.toLowerCase().includes(search.toLowerCase()) || 
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
              Tenancy Control
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Organizations & Tenants</h1>
          <p className="text-sm text-slate-400 mt-1">Manage database tenant boundaries, subscription tiers, and client accounts.</p>
        </div>

        <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm">
          <Plus className="w-4 h-4" />
          <span>New Organization</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filter organizations by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
          />
        </div>
        <div className="text-xs text-slate-400">
          Showing <span className="text-white font-medium">{filtered.length}</span> active tenants
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
            <tr>
              <th className="py-3 px-4">Organization Name</th>
              <th className="py-3 px-4">Slug Identifier</th>
              <th className="py-3 px-4">Plan Tier</th>
              <th className="py-3 px-4">Created Date</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                  Loading tenants from database...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-500 font-sans">
                  No organizations found matching search criteria.
                </td>
              </tr>
            ) : (
              filtered.map((org) => (
                <tr key={org.id} className="hover:bg-slate-850/50 transition">
                  <td className="py-3 px-4 font-sans font-medium text-white flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <span>{org.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{org.slug}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                      {org.planTier || 'enterprise'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-sans">
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-right font-sans">
                    <button className="text-xs text-indigo-400 hover:text-indigo-300 transition font-medium">
                      Manage →
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

