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
  Check,
  Download,
  FileCode,
  HelpCircle,
  FolderTree,
  Terminal,
  UploadCloud,
  Edit,
  Trash2
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

  // Edit / Delete Store State
  const [editingStore, setEditingStore] = useState<any | null>(null);
  const [deletingStoreId, setDeletingStoreId] = useState<string | null>(null);

  // OpenCart Guide Modal
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Store Languages Modal State (Phase 9C)
  const [activeLangStore, setActiveLangStore] = useState<any | null>(null);
  const [storeLanguagesList, setStoreLanguagesList] = useState<any[]>([]);
  const [loadingLangs, setLoadingLangs] = useState(false);
  const [savingLang, setSavingLang] = useState(false);
  const [langError, setLangError] = useState('');
  const [newLangCode, setNewLangCode] = useState('');
  const [newPlatformLocale, setNewPlatformLocale] = useState('');

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
    setEditingStore(null);
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

  function handleOpenEditModal(store: any) {
    setEditingStore(store);
    setShowAddModal(true);
    setErrorMsg('');
    setSuccessMsg('');
    setStoreName(store.storeName || '');
    setStoreUrl(store.storeUrl || '');
    setPlatformType(store.platformType || 'opencart');
    setShopifyAccessToken('');
    setWooConsumerKey('');
    setWooConsumerSecret('');
    setOpenCartUsername('');
    setOpenCartApiKey('');
  }

  async function handleDeleteStore(store: any) {
    if (!confirm(`Are you sure you want to disconnect and delete store "${store.storeName}"? All synced mappings will be removed.`)) {
      return;
    }
    try {
      setDeletingStoreId(store.id);
      await apiClient.deleteStore(store.id);
      await loadStores();
    } catch (err: any) {
      alert(`Failed to delete store: ${err.message || 'Unknown error'}`);
    } finally {
      setDeletingStoreId(null);
    }
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

      if (editingStore) {
        const updatePayload: any = {
          storeName: storeName.trim(),
          storeUrl: storeUrl.trim(),
        };
        // If user entered new credentials, include them in update
        if (
          shopifyAccessToken.trim() ||
          wooConsumerKey.trim() ||
          wooConsumerSecret.trim() ||
          openCartUsername.trim() ||
          openCartApiKey.trim()
        ) {
          updatePayload.credentials = credentials;
        }

        await apiClient.updateStore(editingStore.id, updatePayload);
        setSuccessMsg(`Store "${storeName}" updated successfully!`);
      } else {
        await apiClient.connectStore({
          platformType,
          storeName: storeName.trim(),
          storeUrl: storeUrl.trim(),
          credentials,
          capabilities: ['PULL_PRODUCTS', 'PUSH_PRODUCTS', 'UPDATE_PRICING', 'UPDATE_STOCK'],
        });
        setSuccessMsg(`Store "${storeName}" connected successfully!`);
      }

      setTimeout(() => {
        setShowAddModal(false);
        setEditingStore(null);
        loadStores();
      }, 1200);
    } catch (err: any) {
      setErrorMsg(err.message || (editingStore ? 'Failed to update store' : 'Failed to connect store'));
    } finally {
      setSubmitting(false);
    }
  }

  async function openLanguagesModal(store: any) {
    setActiveLangStore(store);
    setLangError('');
    setLoadingLangs(true);
    try {
      const res = await apiClient.getSpecificStoreLanguages(store.id);
      setStoreLanguagesList(Array.isArray(res?.languages) ? res.languages : []);
    } catch (e: any) {
      setLangError(e.message || 'Failed to fetch store languages');
    } finally {
      setLoadingLangs(false);
    }
  }

  async function handleAddLanguage(e: React.FormEvent) {
    e.preventDefault();
    if (!activeLangStore || !newLangCode.trim()) return;
    try {
      setSavingLang(true);
      setLangError('');
      await apiClient.configureStoreLanguage(activeLangStore.id, {
        languageCode: newLangCode.trim().toLowerCase(),
        platformLocaleCode: newPlatformLocale.trim() || undefined,
        exportEnabled: true,
        isDefault: false,
      });
      setNewLangCode('');
      setNewPlatformLocale('');
      const res = await apiClient.getSpecificStoreLanguages(activeLangStore.id);
      setStoreLanguagesList(Array.isArray(res?.languages) ? res.languages : []);
    } catch (e: any) {
      setLangError(e.message || 'Failed to add store language');
    } finally {
      setSavingLang(false);
    }
  }

  async function handleToggleLangExport(langCode: string, currentEnabled: boolean) {
    if (!activeLangStore) return;
    try {
      await apiClient.configureStoreLanguage(activeLangStore.id, {
        languageCode: langCode,
        exportEnabled: !currentEnabled,
      });
      const res = await apiClient.getSpecificStoreLanguages(activeLangStore.id);
      setStoreLanguagesList(Array.isArray(res?.languages) ? res.languages : []);
    } catch (e: any) {
      setLangError(e.message || 'Failed to update export status');
    }
  }

  async function handleSetDefaultLang(langCode: string) {
    if (!activeLangStore) return;
    try {
      await apiClient.configureStoreLanguage(activeLangStore.id, {
        languageCode: langCode,
        isDefault: true,
        exportEnabled: true,
      });
      const res = await apiClient.getSpecificStoreLanguages(activeLangStore.id);
      setStoreLanguagesList(Array.isArray(res?.languages) ? res.languages : []);
    } catch (e: any) {
      setLangError(e.message || 'Failed to set default language');
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
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Connected E-Commerce Stores</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Connect OpenCart, Shopify, and WooCommerce stores to sync verified canonical catalog data and publish live products.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs rounded-xl border border-emerald-200 transition"
          >
            <HelpCircle className="w-4 h-4 text-emerald-700" />
            <span>Store Connection Guide</span>
          </button>

          <button
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Connect New Store</span>
          </button>
        </div>
      </div>

      {/* Modal Dialog */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#0d2a2c]" />
                <h3 className="font-black text-slate-900 text-base">
                  {editingStore ? `Edit Store — ${editingStore.storeName}` : 'Connect E-Commerce Store'}
                </h3>
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
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 leading-relaxed">
                      <div className="font-bold flex items-center gap-1.5 mb-1 text-emerald-950">
                        <FileCode className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Official OpenCart Extension Module Setup:</span>
                      </div>
                      1. Download <a href="http://localhost:4000/api/v1/stores/download-module" className="font-bold underline text-emerald-800">saas_connector.ocmod.zip</a>.<br/>
                      2. In OpenCart Admin, go to <b>Extensions &gt; Installer</b> and upload the ZIP.<br/>
                      3. Go to <b>Extensions &gt; Modifications</b> and click <b>Refresh</b>.<br/>
                      4. In <b>Extensions &gt; Modules &gt; SaaS Connector</b>, click <b>Edit</b>, copy your generated <b>Secret Key</b>, and paste it below.
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Store Signing Secret Key</label>
                      <input
                        type="password"
                        placeholder="Paste the 64-character Secret Key from your OpenCart SaaS Connector module"
                        value={openCartApiKey}
                        onChange={(e) => setOpenCartApiKey(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                      />
                      <p className="text-[10px] text-slate-400 mt-1">OpenCart's default API username is no longer required. The module authenticates all exports via this secure HMAC Secret Key.</p>
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
                      <span>{editingStore ? 'Saving Changes...' : 'Connecting...'}</span>
                    </>
                  ) : (
                    <span>{editingStore ? 'Save Changes' : 'Connect Store'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OpenCart Setup Help Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Store Connection &amp; Integration Guide</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Follow these standard steps to connect your e-commerce store live</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-700">
              {/* Step 1 */}
              <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900">Step 1 — Choose Store Platform &amp; Credentials</h4>
                  <p className="text-slate-600">
                    Click <strong>"Connect New Store"</strong> above and select your platform:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pt-1 text-slate-600">
                    <li><strong>Shopify:</strong> Enter your Admin API Access Token.</li>
                    <li><strong>WooCommerce:</strong> Enter your REST API Consumer Key &amp; Consumer Secret.</li>
                    <li><strong>OpenCart:</strong> Enter your OpenCart API Secret Key (or use PHP connector bridge).</li>
                  </ul>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  2
                </div>
                <div className="space-y-2">
                  <h4 className="font-bold text-slate-900">Step 2 — OpenCart Connector Bridge (Optional / Zero Config)</h4>
                  <p className="text-slate-600">
                    For OpenCart stores, download <code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">saas_bridge.php</code> and upload it once to your store's root directory:
                  </p>
                  <div className="pt-1">
                    <a
                      href="http://localhost:4000/api/v1/stores/download-bridge"
                      download="saas_bridge.php"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold rounded-lg transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download saas_bridge.php</span>
                    </a>
                  </div>
                  <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-1">
                    <div className="text-slate-400">// Your store root directory structure:</div>
                    <div>📁 public_html/ (store root folder)</div>
                    <div>&nbsp;&nbsp;├── 📄 config.php</div>
                    <div>&nbsp;&nbsp;├── 📄 index.php</div>
                    <div className="text-emerald-400 font-bold">&nbsp;&nbsp;├── 📄 saas_bridge.php &nbsp;&nbsp;&lt;-- Upload here</div>
                    <div>&nbsp;&nbsp;├── 📁 catalog/</div>
                    <div>&nbsp;&nbsp;└── 📁 system/</div>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                  3
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900">Step 3 — Controlled Change Preview &amp; Push</h4>
                  <p className="text-slate-600">
                    After connecting, open any product in your catalog and click <strong>"Push to Store"</strong>. You can preview exactly which fields will be written, skipped, or protected before confirming export!
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-5 py-2.5 text-xs font-bold bg-[#0d2a2c] hover:bg-[#143d40] text-white rounded-xl shadow-sm transition"
              >
                Got It, Thanks!
              </button>
            </div>
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
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{s.status}</span>
                    </span>
                    <button
                      onClick={() => handleOpenEditModal(s)}
                      title="Edit Store Settings & Credentials"
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-transparent hover:border-slate-200 transition"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteStore(s)}
                      disabled={deletingStoreId === s.id}
                      title="Disconnect / Delete Store"
                      className="p-1 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-transparent hover:border-rose-200 transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => openLanguagesModal(s)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 font-bold text-xs rounded-lg transition"
                  title="Manage destination languages for this store"
                >
                  <Globe className="w-3.5 h-3.5 text-teal-700" />
                  <span>Languages</span>
                </button>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.platformType === 'opencart' && (
                    <a
                      href="http://localhost:4000/api/v1/stores/download-bridge"
                      download="saas_bridge.php"
                      title="Download saas_bridge.php for this OpenCart store"
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs rounded-lg transition shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-amber-700" />
                      <span>Download Bridge</span>
                    </a>
                  )}
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
            </div>
          ))}
        </div>
      )}

      {/* Phase 9C: Store Languages Management Modal */}
      {activeLangStore && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center font-bold">
                  <Globe className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Store Languages — {activeLangStore.storeName}</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Configure multiple destination languages supported by this store ({activeLangStore.platformType?.toUpperCase()})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveLangStore(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {langError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{langError}</span>
              </div>
            )}

            {/* List of Configured Store Languages */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Active Store Languages ({storeLanguagesList.length})
              </span>

              {loadingLangs ? (
                <div className="p-4 text-center text-xs text-slate-400">Loading store languages...</div>
              ) : storeLanguagesList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
                  No languages configured yet. Add one below.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {storeLanguagesList.map((l: any) => (
                    <div
                      key={l.id || l.languageCode}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-900">
                          {l.languageCode}
                        </span>
                        {l.isDefault && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                            Default
                          </span>
                        )}
                        {l.platformLocaleCode && (
                          <span className="text-[10px] font-mono text-slate-400">({l.platformLocaleCode})</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {!l.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultLang(l.languageCode)}
                            className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 underline"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleLangExport(l.languageCode, l.exportEnabled)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition ${
                            l.exportEnabled
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {l.exportEnabled ? 'Export Enabled' : 'Export Disabled'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to Add New Language to Store */}
            <form onSubmit={handleAddLanguage} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 block">
                + Add Supported Language To Store
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Language Code (e.g. nl, ar, hi)</label>
                  <input
                    type="text"
                    required
                    placeholder="nl"
                    value={newLangCode}
                    onChange={(e) => setNewLangCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Platform Locale (Optional)</label>
                  <input
                    type="text"
                    placeholder="nl-NL or nl_NL"
                    value={newPlatformLocale}
                    onChange={(e) => setNewPlatformLocale(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={savingLang || !newLangCode.trim()}
                  className="px-4 py-2 text-xs font-bold bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] rounded-xl transition disabled:opacity-50"
                >
                  {savingLang ? 'Adding...' : '+ Add Store Language'}
                </button>
              </div>
            </form>

            <div className="flex items-center justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setActiveLangStore(null)}
                className="px-5 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
