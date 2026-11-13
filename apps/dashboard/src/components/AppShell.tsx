'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  Sparkles,
  Search,
  Cpu,
  Store,
  FolderSync,
  Activity,
  BarChart3,
  CreditCard,
  Users,
  Settings,
  ChevronDown,
  Bell,
  HelpCircle,
  LogOut,
  Award,
  User,
  ShieldCheck,
  CheckCircle2,
  X,
  ArrowRight,
  ChevronRight,
  Layers,
  DollarSign,
  Crosshair,
  KeyRound,
  Wand2
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import CommandPalette from './CommandPalette';

interface NavSection {
  title: string;
  items: {
    name: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Catalog Core',
    items: [
      { name: 'Overview', href: '/', icon: LayoutDashboard },
      { name: 'Products', href: '/products', icon: Boxes },
      { name: 'Intelligence Engine', href: '/intelligence', icon: Sparkles },
      { name: 'Brand Profiles', href: '/brands', icon: Award },
    ],
  },
  {
    title: 'Distribution Channels',
    items: [
      { name: 'Connected Stores', href: '/stores', icon: Store },
      { name: 'Sync & Integration', href: '/sync', icon: FolderSync },
      { name: 'Pricing & Margins', href: '/settings/pricing', icon: DollarSign },
      { name: 'Competitor Price Spy', href: '/settings/competitors', icon: Crosshair },
      { name: 'AI Normalization', href: '/settings/ai', icon: Cpu, badge: 'AI' },
    ],
  },
  {
    title: 'Operations & Telemetry',
    items: [
      { name: 'Proxy & Anti-Bot', href: '/settings/proxies', icon: ShieldCheck },
      { name: 'Supplier Accounts', href: '/settings/suppliers', icon: KeyRound, badge: 'B2B' },
      { name: 'Image Studio', href: '/settings/image-studio', icon: Wand2, badge: 'AI' },
      { name: 'Background Jobs', href: '/jobs', icon: Activity },
      { name: 'System Analytics', href: '/health', icon: BarChart3 },
    ],
  },
  {
    title: 'Organization',
    items: [
      { name: 'Plan & Billing', href: '/settings/billing', icon: CreditCard },
      { name: 'Team & Permissions', href: '/team', icon: Users },
      { name: 'Workspace Settings', href: '/settings/workspace', icon: Settings },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/forgot-password' || pathname === '/reset-password';
  const isAdminPage = pathname.startsWith('/admin');

  const [workspaceName, setWorkspaceName] = useState('Workspace');
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');
  const [authChecked, setAuthChecked] = useState(false);

  // Dropdown states
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState<any[]>([]);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quotaUsage, setQuotaUsage] = useState<{
    planName: string;
    productUsed: number;
    productLimit: number;
    productPercent: number;
    storeUsed: number;
    storeLimit: number;
    storePercent: number;
  } | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isAdminPage) {
        setAuthChecked(true);
        return;
      }

      const token = localStorage.getItem('saas_token');
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

