'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Award,
  Search,
  ExternalLink,
  RefreshCw,
  Globe,
  Tag,
  Layers,
  Building2,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminGlobalBrandsPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<any | null>(null);

  async function loadBrands() {
    try {
      setLoading(true);
      const res = await apiClient.getGlobalBrands();
      setBrands(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBrands();
  }, []);

  const filtered = brands.filter((b) =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.officialWebsite?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="p-7 rounded-3xl bg-gradient-to-r from-white via-[#fefdfa] to-[#fbf7ed] border border-[#ebdcb9] shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#fad982]/50 text-[#7a5e12] border border-[#ebd085] uppercase tracking-wider font-mono">
              BRAND REPOSITORY
            </span>
            <span className="text-xs text-slate-500 font-mono">Platform Admin Privileges</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Global Brand Profiles & Scraping Presets
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Cross-tenant repository of configured brand profiles, click-to-map CSS selectors, and custom e-commerce field groups.
          </p>
        </div>

        <button
          onClick={loadBrands}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-[#7a5e12] transition shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Brands</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search brands by name or website..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#ebdcb9] rounded-2xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#d4af37] transition shadow-xs"
          />
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="text-slate-900 font-bold">{filtered.length}</span> global brand templates
        </div>
      </div>

      {/* Brands Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 py-16 text-center text-slate-400 text-xs">
            Loading cross-tenant brand repository...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-slate-400 text-xs">
            No brand profiles configured yet.
          </div>
        ) : (
          filtered.map((b) => (
            <div
              key={b.id}
              onClick={() => setSelectedBrand(b)}
              className="p-6 rounded-3xl bg-white border border-[#ebdcb9] hover:border-[#d4af37] transition shadow-xs cursor-pointer group space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#fad982] to-[#e6bd53] text-slate-950 font-black text-sm flex items-center justify-center shadow-xs border border-[#cfab47]">
                    {b.name ? b.name.slice(0, 2).toUpperCase() : 'BR'}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 group-hover:text-[#8a6e19] transition">
                      {b.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono block">Tenant: {b.organizationId?.slice(0, 8)}...</span>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
                  {b.status || 'Active'}
                </span>
              </div>

              {b.officialWebsite && (
                <div className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <a
                    href={b.officialWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline truncate"
                  >
                    {b.officialWebsite}
                  </a>
                </div>
              )}

              {/* Mapped stats */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 text-center font-mono">
                <div className="p-2 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9]/60">
                  <span className="text-[9px] text-slate-400 uppercase block">Selectors</span>
                  <span className="font-bold text-slate-900 text-xs">{b.fieldMappings?.length || 0}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9]/60">
                  <span className="text-[9px] text-slate-400 uppercase block">Groups</span>
                  <span className="font-bold text-slate-900 text-xs">{b.fieldGroups?.length || 0}</span>
                </div>
                <div className="p-2 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9]/60">
                  <span className="text-[9px] text-slate-400 uppercase block">Custom Fields</span>
                  <span className="font-bold text-slate-900 text-xs">{b.customFields?.length || 0}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Brand Inspection Drawer */}
      {selectedBrand && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-[#ebdcb9] p-7 space-y-5 shadow-2xl animate-scaleUp max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#f1ebd9] pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase bg-[#fad982]/40 text-[#7a5e12] px-2 py-0.5 rounded font-bold">
                  Brand Preset Inspection
                </span>
                <h3 className="font-black text-lg text-slate-900 mt-1">{selectedBrand.name}</h3>
              </div>
              <button
                onClick={() => setSelectedBrand(null)}
                className="text-xs text-slate-400 hover:text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <span className="text-slate-400 uppercase text-[10px] block">Official Website</span>
                <span className="text-slate-800 font-sans">{selectedBrand.officialWebsite || 'None'}</span>
              </div>

              <div>
                <span className="text-slate-400 uppercase text-[10px] block mb-1">Mapped CSS Field Selectors ({selectedBrand.fieldMappings?.length || 0})</span>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white max-h-52 overflow-y-auto font-sans">
                  {(selectedBrand.fieldMappings || []).map((m: any, i: number) => (
                    <div key={i} className="p-2.5 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900">{m.targetField}</span>
                      <span className="font-mono text-slate-500 text-[11px] bg-slate-50 px-2 py-0.5 rounded">{m.sourceValue}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedBrand.fieldGroups && selectedBrand.fieldGroups.length > 0 && (
                <div>
                  <span className="text-slate-400 uppercase text-[10px] block mb-1">Configured Field Groups</span>
                  <div className="p-3 rounded-xl bg-[#fdfbf7] border border-[#ebdcb9] font-sans">
                    {selectedBrand.fieldGroups.map((g: any, i: number) => (
                      <div key={i}>
                        <span className="font-bold text-slate-900">{g.name}:</span>{' '}
                        <span className="text-slate-600 font-mono text-[11px]">{(g.fields || []).join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

