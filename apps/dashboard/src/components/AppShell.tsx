'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Boxes,
  Sparkles,
  Search,
  Cpu,
  ShoppingBag,
  RefreshCw,
  Activity,
  BarChart3,
  Users,
  KeyRound,
  Settings,
  ChevronDown,
  Bell,
  HelpCircle,
  LogOut,
  Layers,
  Award,
  User,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  X,
  Lock,
  ArrowRight
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const MAIN_NAV_ITEMS = [
  { name: 'Overview', href: '/', icon: Home },
  { name: 'Products', href: '/products', icon: Boxes },
  { name: 'Product Intelligence', href: '/intelligence', icon: Sparkles },
  { name: 'Brand Profiles', href: '/brands', icon: Award },
  { name: 'AI Enrichment', href: '/settings/ai', icon: Cpu, badge: 'AI' },
  { name: 'Connected Stores', href: '/stores', icon: ShoppingBag },
  { name: 'Sync & Integration', href: '/sync', icon: RefreshCw },
  { name: 'Jobs & Queues', href: '/jobs', icon: Activity },
  { name: 'Reports & Analytics', href: '/health', icon: BarChart3 },
];

const SECONDARY_NAV_ITEMS = [
  { name: 'Plan & Billing', href: '/settings/billing', icon: KeyRound },
  { name: 'Team & Permissions', href: '/team', icon: Users },
  { name: 'Integrations & API', href: '/settings/integrations', icon: KeyRound, badge: 'v1' },
  { name: 'Settings', href: '/settings/workspace', icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password';
  const isAdminPage = pathname.startsWith('/admin');

  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  // Interactive UI Dropdowns / Modals
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // If browsing an Admin page, AppShell must NOT handle authentication or redirects;
      // AdminLayout has its own dedicated admin auth guard and /admin/login redirect.
      if (isAdminPage) {
        setAuthChecked(true);
        return;
      }

      const token = localStorage.getItem('saas_token');

      // Mandatory Auth Check for Client Portal: Redirect unauthenticated user to /login
      if (!token && !isAuthPage) {
        window.location.href = '/login';
        return;
      }

      const storedUser = localStorage.getItem('saas_current_user');
      if (storedUser) {
        try {
          const u = JSON.parse(storedUser);
          if (u.fullName) setUserName(u.fullName);
          if (u.email) setUserEmail(u.email);
          if (u.organizationName) setWorkspaceName(u.organizationName);
        } catch (_) {}
      }

      const storedOrg = localStorage.getItem('saas_current_org_name');
      if (storedOrg) setWorkspaceName(storedOrg);

      if (!isAuthPage) {
        apiClient.getClientWorkspace().then((ws) => {
          if (ws?.organization?.name) {
            setWorkspaceName(ws.organization.name);
            localStorage.setItem('saas_current_org_name', ws.organization.name);
          }
        }).catch(() => {});
      }

      setAuthChecked(true);
    }
  }, [pathname, isAuthPage, isAdminPage]);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdowns when route changes
  useEffect(() => {
    setProfileDropdownOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  // If unauthenticated on a protected page, render nothing while redirecting to /login
  if (!authChecked && !isAuthPage && !isAdminPage) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthPage || isAdminPage) {
    return <>{children}</>;
  }

  // Generate dynamic initials for the user (e.g. "JD" for "John Doe")
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'MC';

  return (
    <div className="flex h-screen bg-[#f4f7f6] text-slate-800 font-sans antialiased overflow-hidden select-none">
      {/* Dark Teal Sidebar matching brand identity */}
      <aside className="w-64 flex flex-col bg-[#0d2a2c] text-white shrink-0">
        {/* Brand Header */}
        <div className="h-20 flex items-center px-5 gap-3 border-b border-[#143d40]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-400 to-amber-200 text-slate-900 flex items-center justify-center font-black text-sm shadow-md">
            <span className="tracking-tighter">AI</span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm tracking-tight text-white leading-tight">Product Intelligence AI</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[9px] text-amber-400/90 font-mono tracking-widest uppercase font-semibold">ENTERPRISE SAAS</span>
              <span className="text-[8px] bg-amber-400/20 text-amber-300 px-1 py-0.2 rounded font-mono font-bold">STAGING</span>
            </div>
          </div>
        </div>

        {/* Workspace Selector */}
        <div className="px-4 py-3">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5 px-1">Workspace</div>
          <button className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg bg-[#143d40] text-slate-100 hover:bg-[#194c50] transition shadow-inner">
            <span className="truncate">{workspaceName}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {MAIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#fad982] text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-[#143d40]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                    isActive ? 'bg-slate-950 text-[#fad982]' : 'bg-[#194c50] text-amber-300'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-4 pb-2">
            <div className="h-px bg-[#143d40] mx-2" />
          </div>

          {/* Secondary Navigation - Exact Independent Routes */}
          {SECONDARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-[#fad982] text-slate-950 font-bold shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-[#143d40]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f7f6]">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0 shadow-sm z-20">
          {/* Search Bar */}
          <div className="relative w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products, brands, GTIN/EAN or jobs..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
            />
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-4">
            {/* Notification Bell with Dropdown Popover */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`p-2 rounded-full transition relative ${
                  notificationsOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full ring-2 ring-white"></span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      2 New
                    </span>
                  </div>
                  <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
                    <div className="px-4 py-3 hover:bg-slate-50 transition cursor-pointer">
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Workspace Ready</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {workspaceName} is set up with multi-tenant isolation.
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">Just now</span>
                        </div>
                      </div>
                    </div>
                    <div className="px-4 py-3 hover:bg-slate-50 transition cursor-pointer">
                      <div className="flex items-start gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                        <div>
                          <p className="text-xs font-semibold text-slate-900">Connect Your First Store</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Connect OpenCart, Shopify, or WooCommerce to start catalog sync.
                          </p>
                          <span className="text-[10px] text-slate-400 mt-1 block">1 hour ago</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 px-4 border-t border-slate-100 text-center">
                    <Link
                      href="/health"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[11px] font-bold text-[#0d2a2c] hover:underline"
                    >
                      View All Activity
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Help / Documentation Modal Button */}
            <button
              onClick={() => setHelpModalOpen(true)}
              className="p-2 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
              title="Help & Documentation"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-slate-200"></div>

            {/* User Profile Pill with Interactive Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100 transition text-left group"
              >
                <div className="w-8 h-8 rounded-full bg-[#fad982] text-slate-950 font-bold text-xs flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  {initials}
                </div>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-xs font-bold text-slate-900">{userName}</span>
                  <span className="text-[10px] text-slate-500 mt-1 truncate max-w-[130px] font-medium">{workspaceName}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 transition ml-0.5" />
              </button>

              {/* Profile Dropdown Menu */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-fadeIn divide-y divide-slate-100">
                  <div className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-900">{userName}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{userEmail}</p>
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fad982]/40 text-amber-900 border border-amber-200">
                      <span>{workspaceName}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/admin"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-purple-700 hover:bg-purple-50 font-bold transition"
                    >
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      <span>Platform Admin Portal</span>
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#0d2a2c] font-semibold transition"
                    >
                      <User className="w-4 h-4 text-slate-400" />
                      <span>Show Profile</span>
                    </Link>
                    <Link
                      href="/settings/workspace"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#0d2a2c] font-semibold transition"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Workspace Settings</span>
                    </Link>
                    <Link
                      href="/forgot-password"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 hover:text-[#0d2a2c] font-semibold transition"
                    >
                      <Lock className="w-4 h-4 text-slate-400" />
                      <span>Forgot / Reset Password</span>
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

        {/* Scrollable Body */}
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 bg-[#f4f7f6]">
          <div className="w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Help & Support Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#0d2a2c]" />
                <h3 className="font-bold text-sm text-slate-900">Client Help & Support</h3>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>Welcome to <strong>Product Intelligence AI</strong>. Here are quick shortcuts to guide you:</p>
              <div className="space-y-2">
                <Link
                  href="/stores"
                  onClick={() => setHelpModalOpen(false)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#fad982]/20 border border-slate-200 hover:border-amber-300 transition group"
                >
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-amber-950">Connecting Your Store</p>
                    <p className="text-[11px] text-slate-500">Configure OpenCart, Shopify, or WooCommerce store credentials.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
                </Link>

                <Link
                  href="/brands"
                  onClick={() => setHelpModalOpen(false)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#fad982]/20 border border-slate-200 hover:border-amber-300 transition group"
                >
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-amber-950">Managing Brand Profiles</p>
                    <p className="text-[11px] text-slate-500">Create brand catalogs and link intelligence rules.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
                </Link>

                <Link
                  href="/settings"
                  onClick={() => setHelpModalOpen(false)}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-[#fad982]/20 border border-slate-200 hover:border-amber-300 transition group"
                >
                  <div>
                    <p className="font-bold text-slate-900 group-hover:text-amber-950">API Keys & Ingestion</p>
                    <p className="text-[11px] text-slate-500">Generate tenant tokens to ingest products directly via REST API.</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
                </Link>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setHelpModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0d2a2c] text-white hover:bg-[#143d40] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
