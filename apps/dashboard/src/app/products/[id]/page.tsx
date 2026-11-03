'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ShieldCheck,
  Globe,
  Layers,
  History,
  CheckCircle2,
  ExternalLink,
  Barcode,
  Share2,
} from 'lucide-react';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const product = {
    id: params.id,
    canonicalTitle: 'Traxxas Slash 4X4 VXL 1/10 Scale 4WD Short Course Truck',
    brand: 'Traxxas',
    modelNumber: '68086-4',
    eanGtin: '0020334680864',
    price: 429.95,
    currency: 'USD',
    description:
      'The Traxxas Slash 4X4 VXL sets the standard for short-course durability, performance, and technology. Extreme Velineon brushless horsepower provides raw 60+mph speed while the heavy-duty driveline keeps the power pinned to the ground.',
    attributes: {
      Scale: '1/10',
      Drivetrain: 'Shaft-Driven 4WD',
      Motor: 'Velineon 3500 Brushless',
      ESC: 'VXL-3s Electronic Speed Control',
      TopSpeed: '60+ mph (with optional 3S LiPo)',
      Transmission: 'Single Speed with Torque-Control Slipper',
      Weight: '2.16 kg (4.76 lbs)',
    },
    compatibleModels: [
      'Slash 4X4 Ultimate (68077-4)',
      'Rustler 4X4 VXL (67076-4)',
      'Stampede 4X4 VXL (67086-4)',
      'Hoss 4X4 VXL (90076-4)',
    ],
    variants: [
      { id: 'v1', sku: '68086-4-BLUE', color: 'Blue/White Fox Racing', inStock: true, price: '$429.95' },
      { id: 'v2', sku: '68086-4-RED', color: 'Red/Black Edition', inStock: true, price: '$429.95' },
      { id: 'v3', sku: '68086-4-ORNG', color: 'Orange Edition', inStock: false, price: '$429.95' },
      { id: 'v4', sku: '68086-4-GRN', color: 'Green Courtney Force', inStock: true, price: '$439.95' },
    ],
    sources: [
      {
        domain: 'traxxas.com',
        url: 'https://traxxas.com/products/models/electric/slash-4x4-vxl',
        confidence: 0.99,
        extractedAt: '2026-11-03 18:30 UTC',
        sourceType: 'Brand Primary Source',
      },
      {
        domain: 'amainhobbies.com',
        url: 'https://www.amainhobbies.com/traxxas-slash-4x4-vxl-1-10-rtr-4wd-short-course-truck-tra68086-4/p',
        confidence: 0.94,
        extractedAt: '2026-11-02 12:15 UTC',
        sourceType: 'Authorized Retailer',
      },
    ],
    provenance: [
      { field: 'eanGtin', source: 'traxxas.com (JSON-LD)', confidence: '100%', status: 'Modulo-10 Verified' },
      { field: 'canonicalTitle', source: 'traxxas.com (CSS Selector h1.product-title)', confidence: '98%', status: 'Normalized' },
      { field: 'compatibleModels', source: 'traxxas.com (#compatible-models tab parser)', confidence: '95%', status: 'Parsed' },
      { field: 'price', source: 'amainhobbies.com (Schema.org Offer)', confidence: '94%', status: 'Extracted' },
    ],
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back button and breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          href="/products"
          className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>

      {/* Main Product Header Card */}
      <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {product.brand}
              </span>
              <span className="px-2.5 py-0.5 rounded text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Identity Verified</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{product.canonicalTitle}</h1>
            <p className="text-xs text-slate-400 leading-relaxed">{product.description}</p>
          </div>

          <div className="bg-slate-900/90 border border-slate-750 p-4 rounded-xl shrink-0 w-72 text-right">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Canonical Price Est.</div>
            <div className="text-2xl font-bold text-white mt-1">
              ${product.price.toFixed(2)} <span className="text-xs font-normal text-slate-400">{product.currency}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-800 text-left space-y-1.5 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">GTIN/EAN:</span>
                <span className="text-slate-200">{product.eanGtin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MPN / Model:</span>
                <span className="text-slate-200">{product.modelNumber}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications & Variants Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Technical Attributes & Brand Specific Features */}
        <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Normalized Specifications
            </h3>
            <div className="divide-y divide-slate-800 border-y border-slate-800 text-xs">
              {Object.entries(product.attributes).map(([key, val]) => (
                <div key={key} className="py-2.5 flex justify-between">
                  <span className="text-slate-400 font-medium">{key}</span>
                  <span className="text-slate-200 font-mono text-right">{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Traxxas Brand-Specific Compatible Models Feature */}
          {product.compatibleModels && (
            <div>
              <h3 className="text-sm font-semibold text-sky-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="w-4 h-4" />
                <span>Compatible Traxxas Platforms</span>
              </h3>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {product.compatibleModels.map((model) => (
                  <div
                    key={model}
                    className="p-2 rounded bg-slate-900 border border-slate-800 text-xs text-slate-300 font-medium truncate"
                  >
                    {model}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Variants and Sources */}
        <div className="space-y-6">
          {/* Variants Table */}
          <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Extracted Variants</h3>
            <div className="divide-y divide-slate-800 border-y border-slate-800 text-xs">
              {product.variants.map((v) => (
                <div key={v.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">{v.color}</div>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">{v.sku}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-white">{v.price}</div>
                    <div className="text-[10px] text-emerald-400 mt-0.5">
                      {v.inStock ? 'In Stock' : 'Backorder'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source Provenance */}
          <div className="bg-[#0e1626] border border-slate-800 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Provenance &amp; Field Lineage
            </h3>
            <div className="space-y-2.5">
              {product.provenance.map((p, idx) => (
                <div key={idx} className="p-2.5 rounded bg-slate-900/80 border border-slate-800 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-mono text-sky-400 font-semibold">{p.field}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">{p.source}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono">
                      {p.confidence}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

