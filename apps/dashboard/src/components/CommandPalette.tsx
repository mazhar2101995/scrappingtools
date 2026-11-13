'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Boxes,
  Crosshair,
  KeyRound,
  FileSpreadsheet,
  Wand2,
  Store,
  DollarSign,
  ShieldCheck,
  CreditCard,
  Users,
  Settings,
  ArrowRight,
  Sparkles,
  Command,
  X
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Navigation' | 'Actions' | 'Products';
  href?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string }>;
}

export default function CommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      // Pre-fetch small product sample for fast search
      apiClient.getProducts({ limit: 10 }).then((res) => {
        setProducts(res?.products || res?.data || []);
      }).catch(() => {});
    }
  }, [isOpen]);

  // Global static navigation items
  const staticItems: CommandItem[] = [
    {
      id: 'nav-products',
      title: 'Products Catalog',
      subtitle: 'Browse, manage, and edit normalized catalog items',
      category: 'Navigation',
      href: '/products',
      icon: Boxes,
    },
    {
      id: 'nav-competitors',
      title: 'Competitor Price Spy',
      subtitle: 'Real-time rival price tracking & dynamic auto-undercut engine',
      category: 'Navigation',
      href: '/settings/competitors',
      icon: Crosshair,
    },
    {
      id: 'nav-suppliers',
      title: 'Supplier Feeds & B2B Vault',
      subtitle: 'FTP/SFTP, Google Sheets, CSV feeds & dealer logins',
      category: 'Navigation',
      href: '/settings/suppliers',
      icon: FileSpreadsheet,
    },
    {
      id: 'nav-image-studio',
      title: 'AI Product Image Studio',
      subtitle: 'Remove dirty backgrounds & scrub supplier watermarks',
      category: 'Navigation',
      href: '/settings/image-studio',
      icon: Wand2,
    },
    {
      id: 'nav-pricing',
      title: 'Pricing & Margin Rules',
      subtitle: 'Configure automated markups and margin floor protection',
      category: 'Navigation',
      href: '/settings/pricing',
      icon: DollarSign,
    },
    {
      id: 'nav-proxies',
      title: 'Residential Proxy & Anti-Bot Pool',
      subtitle: 'Manage proxy rotation and browser fingerprint spoofing',
      category: 'Navigation',
      href: '/settings/proxies',
      icon: ShieldCheck,
    },
    {
      id: 'nav-stores',
      title: 'Connected Stores (OpenCart / Shopify)',
      subtitle: 'Manage live store integrations and distribution feeds',
      category: 'Navigation',
      href: '/stores',
      icon: Store,
    },
    {
      id: 'nav-team',
      title: 'Team & RBAC Access',
      subtitle: 'Invite team members and manage role permissions',
      category: 'Navigation',
      href: '/team',
      icon: Users,
    },
  ];

  // Dynamic items including matched products
  const productItems: CommandItem[] = products.map((p) => ({
    id: `prod-${p.id}`,
    title: p.canonicalTitle,
    subtitle: `SKU: ${p.modelNumber || 'N/A'} • Click to view change plan & export`,
    category: 'Products',
    href: `/products/${p.id}`,
    icon: Boxes,
  }));

  const allItems = [...staticItems, ...productItems];

  const filteredItems = allItems.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  const handleSelect = (item: CommandItem) => {
    onClose();
    if (item.action) {
      item.action();
    } else if (item.href) {
      router.push(item.href);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-start justify-center pt-20 p-4 animate-in fade-in duration-150">
      <div
        className="bg-white border border-slate-200/90 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[580px] animate-in zoom-in-95 duration-150 text-slate-800"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-teal-700 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search commands, pages, tools, or products (Type to filter)..."
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none font-medium"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-400 shadow-2xs">
              ESC to exit
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-slate-100">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Command className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No matching commands or products</p>
              <p className="text-[11px] text-slate-400">Try searching for &quot;competitor&quot;, &quot;feed&quot;, or &quot;image&quot;</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`p-3 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition ${
                    isSelected ? 'bg-amber-50/80 border-l-4 border-[#fad982] shadow-2xs' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        isSelected
                          ? 'bg-[#fad982] text-slate-950 border-amber-300'
                          : 'bg-slate-100 text-slate-600 border-slate-200/80'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate">{item.title}</span>
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold border border-slate-200">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 text-slate-400">
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-teal-700 animate-pulse" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] shadow-2xs font-mono">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] shadow-2xs font-mono">
                ↓
              </kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 text-[10px] shadow-2xs font-mono">
                ↵
              </kbd>
              <span>to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1 text-teal-800 font-semibold font-mono text-[10px]">
            <Sparkles className="w-3 h-3 text-[#fad982]" />
            <span>ENTERPRISE COMMAND CENTER</span>
          </span>
        </div>
      </div>
    </div>
  );
}
