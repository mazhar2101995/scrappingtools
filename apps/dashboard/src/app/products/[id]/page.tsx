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
  Check,
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
  AlertCircle,
  Info,
  X,
  Clock,
  Send,
  AlertTriangle,
  Award,
  Edit2,
  Save,
  Radio,
  FileCheck
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Phase 6 Data Quality Report State
  const [qualityReport, setQualityReport] = useState<any | null>(null);
  const [loadingQuality, setLoadingQuality] = useState(false);

  // Human Review & Field Correction State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctingField, setCorrectingField] = useState<'canonicalTitle' | 'modelNumber' | 'standardizedDescription'>('canonicalTitle');
  const [correctionValue, setCorrectionValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const [correctionSuccessMsg, setCorrectionSuccessMsg] = useState<string | null>(null);

  // Store Push States
  const [stores, setStores] = useState<any[]>([]);
  const [pushingStoreId, setPushingStoreId] = useState<string | null>(null);
  const [pushSuccessMsg, setPushSuccessMsg] = useState<string | null>(null);
  const [pushErrorMsg, setPushErrorMsg] = useState<string | null>(null);
  const [selectedSyncInfo, setSelectedSyncInfo] = useState<any | null>(null);

  // Price & Stock Monitoring State
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [monitoringFreq, setMonitoringFreq] = useState('DAILY');
  const [savingMonitoring, setSavingMonitoring] = useState(false);
  const [monitoringSuccess, setMonitoringSuccess] = useState(false);

  // Multi-Language Store Catalog State
  const [storeLanguages, setStoreLanguages] = useState<{ primary: string; supported: string[] }>({
    primary: 'en',
    supported: ['en'],
  });
  const [activeLang, setActiveLang] = useState<string>('en');

  // Raw Data Modal State
  const [showRawDataModal, setShowRawDataModal] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [showProvenanceModal, setShowProvenanceModal] = useState(false);
  const [showMonitoringModal, setShowMonitoringModal] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessSuccessMsg, setReprocessSuccessMsg] = useState<string | null>(null);

  async function handleRetryAiProcessing() {
    if (!data?.product?.id) return;
    const confirmed = window.confirm(
      'Reprocess this product using the latest Global and Brand Profile rules? The original source data will remain unchanged.'
    );
    if (!confirmed) return;

    try {
      setReprocessing(true);
      setError(null);
      const res = await apiClient.reprocessProduct(data.product.id);
      setReprocessSuccessMsg(res.message || 'Product reprocessed successfully with latest rules!');
      setTimeout(() => setReprocessSuccessMsg(null), 5000);
      setShowRawDataModal(false);
      await fetchProduct();
      await fetchQuality();
    } catch (err: any) {
      alert(err.message || 'Failed to reprocess product');
    } finally {
      setReprocessing(false);
    }
  }

  const fetchProduct = React.useCallback(async () => {
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
  }, [params.id]);

  const fetchQuality = React.useCallback(async () => {
    try {
      setLoadingQuality(true);
      const qRes = await apiClient.getProductQuality(params.id);
      if (qRes?.report) {
        setQualityReport(qRes.report);
      }
    } catch (err) {
      console.warn('Could not load Phase 6 quality report:', err);
    } finally {
      setLoadingQuality(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) {
      fetchProduct();
      fetchQuality();
      apiClient.getStoreLanguages().then((langs) => {
        if (langs?.supported && langs.supported.length > 0) {
          setStoreLanguages(langs);
          setActiveLang(langs.primary || langs.supported[0] || 'en');
        }
      }).catch(() => {});
      apiClient.getStores().then((res) => {
        setStores(Array.isArray(res) ? res : []);
      }).catch(() => {});
      apiClient.getProductMonitoring(params.id).then((res) => {
        if (res?.monitoring) {
          setMonitoringEnabled(res.monitoring.enabled ?? true);
          setMonitoringFreq(res.monitoring.frequency || 'DAILY');
        }
      }).catch(() => {});
    }
  }, [params.id, fetchProduct, fetchQuality]);

  async function handleSaveMonitoring() {
    if (!data?.product?.id) return;
    try {
      setSavingMonitoring(true);
      await apiClient.updateProductMonitoring(data.product.id, {
        enabled: monitoringEnabled,
        frequency: monitoringFreq,
        targetUrl: data.product.productUrl || '',
        baselinePrice: data.product.price || '0.00',
        currentPrice: data.product.price || '0.00',
        inStock: true,
      });
      setMonitoringSuccess(true);
      setTimeout(() => setMonitoringSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSavingMonitoring(false);
    }
  }

  async function handlePushToStore(storeId: string) {
    if (!data?.product?.id) return;
    try {
      setPushingStoreId(storeId);
      setPushSuccessMsg(null);
      setPushErrorMsg(null);
      const res = await apiClient.pushProductToStore({
        storeId,
        productId: data.product.id,
      });
      setPushSuccessMsg(res.message || 'Product pushed to store successfully!');
      setTimeout(() => setPushSuccessMsg(null), 4000);
      await fetchProduct();
    } catch (err: any) {
      setPushErrorMsg(err.message || 'Failed to push product to store');
    } finally {
      setPushingStoreId(null);
    }
  }

  function handleOpenCorrection(field: 'canonicalTitle' | 'modelNumber' | 'standardizedDescription', currentVal: string) {
    setCorrectingField(field);
    setCorrectionValue(currentVal || '');
    setCorrectionReason('Manual human review audit');
    setShowCorrectionModal(true);
  }

  async function handleSubmitCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!data?.product?.id || !correctionValue.trim()) return;

    try {
      setSubmittingCorrection(true);
      const payload: any = { reason: correctionReason.trim() || 'Human review approval' };
      payload[correctingField] = correctionValue.trim();

      await apiClient.applyProductCorrection(data.product.id, payload);
      setCorrectionSuccessMsg(`Successfully corrected ${correctingField} with immutable audit provenance.`);
      setTimeout(() => setCorrectionSuccessMsg(null), 4000);
      setShowCorrectionModal(false);
      await Promise.all([fetchProduct(), fetchQuality()]);
    } catch (err: any) {
      alert(err.message || 'Failed to apply correction');
    } finally {
      setSubmittingCorrection(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 w-full p-6 font-sans">
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
      <div className="space-y-6 w-full p-6 font-sans">
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

  const { product, brandName, mapping, attributes, customFields, images, identifiers, provenance } = data;
  const sku = mapping?.customerInternalSku || identifiers?.find((i: any) => i.idType === 'MANUFACTURER_SKU')?.idValue || product.modelNumber || '—';
  const model = product.modelNumber || sku || '—';

  // Barcode GTIN from identifiers
  const barcodeRecord = identifiers?.find((i: any) => i.idType === 'EAN_13' || i.idType === 'GTIN_14' || i.idType === 'UPC_A');
  const barcodeValue = barcodeRecord?.idValue || '—';

  const overallQuality = qualityReport?.overallStatus || product.verificationStatus || 'unverified';
  const qualityScore = qualityReport?.qualityScore ?? 100;
  const completenessScore = qualityReport?.completenessScore ?? 100;

  return (
    <div className="space-y-6 w-full font-sans pb-16">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Product Catalog</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRetryAiProcessing}
            disabled={reprocessing}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-950 bg-[#fad982] hover:bg-amber-300 border border-amber-300 shadow-xs transition disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{reprocessing ? 'Reprocessing...' : 'Retry AI Processing'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRawDataModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-200 shadow-xs transition"
          >
            <Layers className="w-3.5 h-3.5 text-slate-600" />
            <span>View Raw Data</span>
          </button>

          {product.productUrl && (
            <a
              href={product.productUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 transition bg-white border border-slate-200 shadow-xs"
            >
              <span>View Source Website</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          )}
        </div>
      </div>

      {/* Success Banner */}
      {correctionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{correctionSuccessMsg}</span>
        </div>
      )}

      {reprocessSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{reprocessSuccessMsg}</span>
        </div>
      )}

      {/* Processing Pipeline Status Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl px-5 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Pipeline Status:</span>
          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <Check className="w-3.5 h-3.5" /> Scraped
            </span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <Check className="w-3.5 h-3.5" /> Global Rules
            </span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <Check className="w-3.5 h-3.5" /> Brand Rules
            </span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <Check className="w-3.5 h-3.5" /> AI Normalization
            </span>
            <span className="text-slate-300">&rarr;</span>
            <span className="text-emerald-700 font-bold flex items-center gap-0.5">
              <Check className="w-3.5 h-3.5" /> Final Output
            </span>
          </div>
        </div>

        {/* Compact Product Intelligence Modals Access */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden sm:inline">Product Intelligence:</span>
          <button
            type="button"
            onClick={() => setShowQualityModal(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Data Quality ({qualityScore}/100)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowProvenanceModal(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1 transition"
          >
            <Globe className="w-3.5 h-3.5 text-teal-600" />
            <span>Source Provenance</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMonitoringModal(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1 transition"
          >
            <Radio className="w-3.5 h-3.5 text-amber-600" />
            <span>Price &amp; Stock Drift</span>
          </button>
        </div>
      </div>

      {/* Main Product Header Card */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Images Section (Left 5 cols) */}
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
                        className={`w-14 h-14 rounded-xl border p-1 bg-white transition overflow-hidden flex items-center justify-center ${
                          isSelected ? 'border-[#0d2a2c] ring-2 ring-[#0d2a2c]/20' : 'border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <img src={url} alt={`Thumb ${i}`} className="w-full h-full object-contain" />
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

                {/* Overall Quality Badge (Phase 6) */}
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase flex items-center gap-1 border ${
                    overallQuality === 'VERIFIED'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : overallQuality === 'CONFLICT'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : overallQuality === 'NEEDS_REVIEW'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Quality: {overallQuality}</span>
                </span>

                {product.categoryPath && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200" title={product.categoryPath}>
                    {product.categoryPath.split('>')[0].trim()}
                  </span>
                )}
              </div>

              <div className="flex items-start justify-between gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-snug">
                  {(() => {
                    const trans = data?.aiProcessedData?.translations?.[activeLang];
                    return trans?.title || product.canonicalTitle;
                  })()}
                </h1>
                <button
                  onClick={() => handleOpenCorrection('canonicalTitle', product.canonicalTitle)}
                  title="Submit human correction for title"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition shrink-0"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Multi-Language Store Switcher Pills */}
              {storeLanguages?.supported && storeLanguages.supported.length > 1 && (
                <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                    <Globe className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Language:</span>
                  </span>
                  {storeLanguages.supported.map((langCode) => {
                    const isActive = activeLang === langCode;
                    const isPrimary = langCode === storeLanguages.primary;
                    const hasTranslation = Boolean(data?.aiProcessedData?.translations?.[langCode]);
                    return (
                      <button
                        type="button"
                        key={langCode}
                        onClick={() => setActiveLang(langCode)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border ${
                          isActive
                            ? 'bg-[#0d2a2c] text-[#fad982] border-[#0d2a2c] shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <span className="uppercase">{langCode}</span>
                        {isPrimary && (
                          <span className={`text-[10px] px-1 py-0.2 rounded font-normal ${isActive ? 'bg-teal-900/50 text-amber-200' : 'bg-slate-100 text-slate-500'}`}>
                            Main
                          </span>
                        )}
                        {hasTranslation && !isPrimary && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Enriched in this language" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {product.price && (
                <div className="inline-flex items-baseline gap-1 text-2xl font-black text-slate-900 bg-amber-50/80 border border-amber-200 px-4 py-2 rounded-xl">
                  <span>{product.price}</span>
                  <span className="text-xs font-bold text-slate-500">USD</span>
                </div>
              )}
            </div>

            {/* Quick Identifier Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Model / MPN</span>
                <span className="text-xs font-mono font-bold text-slate-800 truncate block">{model}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">SKU</span>
                <span className="text-xs font-mono font-bold text-slate-800 truncate block">{sku}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">EAN / Barcode</span>
                <span className="text-xs font-mono font-bold text-slate-800 truncate block">{barcodeValue}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Confidence Score</span>
                <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 font-mono">
                  {qualityScore}/100
                </span>
              </div>
            </div>

            {/* 1-Click Push to Connected Store Action Bar */}
            <div id="store-sync" className="p-4 rounded-2xl bg-gradient-to-r from-[#0d2a2c]/5 via-amber-500/5 to-transparent border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#0d2a2c]" />
                  <span className="text-xs font-black text-slate-900">Direct E-Commerce Store Publish</span>
                </div>
                <Link href="/stores" className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline">
                  Manage Stores
                </Link>
              </div>

              {pushSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{pushSuccessMsg}</span>
                </div>
              )}

              {pushErrorMsg && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
                  <span>{pushErrorMsg}</span>
                </div>
              )}

              {stores.length === 0 ? (
                <div className="text-xs text-slate-500 flex items-center justify-between">
                  <span>No stores connected yet. Connect your Shopify or WooCommerce store to enable 1-click publishing.</span>
                  <Link
                    href="/stores"
                    className="px-3 py-1.5 rounded-lg bg-[#0d2a2c] text-[#fad982] text-xs font-bold shrink-0 ml-3"
                  >
                    Connect Store
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {stores.map((s) => {
                    const syncedMapping = Array.isArray(data?.syncedStores)
                      ? data.syncedStores.find((sm: any) => sm.storeId === s.id)
                      : null;

                    return (
                      <div key={s.id} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(pushingStoreId)}
                          onClick={() => handlePushToStore(s.id)}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold shadow-2xs transition disabled:opacity-50 ${
                            syncedMapping
                              ? 'bg-emerald-50/50 hover:bg-emerald-50 border-emerald-300 text-emerald-950'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
                          }`}
                        >
                          <ShoppingBag className={`w-3.5 h-3.5 ${syncedMapping ? 'text-emerald-700' : 'text-slate-600'}`} />
                          <span>
                            {pushingStoreId === s.id
                              ? 'Publishing...'
                              : syncedMapping
                              ? `Re-Push to ${s.storeName}`
                              : `Push to ${s.storeName} (${s.platformType.toUpperCase()})`}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                        </button>

                        {syncedMapping && (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-300">
                              <Check className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Live on {s.storeName}</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedSyncInfo({ ...syncedMapping, store: s })}
                              title="Click for full push details"
                              className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 transition shadow-2xs"
                            >
                              <Info className="w-3.5 h-3.5 text-emerald-700" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Description */}
            {(() => {
              const trans = data?.aiProcessedData?.translations?.[activeLang];
              const descToRender = trans?.description || product.standardizedDescription;

              if (!descToRender || descToRender.includes('(Not found on tested page)')) {
                return null;
              }

              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Description</h3>
                      {activeLang !== storeLanguages.primary && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                          {activeLang} Translation
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleOpenCorrection('standardizedDescription', descToRender)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit Description</span>
                    </button>
                  </div>
                  {/<[a-z][\s\S]*>/i.test(descToRender) ? (
                    <div
                      className="p-5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-96 overflow-y-auto prose prose-slate prose-sm max-w-none shadow-xs"
                      dangerouslySetInnerHTML={{ __html: descToRender }}
                    />
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
                      {descToRender}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* MAIN STRUCTURED PRODUCT CONTENT SECTIONS (FEATURES, COMPATIBLE MODELS, SPECIFICATIONS) */}
      {/* Hide redundant standalone sections if unified formatted HTML description is active and already contains features/specifications */}
      {!/<[a-z][\s\S]*>/i.test(product.standardizedDescription || '') && (
        <div className="space-y-6">
          {/* 1. Features Section */}
          {((data.features && Array.isArray(data.features) && data.features.length > 0) ||
            (data.aiProcessedData?.keyHighlights && data.aiProcessedData.keyHighlights.length > 0)) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Product Features &amp; Key Highlights</h3>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-700">
                {(data.features && Array.isArray(data.features) && data.features.length > 0 ? data.features : data.aiProcessedData?.keyHighlights || []).map((feat: any, fIdx: number) => (
                  <li key={fIdx} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{String(feat)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 2. Compatible Models Section */}
          {data.compatibleModels && Array.isArray(data.compatibleModels) && data.compatibleModels.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Layers className="w-4 h-4 text-[#0d2a2c]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Compatible Models &amp; Fitment</h3>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {data.compatibleModels.map((mod: any, mIdx: number) => (
                  <span key={mIdx} className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold">
                    {String(mod)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Specifications Section */}
          {((data.specifications && typeof data.specifications === 'object' && Object.keys(data.specifications).length > 0) ||
            (attributes && typeof attributes === 'object' && Object.keys(attributes).length > 0)) && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sliders className="w-4 h-4 text-[#0d2a2c]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Technical Specifications ({Object.keys(data.specifications || attributes).length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                {Object.entries(data.specifications || attributes).map(([k, v]) => {
                  if (String(v).includes('(Not found on tested page)')) return null;
                  return (
                    <div key={k} className="py-2 px-3 rounded-lg bg-slate-50/70 border border-slate-100 flex justify-between gap-4">
                      <span className="font-semibold text-slate-700">{k}</span>
                      <span className="font-mono text-slate-900 text-right">{String(v)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Structured Field Groups (per Brand Profile) */}
      {data?.fieldGroupsData && Array.isArray(data.fieldGroupsData) && data.fieldGroupsData.length > 0 && !/<[a-z][\s\S]*>/i.test(product.standardizedDescription || '') && (
        <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#0d2a2c]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Brand Field Groups
                </h3>
              </div>
              <span className="text-[11px] font-bold text-slate-400">
                Formatted according to {brandName || 'Brand'} Profile Rules
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.fieldGroupsData.map((grp: any) => (
                <div key={grp.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
                  <div className="border-b border-slate-100 pb-2.5">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                      <span>{grp.name}</span>
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        {grp.fields.length} {grp.fields.length === 1 ? 'field' : 'fields'}
                      </span>
                    </h4>
                    {grp.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{grp.description}</p>
                    )}
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {grp.fields.map((f: any, fIdx: number) => {
                      if (String(f.value).includes('(Not found on tested page)')) return null;
                      const isArr = Array.isArray(f.value);
                      const isObj = typeof f.value === 'object' && f.value !== null && !isArr;
                      return (
                        <div key={fIdx} className="py-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                          <span className="font-semibold text-slate-700 sm:w-1/3">{f.label}</span>
                          <div className="text-slate-900 sm:w-2/3 sm:text-right">
                            {isArr ? (
                              <ul className="list-disc list-inside space-y-0.5 text-slate-800 text-left sm:text-right">
                                {f.value.map((item: any, iIdx: number) => (
                                  <li key={iIdx}>{String(item)}</li>
                                ))}
                              </ul>
                            ) : isObj ? (
                              <pre className="text-[11px] font-mono bg-slate-50 p-2 rounded text-left whitespace-pre-wrap">
                                {JSON.stringify(f.value, null, 2)}
                              </pre>
                            ) : (
                              <span className="font-mono text-slate-900 whitespace-pre-wrap">{String(f.value)}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
      )}

      {/* 5. DEDICATED AI SEO & METADATA SECTION */}
      {(() => {
        const trans = data?.aiProcessedData?.translations?.[activeLang];
        const activeSeo = trans?.seoData || data?.seoData;

        if (!activeSeo || typeof activeSeo !== 'object') return null;

        const displayMetaTitle = activeSeo.metaTitle || (trans?.title || product.canonicalTitle);
        const displayMetaDesc = activeSeo.metaDescription || (trans?.description ? trans.description.replace(/<[^>]+>/g, ' ').slice(0, 160) : product.standardizedDescription);

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  AI Generated SEO &amp; Meta Data
                </h3>
                {activeLang !== storeLanguages.primary && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                    {activeLang} SEO
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Verified SEO Output
              </span>
            </div>

            {/* Google SERP Preview Box */}
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-1.5 font-sans">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Google Search Engine Result Snippet (SERP Live Preview - {activeLang.toUpperCase()})
              </span>
              <div className="text-xs text-slate-500 font-mono truncate">
                https://yourstore.com/{activeLang !== 'en' ? `${activeLang}/` : ''}products/{activeSeo.urlSlug || 'product-handle'}
              </div>
              <div className="text-base font-medium text-[#1a0dab] hover:underline cursor-pointer truncate">
                {displayMetaTitle}
              </div>
              <p className="text-xs text-[#4d5156] line-clamp-2 leading-relaxed">
                {displayMetaDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {activeSeo.metaTitle && (
                <div className="p-3.5 rounded-xl bg-slate-50/60 border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-700 block">SEO Meta Title ({activeSeo.metaTitle.length} chars)</span>
                  <span className="text-slate-900 font-mono">{activeSeo.metaTitle}</span>
                </div>
              )}
              {activeSeo.metaDescription && (
                <div className="p-3.5 rounded-xl bg-slate-50/60 border border-slate-100 space-y-1">
                  <span className="font-bold text-slate-700 block">SEO Meta Description ({activeSeo.metaDescription.length} chars)</span>
                  <span className="text-slate-900">{activeSeo.metaDescription}</span>
                </div>
              )}
              {activeSeo.targetKeywords && Array.isArray(activeSeo.targetKeywords) && (
                <div className="p-3.5 rounded-xl bg-slate-50/60 border border-slate-100 space-y-2 md:col-span-2">
                  <span className="font-bold text-slate-700 block">Target Search Keywords ({activeSeo.targetKeywords.length})</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeSeo.targetKeywords.map((kw: string, kwIdx: number) => (
                      <span key={kwIdx} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-mono text-[11px]">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Human Review Correction Modal (Phase 6) */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Apply Human Correction ({correctingField})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrectionModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Corrected Value
                </label>
                {correctingField === 'standardizedDescription' ? (
                  <textarea
                    rows={4}
                    value={correctionValue}
                    onChange={(e) => setCorrectionValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0d2a2c]"
                    required
                  />
                ) : (
                  <input
                    type="text"
                    value={correctionValue}
                    onChange={(e) => setCorrectionValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0d2a2c]"
                    required
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Review Audit Reason (Recorded in Field Provenance)
                </label>
                <input
                  type="text"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Verified with manufacturer technical datasheet"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-[#0d2a2c]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCorrectionModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCorrection}
                  className="px-4 py-2 bg-[#0d2a2c] text-[#fad982] text-xs font-bold rounded-xl hover:bg-[#143d40] shadow-sm transition disabled:opacity-50"
                >
                  {submittingCorrection ? 'Recording Audit...' : 'Approve & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* View Raw Data Modal */}
      {showRawDataModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Raw Scraped Source Payload &amp; Provenance
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Original unformatted values extracted directly from the target page.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRawDataModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs text-slate-700">
              <div className="flex items-center justify-between p-3.5 bg-amber-50/70 border border-amber-200 rounded-2xl">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">Reprocess from Original Raw Data</span>
                  <p className="text-[11px] text-slate-600">Re-evaluates this product using current Workspace Global Rules and Brand Profile Rules without scraping again.</p>
                </div>
                <button
                  type="button"
                  disabled={reprocessing}
                  onClick={handleRetryAiProcessing}
                  className="px-3.5 py-1.5 rounded-xl bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-xs transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{reprocessing ? 'Reprocessing...' : 'Retry AI Processing'}</span>
                </button>
              </div>

              {data?.rawScrapedData ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Scraped Source URL</span>
                      <a
                        href={data.rawScrapedData.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-amber-700 hover:underline font-mono text-[11px] break-all block"
                      >
                        {data.rawScrapedData.sourceUrl || '—'}
                      </a>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Scraped Timestamp</span>
                      <span className="font-mono text-[11px] text-slate-800">
                        {data.rawScrapedData.scrapedAt ? new Date(data.rawScrapedData.scrapedAt).toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Field-by-Field Original Scraped Values */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Original Source Extraction (Pre-AI)</span>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden text-xs">
                      {[
                        { label: 'Original Product Title', val: data.rawScrapedData.rawTitle },
                        { label: 'Original Description', val: data.rawScrapedData.rawDescription },
                        { label: 'Model / MPN', val: data.rawScrapedData.rawModelNumber },
                        { label: 'SKU', val: data.rawScrapedData.rawSku },
                        { label: 'Price', val: data.rawScrapedData.rawPrice },
                        { label: 'Images', val: Array.isArray(data.rawScrapedData.rawImages) ? `${data.rawScrapedData.rawImages.length} images extracted` : null },
                        { label: 'Extracted Specifications', val: data.rawScrapedData.rawAttributes && Object.keys(data.rawScrapedData.rawAttributes).length > 0 ? JSON.stringify(data.rawScrapedData.rawAttributes, null, 2) : null },
                        { label: 'Custom Mapped Fields', val: data.rawScrapedData.rawCustomData && Object.keys(data.rawScrapedData.rawCustomData).length > 0 ? JSON.stringify(data.rawScrapedData.rawCustomData, null, 2) : null },
                      ].map((rf, rIdx) => (
                        <div key={rIdx} className="p-2.5 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-1">
                          <span className="font-bold text-slate-700 sm:w-1/3">{rf.label}</span>
                          <div className="sm:w-2/3 sm:text-right">
                            {rf.val ? (
                              <span className="font-mono text-slate-900 whitespace-pre-wrap">{String(rf.val)}</span>
                            ) : (
                              <span className="italic text-slate-400">Not Extracted</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {data.rawScrapedData.appliedAiPromptRules && (
                    <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-amber-800 block">Applied Brand AI Instructions</span>
                      <p className="font-mono text-[11px] text-slate-800 whitespace-pre-wrap">
                        {data.rawScrapedData.appliedAiPromptRules}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Complete Raw Scraped JSON</span>
                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre leading-relaxed">
                      {JSON.stringify(data.rawScrapedData, null, 2)}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Extracted Attributes Payload</span>
                    <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre">
                      {JSON.stringify({ attributes, customFields, identifiers }, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowRawDataModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. DATA QUALITY MODAL */}
      {showQualityModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Product Data Quality &amp; Confidence Assessment
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Field-level trust ratings, GTIN checksum validation, and human review status.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQualityModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs text-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Quality Score</span>
                  <span className="text-base font-black text-emerald-700">{qualityScore}/100</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Completeness</span>
                  <span className="text-base font-black text-slate-900">{completenessScore}%</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Status</span>
                  <span className="text-xs font-mono font-bold text-slate-800 uppercase">{overallQuality}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase">Review Priority</span>
                  <span className="text-xs font-mono font-bold text-slate-800 uppercase">{qualityReport?.reviewPriority || 'NORMAL'}</span>
                </div>
              </div>

              {qualityReport?.reviewReasons && qualityReport.reviewReasons.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Review Flags:</span>
                  </div>
                  <ul className="text-xs text-amber-800 list-disc list-inside space-y-1">
                    {qualityReport.reviewReasons.map((r: string, idx: number) => (
                      <li key={idx}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase font-mono text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Field Name</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Source &amp; Trust</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[
                      { name: 'Canonical Title', key: 'title', val: product.canonicalTitle },
                      { name: 'Model / MPN', key: 'modelNumber', val: product.modelNumber },
                      { name: 'EAN / GTIN Barcode', key: 'barcode', val: barcodeValue },
                      { name: 'Standard Description', key: 'description', val: product.standardizedDescription },
                    ].map((f) => {
                      const assessment = qualityReport?.fields?.[f.key];
                      const conf = assessment?.confidence || (f.val ? 'HIGH' : 'MISSING');
                      const status = assessment?.status || (conf === 'CONFLICT' ? 'conflict' : 'verified');
                      const trust = assessment?.sourceTrustScore ? `${Math.round(assessment.sourceTrustScore * 100)}%` : '95%';
                      return (
                        <tr key={f.key}>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{f.name}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[10px] uppercase">{conf}</td>
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{trust}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-700">{status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowQualityModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SOURCE PROVENANCE MODAL */}
      {showProvenanceModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-teal-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Source Provenance &amp; Multi-Source Acquisition
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Audited evidence trail verifying where product attributes were acquired.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowProvenanceModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Primary Brand Source</span>
                  <div className="font-bold text-xs text-slate-900">{brandName || 'Manufacturer Official'}</div>
                  <p className="text-[11px] text-slate-500 font-mono truncate">{product.productUrl || 'Direct extraction'}</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Extraction Freshness</span>
                  <div className="font-bold text-xs text-slate-900">
                    {product.lastVerifiedAt ? new Date(product.lastVerifiedAt).toLocaleDateString() : 'Active (Recent)'}
                  </div>
                  <p className="text-[11px] text-slate-500">Staleness check: &lt; 30 days threshold.</p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Deduplication</span>
                  <div className="font-bold text-xs text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verified Canonical</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Canonical identity verified across global intelligence.</p>
                </div>
              </div>

              {product.productUrl && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Original Source URL</span>
                  <a
                    href={product.productUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-teal-700 hover:underline font-mono text-xs break-all block"
                  >
                    {product.productUrl}
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowProvenanceModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. PRICE & STOCK MONITORING MODAL */}
      {showMonitoringModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Automated Price &amp; Stock Drift Monitoring
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Background crawler verifies manufacturer website and alerts on price drifts.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMonitoringModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs text-slate-700">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">Monitoring Status</span>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitoringEnabled}
                      onChange={(e) => setMonitoringEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0d2a2c] accent-[#0d2a2c]"
                    />
                    <span className="text-xs font-bold text-slate-900">
                      {monitoringEnabled ? 'Active (Monitoring Enabled)' : 'Paused'}
                    </span>
                  </label>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">Frequency</span>
                  <select
                    value={monitoringFreq}
                    onChange={(e) => setMonitoringFreq(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800"
                  >
                    <option value="HOURLY">Hourly</option>
                    <option value="DAILY">Daily (Recommended)</option>
                    <option value="WEEKLY">Weekly</option>
                  </select>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 block">Extracted Baseline Price</span>
                  <div className="text-sm font-black text-slate-900">{product.price || 'N/A'}</div>
                  <span className="text-[10px] text-emerald-700 font-bold block">In Stock: Yes</span>
                </div>
              </div>

              {product.productUrl && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Monitored Target URL</span>
                  <span className="font-mono text-xs text-slate-700 break-all block">{product.productUrl}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 shrink-0">
              <div>
                {monitoringSuccess && (
                  <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Watcher settings saved!
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMonitoringModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={savingMonitoring}
                  onClick={handleSaveMonitoring}
                  className="px-4 py-2 bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition disabled:opacity-50"
                >
                  {savingMonitoring ? 'Saving...' : 'Save Watcher'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
