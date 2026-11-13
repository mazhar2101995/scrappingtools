'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Wand2,
  Sparkles,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Maximize2,
  Download,
  ShoppingBag,
  Layers,
  ArrowRight,
  Eye,
  Check
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface ProductItem {
  id: string;
  canonicalTitle: string;
  primaryImageUrl: string | null;
  modelNumber?: string;
  categoryPath?: string;
}

export default function ImageStudioPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // Studio Options
  const [actionType, setActionType] = useState<'AUTO_ENHANCE_ALL' | 'REMOVE_BG_STUDIO' | 'REMOVE_WATERMARK'>('AUTO_ENHANCE_ALL');
  const [removeBg, setRemoveBg] = useState(true);
  const [removeWatermark, setRemoveWatermark] = useState(true);
  const [autoCenter, setAutoCenter] = useState(true);
  const [outputFormat, setOutputFormat] = useState<'webp' | 'png' | 'jpeg'>('webp');

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [cleanedImageUrl, setCleanedImageUrl] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  // Compare Slider State (0 to 100)
  const [sliderPos, setSliderPos] = useState(50);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getProducts({ limit: 50 });
      const items = res?.products || res?.data || [];
      setProducts(items);
      if (items.length > 0 && !selectedProduct) {
        selectProductForStudio(items[0]);
      }
    } catch (err: any) {
      console.warn('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFullImageUrl = (url: string | null) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Prepend API server port if relative uploads path
    return `http://localhost:4000${url.startsWith('/') ? '' : '/'}${url}`;
  };
  const selectProductForStudio = async (prod: ProductItem) => {
    setSelectedProduct(prod);
    setCleanedImageUrl(null);
    setStatusMsg(null);
    try {
      const hist = await apiClient.getImageTransformations(prod.id);
      setHistory(hist);
      if (hist.length > 0) {
        setCleanedImageUrl(hist[0].cleanedUrl);
      }
    } catch (err) {
      setHistory([]);
    }
  };

  const handleProcessImage = async () => {
    if (!selectedProduct || !selectedProduct.primaryImageUrl) {
      alert('Selected product does not have a source image.');
      return;
    }

    try {
      setProcessing(true);
      setStatusMsg(null);

      const res = await apiClient.transformProductImage({
        globalProductId: selectedProduct.id,
        sourceImageUrl: selectedProduct.primaryImageUrl,
        transformationType: actionType,
        options: {
          removeBackground: removeBg,
          removeWatermark: removeWatermark,
          autoCenter: autoCenter,
          outputFormat: outputFormat,
          backgroundColor: '#FFFFFF',
          quality: 92,
        },
      });

      setCleanedImageUrl(res.data.cleanedUrl);
      setStatusMsg({
        type: 'success',
        text: 'Studio clean-up complete! Background removed, watermarks scrubbed, and auto-centered on pure white canvas.',
      });

      // Reload transformation history
      const hist = await apiClient.getImageTransformations(selectedProduct.id);
      setHistory(hist);
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Image processing failed',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-teal-800 font-bold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            <span>Commercial Studio Optimization</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            <Wand2 className="w-6 h-6 text-teal-700" />
            <span>AI Product Image Studio (Clean BG &amp; Watermark Remover)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Turn raw, messy supplier photos into Amazon &amp; Shopify-compliant pure white studio shots with automated watermark inpainting.
          </p>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
        >
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Main Studio Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Product Selector Sidebar */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-teal-700" />
              <span>Select Product ({products.length})</span>
            </h2>
            <button
              onClick={loadProducts}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500"
              title="Refresh Products"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {products.map((p) => {
              const isSelected = selectedProduct?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => selectProductForStudio(p)}
                  className={`p-3 flex items-center gap-3 cursor-pointer transition ${isSelected ? 'bg-amber-50/70 border-l-4 border-[#fad982]' : 'hover:bg-slate-50'
                    }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 shrink-0 overflow-hidden flex items-center justify-center">
                    {p.primaryImageUrl ? (
                      <img src={p.primaryImageUrl} alt={p.canonicalTitle} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                      {p.canonicalTitle}
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 truncate">
                      {p.modelNumber || 'SKU #N/A'}
                    </p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-teal-700 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Studio Canvas & Controls */}
        <div className="lg:col-span-8 space-y-5">
          {/* Studio Controls Header Card */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-teal-800 font-mono">
                  ACTIVE STUDIO ITEM
                </span>
                <h3 className="text-sm font-bold text-slate-900 truncate max-w-lg">
                  {selectedProduct ? selectedProduct.canonicalTitle : 'No product selected'}
                </h3>
              </div>

              <button
                onClick={handleProcessImage}
                disabled={processing || !selectedProduct?.primaryImageUrl}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs shadow-sm transition disabled:opacity-50"
              >
                <Wand2 className={`w-4 h-4 ${processing ? 'animate-spin' : ''}`} />
                <span>{processing ? 'Processing Studio Image...' : 'Run AI Clean Studio'}</span>
              </button>
            </div>

            {/* Config Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 cursor-pointer hover:bg-slate-100/70 transition">
                <input
                  type="checkbox"
                  checked={removeBg}
                  onChange={(e) => setRemoveBg(e.target.checked)}
                  className="rounded text-teal-700 border-slate-300 focus:ring-0 mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">Remove Dirty Background</span>
                  <span className="text-[10px] text-slate-500">Converts off-white / warehouse clutter to pure #FFFFFF</span>
                </div>
              </label>

              <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 cursor-pointer hover:bg-slate-100/70 transition">
                <input
                  type="checkbox"
                  checked={removeWatermark}
                  onChange={(e) => setRemoveWatermark(e.target.checked)}
                  className="rounded text-teal-700 border-slate-300 focus:ring-0 mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">Scrub Supplier Watermarks</span>
                  <span className="text-[10px] text-slate-500">Suppresses corner stamps, badges, and supplier logos</span>
                </div>
              </label>

              <label className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 cursor-pointer hover:bg-slate-100/70 transition">
                <input
                  type="checkbox"
                  checked={autoCenter}
                  onChange={(e) => setAutoCenter(e.target.checked)}
                  className="rounded text-teal-700 border-slate-300 focus:ring-0 mt-0.5"
                />
                <div>
                  <span className="block text-xs font-bold text-slate-900">Square Auto-Fit (1000px)</span>
                  <span className="text-[10px] text-slate-500">Centers product on standard square e-commerce canvas</span>
                </div>
              </label>
            </div>
          </div>

          {/* Interactive Before & After Canvas */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-teal-700" />
                <span>Interactive Split Preview: Original vs Clean Studio Shot</span>
              </h4>
              {cleanedImageUrl && (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  ✓ Studio Enhanced
                </span>
              )}
            </div>

            <div className="relative w-full h-[420px] rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center select-none">
              {!selectedProduct?.primaryImageUrl ? (
                <div className="text-center text-slate-400 text-xs">
                  <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <span>No image available for this product</span>
                </div>
              ) : cleanedImageUrl ? (
                <>
                  {/* Background Cleaned Image */}
                  <img
                    src={getFullImageUrl(cleanedImageUrl)}
                    alt="Cleaned Studio Shot"
                    className="absolute inset-0 w-full h-full object-contain bg-white"
                  />

                  {/* Original Image clipped by slider */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPos}%` }}
                  >
                    <img
                      src={getFullImageUrl(selectedProduct.primaryImageUrl)}
                      alt="Original Raw Shot"
                      className="absolute inset-0 w-full h-full object-contain max-w-none"
                      style={{ width: '100%', height: '100%' }}
                    />
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-black/70 text-white text-[10px] font-bold uppercase">
                      Raw Original
                    </div>
                  </div>

                  <div className="absolute top-3 right-3 px-2 py-0.5 rounded bg-teal-800 text-white text-[10px] font-bold uppercase">
                    Clean Studio Shot
                  </div>

                  {/* Vertical Divider Line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg pointer-events-none"
                    style={{ left: `${sliderPos}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-white shadow-md border-2 border-teal-700 flex items-center justify-center text-[10px] text-teal-700 font-bold">
                      ↔
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center space-y-2">
                  <img
                    src={selectedProduct.primaryImageUrl}
                    alt="Raw Product"
                    className="max-h-[300px] object-contain mx-auto"
                  />
                  <p className="text-xs text-slate-500 font-medium">
                    Raw image ready for studio processing. Click &quot;Run AI Clean Studio&quot; above.
                  </p>
                </div>
              )}
            </div>

            {/* Slider Range Control */}
            {cleanedImageUrl && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] font-bold text-slate-500">
                  <span>← Drag left to reveal Clean Studio Image</span>
                  <span>Drag right to see Raw Original →</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderPos}
                  onChange={(e) => setSliderPos(Number(e.target.value))}
                  className="w-full accent-teal-700 cursor-ew-resize"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
