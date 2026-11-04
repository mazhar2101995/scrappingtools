'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Award,
  Plus,
  Search,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  SlidersHorizontal,
  Trash2,
  Edit,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function BrandProfilesPage() {
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function loadBrands() {
    try {
      setLoading(true);
      const res = await apiClient.getBrands();
      // Only show real database records belonging to authenticated tenant
      setBrands(Array.isArray(res) ? res : []);
    } catch (e: any) {
      console.error(e);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBrands();
  }, []);

  async function handleCreateBrand(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg('');
    try {
      setCreating(true);
      await apiClient.createBrand({
        name: name.trim(),
        officialWebsite: website.trim() || undefined,
        logoUrl: logoUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setName('');
      setWebsite('');
      setLogoUrl('');
      setNotes('');
      setShowModal(false);
      await loadBrands();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create brand profile');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteBrand(id: string, brandName: string) {
    if (!window.confirm(`Are you sure you want to delete brand profile "${brandName}"?`)) return;
    try {
      await apiClient.deleteBrand(id);
      await loadBrands();
    } catch (err: any) {
      alert(err.message || 'Failed to delete brand profile');
    }
  }

  const filtered = brands.filter((b) =>
    b.name?.toLowerCase().includes(search.toLowerCase()) ||
    b.officialWebsite?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Brand Profiles</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Tenant-specific brand catalog, dynamic product field mapping, and extraction rules.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setShowModal(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4 text-slate-950" />
          <span>+ Add Brand Profile</span>
        </button>
      </div>

      {/* Search Bar & Counter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search manufacturer brands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] shadow-sm transition"
          />
        </div>

        <div className="text-xs font-bold text-slate-500 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-sm">
          {brands.length} {brands.length === 1 ? 'Brand Profile' : 'Brand Profiles'}
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-semibold text-slate-500">Loading your brand profiles...</p>
        </div>
      ) : brands.length === 0 ? (
        /* Mandatory Professional Empty State for New Client */
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-sm space-y-4 max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-[#0d2a2c]/10 text-[#0d2a2c] mx-auto flex items-center justify-center">
            <Award className="w-8 h-8 text-[#0d2a2c]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">No Brand Profiles Yet</h3>
            <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              Create your first Brand Profile to configure product sources, extraction selectors, and flexible field mappings for your workspace.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-[#fad982] hover:bg-amber-300 text-slate-950 transition shadow"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Brand Profile</span>
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <p className="text-xs font-semibold text-slate-500">No brands matching "{search}".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((b) => {
            const initials = b.name.substring(0, 2).toUpperCase();
            const mappingsCount = Array.isArray(b.fieldMappings) ? b.fieldMappings.length : 0;
            const sourcesCount = Array.isArray(b.sourceConfigs) ? b.sourceConfigs.length : 0;

            return (
              <div
                key={b.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-black text-sm shrink-0 shadow-sm">
                        {initials}
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 group-hover:text-[#0d2a2c] transition">
                          {b.name}
                        </h3>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Created {new Date(b.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                      {b.status || 'Active'}
                    </span>
                  </div>

                  {b.officialWebsite ? (
                    <a
                      href={b.officialWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-slate-500 hover:text-[#0d2a2c] flex items-center gap-1.5 transition font-medium truncate mt-2"
                    >
                      <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{b.officialWebsite.replace(/^https?:\/\//, '')}</span>
                      <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                    </a>
                  ) : (
                    <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-2">
                      <Globe className="w-3.5 h-3.5 text-slate-300" />
                      <span>No website registered</span>
                    </div>
                  )}

                  {b.notes && (
                    <p className="text-xs text-slate-600 mt-2 line-clamp-2 italic bg-slate-50 p-2 rounded-lg">
                      {b.notes}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                    <div className="flex items-center gap-1 text-slate-600 font-semibold bg-slate-100 px-2 py-1 rounded-lg">
                      <SlidersHorizontal className="w-3 h-3 text-slate-500" />
                      <span>{mappingsCount} {mappingsCount === 1 ? 'Mapping' : 'Mappings'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-600 font-semibold bg-slate-100 px-2 py-1 rounded-lg">
                      <Layers className="w-3 h-3 text-slate-500" />
                      <span>{sourcesCount} {sourcesCount === 1 ? 'Source' : 'Sources'}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => handleDeleteBrand(b.id, b.name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    title="Delete Brand Profile"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <Link
                    href={`/brands/${b.id}`}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#0d2a2c] hover:text-teal-900 bg-[#fad982]/40 hover:bg-[#fad982] px-3 py-1.5 rounded-lg transition"
                  >
                    <span>Configure Field Mapping</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Brand Profile Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#0d2a2c]" />
                <h3 className="font-bold text-sm text-slate-900">Add Brand Profile</h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateBrand} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Traxxas, Tamiya, Xray"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Website
                </label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Brand Logo URL (Optional)
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Internal Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Specific catalog details or notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-white rounded-xl text-xs font-bold transition shadow"
                >
                  {creating ? 'Creating...' : 'Save Brand Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
