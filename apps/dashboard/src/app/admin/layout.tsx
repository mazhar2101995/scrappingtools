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
  Search,
  Award,
  Boxes
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const ADMIN_PRIMARY_NAV = [
  { name: 'Control Center', href: '/admin', icon: Activity },
  { name: 'Tenants & Clients', href: '/admin/organizations', icon: Building2 },
  { name: 'Global Master Catalog', href: '/admin/products', icon: Boxes },
  { name: 'Global Brand Profiles', href: '/admin/brands', icon: Award },
];

const ADMIN_INTELLIGENCE_NAV = [
  { name: 'AI Prompts & Costs', href: '/admin/ai', icon: Cpu },
  { name: 'Identity Review Queue', href: '/admin/review', icon: ShieldAlert },
];

const ADMIN_SUBSYSTEM_ITEMS = [
  { name: 'BullMQ Engine & Queues', href: '/admin/jobs', icon: Activity },
  { name: 'Telemetry & Cluster Logs', href: '/admin/telemetry', icon: BarChart3 },
  { name: 'Store Connectors & Bridges', href: '/admin/stores', icon: RefreshCw },
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
    <div className="flex h-screen bg-[#f8faf9] text-slate-900 font-sans antialiased overflow-hidden select-none">
      {/* Light Luxury Sidebar (White & Gold) */}
      <aside className="w-64 flex flex-col bg-white text-slate-800 shrink-0 border-r border-[#e8dfc8]/60 shadow-[4px_0_24px_rgba(218,165,32,0.06)]">
        {/* Admin Header with Gold Emblem */}
        <div className="h-20 flex items-center px-5 gap-3 border-b border-[#f1ebd9] bg-gradient-to-b from-[#fdfbf7] to-white">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#d4af37] via-[#f3e5ab] to-[#fad982] text-slate-950 flex items-center justify-center font-black text-sm shadow-md shadow-[#d4af37]/20 border border-[#b89728]/30">
            <span className="tracking-tighter font-serif">PA</span>
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-sm tracking-tight text-slate-900 leading-tight">Platform Admin</span>
            <span className="text-[10px] text-[#9b7b1b] font-mono tracking-widest uppercase font-bold">SUPER ROOT CONTROL</span>
          </div>
        </div>

        {/* Switch Back to Client Portal Pill */}
        <div className="px-4 py-3 bg-[#fdfbf7]/60 border-b border-[#f5efe1]">
          <Link
            href="/"
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl bg-white hover:bg-[#fff9e6] border border-[#e5d8b5] text-slate-700 hover:text-[#7d6110] transition shadow-xs group"
          >
            <div className="flex items-center gap-2">
              <ArrowLeft className="w-3.5 h-3.5 text-[#b89728] group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Client Portal</span>
            </div>
            <span className="text-[10px] bg-[#f7eed4] text-[#846714] px-1.5 py-0.5 rounded font-mono font-semibold">Exit</span>
          </Link>
        </div>

        {/* Admin Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-extrabold text-[#9c823b] uppercase tracking-wider px-3 py-1 font-mono">
            Platform Governance
          </div>

          {ADMIN_PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#fad982] to-[#f4cca1] text-slate-950 font-bold shadow-md shadow-[#fad982]/40 border border-[#e6c167]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-[#faf6eb]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-[#a38c4c]'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}

          <div className="pt-4 pb-2">
            <div className="h-px bg-[#f1ebd9] mx-2" />
          </div>

          <div className="text-[10px] font-extrabold text-[#9c823b] uppercase tracking-wider px-3 py-1 font-mono">
            AI & Identity Control
          </div>

          {ADMIN_INTELLIGENCE_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#fad982] to-[#f4cca1] text-slate-950 font-bold shadow-md shadow-[#fad982]/40 border border-[#e6c167]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-[#faf6eb]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-[#a38c4c]'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}

          <div className="pt-4 pb-2">
            <div className="h-px bg-[#f1ebd9] mx-2" />
          </div>

          <div className="text-[10px] font-extrabold text-[#9c823b] uppercase tracking-wider px-3 py-1 font-mono">
            Engines & Telemetry
          </div>

          {ADMIN_SUBSYSTEM_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-[#fad982] to-[#f4cca1] text-slate-950 font-bold shadow-md shadow-[#fad982]/40 border border-[#e6c167]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-[#faf6eb]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-[#a38c4c]'}`} />
                  <span>{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Admin Footer Status */}
        <div className="p-4 border-t border-[#f1ebd9] bg-[#fcfaf5]">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500 font-medium">Engine Cluster</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-mono">
              Live Active
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono">Postgres 16 • Redis 7 • BullMQ</div>
        </div>
      </aside>

      {/* Admin Main Body */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#faf8f3]">
        {/* Admin Top Header (Crisp White & Subtle Gold Accent) */}
        <header className="h-16 bg-white border-b border-[#ebdcb9] px-8 flex items-center justify-between shrink-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-[#fad982]/40 text-[#7a5e12] border border-[#e8ce8a] uppercase tracking-wider font-mono">
              GLOBAL ROOT
            </span>
            <span className="text-xs text-slate-600 font-medium hidden sm:inline">
              Multi-Tenant Product Intelligence, Cross-Store Data Lake & Telemetry
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Switch Button */}
            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-[#fff9e6] border border-[#e0cf9b] text-[#7a5e12] transition shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Client Workspace</span>
            </Link>

            <div className="h-5 w-px bg-slate-200" />

            {/* Admin User Profile */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#fad982] to-[#e6bd53] text-slate-950 font-black text-xs flex items-center justify-center shadow-xs border border-[#cfab47]">
                  {initials}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-slate-900">{adminName}</span>
                  <span className="text-[10px] text-[#9b7b1b] mt-1 font-mono font-bold">Super Admin</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition ml-0.5" />
              </button>

              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#ebdcb9] py-2 z-50 divide-y divide-slate-100 animate-fadeIn">
                  <div className="px-4 py-3 bg-[#fdfbf7]">
                    <p className="text-xs font-bold text-slate-900">{adminName}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{adminEmail}</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#fad982]/40 text-[#7a5e12] border border-[#e8ce8a] uppercase">
                      Platform Root Operator
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-[#faf6eb] hover:text-[#7a5e12] font-semibold transition"
                    >
                      <ArrowLeft className="w-4 h-4 text-[#a38c4c]" />
                      <span>Switch to Client Dashboard</span>
                    </Link>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => apiClient.logout()}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-50 font-bold transition text-left"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Body with Ivory/Gold Wash */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#faf8f3] text-slate-900">
          {children}
        </main>
      </div>
    </div>
  );
}
