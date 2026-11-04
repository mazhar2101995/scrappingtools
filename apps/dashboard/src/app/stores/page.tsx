'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Globe,
  ExternalLink,
  Layers,
  ArrowRight,
  ShieldCheck,
  X,
  Store,
  Key,
  Lock,
  AlertCircle,
  Check
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function StoresPage() {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form Fields
  const [storeName, setStoreName] = useState('');
  const [platformType, setPlatformType] = useState('shopify');
  const [storeUrl, setStoreUrl] = useState('');

  // Credentials based on platform
  const [shopifyAccessToken, setShopifyAccessToken] = useState('');
  const [wooConsumerKey, setWooConsumerKey] = useState('');
  const [wooConsumerSecret, setWooConsumerSecret] = useState('');
  const [openCartUsername, setOpenCartUsername] = useState('');
  const [openCartApiKey, setOpenCartApiKey] = useState('');

  async function loadStores() {
    try {
      setLoading(true);
      const res = await apiClient.getStores();
      setStores(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      setStores([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStores();
  }, []);

  function handleOpenModal() {
    setShowAddModal(true);
    setErrorMsg('');
    setSuccessMsg('');
    setStoreName('');
    setStoreUrl('');
    setPlatformType('shopify');
    setShopifyAccessToken('');
    setWooConsumerKey('');
    setWooConsumerSecret('');
    setOpenCartUsername('');
    setOpenCartApiKey('');
  }

  async function handleConnectStore(e: React.FormEvent) {
    e.preventDefault();
    if (!storeName.trim() || !storeUrl.trim()) return;

    try {
      setSubmitting(true);
      setErrorMsg('');

      let credentials: Record<string, any> = {};
      if (platformType === 'shopify') {
        credentials = {
          shopDomain: storeUrl.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
          accessToken: shopifyAccessToken.trim() || 'shpat_demo_sample_token',
        };
      } else if (platformType === 'woocommerce') {
        credentials = {
          consumerKey: wooConsumerKey.trim() || 'ck_demo_sample_key',
          consumerSecret: wooConsumerSecret.trim() || 'cs_demo_sample_secret',
        };
      } else {
        credentials = {
          apiUsername: openCartUsername.trim() || 'demo_user',
          apiKey: openCartApiKey.trim() || 'demo_key',
        };
      }

      await apiClient.connectStore({
        platformType,
        storeName: storeName.trim(),
        storeUrl: storeUrl.trim(),
        credentials,
        capabilities: ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'UPDATE_STOCK'],
      });

      setSuccessMsg(`Store "${storeName}" connected successfully!`);
      setTimeout(() => {
        setShowAddModal(false);
        loadStores();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect store');
    } finally {
      setSubmitting(false);
    }
  }

  const handleTriggerSync = async (storeId: string) => {
    try {
      setIsSyncing(storeId);
      await apiClient.triggerStoreSync(storeId);
      await loadStores();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-slate-800 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Connected E-Commerce Stores</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Connect OpenCart, Shopify, and WooCommerce stores to sync verified canonical catalog data and publish live products.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Connect New Store</span>
        </button>
      </div>

      {/* Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#0d2a2c]" />
                <h3 className="font-black text-slate-900 text-base">Connect E-Commerce Store</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {successMsg && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleConnectStore} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                  Store Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My RC Shop Official"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Platform Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={platformType}
                    onChange={(e) => setPlatformType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                  >
                    <option value="shopify">Shopify</option>
                    <option value="woocommerce">WooCommerce</option>
                    <option value="opencart">OpenCart 3.x / 4.x</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Store URL / Domain <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    placeholder={
                      platformType === 'shopify' ? 'https://my-store.myshopify.com' : 'https://myshop.com'
                    }
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                  />
                </div>
              </div>

              {/* Dynamic Credentials Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Encrypted Store Credentials</span>
                </div>

                {platformType === 'shopify' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Shopify Admin API Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="shpat_xxxxxxxxxxxxxxxxxxxx"
                      value={shopifyAccessToken}
                      onChange={(e) => setShopifyAccessToken(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Generated from your Shopify Custom App settings.</p>
                  </div>
                )}

                {platformType === 'woocommerce' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Consumer Key</label>
                      <input
                        type="text"
                        placeholder="ck_xxxxxxxxxxxxxxxxxxxx"
                        value={wooConsumerKey}
                        onChange={(e) => setWooConsumerKey(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Consumer Secret</label>
                      <input
                        type="password"
                        placeholder="cs_xxxxxxxxxxxxxxxxxxxx"
                        value={wooConsumerSecret}
                        onChange={(e) => setWooConsumerSecret(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                      />
                    </div>
                  </div>
                )}

                {platformType === 'opencart' && (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">API Username</label>
                      <input
                        type="text"
                        placeholder="api_user"
                        value={openCartUsername}
                        onChange={(e) => setOpenCartUsername(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">API Key</label>
                      <input
                        type="password"
                        placeholder="api_key_secret"
                        value={openCartApiKey}
                        onChange={(e) => setOpenCartApiKey(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !storeName.trim() || !storeUrl.trim()}
                  className="px-5 py-2.5 text-xs font-bold bg-[#0d2a2c] hover:bg-[#143d40] text-white rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <span>Connect Store</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stores Grid in Clean Brand Style */}
      {loading ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs">
          Loading connected stores...
        </div>
      ) : stores.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 shadow-sm space-y-4 max-w-xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-2xl border border-amber-200">
            🏪
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">No Stores Connected Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium mt-1">
              Link your Shopify, WooCommerce, or OpenCart store to enable 1-click publishing and automated two-way inventory sync.
            </p>
          </div>
          <button
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4 text-[#fad982]" />
            <span>Connect First Store</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stores.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#0d2a2c] text-[#fad982]">
                    {s.platformType}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{s.status}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{s.storeName}</h3>
                  <a
                    href={s.storeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-400 font-mono hover:text-[#0d2a2c] flex items-center gap-1 mt-0.5 truncate"
                  >
                    <span>{s.storeUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Capabilities:</span>
                    <span className="font-bold text-slate-800">Push, Pull, Pricing</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Last Synced:</span>
                    <span className="font-mono text-slate-800">
                      {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">
                  ID: {s.id.slice(0, 8)}...
                </span>
                <button
                  onClick={() => handleTriggerSync(s.id)}
                  disabled={isSyncing === s.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-lg transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing === s.id ? 'animate-spin' : ''}`} />
                  <span>{isSyncing === s.id ? 'Syncing...' : 'Sync Now'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
