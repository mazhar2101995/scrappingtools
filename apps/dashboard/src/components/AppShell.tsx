'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  Layers,
  Wrench,
  Activity,
  ShoppingBag,
  KeyRound,
  ShieldCheck,
  ChevronDown,
  Bell,
  Search,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Product Catalog', href: '/products', icon: Boxes },
  { name: 'Connected Stores', href: '/stores', icon: ShoppingBag },
  { name: 'Brand Intelligence', href: '/brands', icon: Layers },
  { name: 'Scraping Studio', href: '/studio', icon: Wrench },
  { name: 'Job Pipelines', href: '/jobs', icon: Activity },
  { name: 'API & Security', href: '/settings', icon: KeyRound },
  { name: 'System Health', href: '/health', icon: ShieldCheck },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [selectedTenant, setSelectedTenant] = useState('Acme Corp (Primary)');

  return (
    <div className="flex h-screen bg-[#0b0f19] text-slate-100 font-sans antialiased overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-slate-800 bg-[#0d1322] select-none">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80 gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20">
            AI
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-white">Product Intel</span>
            <span className="text-[10px] text-sky-400 font-mono tracking-wider uppercase font-semibold">Enterprise SaaS</span>
          </div>
        </div>

        {/* Tenant Selector Dropdown */}
        <div className="px-4 py-3 border-b border-slate-800/60">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 px-2">Active Workspace</div>
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg bg-slate-900/90 border border-slate-750 text-slate-200 hover:border-slate-600 transition shadow-sm">
            <span className="truncate">{selectedTenant}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-1" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Status Pill in Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/30">
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 font-medium">Cluster Active</span>
            </div>
            <span className="text-slate-500 font-mono">v1.0.0</span>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 border-b border-slate-800 bg-[#0d1322]/80 backdrop-blur px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 w-96">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search products, brands, GTIN/EAN or jobs..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-900/90 border border-slate-750 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition shadow-inner"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-sky-500 rounded-full ring-2 ring-slate-900"></span>
            </button>

            <div className="h-4 w-px bg-slate-800"></div>

            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-300">
                JD
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-medium text-slate-200 leading-none">John Doe</span>
                <span className="text-[10px] text-slate-500 leading-none mt-1">Tenant Admin</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Route Body */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#0b0f19]">
          {children}
        </main>
      </div>
    </div>
  );
}

