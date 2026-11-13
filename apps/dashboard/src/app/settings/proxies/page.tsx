'use client';

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  Server,
  Globe,
  CheckCircle2,
  AlertCircle,
  X,
  Activity,
  Zap,
  Lock,
  Wifi,
  WifiOff
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ProxyPoolPage() {
  const [proxies, setProxies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form Fields
  const [proxyName, setProxyName] = useState('');
  const [protocol, setProtocol] = useState('HTTP');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('8080');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('US');

  useEffect(() => {
    loadProxies();
  }, []);

  async function loadProxies() {
    try {
      setLoading(true);
      setErrorMsg('');
      const list = await apiClient.getProxies();
      setProxies(list);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load proxies');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddProxy(e: React.FormEvent) {
    e.preventDefault();
    if (!host.trim() || !port.trim()) {
      alert('Host and port are required');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      await apiClient.addProxy({
        name: proxyName.trim() || `${host}:${port}`,
        protocol,
        host: host.trim(),
        port: parseInt(port, 10),
        username: username.trim() || undefined,
        password: password || undefined,
        countryCode: countryCode.trim() || undefined,
      });

      setSuccessMsg(`Proxy ${host}:${port} added successfully`);
      setShowAddModal(false);
      setHost('');
      setUsername('');
      setPassword('');
      setProxyName('');
      loadProxies();
    } catch (err: any) {
      alert(`Failed to add proxy: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestProxy(id: string) {
    try {
      setTestingId(id);
      const res = await apiClient.testProxy(id);
      if (res.success) {
        alert(`[Ping Success] Proxy is online! Latency: ${res.latencyMs || 0}ms`);
      } else {
        alert(`[Ping Failed] ${res.error || 'Connection timed out'}`);
      }
      loadProxies();
    } catch (err: any) {
      alert(`Test ping failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  }

  async function handleDeleteProxy(id: string, name: string) {
    if (!confirm(`Delete proxy "${name}"?`)) return;
    try {
      await apiClient.deleteProxy(id);
      setSuccessMsg('Proxy deleted from pool');
      loadProxies();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  }

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Anti-Bot Defense &amp; Residential Proxy Pool</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Configure rotating HTTP/HTTPS/SOCKS5 proxies and User-Agent spoofing to bypass supplier rate-limits &amp; Cloudflare blocks.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Proxy Node</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Defense Architecture Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <Shield className="w-4 h-4 text-emerald-600" />
            <span>Dynamic User-Agent Spoofing</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Every scrape &amp; price-check automatically randomizes modern Chrome, Firefox &amp; Safari desktop headers with client hints.
          </p>
          <div className="pt-1 text-[10px] font-mono text-emerald-700 font-bold">STATUS: ACTIVE (5 Browser Profiles)</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <Server className="w-4 h-4 text-blue-600" />
            <span>Rotating Proxy Pool</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Distributes batch scrapers across healthy proxy nodes to prevent IP bans and 429 Too Many Requests errors.
          </p>
          <div className="pt-1 text-[10px] font-mono text-blue-700 font-bold">TOTAL NODES: {proxies.length}</div>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
            <Zap className="w-4 h-4 text-amber-500" />
            <span>Intelligent Failover</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            If a proxy node experiences 5 consecutive failures, the engine automatically flags it as DEGRADED and routes through healthy nodes.
          </p>
          <div className="pt-1 text-[10px] font-mono text-amber-700 font-bold">AUTO-HEALING: ENABLED</div>
        </div>
      </div>

      {/* Proxy List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-[#0d2a2c]" />
            <h2 className="font-bold text-sm text-slate-900">Configured Proxy Nodes ({proxies.length})</h2>
          </div>
          <button
            onClick={loadProxies}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading proxy nodes...</div>
          ) : proxies.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No proxy nodes added yet. Scrapers are currently using direct requests. Click &quot;Add Proxy Node&quot; to configure residential IPs.
            </div>
          ) : (
            proxies.map((p) => (
              <div key={p.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 transition">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{p.name}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                      {p.protocol}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      p.healthStatus === 'HEALTHY'
                        ? 'bg-emerald-100 text-emerald-800'
                        : p.healthStatus === 'DEGRADED'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {p.healthStatus}
                    </span>
                    {p.countryCode && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                        {p.countryCode}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-2">
                    <span>{p.host}:{p.port}</span>
                    {p.username && <span>• User: {p.username}</span>}
                    {p.latencyMs && <span>• Ping: {p.latencyMs}ms</span>}
                    <span>• Success: {p.successCount} / Fails: {p.failCount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={testingId === p.id}
                    onClick={() => handleTestProxy(p.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    <Activity className={`w-3.5 h-3.5 text-emerald-600 ${testingId === p.id ? 'animate-spin' : ''}`} />
                    <span>{testingId === p.id ? 'Testing...' : 'Test Ping'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteProxy(p.id, p.name)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete proxy"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Proxy Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-sm text-slate-900">Add Proxy Node</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddProxy} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Friendly Node Label</label>
                <input
                  type="text"
                  placeholder="e.g. US Residential Node #1"
                  value={proxyName}
                  onChange={(e) => setProxyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Protocol</label>
                  <select
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  >
                    <option value="HTTP">HTTP</option>
                    <option value="HTTPS">HTTPS</option>
                    <option value="SOCKS5">SOCKS5</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Host / IP *</label>
                  <input
                    type="text"
                    required
                    placeholder="198.51.100.25"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Port *</label>
                  <input
                    type="number"
                    required
                    placeholder="8080"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-mono focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Country Code</label>
                  <input
                    type="text"
                    placeholder="US, DE, IN"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username (Optional)</label>
                  <input
                    type="text"
                    placeholder="proxy_user"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password (Optional)</label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Save Proxy Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
