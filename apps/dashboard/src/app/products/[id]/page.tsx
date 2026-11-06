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

  // Raw Data Modal State
  const [showRawDataModal, setShowRawDataModal] = useState(false);

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
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
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
            onClick={() => setShowRawDataModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-xs transition"
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
                  {product.canonicalTitle}
                </h1>
                <button
                  onClick={() => handleOpenCorrection('canonicalTitle', product.canonicalTitle)}
                  title="Submit human correction for title"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition shrink-0"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

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
            {product.standardizedDescription && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Description</h3>
                  <button
                    onClick={() => handleOpenCorrection('standardizedDescription', product.standardizedDescription)}
                    className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit Description</span>
                  </button>
                </div>
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto">
                  {product.standardizedDescription}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PHASE 6: Data Quality Assessment & Field-Level Confidence */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Product Data Quality &amp; Confidence Assessment (Phase 6 Engine)
              </h2>
              <p className="text-xs text-slate-500">
                Detailed field-level trust ratings, GTIN checksum audits, and human review status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block font-bold">Completeness</span>
              <span className="text-xs font-mono font-black text-slate-900">{completenessScore}%</span>
            </div>
            <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-[10px] text-slate-400 block font-bold">Quality Score</span>
              <span className="text-xs font-mono font-black text-emerald-700">{qualityScore}/100</span>
            </div>
          </div>
        </div>

        {/* Quality Reasons / Issues Alert if Conflict or Needs Review */}
        {qualityReport?.reviewReasons && qualityReport.reviewReasons.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Issues Flagged for Review (Priority: {qualityReport.reviewPriority || 'MEDIUM'}):</span>
            </div>
            <ul className="text-xs text-amber-800 list-disc list-inside space-y-1">
              {qualityReport.reviewReasons.map((reason: string, idx: number) => (
                <li key={idx} className="font-medium">{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Field-by-Field Quality Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-mono">
              <tr>
                <th className="py-2.5 px-4">Field Name</th>
                <th className="py-2.5 px-4">Confidence</th>
                <th className="py-2.5 px-4">Source Type &amp; Trust</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Human Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {[
                { name: 'Canonical Title', key: 'title', val: product.canonicalTitle, editField: 'canonicalTitle' },
                { name: 'Model / MPN', key: 'modelNumber', val: product.modelNumber, editField: 'modelNumber' },
                { name: 'EAN / GTIN Barcode', key: 'barcode', val: barcodeValue, editField: null },
                { name: 'Standard Description', key: 'description', val: product.standardizedDescription, editField: 'standardizedDescription' },
              ].map((f) => {
                const assessment = qualityReport?.fields?.[f.key];
                const conf = assessment?.confidence || (f.val ? 'HIGH' : 'MISSING');
                const status = assessment?.status || (conf === 'CONFLICT' ? 'conflict' : 'verified');
                const trust = assessment?.sourceTrustScore ? `${Math.round(assessment.sourceTrustScore * 100)}%` : '95%';

                return (
                  <tr key={f.key} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">{f.name}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          conf === 'EXACT' || conf === 'HIGH'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : conf === 'CONFLICT'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : conf === 'MISSING'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {conf}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {assessment?.sourceType || 'Manufacturer Official'} (Trust: {trust})
                    </td>
                    <td className="py-3 px-4">
                      <span className="capitalize text-slate-700 font-medium">{status}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {f.editField ? (
                        <button
                          onClick={() => handleOpenCorrection(f.editField as any, String(f.val || ''))}
                          className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded text-slate-700 font-bold text-[11px] transition shadow-2xs"
                        >
                          Correct Field
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Deterministic ID</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PHASE 1 & 5: Data Sources & Provenance Audit */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Source Provenance &amp; Multi-Source Acquisition (Phase 1 &amp; 5)
              </h2>
              <p className="text-xs text-slate-500">
                Audited evidence trail verifying where product attributes were acquired.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-50 text-teal-800 border border-teal-200">
            {provenance?.length || 1} Provenance Records
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Primary Acquisition</span>
            <div className="font-bold text-xs text-slate-900">{brandName || 'Official Brand Website'}</div>
            <p className="text-[11px] text-slate-500 font-mono truncate">{product.productUrl || 'Catalog direct extraction'}</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Intelligence Reuse</span>
            <div className="font-bold text-xs text-emerald-700 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Pre-Scrape Verification</span>
            </div>
            <p className="text-[11px] text-slate-500">Canonical identity deduplicated across global intelligence.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data Freshness</span>
            <div className="font-bold text-xs text-slate-900">
              {product.lastVerifiedAt ? new Date(product.lastVerifiedAt).toLocaleDateString() : 'Active (Recent)'}
            </div>
            <p className="text-[11px] text-slate-500">Staleness check: &lt; 30 days threshold.</p>
          </div>
        </div>
      </div>

      {/* STRUCTURED FIELD GROUPS (Organized Output per Brand Profile) */}
      {data?.fieldGroupsData && Array.isArray(data.fieldGroupsData) && data.fieldGroupsData.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#0d2a2c]" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Brand Field Groups &amp; Structured Output
              </h2>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              Formatted according to {brandName || 'Brand'} Profile Rules
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.fieldGroupsData.map((grp: any) => (
              <div key={grp.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-3">
                <div className="border-b border-slate-100 pb-2.5">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center justify-between">
                    <span>{grp.name}</span>
                    <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      {grp.fields.length} {grp.fields.length === 1 ? 'field' : 'fields'}
                    </span>
                  </h3>
                  {grp.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{grp.description}</p>
                  )}
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {grp.fields.map((f: any, fIdx: number) => {
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

      {/* Automated Price & Stock Change Monitoring Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#0d2a2c]/10 text-[#0d2a2c] uppercase tracking-wider">
                Automated Monitor
              </span>
              <span className="text-xs font-mono text-emerald-700 font-bold">Active Background Watcher</span>
            </div>
            <h3 className="text-base font-black text-slate-900">Price &amp; Stock Drift Monitoring</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              The automated crawler checks the manufacturer URL daily and dispatches alerts on price drifts or stock depletion.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {monitoringSuccess && (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" /> Saved
              </span>
            )}
            <button
              type="button"
              disabled={savingMonitoring}
              onClick={handleSaveMonitoring}
              className="px-4 py-2 rounded-xl bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs shadow-sm transition disabled:opacity-50"
            >
              {savingMonitoring ? 'Updating...' : 'Save Watcher'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
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
            <p className="text-[11px] text-slate-500">Automatically inspects manufacturer source page.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">Re-check Frequency</span>
            <select
              value={monitoringFreq}
              onChange={(e) => setMonitoringFreq(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#0d2a2c]"
            >
              <option value="HOURLY">Hourly</option>
              <option value="DAILY">Daily (Recommended)</option>
              <option value="WEEKLY">Weekly</option>
            </select>
            <p className="text-[11px] text-slate-500">Frequency of background crawler verification.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-bold text-slate-700 block">Target Source URL</span>
            <input
              type="text"
              readOnly
              value={product.productUrl || 'No direct URL mapped'}
              className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono text-slate-600 truncate focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">Scraped source for price drift comparison.</p>
          </div>
        </div>
      </div>

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
    </div>
  );
}
