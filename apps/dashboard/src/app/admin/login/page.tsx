'use client';

import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, AlertCircle, ShieldAlert, Sparkles } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.login(email.trim(), password);

      // Verify that this user is authorized for Platform Admin
      const isSuperAdmin = res?.user?.role === 'super_admin' || res?.user?.role === 'admin' || res?.user?.isSuperadmin;
      if (!isSuperAdmin) {
        throw new Error('Access Denied: This account does not have Platform Administrator permissions.');
      }

      // Hard redirect to Admin Control Center
      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message || 'Invalid administrator email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0d2a2c] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans text-slate-100 selection:bg-amber-400 selection:text-slate-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex w-14 h-14 rounded-xl bg-gradient-to-tr from-amber-400 via-amber-300 to-amber-200 text-slate-950 items-center justify-center font-black text-2xl shadow-xl shadow-black/40 mb-4 border border-amber-300/40">
          <ShieldAlert className="w-8 h-8 text-slate-950" />
        </div>
        <h2 className="text-2xl font-black tracking-tight text-white">Platform Admin Control Center</h2>
        <p className="text-xs text-amber-200/80 mt-1 font-medium tracking-wide">
          Super Administrator Infrastructure &amp; Tenant Operations
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#143d40] py-8 px-6 shadow-2xl border border-teal-800/80 rounded-xl sm:px-10 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-amber-300/90 uppercase tracking-wider mb-1.5">
                Admin Master Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-teal-400/60" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@productintel.internal"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0b2426] border border-teal-700/60 rounded-xl text-xs text-white placeholder-teal-600 focus:outline-none focus:border-amber-400 focus:bg-[#081d1f] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-300/90 uppercase tracking-wider mb-1.5">
                Master Security Key / Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-teal-400/60" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-[#0b2426] border border-teal-700/60 rounded-xl text-xs text-white placeholder-teal-600 focus:outline-none focus:border-amber-400 focus:bg-[#081d1f] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 transition shadow-lg shadow-black/30 disabled:opacity-50 mt-2"
            >
              <span>{loading ? 'Authenticating Admin...' : 'Authenticate Platform Admin'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="text-center pt-3 border-t border-teal-800/60">
            <span className="text-[11px] text-teal-300/70">Looking for Client Workspace? </span>
            <a href="/login" className="text-[11px] text-amber-400 font-bold hover:underline">
              Switch to Client Portal
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

