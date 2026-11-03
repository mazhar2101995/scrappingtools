'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Tag,
  ArrowUpDown,
  Layers,
} from 'lucide-react';

const SAMPLE_PRODUCTS = [
  {
    id: 'prod-001',
    canonicalTitle: 'Traxxas Slash 4X4 VXL 1/10 Scale 4WD Short Course Truck',
    brand: 'Traxxas',
    modelNumber: '68086-4',
    eanGtin: '0020334680864',
    status: 'verified',
    sourcesCount: 3,
    variantsCount: 4,
    lastScrapedAt: '10 mins ago',
    priceEstimate: '$429.95',
    category: 'RC Vehicles / Electric Trucks',
  },
  {
    id: 'prod-002',
    canonicalTitle: 'Xray X4 2024 Luxury 1/10 Electric Touring Car Kit - Carbon Chassis',
    brand: 'Xray',
    modelNumber: '300034',
    eanGtin: '8581703000342',
    status: 'verified',
    sourcesCount: 2,
    variantsCount: 2,
    lastScrapedAt: '1 hour ago',
    priceEstimate: '€749.00',
    category: 'Competition Kits / Touring',
  },
  {
    id: 'prod-003',
    canonicalTitle: 'Bittydesign HYPER-HR 190mm Clear Body Lightweight for 1/10 TC',
    brand: 'Bittydesign',
    modelNumber: 'BD-HYP-HR',
    eanGtin: '0714833215509',
    status: 'verified',
    sourcesCount: 2,
    variantsCount: 1,
    lastScrapedAt: '3 hours ago',
    priceEstimate: '€32.90',
    category: 'RC Bodies / Aerodynamics',
  },
  {
    id: 'prod-004',
    canonicalTitle: 'Traxxas TRX-4 1979 Chevrolet Blazer High Trail Edition 4WD Scale Crawler',
    brand: 'Traxxas',
    modelNumber: '82076-4',
    eanGtin: '0020334820765',
    status: 'verified',
    sourcesCount: 4,
    variantsCount: 3,
    lastScrapedAt: 'Yesterday',
    priceEstimate: '$549.95',
    category: 'Scale Trail Crawlers',
  },
  {
    id: 'prod-005',
    canonicalTitle: 'Xray XB2D 2024 1/10 2WD Buggy Dirt Edition Competition Kit',
    brand: 'Xray',
    modelNumber: '320015',
    eanGtin: '8581703200155',
    status: 'verified',
    sourcesCount: 1,
    variantsCount: 1,
    lastScrapedAt: '2 days ago',
    priceEstimate: '€499.00',
    category: 'Competition Buggy / 2WD',
  },
];

export default function ProductsPage() {
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('ALL');

  const filteredProducts = SAMPLE_PRODUCTS.filter((prod) => {
    const matchesBrand = selectedBrand === 'ALL' || prod.brand.toUpperCase() === selectedBrand;
    const matchesSearch =
      prod.canonicalTitle.toLowerCase().includes(search.toLowerCase()) ||
      (prod.eanGtin && prod.eanGtin.includes(search)) ||
      (prod.modelNumber && prod.modelNumber.toLowerCase().includes(search.toLowerCase()));
    return matchesBrand && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Global Product Catalog</h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse normalized catalog entries, verified EAN/GTINs, provenance audits, and tenant overrides.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            Total Entities: <strong className="text-white font-mono">{SAMPLE_PRODUCTS.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[#0e1626] p-4 rounded-xl border border-slate-800">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Title, GTIN/EAN, or MPN..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {['ALL', 'TRAXXAS', 'XRAY', 'BITTYDESIGN'].map((brand) => (
            <button
              key={brand}
              onClick={() => setSelectedBrand(brand)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition shrink-0 ${
                selectedBrand === brand
                  ? 'bg-sky-500 text-slate-950 font-semibold'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {brand}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-[#0e1626] border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">Brand</th>
                <th className="py-3 px-4">Identifiers</th>
                <th className="py-3 px-4">Sources / Variants</th>
                <th className="py-3 px-4">Price Est.</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-4 px-4 max-w-md">
                    <div className="font-semibold text-slate-100 text-sm line-clamp-1">{p.canonicalTitle}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{p.category}</div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {p.brand}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono text-[11px]">
                    {p.eanGtin && <div>EAN: {p.eanGtin}</div>}
                    {p.modelNumber && <div className="text-slate-400">MPN: {p.modelNumber}</div>}
                  </td>
                  <td className="py-4 px-4">
                    <div className="text-slate-200">{p.sourcesCount} domains</div>
                    <div className="text-[11px] text-slate-400">{p.variantsCount} variants</div>
                  </td>
                  <td className="py-4 px-4 font-semibold text-slate-100">
                    {p.priceEstimate}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <Link
                      href={`/products/${p.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-750 text-slate-200 hover:border-sky-500 hover:text-sky-400 transition"
                    >
                      <span>Inspect</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

