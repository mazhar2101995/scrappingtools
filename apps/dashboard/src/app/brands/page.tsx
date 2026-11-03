'use client';

import React, { useState } from 'react';
import {
  Layers,
  Globe,
  Settings,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
} from 'lucide-react';

const BRANDS = [
  {
    id: 'b-traxxas',
    name: 'Traxxas',
    slug: 'traxxas',
    domain: 'traxxas.com',
    status: 'active',
    productsCount: 842,
    parserType: 'Custom Cascade + Model Compatibility Parser',
    lastScraped: '15 mins ago',
    rulesSummary: 'Extracts full specs, model tables, exploded views, and compatible vehicle IDs.',
  },
  {
    id: 'b-xray',
    name: 'Xray',
    slug: 'xray',
    domain: 'teamxray.com',
    status: 'active',
    productsCount: 295,
    parserType: 'Custom Technical Specifications Table Parser',
    lastScraped: '1 hour ago',
    rulesSummary: 'Scrapes HTML tables, carbon/alu chassis variants, and high-precision tolerances.',
  },
  {
    id: 'b-bittydesign',
    name: 'Bittydesign',
    slug: 'bittydesign',
    domain: 'bittydesign.net',
    status: 'active',
    productsCount: 111,
    parserType: 'Concise Factual Description & Aerodynamics Parser',
    lastScraped: '3 hours ago',
    rulesSummary: 'Cleans marketing jargon, parses wheelbase, lexan thickness, EFRA/IFMAR homologation.',
  },
];

export default function BrandsPage() {
  const [brands, setBrands] = useState(BRANDS);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Brand Intelligence &amp; Profiles</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure scraping extraction profiles, custom parsers, rate limits, and brand-level domain bindings.
          </p>
        </div>
        <div>
          <button className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition">
            <Plus className="w-4 h-4" />
            <span>Add Brand Profile</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {brands.map((brand) => (
          <div
            key={brand.id}
            className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {brand.name}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Profile Live</span>
                </span>
              </div>

              <div className="mt-4">
                <a
                  href={`https://${brand.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition font-mono"
                >
                  <Globe className="w-3.5 h-3.5 text-slate-500" />
                  <span>{brand.domain}</span>
                  <ExternalLink className="w-3 h-3 text-slate-500" />
                </a>
              </div>

              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                {brand.rulesSummary}
              </p>

              <div className="mt-4 p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Parser Architecture:</span>
                  <span className="text-slate-200 font-mono text-right truncate max-w-[140px]">{brand.parserType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Indexed Products:</span>
                  <span className="text-sky-400 font-mono font-semibold">{brand.productsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Last Scrape Sync:</span>
                  <span className="text-slate-300 font-mono">{brand.lastScraped}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">ID: {brand.slug}</span>
              <button className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium">
                <Code2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

