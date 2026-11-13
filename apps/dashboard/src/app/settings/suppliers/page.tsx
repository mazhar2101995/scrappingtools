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
  Sparkles,
  FileSpreadsheet,
  Server,
  UploadCloud,
  Check,
  Play,
  ArrowRight,
  Database,
  Layers,
  ChevronRight
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

interface SupplierFeed {
  id: string;
  feedName: string;
  feedType: 'FTP' | 'SFTP' | 'HTTP_URL' | 'GOOGLE_SHEETS';
  connectionConfig: any;
  columnMapping: { sku: string; price: string; stock?: string; title?: string };
  syncFrequencyHours: number;
  autoPushToStores: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: 'SUCCESS' | 'FAILED' | 'PENDING' | 'RUNNING';
  lastErrorMessage: string | null;
  lastItemsProcessed: number;
  lastItemsUpdated: number;
  createdAt: string;
}

export default function SupplierSessionsAndFeedsPage() {
  const [activeTab, setActiveTab] = useState<'feeds' | 'sessions'>('feeds');

  // Sessions State
  const [sessions, setSessions] = useState<SupplierSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [loggingInId, setLoggingInId] = useState<string | null>(null);

  // Feeds State
  const [feeds, setFeeds] = useState<SupplierFeed[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [feedModalOpen, setFeedModalOpen] = useState(false);
  const [syncingFeedId, setSyncingFeedId] = useState<string | null>(null);

  // Status notification banner
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Supplier Portal Form State
  const [sessionFormData, setSessionFormData] = useState({
    supplierName: '',
    supplierDomain: '',
    loginUrl: '',
    username: '',
    password: '',
    autoRefreshHours: 12,
  });

  // Feed Wizard Form State
  const [feedWizardStep, setFeedWizardStep] = useState<1 | 2>(1);
  const [feedType, setFeedType] = useState<'FTP' | 'SFTP' | 'HTTP_URL' | 'GOOGLE_SHEETS'>('GOOGLE_SHEETS');
  const [feedName, setFeedName] = useState('');
  const [feedConfig, setFeedConfig] = useState<any>({
    url: '',
    host: '',
    port: 21,
    username: '',
    password: '',
    remotePath: '',
    secure: false,
  });
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<{
    fileName: string;
    totalRows: number;
    availableColumns: string[];
    suggestedMapping: any;
    sampleRows: any[];
  } | null>(null);
  const [columnMapping, setColumnMapping] = useState<{
    sku: string;
    price: string;
    stock: string;
    title: string;
  }>({ sku: '', price: '', stock: '', title: '' });
  const [autoPushToStores, setAutoPushToStores] = useState(true);

  // Loaders
  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const data = await apiClient.getSupplierSessions();
      setSessions(data);
    } catch (err: any) {
      console.warn('Failed to load sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadFeeds = async () => {
    try {
      setLoadingFeeds(true);
      const data = await apiClient.getSupplierFeeds();
      setFeeds(data);
    } catch (err: any) {
      console.warn('Failed to load feeds:', err);
    } finally {
      setLoadingFeeds(false);
    }
  };

  useEffect(() => {
    loadSessions();
    loadFeeds();
  }, []);

  // Handlers for Sessions
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.saveSupplierSession(sessionFormData);
      setStatusMessage({
        type: 'success',
        text: `Supplier credentials saved for ${sessionFormData.supplierName}!`,
      });
      setSessionModalOpen(false);
      setSessionFormData({
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

  const handleLoginSessionNow = async (session: SupplierSession) => {
    setLoggingInId(session.id);
    try {
      const res = await apiClient.loginSupplierNow(session.id);
      setStatusMessage({
        type: 'success',
        text: `Logged in to ${session.supplierName}! Locked in ${res.data.cookieCount} session cookies.`,
      });
      loadSessions();
    } catch (err: any) {
      alert(`Login failed: ${err.message}`);
      loadSessions();
    } finally {
      setLoggingInId(null);
    }
  };

  const handleDeleteSession = async (id: string, name: string) => {
    if (!confirm(`Delete credentials for ${name}?`)) return;
    try {
      await apiClient.deleteSupplierSession(id);
      setSessions(prev => prev.filter(s => s.id !== id));
      setStatusMessage({ type: 'success', text: `Credentials for ${name} removed.` });
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  // Handlers for Feeds
  const handlePreviewFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewing(true);
    try {
      const preview = await apiClient.previewSupplierFeed({
        feedType,
        connectionConfig: feedConfig,
      });
      setPreviewData(preview);
      setColumnMapping({
        sku: preview.suggestedMapping.sku || preview.availableColumns[0] || '',
        price: preview.suggestedMapping.price || preview.availableColumns[1] || '',
        stock: preview.suggestedMapping.stock || '',
        title: preview.suggestedMapping.title || '',
      });
      setFeedWizardStep(2);
    } catch (err: any) {
      alert(`Failed to fetch and parse feed: ${err.message}`);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveFeed = async () => {
    if (!columnMapping.sku || !columnMapping.price) {
      alert('Please map at least the SKU/Item# and Price columns.');
      return;
    }

    try {
      await apiClient.createSupplierFeed({
        feedName: feedName || `${feedType} Feed (${new Date().toLocaleDateString()})`,
        feedType,
        connectionConfig: feedConfig,
        columnMapping,
        autoPushToStores,
      });
      setStatusMessage({
        type: 'success',
        text: `Feed '${feedName}' created! Auto-sync activated.`,
      });
      setFeedModalOpen(false);
      setFeedWizardStep(1);
      setPreviewData(null);
      loadFeeds();
    } catch (err: any) {
      alert(`Error saving feed: ${err.message}`);
    }
  };

  const handleSyncFeedNow = async (feed: SupplierFeed) => {
    setSyncingFeedId(feed.id);
    try {
      const res = await apiClient.syncSupplierFeedNow(feed.id);
      setStatusMessage({
        type: 'success',
        text: `Feed synced! Processed ${res.data.processed} products, updated ${res.data.updated} live prices/stock.`,
      });
      loadFeeds();
    } catch (err: any) {
      alert(`Sync error: ${err.message}`);
      loadFeeds();
    } finally {
      setSyncingFeedId(null);
    }
  };

  const handleDeleteFeed = async (id: string, name: string) => {
    if (!confirm(`Delete feed '${name}'? Automatic sync will stop.`)) return;
    try {
      await apiClient.deleteSupplierFeed(id);
      setFeeds(prev => prev.filter(f => f.id !== id));
      setStatusMessage({ type: 'success', text: `Feed '${name}' deleted.` });
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12">
      {/* Header matching App Theme */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-teal-800 font-bold mb-1">
            <Server className="w-3.5 h-3.5 text-teal-700" />
            <span>Hybrid Ingestion &amp; Wholesale Gateway</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <KeyRound className="w-6 h-6 text-teal-700" />
            <span>Supplier Feeds (FTP / Google Sheets / CSV) &amp; Vault</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Ingest live wholesale prices and warehouse inventory from supplier FTP/SFTP servers, Google Sheets, or CSV links, or store dealer portal logins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'feeds' ? (
            <button
              onClick={() => {
                setFeedModalOpen(true);
                setFeedWizardStep(1);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Connect Feed (FTP / Sheet / CSV)</span>
            </button>
          ) : (
            <button
              onClick={() => setSessionModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Supplier Portal Login</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('feeds')}
          className={`pb-3 px-1 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'feeds'
              ? 'border-teal-700 text-teal-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-teal-700" />
          <span>Automated Feeds (FTP / Google Sheets / CSV)</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono text-slate-700 font-semibold border border-slate-200">
            {feeds.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`pb-3 px-1 text-xs font-bold flex items-center gap-2 border-b-2 transition ${
            activeTab === 'sessions'
              ? 'border-teal-700 text-teal-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound className="w-4 h-4 text-teal-700" />
          <span>B2B Portal Logins &amp; Session Cookies</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-mono text-slate-700 font-semibold border border-slate-200">
            {sessions.length}
          </span>
        </button>
      </div>

      {/* TAB 1: FEEDS (FTP / GOOGLE SHEETS / CSV) */}
      {activeTab === 'feeds' && (
        <div className="space-y-6">
          {/* Feature Highlights with crisp card styling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Live Google Sheets Sync</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Paste any shared Google Sheet link. Supplier price edits stream directly into your catalog and push to connected stores.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                <Server className="w-4 h-4 text-amber-600" />
                <span>FTP / SFTP Automated Ingestion</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Automatically connects to supplier servers on schedule and downloads daily Excel (.xlsx) or CSV inventory files.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Smart Auto-Column Mapping</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Visual column detection automatically matches Item #, Wholesale Price, and Quantity without manual data formatting.
              </p>
            </div>
          </div>

          {/* List of Configured Feeds */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-teal-700" />
                  <span>Active Supplier Feed Sources ({feeds.length})</span>
                </h2>
                <span className="text-[11px] text-slate-400">
                  Periodic ingestion automatically synchronizes cost prices and stock across stores.
                </span>
              </div>

              <button
                onClick={loadFeeds}
                disabled={loadingFeeds}
                className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
                title="Refresh Feeds"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFeeds ? 'animate-spin text-teal-600' : ''}`} />
              </button>
            </div>

            {feeds.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
                <p className="font-bold text-slate-700 text-sm">No Supplier Feeds Configured</p>
                <p className="text-xs mt-1 text-slate-400 max-w-md mx-auto">
                  Connect a Google Sheet, FTP server, or CSV URL to ingest wholesale prices automatically.
                </p>
                <button
                  onClick={() => {
                    setFeedModalOpen(true);
                    setFeedWizardStep(1);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Connect First Feed</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {feeds.map((feed) => {
                  const isSyncing = syncingFeedId === feed.id;
                  return (
                    <div
                      key={feed.id}
                      className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900">{feed.feedName}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                            {feed.feedType}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              feed.lastSyncStatus === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : feed.lastSyncStatus === 'FAILED'
                                ? 'bg-rose-100 text-rose-800'
                                : feed.lastSyncStatus === 'RUNNING'
                                ? 'bg-cyan-100 text-cyan-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {feed.lastSyncStatus}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                          <span>
                            Mapped: SKU ➔ <strong className="text-slate-800 font-mono">{feed.columnMapping.sku}</strong> | Price ➔ <strong className="text-slate-800 font-mono">{feed.columnMapping.price}</strong>
                          </span>
                          <span>
                            Processed: <strong className="text-slate-800">{feed.lastItemsProcessed} items</strong>
                          </span>
                          <span>
                            Updated: <strong className="text-emerald-700 font-bold">{feed.lastItemsUpdated} changed</strong>
                          </span>
                          <span>
                            Last Sync: {feed.lastSyncAt ? new Date(feed.lastSyncAt).toLocaleString() : 'Never'}
                          </span>
                        </div>

                        {feed.lastErrorMessage && (
                          <div className="text-[11px] text-rose-600 flex items-center gap-1 font-mono">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {feed.lastErrorMessage}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleSyncFeedNow(feed)}
                          disabled={isSyncing}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition disabled:opacity-50"
                        >
                          <Play className={`w-3 h-3 text-teal-700 ${isSyncing ? 'animate-spin' : ''}`} />
                          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteFeed(feed.id, feed.feedName)}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                          title="Delete Feed"
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
        </div>
      )}

      {/* TAB 2: SESSIONS (PORTAL LOGINS) */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Building className="w-4 h-4 text-teal-700" />
                <span>Configured Wholesale Supplier Logins ({sessions.length})</span>
              </h2>
              <span className="text-[11px] text-slate-400">
                AES-256 encrypted credentials for crawling password-protected dealer stores.
              </span>
            </div>

            <button
              onClick={loadSessions}
              disabled={loadingSessions}
              className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSessions ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <KeyRound className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
              <p className="font-bold text-slate-700 text-sm">No Supplier Accounts Added</p>
              <p className="text-xs mt-1 text-slate-400 max-w-md mx-auto">
                Add your B2B supplier login to capture wholesale pricing and warehouse stock levels behind login screens.
              </p>
              <button
                onClick={() => setSessionModalOpen(true)}
                className="mt-4 px-4 py-2 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Connect Supplier Login</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sessions.map((item) => {
                const isLoggingIn = loggingInId === item.id;
                return (
                  <div
                    key={item.id}
                    className="p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900">{item.supplierName}</span>
                        <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                          <Globe className="w-3 h-3 text-teal-700" />
                          {item.supplierDomain}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            item.lastStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.lastStatus === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.lastStatus}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          Username: <span className="text-slate-800 font-mono font-semibold">{item.username}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Cookie className="w-3.5 h-3.5 text-amber-600" />
                          Session Cookies: <strong className="text-slate-800 font-mono">{item.activeCookiesCount}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Last Login: <span className="text-slate-600">{item.lastLoginAt ? new Date(item.lastLoginAt).toLocaleString() : 'Never'}</span>
                        </span>
                      </div>

                      {item.lastErrorMessage && (
                        <div className="text-[11px] text-rose-600 flex items-center gap-1 font-mono">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          {item.lastErrorMessage}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleLoginSessionNow(item)}
                        disabled={isLoggingIn}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 text-teal-700 ${isLoggingIn ? 'animate-spin' : ''}`} />
                        <span>{isLoggingIn ? 'Logging in...' : 'Test Login'}</span>
                      </button>

                      <a
                        href={item.loginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-700 border border-slate-200 transition"
                        title="Open Login URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      <button
                        onClick={() => handleDeleteSession(item.id, item.supplierName)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
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
      )}

      {/* MODAL: ADD SUPPLIER LOGIN */}
      {sessionModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-scale-in text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">Add B2B Supplier Login</h3>
              </div>
              <button onClick={() => setSessionModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tech Data, Synnex, Ingram Micro"
                  value={sessionFormData.supplierName}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, supplierName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supplier Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. dealer.supplier.com"
                  value={sessionFormData.supplierDomain}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, supplierDomain: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Login URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://dealer.supplier.com/login"
                  value={sessionFormData.loginUrl}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, loginUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username / ID</label>
                  <input
                    type="text"
                    required
                    placeholder="account_910"
                    value={sessionFormData.username}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, username: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={sessionFormData.password}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs shadow-sm transition"
                >
                  Save &amp; Lock In Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FEED WIZARD (FTP / GOOGLE SHEETS / CSV) */}
      {feedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-5 animate-scale-in max-h-[90vh] overflow-y-auto text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Connect Wholesale Feed Source</h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Step {feedWizardStep} of 2: {feedWizardStep === 1 ? 'Connection Settings' : 'Smart Column Mapping'}
                  </p>
                </div>
              </div>
              <button onClick={() => setFeedModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">
                &times;
              </button>
            </div>

            {feedWizardStep === 1 ? (
              <form onSubmit={handlePreviewFeed} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Feed Source Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { type: 'GOOGLE_SHEETS', label: 'Google Sheets', icon: FileSpreadsheet },
                      { type: 'HTTP_URL', label: 'CSV / Excel URL', icon: Globe },
                      { type: 'FTP', label: 'FTP Server', icon: Server },
                      { type: 'SFTP', label: 'SFTP (Secure)', icon: Lock },
                    ].map((item) => {
                      const Icon = item.icon;
                      const active = feedType === item.type;
                      return (
                        <button
                          key={item.type}
                          type="button"
                          onClick={() => setFeedType(item.type as any)}
                          className={`p-3 rounded-xl border text-left flex flex-col items-center justify-center text-center gap-1.5 transition ${
                            active
                              ? 'bg-amber-50/60 border-amber-400 text-slate-900 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className={`w-4 h-4 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
                          <span className="text-xs font-bold">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Feed Name / Supplier</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Westcoast Daily Inventory Sheet"
                    value={feedName}
                    onChange={(e) => setFeedName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                  />
                </div>

                {/* Connection inputs depending on feedType */}
                {feedType === 'GOOGLE_SHEETS' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Google Sheet Link (Shareable)</label>
                    <input
                      type="url"
                      required
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR.../edit#gid=0"
                      value={feedConfig.url}
                      onChange={(e) => setFeedConfig({ ...feedConfig, url: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block font-medium">
                      Ensure the sheet permission is &quot;Anyone with the link can view&quot;. The engine streams live CSV directly.
                    </span>
                  </div>
                )}

                {feedType === 'HTTP_URL' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Direct CSV / Excel URL</label>
                    <input
                      type="url"
                      required
                      placeholder="https://supplier.com/exports/pricing.csv"
                      value={feedConfig.url}
                      onChange={(e) => setFeedConfig({ ...feedConfig, url: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                    />
                  </div>
                )}

                {(feedType === 'FTP' || feedType === 'SFTP') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-700 mb-1">Host / Server</label>
                        <input
                          type="text"
                          required
                          placeholder="ftp.supplier.com"
                          value={feedConfig.host}
                          onChange={(e) => setFeedConfig({ ...feedConfig, host: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Port</label>
                        <input
                          type="number"
                          value={feedConfig.port}
                          onChange={(e) => setFeedConfig({ ...feedConfig, port: parseInt(e.target.value, 10) })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                        <input
                          type="text"
                          required
                          placeholder="ftp_user"
                          value={feedConfig.username}
                          onChange={(e) => setFeedConfig({ ...feedConfig, username: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••••••"
                          value={feedConfig.password}
                          onChange={(e) => setFeedConfig({ ...feedConfig, password: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Remote File Path</label>
                      <input
                        type="text"
                        required
                        placeholder="/feeds/inventory.csv or /pricing/stock.xlsx"
                        value={feedConfig.remotePath}
                        onChange={(e) => setFeedConfig({ ...feedConfig, remotePath: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setFeedModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={previewing}
                    className="px-4 py-2 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {previewing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting &amp; Reading Columns...</span>
                      </>
                    ) : (
                      <>
                        <span>Fetch &amp; Map Columns</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* STEP 2: COLUMN MAPPING & PREVIEW */
              <div className="space-y-5">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Successfully read <strong>{previewData?.fileName}</strong> ({previewData?.totalRows} rows found).
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-emerald-700 font-bold">
                    {previewData?.availableColumns.length} Columns Detected
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      SKU / Model # <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={columnMapping.sku}
                      onChange={(e) => setColumnMapping({ ...columnMapping, sku: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                    >
                      <option value="">Select Column</option>
                      {previewData?.availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">
                      Cost / Wholesale Price <span className="text-rose-600">*</span>
                    </label>
                    <select
                      value={columnMapping.price}
                      onChange={(e) => setColumnMapping({ ...columnMapping, price: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                    >
                      <option value="">Select Column</option>
                      {previewData?.availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Stock / Quantity</label>
                    <select
                      value={columnMapping.stock}
                      onChange={(e) => setColumnMapping({ ...columnMapping, stock: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                    >
                      <option value="">(Optional - None)</option>
                      {previewData?.availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-700 mb-1">Title / Name</label>
                    <select
                      value={columnMapping.title}
                      onChange={(e) => setColumnMapping({ ...columnMapping, title: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
                    >
                      <option value="">(Optional - None)</option>
                      {previewData?.availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Sample Rows Table */}
                <div>
                  <h4 className="text-xs font-bold text-slate-800 mb-2">Sample Feed Rows Preview (First 5 Rows):</h4>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white max-h-48 shadow-2xs">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 text-slate-600 uppercase font-mono text-[9px] border-b border-slate-200">
                        <tr>
                          {previewData?.availableColumns.slice(0, 6).map((c) => (
                            <th key={c} className="p-2 border-r border-slate-200">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewData?.sampleRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            {previewData.availableColumns.slice(0, 6).map((c) => (
                              <td key={c} className="p-2 truncate max-w-[150px] font-mono text-slate-700 border-r border-slate-100">
                                {String(row[c] || '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="autopush"
                    checked={autoPushToStores}
                    onChange={(e) => setAutoPushToStores(e.target.checked)}
                    className="rounded border-slate-300 text-teal-700 focus:ring-0"
                  />
                  <label htmlFor="autopush" className="text-xs font-medium text-slate-700">
                    Automatically push price &amp; inventory changes to connected OpenCart / Shopify stores
                  </label>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setFeedWizardStep(1)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveFeed}
                    className="px-5 py-2.5 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs shadow-sm transition"
                  >
                    Activate Feed &amp; Run Sync
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
