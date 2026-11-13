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
          if (u.name) setUserName(u.name);
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
      <div className="min-h-screen bg-[#f8f7fa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-teal-700 rounded-full animate-spin"></div>
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
    <div className="flex h-screen bg-[#f8f7fa] text-[#4b465c] font-sans antialiased overflow-hidden select-none">
      {/* 1. VUEXY BORDERED CLEAN WHITE SIDEBAR */}
      <aside className="w-64 flex flex-col bg-white text-[#5d596c] shrink-0 border-r border-[#dbdade] relative z-30">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 gap-3 border-b border-[#dbdade]">
          <div className="w-8 h-8 rounded-xl bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-black text-xs shadow-2xs">
            <span>PI</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm tracking-tight text-[#4b465c]">
              Product Intelligence
            </span>
            <span className="text-[10px] text-teal-800 font-mono tracking-wider uppercase font-bold">
              ENTERPRISE BORDERED
            </span>
          </div>
        </div>

        {/* Active Workspace Selector Card - Vuexy Bordered Style */}
        <div className="px-3.5 py-3">
          <div className="p-2.5 rounded-xl bg-[#f8f7fa] border border-[#dbdade] flex items-center justify-between transition hover:border-[#b8b5c0]">
            <div className="min-w-0 pr-2">
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#a5a3ae]">Active Workspace</div>
              <div className="text-xs font-bold text-[#4b465c] truncate mt-0.5">{workspaceName}</div>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-[9px] font-mono font-bold text-emerald-700 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>LIVE</span>
            </div>
          </div>
        </div>

        {/* Categorized Nav Hierarchy - Vuexy Bordered Menu */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-3 text-[10px] font-bold text-[#a5a3ae] uppercase tracking-wider font-mono">
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
                          ? 'bg-[#0d2a2c] text-white shadow-xs font-bold'
                          : 'text-[#6f6b7d] hover:text-[#4b465c] hover:bg-[#f8f7fa]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 transition-transform ${
                          isActive ? 'text-[#fad982]' : 'text-[#82808b] group-hover:text-[#4b465c]'
                        }`} />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                          isActive
                            ? 'bg-[#194c50] text-[#fad982]'
                            : 'bg-slate-100 text-[#5d596c] border border-[#dbdade]'
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

        {/* Vuexy Tenant Plan Card */}
        {quotaUsage && (
          <div className="px-3.5 py-2.5 border-t border-[#dbdade] bg-[#fafafb]">
            <div className="p-3 rounded-xl bg-white border border-[#dbdade] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#4b465c] truncate">{quotaUsage.planName}</span>
                <Link
                  href="/settings/billing"
                  className="text-[10px] font-bold text-teal-700 hover:underline"
                >
                  Upgrade
                </Link>
              </div>

              {/* Products Quota */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-[#82808b] font-medium">
                  <span>Catalog</span>
                  <span className="font-mono text-[#4b465c] font-semibold">{quotaUsage.productUsed} / {quotaUsage.productLimit}</span>
                </div>
                <div className="w-full bg-[#f8f7fa] h-1.5 rounded-full overflow-hidden border border-[#dbdade]">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      quotaUsage.productPercent > 90 ? 'bg-rose-500' : 'bg-teal-700'
                    }`}
                    style={{ width: `${Math.min(100, quotaUsage.productPercent)}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-[#dbdade] bg-white text-[10px] text-[#a5a3ae] flex items-center justify-between px-4">
          <span className="font-mono font-medium">OCMOD v1.4.0</span>
          <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Sync Ready
          </span>
        </div>
      </aside>

      {/* 2. VUEXY MAIN VIEWPORT WITH FLOATING BORDERED NAVBAR */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8f7fa] relative">
        {/* Floating Topbar (Vuexy Bordered Navbar Standard) */}
        <div className="px-6 pt-4 pb-2 shrink-0 z-20">
          <header className="h-14 bg-white/95 backdrop-blur-md border border-[#dbdade] rounded-xl px-4 flex items-center justify-between shadow-2xs">
            {/* Quick Command Search Trigger */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="relative w-72 md:w-96 text-left group"
            >
              <div className="w-full pl-9 pr-12 py-1.5 bg-[#f8f7fa] hover:bg-[#f1f0f4] border border-[#dbdade] rounded-lg text-xs text-[#82808b] transition flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-[#82808b] group-hover:text-[#4b465c] transition" />
                  <span>Search commands, items (Ctrl+K)...</span>
                </span>
                <kbd className="font-mono text-[10px] text-[#82808b] bg-white border border-[#dbdade] rounded px-1.5 py-0.5 shadow-2xs font-semibold">
                  ⌘K
                </kbd>
              </div>
            </button>

            {/* Action Tools & User Profile */}
            <div className="flex items-center gap-2.5">
              {/* Notification Dropdown */}
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className={`p-2 rounded-lg transition relative border ${
                    notificationsOpen
                      ? 'bg-slate-100 border-[#dbdade] text-[#4b465c]'
                      : 'border-transparent text-[#6f6b7d] hover:text-[#4b465c] hover:bg-[#f8f7fa]'
                  }`}
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full ring-2 ring-white"></span>
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-[#dbdade] py-2.5 z-50 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between px-4 pb-2 border-b border-[#dbdade]">
                      <span className="text-xs font-bold text-[#4b465c]">Notifications</span>
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
                        <span className="text-[10px] text-[#a5a3ae]">All caught up</span>
                      )}
                    </div>
                    <div className="divide-y divide-[#dbdade]/50 max-h-72 overflow-y-auto">
                      {notificationsList.length === 0 ? (
                        <div className="py-6 text-center text-xs text-[#a5a3ae]">
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
                            className={`px-4 py-2.5 hover:bg-[#f8f7fa] transition cursor-pointer ${
                              !notif.isRead ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div
                                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  notif.severity === 'error'
                                    ? 'bg-rose-500'
                                    : notif.severity === 'warning'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                }`}
                              ></div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-[#4b465c] truncate">
                                  {notif.title}
                                </p>
                                <p className="text-[11px] text-[#82808b] line-clamp-2 mt-0.5">
                                  {notif.message}
                                </p>
                                <span className="text-[9px] text-[#a5a3ae] font-mono mt-1 block">
                                  {new Date(notif.createdAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
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

              {/* Documentation Helper */}
              <button
                onClick={() => setHelpModalOpen(true)}
                className="p-2 text-[#6f6b7d] hover:text-[#4b465c] hover:bg-[#f8f7fa] rounded-lg transition"
                title="Documentation & Guides"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <div className="w-[1px] h-6 bg-[#dbdade] mx-1"></div>

              {/* User Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-lg hover:bg-[#f8f7fa] transition"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0d2a2c] text-[#fad982] flex items-center justify-center font-bold text-xs shadow-2xs">
                    {initials}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-bold text-[#4b465c] leading-tight truncate max-w-[110px]">
                      {userName}
                    </span>
                    <span className="text-[10px] text-[#82808b] leading-tight truncate max-w-[110px]">
                      {workspaceName}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#82808b]" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#dbdade] py-1 z-50 animate-in fade-in zoom-in-95">
                    <div className="px-4 py-3 border-b border-[#dbdade]">
                      <p className="text-xs font-bold text-[#4b465c]">{userName}</p>
                      <p className="text-[11px] text-[#82808b] truncate">{userEmail}</p>
                      <div className="mt-1.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#f8f7fa] text-[#5d596c] border border-[#dbdade]">
                          ORGANIZATION ADMIN
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/settings/workspace"
                        className="flex items-center gap-2 px-4 py-2 text-xs text-[#5d596c] hover:bg-[#f8f7fa] hover:text-[#4b465c]"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>Workspace Settings</span>
                      </Link>

                      <Link
                        href="/team"
                        className="flex items-center gap-2 px-4 py-2 text-xs text-[#5d596c] hover:bg-[#f8f7fa] hover:text-[#4b465c]"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Team &amp; Permissions</span>
                      </Link>

                      <Link
                        href="/settings/billing"
                        className="flex items-center gap-2 px-4 py-2 text-xs text-[#5d596c] hover:bg-[#f8f7fa] hover:text-[#4b465c]"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Plan &amp; Quotas</span>
                      </Link>
                    </div>

                    <div className="border-t border-[#dbdade] py-1">
                      <button
                        onClick={() => apiClient.logout()}
                        className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>
        </div>

        {/* Scrollable Viewport Content */}
        <main className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </main>
      </div>

      {/* Global Command Center Palette (Cmd+K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
      />

      {/* Help Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#dbdade]">
            <div className="flex items-center justify-between border-b border-[#dbdade] pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-teal-700" />
                <h3 className="font-bold text-sm text-[#4b465c]">System Documentation</h3>
              </div>
              <button
                onClick={() => setHelpModalOpen(false)}
                className="text-[#82808b] hover:text-[#4b465c]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <Link
                href="/stores"
                onClick={() => setHelpModalOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-[#f8f7fa] hover:bg-slate-100 border border-[#dbdade] transition group"
              >
                <div>
                  <p className="font-bold text-[#4b465c]">Connecting E-Commerce Stores</p>
                  <p className="text-[11px] text-[#82808b]">Shopify, WooCommerce, and OpenCart OCMOD extension.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#82808b] group-hover:text-[#4b465c]" />
              </Link>

              <Link
                href="/brands"
                onClick={() => setHelpModalOpen(false)}
                className="flex items-center justify-between p-3 rounded-xl bg-[#f8f7fa] hover:bg-slate-100 border border-[#dbdade] transition group"
              >
                <div>
                  <p className="font-bold text-[#4b465c]">Brand Catalogs &amp; Health Cards</p>
                  <p className="text-[11px] text-[#82808b]">Field mapping, options array analysis, and schema directives.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#82808b] group-hover:text-[#4b465c]" />
              </Link>
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
