'use client';

import React, { useState, useEffect } from 'react';
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
  Tag,
  DollarSign,
  Package,
  Image as ImageIcon,
  Sliders,
  Check
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        setError(null);
        const res = await apiClient.getProductById(params.id);
        setData(res);
        if (res?.images && res.images.length > 0) {
          const primary = res.images.find((img: any) => img.isPrimary) || res.images[0];
          setSelectedImage(primary.originUrl || primary.storageUri);
        } else if (res?.product?.primaryImageUrl) {
          setSelectedImage(res.product.primaryImageUrl);
        }
      } catch (err: any) {
        console.error('Failed to load product details:', err);
        setError(err.message || 'Failed to load product details');
      } finally {
        setLoading(false);
      }
    }

    if (params.id) {
      fetchProduct();
    }
  }, [params.id]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-6 font-sans">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <div className="w-24 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm space-y-4">
          <div className="w-32 h-6 bg-slate-200 rounded animate-pulse" />
          <div className="w-3/4 h-8 bg-slate-200 rounded animate-pulse" />
          <div className="w-1/2 h-4 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data || !data.product) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto p-6 font-sans">
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </Link>
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center space-y-3">
          <h3 className="text-sm font-bold text-rose-800">Product Not Found</h3>
          <p className="text-xs text-rose-600">{error || 'Unable to load product information.'}</p>
        </div>
      </div>
    );
  }

  const { product, brandName, mapping, attributes, customFields, images, identifiers } = data;
  const sku = mapping?.customerInternalSku || identifiers?.find((i: any) => i.idType === 'MANUFACTURER_SKU')?.idValue || product.modelNumber || '—';
  const model = product.modelNumber || sku || '—';

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-12">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Product Catalog</span>
        </Link>

        {product.productUrl && (
          <a
            href={product.productUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
          >
            <span>View Source Page</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </a>
        )}
      </div>

      {/* Main Product Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Images Section (Left 4 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="w-full aspect-square rounded-2xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-center overflow-hidden">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.canonicalTitle}
                  className="w-full h-full object-contain hover:scale-105 transition duration-300"
                />
              ) : (
                <div className="text-center text-slate-400 space-y-2">
                  <ImageIcon className="w-12 h-12 mx-auto stroke-1" />
                  <p className="text-xs">No image available</p>
                </div>
              )}
            </div>

            {/* Gallery Thumbnails */}
            {images && images.length > 1 && (
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Extracted Media ({images.length} images)
                </div>
                <div className="flex flex-wrap gap-2">
                  {images.map((img: any, i: number) => {
                    const url = img.originUrl || img.storageUri;
                    const isSelected = selectedImage === url;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedImage(url)}
                        className={`w-14 h-14 rounded-xl border p-1 bg-white transition flex items-center justify-center overflow-hidden ${
                          isSelected
                            ? 'border-[#0d2a2c] ring-2 ring-[#0d2a2c]/20'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <img src={url} alt={`thumb-${i}`} className="w-full h-full object-contain" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Details Section (Right 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#0d2a2c] text-[#fad982]">
                  {brandName || 'Brand'}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Tenant Extracted</span>
                </span>
                {product.categoryPath && (
                  <span className="px-2.5 py-1 rounded-lg text-xs text-slate-500 bg-slate-100 border border-slate-200">
                    {product.categoryPath}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                {product.canonicalTitle}
              </h1>

              {product.price && (
                <div className="inline-flex items-baseline gap-1 text-2xl font-black text-slate-900 bg-amber-50/80 border border-amber-200 px-4 py-2 rounded-xl">
                  <span>{product.price}</span>
                  <span className="text-xs font-bold text-slate-500">USD</span>
                </div>
              )}
            </div>

            {/* Quick Identifier Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Model / MPN</span>
                <span className="text-xs font-mono font-bold text-slate-800">{model}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">SKU</span>
                <span className="text-xs font-mono font-bold text-slate-800">{sku}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Verification</span>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Verified
                </span>
              </div>
            </div>

            {/* Description */}
            {product.standardizedDescription && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Description</h3>
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
                  {product.standardizedDescription}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Specifications & Custom Attributes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Normalized Technical Specifications */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Sliders className="w-4 h-4 text-[#0d2a2c]" />
            <h3 className="text-sm font-bold text-slate-900">
              Technical Specifications ({attributes && typeof attributes === 'object' ? Object.keys(attributes).length : 0})
            </h3>
          </div>

          {attributes && typeof attributes === 'object' && Object.keys(attributes).length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto pr-1">
              {Object.entries(attributes).map(([key, val]) => (
                <div key={key} className="py-2.5 flex justify-between gap-4">
                  <span className="font-semibold text-slate-700">{key}</span>
                  <span className="font-mono text-slate-900 text-right">{String(val)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No technical specifications extracted for this product.
            </div>
          )}
        </div>

        {/* Custom Client Fields */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Tag className="w-4 h-4 text-[#0d2a2c]" />
            <h3 className="text-sm font-bold text-slate-900">
              Custom Attributes ({customFields && typeof customFields === 'object' ? Object.keys(customFields).length : 0})
            </h3>
          </div>

          {customFields && typeof customFields === 'object' && Object.keys(customFields).length > 0 ? (
            <div className="divide-y divide-slate-100 text-xs max-h-96 overflow-y-auto pr-1">
              {Object.entries(customFields).map(([key, val]) => {
                const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                const isMultiLine = strVal.includes('\n') || strVal.length > 80;

                if (isMultiLine) {
                  return (
                    <div key={key} className="py-3 space-y-1.5">
                      <span className="font-semibold text-slate-800 uppercase tracking-wider text-[10px] block">
                        {key}
                      </span>
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed max-h-60 overflow-y-auto">
                        {strVal}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={key} className="py-2.5 flex justify-between gap-4">
                    <span className="font-semibold text-slate-700">{key}</span>
                    <span className="font-mono text-slate-900 text-right">{strVal}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No custom attributes mapped for this product.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