        // Load billing quotas for bottom sidebar indicator
        apiClient.getMySubscription().then((sub) => {
          if (sub?.usage) {
            setQuotaUsage({
              planName: sub.plan?.name || 'Starter Plan',
              productUsed: sub.usage.products?.used || 0,
              productLimit: sub.usage.products?.limit || 500,
              productPercent: sub.usage.products?.percentage || 0,
              storeUsed: sub.usage.stores?.used || 0,
              storeLimit: sub.usage.stores?.limit || 1,
              storePercent: sub.usage.stores?.percentage || 0,
            });
          }
        }).catch(() => {});
        // Load real-time notifications
        apiClient.getNotifications().then((res) => {
          if (res?.notifications) {
            setNotificationsList(res.notifications);
          }
        }).catch(() => {});
      }

      setAuthChecked(true);
    }
  }, [pathname, isAuthPage, isAdminPage]);

  // Click outside to close
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

  useEffect(() => {
    setProfileDropdownOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  // Global Keyboard Listener for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!authChecked && !isAuthPage && !isAdminPage) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isAuthPage || isAdminPage) {
    return <>{children}</>;
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'SA';

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased overflow-hidden select-none">
      {/* 1. Left Premium Dark Sidebar with Subtle Depth & MagicUI Pattern */}
      <aside className="w-64 flex flex-col bg-[#0d2a2c] text-white shrink-0 border-r border-[#143d40] shadow-glow-teal relative z-30">
        {/* MagicUI Subtle Dot Pattern Overlay */}
        <div className="absolute inset-0 bg-dot-pattern-dark pointer-events-none opacity-40"></div>

        {/* Brand Identity Header */}
        <div className="h-16 flex items-center px-5 gap-3 border-b border-[#143d40]/80 relative z-10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#fad982] to-amber-200 text-[#0d2a2c] flex items-center justify-center font-black text-xs shadow-glow-gold">
            <span>PI</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs tracking-tight text-white flex items-center gap-1.5">
              <span>Product Intelligence</span>
            </span>
            <span className="text-[10px] text-[#fad982]/90 font-mono tracking-widest uppercase font-semibold">
              ENTERPRISE PLATFORM
            </span>
          </div>
        </div>

        {/* Active Workspace Selector Card */}
        <div className="px-3.5 py-3 relative z-10">
          <div className="p-2.5 rounded-xl bg-[#143d40]/80 border border-[#1d575c] shadow-subtle flex items-center justify-between transition hover:border-[#277177]">
            <div className="min-w-0 pr-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-teal-300/80">Active Workspace</div>
              <div className="text-xs font-bold text-slate-100 truncate mt-0.5">{workspaceName}</div>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[9px] font-mono text-emerald-300 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE</span>
            </div>
          </div>
        </div>

        {/* Categorized Nav Hierarchy */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto relative z-10">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold text-teal-300/60 uppercase tracking-widest font-mono">
                {section.title}
              </div>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`group flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#fad982] text-slate-950 font-bold shadow-md shadow-amber-900/20'
                          : 'text-slate-300 hover:text-white hover:bg-[#143d40]/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                          isActive ? 'text-slate-950' : 'text-teal-300/80'
                        }`} />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                          isActive ? 'bg-slate-950 text-[#fad982]' : 'bg-[#194c50] text-[#fad982] border border-[#277177]'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Dynamic Tenant Plan & Quota Guardrail Mini Widget */}
        {quotaUsage && (
          <div className="px-3.5 py-2.5 relative z-10 border-t border-[#143d40]/80 bg-[#0a2022]/60">
            <div className="p-3 rounded-xl bg-[#143d40]/70 border border-[#1d575c] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-200 truncate">{quotaUsage.planName}</span>
                <Link
                  href="/settings/billing"
                  className="text-[9px] font-bold text-[#fad982] hover:underline"
                >
                  Upgrade
                </Link>
              </div>

              {/* Products Quota */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-teal-200/80 font-medium">
                  <span>Catalog</span>
                  <span className="font-mono">{quotaUsage.productUsed} / {quotaUsage.productLimit}</span>
                </div>
                <div className="w-full bg-[#0d2a2c] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      quotaUsage.productPercent > 90 ? 'bg-rose-500' : 'bg-[#fad982]'
                    }`}
                    style={{ width: `${Math.min(100, quotaUsage.productPercent)}%` }}
                  ></div>
                </div>
              </div>

              {/* Stores Quota */}
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] text-teal-200/80 font-medium">
                  <span>Stores</span>
                  <span className="font-mono">{quotaUsage.storeUsed} / {quotaUsage.storeLimit}</span>
                </div>
                <div className="w-full bg-[#0d2a2c] h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      quotaUsage.storePercent >= 100 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, quotaUsage.storePercent)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#143d40]/80 bg-[#0a2022] text-[10px] text-slate-400 flex items-center justify-between px-4 relative z-10">
          <span className="font-mono text-teal-300/60 font-medium">OCMOD v1.4.0</span>
          <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Sync Active
          </span>
        </div>
      </aside>

      {/* 2. Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc] relative">
        {/* Subtle Top Grid Pattern */}
        <div className="absolute inset-0 bg-grid-pattern pointer-events-none opacity-60"></div>

        {/* Top Header Navigation (Bklit & MagicUI Inspired) */}
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-8 flex items-center justify-between shrink-0 z-20 shadow-subtle">
          {/* Quick Command Search Trigger */}
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="relative w-80 md:w-96 text-left group"
          >
            <div className="w-full pl-9 pr-12 py-1.5 bg-slate-50/80 hover:bg-slate-100/70 border border-slate-200/90 rounded-xl text-xs text-slate-500 transition shadow-2xs flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 transition" />
                <span>Quick search commands, items, feeds...</span>
              </span>
              <kbd className="font-mono text-[10px] text-slate-500 bg-white border border-slate-200/80 rounded-md px-1.5 py-0.5 shadow-2xs font-semibold">
                ⌘K
              </kbd>
            </div>
          </button>

          {/* Action Tools & User Profile */}
          <div className="flex items-center gap-3">
            {/* Notification Dropdown */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`p-2 rounded-xl transition relative border ${
                  notificationsOpen
                    ? 'bg-slate-100 border-slate-300 text-slate-900'
                    : 'border-slate-200/70 text-slate-500 hover:text-slate-900 hover:bg-slate-50 shadow-2xs'
                }`}
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-amber-500 rounded-full ring-2 ring-white"></span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 py-2.5 z-50 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between px-4 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    {notificationsList.filter((n) => !n.isRead).length > 0 ? (
                      <button
                        onClick={async () => {
                          await apiClient.markAllNotificationsAsRead();
                          setNotificationsList((prev) => prev.map((n) => ({ ...n, isRead: true })));
                        }}
                        className="text-[10px] font-bold text-teal-700 hover:underline"
                      >
                        Mark all as read
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400">All caught up</span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                    {notificationsList.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        No recent notifications
                      </div>
                    ) : (
                      notificationsList.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={async () => {
                            if (!notif.isRead) {
                              await apiClient.markNotificationAsRead(notif.id);
                              setNotificationsList((prev) =>
                                prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
                              );
                            }
                            if (notif.actionUrl) {
                              window.location.href = notif.actionUrl;
                            }
                          }}
                          className={`px-4 py-2.5 hover:bg-slate-50 transition cursor-pointer ${
                            !notif.isRead ? 'bg-amber-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                notif.severity === 'error'
                                  ? 'bg-rose-500'
                                  : notif.severity === 'warning'
                                  ? 'bg-amber-500'
                                  : notif.severity === 'success'
                                  ? 'bg-emerald-500'
                                  : 'bg-teal-500'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate">{notif.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                                {notif.message}
                              </p>
                              <span className="text-[9px] text-slate-400 mt-1 block">
                                {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Help / Guide Shortcut */}
            <button
              onClick={() => setHelpModalOpen(true)}
              className="p-2 rounded-xl border border-slate-200/70 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition shadow-2xs"
              title="Help & Guides"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            <div className="h-5 w-px bg-slate-200 mx-0.5"></div>

            {/* User Profile Pill */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100/80 border border-slate-200/80 transition text-left shadow-2xs group"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#fad982] to-amber-200 text-[#0d2a2c] font-black text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  {initials}
                </div>
                <div className="hidden sm:flex flex-col text-left leading-none pr-1">
                  <span className="text-xs font-bold text-slate-900">{userName}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[120px]">{workspaceName}</span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 divide-y divide-slate-100 animate-in fade-in zoom-in-95">
                  <div className="px-4 py-3">
                    <p className="text-xs font-bold text-slate-900">{userName}</p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{userEmail}</p>
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fad982]/40 text-[#0d2a2c] border border-amber-300">
                      <span>{workspaceName}</span>
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href="/admin"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-purple-700 hover:bg-purple-50 font-bold transition"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                      <span>Platform Admin Portal</span>
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition"
                    >
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>Profile</span>
                    </Link>
                    <Link
                      href="/settings/workspace"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-medium transition"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-400" />
                      <span>Workspace Settings</span>
                    </Link>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => apiClient.logout()}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 font-bold transition text-left"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8 relative z-10">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Help Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#0d2a2c]" />
                <h3 className="font-bold text-sm text-slate-900">Documentation &amp; Support</h3>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600">
              <Link
                href="/stores"
                onClick={() => setHelpModalOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200 transition group"
              >
                <div>
                  <p className="font-bold text-slate-900">Connecting E-Commerce Stores</p>
                  <p className="text-[11px] text-slate-500">Shopify, WooCommerce, and OpenCart OCMOD extension.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
              </Link>

              <Link
                href="/brands"
                onClick={() => setHelpModalOpen(false)}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 hover:bg-amber-50/50 border border-slate-200 transition group"
              >
                <div>
                  <p className="font-bold text-slate-900">Brand Catalogs &amp; Health Cards</p>
                  <p className="text-[11px] text-slate-500">Field mapping, options array analysis, and schema directives.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-800" />
              </Link>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setHelpModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#0d2a2c] text-white hover:bg-[#143d40] transition shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Command Center Palette (Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />
    </div>
  );
}
