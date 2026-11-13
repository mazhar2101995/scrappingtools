'use client';

import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  Plus,
  RefreshCw,
  Trash2,
  Lock,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Building,
  User,
  ExternalLink,
  Cookie,
  Clock,
  Sparkles
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface SupplierSession {
  id: string;
  supplierName: string;
  supplierDomain: string;
  loginUrl: string;
  username: string;
  lastLoginAt: string | null;
  lastStatus: 'ACTIVE' | 'FAILED' | 'PENDING';
  lastErrorMessage: string | null;
  autoRefreshHours: number;
  activeCookiesCount: number;
  createdAt: string;
}

export default function SupplierSessionsPage() {
  const [sessions, setSessions] = useState<SupplierSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Form State
  const [formData, setFormData] = useState({
    supplierName: '',
    supplierDomain: '',
    loginUrl: '',
    username: '',
    password: '',
    autoRefreshHours: 12,
  });

  const loadSessions = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSupplierSessions();
      setSessions(data);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load supplier sessions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.saveSupplierSession(formData);
      setStatusMessage({
        type: 'success',
        text: `Supplier credentials saved for ${formData.supplierName}! Initial login dispatachable.`,
      });
      setModalOpen(false);
      setFormData({
        supplierName: '',
        supplierDomain: '',
        loginUrl: '',
        username: '',
        password: '',
        autoRefreshHours: 12,
      });
      loadSessions();
    } catch (err: any) {
      alert(`Error saving credentials: ${err.message}`);
    }
  };

  const handleLoginNow = async (session: SupplierSession) => {
    setLoggingInId(session.id);
    try {
      const res = await apiClient.loginSupplierNow(session.id);
      setStatusMessage({
        type: 'success',
        text: `Logged in to ${session.supplierName}! Locked in ${res.data.cookieCount} wholesale session cookies.`,
      });
      loadSessions();
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
      loadSessions();
    } finally {
      setLoggingInId(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete credentials for ${name}? Wholesale scraping for this domain will be disabled.`)) return;
    try {
      await apiClient.deleteSupplierSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setStatusMessage({ type: 'success', text: `Supplier ${name} credentials removed.` });
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-slate-100">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#143d40] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-[#fad982] tracking-wider mb-1 font-bold">
            <Lock className="w-3.5 h-3.5" />
            <span>Authenticated Scraping Vault</span>
          </div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <KeyRound className="w-7 h-7 text-[#fad982]" />
            B2B Supplier Accounts & Wholesale Session Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-3xl">
            Store dealer portal credentials to unlock tier-based B2B discounts, cost prices, and gated warehouse inventory behind login screens.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#fad982] to-amber-200 text-slate-950 font-bold text-xs shadow-glow-gold hover:opacity-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier Account</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* Feature Value Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-[#0d2a2c]/60 border border-[#143d40] relative overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-amber-400/10 text-[#fad982] flex items-center justify-center mb-3">
            <Lock className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-white">AES-256 Gated Storage</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Supplier passwords are encrypted at rest with AES-256 ciphering. Credentials are never exposed in logs or API payloads.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d2a2c]/60 border border-[#143d40] relative overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-emerald-400/10 text-emerald-400 flex items-center justify-center mb-3">
            <Cookie className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-white">Autonomous Session Vault</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Crawlers automatically authenticate using CSRF token handshakes and maintain fresh Wholesale session cookies.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#0d2a2c]/60 border border-[#143d40] relative overflow-hidden">
          <div className="w-8 h-8 rounded-xl bg-cyan-400/10 text-cyan-400 flex items-center justify-center mb-3">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-white">Tiered Wholesale Pricing</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Scrapes hidden Dealer/VIP volume prices instead of standard public MSRPs, maximizing your profit calculation accuracy.
          </p>
        </div>
      </div>

      {/* List of Configured Suppliers */}
      <div className="bg-[#0d2a2c]/80 rounded-2xl border border-[#143d40] overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-[#143d40] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Building className="w-4 h-4 text-[#fad982]" />
              Configured Wholesale Supplier Accounts ({sessions.length})
            </h2>
            <span className="text-[11px] text-slate-400">
              Authenticated scrapers inject session cookies whenever crawling products from these domains.
            </span>
          </div>

          <button
            onClick={loadSessions}
            disabled={loading}
            className="p-2 rounded-xl bg-[#143d40]/60 hover:bg-[#143d40] text-slate-300 hover:text-white transition"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#fad982]' : ''}`} />
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <KeyRound className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="font-semibold text-slate-300">No Supplier Accounts Added</p>
            <p className="text-xs mt-1 text-slate-500 max-w-md mx-auto">
              Add your B2B supplier/wholesaler login to allow the crawler to log in and capture your wholesale pricing and warehouse stock levels.
            </p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-4 px-4 py-2 rounded-xl bg-[#fad982] text-slate-950 font-bold text-xs inline-flex items-center gap-2 shadow-glow-gold hover:opacity-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Connect First Supplier</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#143d40]/60">
            {sessions.map((item) => {
              const isLoggingIn = loggingInId === item.id;
              return (
                <div key={item.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#143d40]/20 transition">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-sm text-white">{item.supplierName}</span>
                      <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#143d40] text-slate-300 border border-[#1d575c]">
                        <Globe className="w-3 h-3 text-[#fad982]" />
                        {item.supplierDomain}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          item.lastStatus === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : item.lastStatus === 'FAILED'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}
                      >
                        {item.lastStatus}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        Username: <span className="text-slate-200 font-mono">{item.username}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Cookie className="w-3.5 h-3.5 text-amber-400" />
                        Session Cookies: <strong className="text-slate-200 font-mono">{item.activeCookiesCount}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Last Login: <span className="text-slate-300">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never'}</span>
                      </span>
                    </div>

                    {item.lastErrorMessage && (
                      <div className="text-[11px] text-rose-400 flex items-center gap-1 font-mono">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        {item.lastErrorMessage}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleLoginNow(item)}
                      disabled={isLoggingIn}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#143d40] hover:bg-[#1a4e52] text-slate-200 hover:text-white text-xs font-semibold border border-[#1d575c] transition disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#fad982] ${isLoggingIn ? 'animate-spin' : ''}`} />
                      <span>{isLoggingIn ? 'Logging in...' : 'Test Login'}</span>
                    </button>

                    <a
                      href={item.loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-xl bg-[#143d40]/40 hover:bg-[#143d40] text-slate-400 hover:text-slate-200 border border-[#1d575c] transition"
                      title="Open Login URL"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>

                    <button
                      onClick={() => handleDelete(item.id, item.supplierName)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition"
                      title="Delete Credentials"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d2a2c] border border-[#143d40] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[#143d40] pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#fad982]/10 text-[#fad982] flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-white text-base">Add B2B Supplier Login</h3>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ingram Micro, D&H Distributing, Tech Data"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#143d40]/50 border border-[#1d575c] text-xs text-white focus:outline-none focus:border-[#fad982]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. supplierportal.com"
                  value={formData.supplierDomain}
                  onChange={(e) => setFormData({ ...formData, supplierDomain: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#143d40]/50 border border-[#1d575c] text-xs text-white focus:outline-none focus:border-[#fad982]"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Any crawl request hitting this domain will automatically carry the authenticated wholesale session.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Login URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://dealer.supplier.com/login"
                  value={formData.loginUrl}
                  onChange={(e) => setFormData({ ...formData, loginUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#143d40]/50 border border-[#1d575c] text-xs text-white focus:outline-none focus:border-[#fad982]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Username / Dealer ID</label>
                  <input
                    type="text"
                    required
                    placeholder="dealer_10294"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#143d40]/50 border border-[#1d575c] text-xs text-white focus:outline-none focus:border-[#fad982]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#143d40]/50 border border-[#1d575c] text-xs text-white focus:outline-none focus:border-[#fad982]"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <span>
                  Passwords are encrypted with hardware-grade AES-256 before storage. Sessions are auto-refreshed periodically in the background.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#143d40]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#143d40]/60 hover:bg-[#143d40] text-slate-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#fad982] to-amber-200 text-slate-950 font-bold text-xs shadow-glow-gold hover:opacity-95 transition"
                >
                  Save & Lock In Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
