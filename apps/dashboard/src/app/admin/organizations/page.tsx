'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Shield,
  Search,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye,
  LogIn,
  Boxes,
  Award,
  ShoppingBag,
  RefreshCw,
  X
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  
  // Inspection Drawer State
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any | null>(null);
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  async function loadOrgs() {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getOrganizations();
      setOrgs(Array.isArray(res) ? res : []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch organizations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrgs();
  }, []);

  async function handleInspect(org: any) {
    try {
      setSelectedOrg(org);
      setInspectModalOpen(true);
      setInspectLoading(true);
      const details = await apiClient.inspectOrganization(org.id);
      setInspectData(details);
    } catch (e: any) {
      console.error('Inspection failed:', e);
    } finally {
      setInspectLoading(false);
    }
  }

  async function handleImpersonate(orgId: string) {
    try {
      setImpersonatingId(orgId);
      await apiClient.impersonateOrganization(orgId);
      // Redirect to client portal
      window.location.href = '/';
    } catch (e: any) {
      alert(`Impersonation failed: ${e.message}`);
      setImpersonatingId(null);
    }
  }

  async function handleToggleStatus(orgId: string) {
    try {
      await apiClient.toggleOrganizationStatus(orgId);
      await loadOrgs();
      if (selectedOrg?.id === orgId) {
        setSelectedOrg((prev: any) => ({ ...prev, isActive: !prev.isActive }));
      }
    } catch (e: any) {
      alert(`Status toggle failed: ${e.message}`);
    }
  }

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full font-sans">
      {/* Header */}
      <div className="p-7 rounded-xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              TENANT CONTROLS
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Tenant Organizations & Merchant Accounts
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Inspect individual client scrapers, brands, product catalogs, and impersonate workspaces with 1-click.
          </p>
        </div>

        <button
          onClick={loadOrgs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Tenants</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search organizations by name or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#ebdcb9] rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#d4af37] transition shadow-xs"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-bold">{filtered.length}</span> active tenants
        </div>
      </div>

      {/* Tenants Table */}
      <div className="rounded-xl border border-[#ebdcb9] bg-white overflow-hidden shadow-xs">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-[#fcfaf5] border-b border-[#ebdcb9] text-[11px] uppercase tracking-wider text-slate-500 font-mono">
            <tr>
              <th className="py-3.5 px-5">Organization & Merchant Name</th>
              <th className="py-3.5 px-4">Slug Identifier</th>
              <th className="py-3.5 px-4">Plan Tier</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4">Telemetry</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                  Loading multi-tenant database records...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400 font-sans">
                  No organizations found matching search criteria.
                </td>
              </tr>
            ) : (
              filtered.map((org) => (
                <tr key={org.id} className="hover:bg-[#faf7ee]/60 transition">
                  <td className="py-3.5 px-5 font-sans font-medium text-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#faf4e1] border border-[#ecdba8] flex items-center justify-center text-[#9c7f23]">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-slate-900 block">{org.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">ID: {org.id.slice(0, 8)}...</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 font-mono">{org.slug}</td>
                  <td className="py-3.5 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/40 text-[#7a5e12] border border-[#ebd085] uppercase">
                      {org.planTier || 'standard'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                      org.isActive
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {org.isActive ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[11px] text-slate-600 font-sans">
                    <span className="font-bold text-slate-900">{org.totalProducts || 0}</span> prods •{' '}
                    <span className="font-bold text-slate-900">{org.totalBrands || 0}</span> brands
                  </td>
                  <td className="py-3.5 px-5 text-right font-sans space-x-2">
                    <button
                      onClick={() => handleInspect(org)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#faf4e1] border border-[#e5d8b5] text-[#7a5e12] text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                    <button
                      disabled={impersonatingId === org.id}
                      onClick={() => handleImpersonate(org.id)}
                      className="px-3 py-1.5 rounded-xl bg-[#fad982] hover:bg-[#f3cc65] text-slate-950 text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 border border-[#e8c35f]"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{impersonatingId === org.id ? 'Connecting...' : 'Login As'}</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Tenant Deep Inspection Modal */}
      {inspectModalOpen && selectedOrg && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full border border-[#ebdcb9] p-7 space-y-6 shadow-2xl animate-scaleUp max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#f1ebd9] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#fad982]/40 border border-[#ebd085] flex items-center justify-center text-[#7a5e12]">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">{selectedOrg.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">Slug: {selectedOrg.slug} • Plan: {selectedOrg.planTier}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleStatus(selectedOrg.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                    selectedOrg.isActive
                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  {selectedOrg.isActive ? 'Suspend Tenant' : 'Activate Tenant'}
                </button>
                <button
                  onClick={() => setInspectModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {inspectLoading ? (
              <div className="py-16 text-center text-slate-400 text-xs font-sans">
                Inspecting tenant databases, brand profiles and scraping history...
              </div>
            ) : inspectData ? (
              <div className="space-y-6">
                {/* 1. Tenant KPI Quick Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Catalog Items</span>
                    <span className="text-xl font-black text-slate-900 font-mono">{inspectData.products?.length || 0}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Configured Brands</span>
                    <span className="text-xl font-black text-slate-900 font-mono">{inspectData.brands?.length || 0}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9]">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Connected Stores</span>
                    <span className="text-xl font-black text-slate-900 font-mono">{inspectData.stores?.length || 0}</span>
                  </div>
                </div>

                {/* 2. Brand Profiles Mapped by this tenant */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#9c7f23]" />
                    <span>Brand Profiles & Scraping Configurations ({inspectData.brands?.length || 0})</span>
                  </h4>
                  {inspectData.brands && inspectData.brands.length > 0 ? (
                    <div className="divide-y divide-slate-100 rounded-xl border border-[#dbdade] overflow-hidden bg-white">
                      {inspectData.brands.map((b: any) => (
                        <div key={b.id} className="p-3.5 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-900">{b.name}</span>
                            <span className="text-slate-400 block text-[11px] font-mono">{b.officialWebsite || 'No official URL'}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
                            {b.fieldMappings?.length || 0} selectors mapped
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No custom brand profiles created by this tenant yet.</p>
                  )}
                </div>

                {/* 3. Products Extracted by this tenant */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-[#9c7f23]" />
                    <span>Scraped Products in Catalog ({inspectData.products?.length || 0})</span>
                  </h4>
                  {inspectData.products && inspectData.products.length > 0 ? (
                    <div className="divide-y divide-slate-100 rounded-xl border border-[#dbdade] overflow-hidden bg-white max-h-60 overflow-y-auto">
                      {inspectData.products.map((p: any) => (
                        <div key={p.mappingId} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                          <div className="flex items-center gap-3">
                            {p.primaryImageUrl ? (
                              <img src={p.primaryImageUrl} alt="" className="w-8 h-8 rounded-lg object-contain bg-slate-100 border border-[#dbdade]" />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">📦</div>
                            )}
                            <div>
                              <span className="font-bold text-slate-900 block truncate max-w-sm">{p.canonicalTitle}</span>
                              <span className="text-slate-400 text-[10px] font-mono">SKU / MPN: {p.modelNumber || p.customerSku || '—'}</span>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase font-mono">
                            Verified
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No products extracted into this tenant catalog yet.</p>
                  )}
                </div>

                {/* Footer Action: Impersonate */}
                <div className="pt-3 border-t border-[#f1ebd9] flex items-center justify-end gap-3">
                  <button
                    onClick={() => handleImpersonate(selectedOrg.id)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#fad982] hover:bg-[#f3cc65] text-slate-950 text-xs font-bold transition shadow-md shadow-[#fad982]/30 border border-[#e8c35f]"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Launch Tenant Portal as Operator</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
