'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldAlert,
  Building2,
  Cpu,
  Layers,
  Activity,
  Server,
  Database,
  Radio,
  ExternalLink,
  ChevronDown,
  ArrowLeft,
  Bell,
  HelpCircle,
  LogOut,
  User,
  Settings,
  Sparkles,
  BarChart3,
  RefreshCw,
  Search
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const ADMIN_NAV_ITEMS = [
  { name: 'Control Center', href: '/admin', icon: Activity },
  { name: 'Tenants & Organizations', href: '/admin/organizations', icon: Building2 },
  { name: 'AI Prompts & Costs', href: '/admin/ai', icon: Cpu },
  { name: 'Identity Review Queue', href: '/admin/review', icon: ShieldAlert },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [adminName, setAdminName] = useState('Platform Super Admin');
  const [adminEmail, setAdminEmail] = useState('admin@platform.internal');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('saas_current_user');
      if (stored) {
        try {
          const u = JSON.parse(stored);
          if (u.fullName) setAdminName(u.fullName);
          if (u.email) setAdminEmail(u.email);
        } catch (_) {}
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = adminName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'SA';

  return (
    <div className="flex h-screen bg-[#070b12] text-slate-100 font-sans antialiased overflow-hidden select-none">
      {/* Platform Admin Dedicated Sidebar */}
      <aside className="w-64 flex flex-col bg-[#0b0f19] text-white shrink-0 border-r border-slate-800/80">
        {/* Admin Header with Platform Shield Badge */}
        <div className="h-20 flex items-center px-5 gap-3 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-purple-500/20">
            <span>PA</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white leading-tight">Platform Admin</span>
            <span className="text-[10px] text-purple-400 font-mono tracking-widest uppercase font-semibold">ROOT CONTROL</span>
          </div>
        </div>

        {/* Switch Back to Client Portal Button */}
        <div className="px-4 py-3">
          <Link
            href="/"
            className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition group shadow-sm"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Client Portal</span>
            </div>
            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400">Exit</span>
          </Link>
        </div>

        {/* Admin Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1.5 font-mono">
            Platform Infrastructure
          </div>

          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}

          <div className="pt-6 pb-2">
            <div className="h-px bg-slate-800/80 mx-2" />
          </div>

          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-3 py-1.5 font-mono">
            Client Subsystems
          </div>

          <Link
            href="/jobs"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 transition"
          >
            <Activity className="w-4 h-4 text-slate-500" />
            <span>BullMQ Engine</span>
          </Link>
          <Link
            href="/health"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 transition"
          >
            <BarChart3 className="w-4 h-4 text-slate-500" />
            <span>Telemetry & Logs</span>
          </Link>
          <Link
            href="/stores"
            className="flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-850/60 transition"
          >
            <RefreshCw className="w-4 h-4 text-slate-500" />
            <span>Store Connectors</span>
          </Link>
        </nav>

        {/* Admin Footer Status */}
        <div className="p-4 border-t border-slate-800/80 bg-[#080c14]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">Environment</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">
              Production
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Postgres 16 • Redis 7 • Node v20</div>
        </div>
      </aside>

      {/* Admin Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#070b12]">
        {/* Admin Top Header */}
        <header className="h-16 bg-[#0b0f19] border-b border-slate-800/80 px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase tracking-wider font-mono">
              ROOT ADMIN
            </span>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Global Platform Control & Multi-Tenant Orchestration
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Switch to Client Portal */}
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Switch to Client Portal</span>
            </Link>

            <div className="h-5 w-px bg-slate-800" />

            {/* Admin User Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-800/60 transition text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-md">
                  {initials}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-white">{adminName}</span>
                  <span className="text-[10px] text-purple-400 mt-1 font-mono">Super Admin</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition ml-0.5" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-[#0e1422] rounded-2xl shadow-2xl border border-slate-800 py-2 z-50 divide-y divide-slate-800/80 animate-fadeIn">
                  <div className="px-4 py-3">
                    <p className="text-xs font-bold text-white">{adminName}</p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{adminEmail}</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase">
                      Platform Super Admin
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white font-semibold transition"
                    >
                      <ArrowLeft className="w-4 h-4 text-amber-400" />
                      <span>Client Dashboard</span>
                    </Link>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => apiClient.logout()}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-400 hover:bg-rose-500/10 font-bold transition text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Body */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#070b12] text-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
}
