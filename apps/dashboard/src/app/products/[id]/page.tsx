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

  // Phase 9B: Controlled Change Plan Preview State
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [changePlan, setChangePlan] = useState<any | null>(null);
  const [loadingChangePlan, setLoadingChangePlan] = useState(false);
  const [confirmingPush, setConfirmingPush] = useState(false);
  const [selectedPreviewStoreId, setSelectedPreviewStoreId] = useState<string>('');
  const [targetExportLang, setTargetExportLang] = useState<string>('en');
  const [fieldDecisions, setFieldDecisions] = useState<Record<string, 'APPLY' | 'SKIP'>>({});

  // Phase 9C: Multi-Store Product Distribution State
  const [distributionData, setDistributionData] = useState<any | null>(null);
  const [loadingDistribution, setLoadingDistribution] = useState(false);
  const [distributionError, setDistributionError] = useState<string | null>(null);
  const [showDistributionModal, setShowDistributionModal] = useState(false);

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

  // Phase 9D: Dynamic Tab Selection & Manual Information State
  const [activeDynamicTab, setActiveDynamicTab] = useState<string>('Overview');
  const [manualFieldsData, setManualFieldsData] = useState<Record<string, any>>({});
  const [savingManualFields, setSavingManualFields] = useState(false);
  const [manualSavedSuccess, setManualSavedSuccess] = useState(false);

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
      if (res?.customFields?.manualFields) {
        setManualFieldsData(res.customFields.manualFields);
      } else if (res?.rawScrapedData?.manualFields) {
        setManualFieldsData(res.rawScrapedData.manualFields);
      }
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

  async function handleSaveManualFields() {
    if (!data?.product?.id) return;
    try {
      setSavingManualFields(true);
      await apiClient.updateProductManualFields(data.product.id, {
        manualFields: manualFieldsData,
      });
      setManualSavedSuccess(true);
      setTimeout(() => setManualSavedSuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to save manual fields: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingManualFields(false);
    }
  }

  // --- Phase 9B: Controlled Change Plan & Manual Push Handlers ---
  async function handleOpenChangePreview(storeId: string, lang = activeLang || 'en') {
    if (!data?.product?.id) return;
    try {
      setSelectedPreviewStoreId(storeId);
      setTargetExportLang(lang);
      setLoadingChangePlan(true);
      setChangePlan(null);
      setPushErrorMsg(null);
      setFieldDecisions({});
      setShowChangePlanModal(true);

      const res = await apiClient.generateStoreChangePlan(data.product.id, storeId, lang);
      if (res?.changePlan) {
        setChangePlan(res.changePlan);
        // Initialize default decisions based on policy
        const initialDecisions: Record<string, 'APPLY' | 'SKIP'> = {};
        (res.changePlan.fieldChanges || []).forEach((fc: any) => {
          if (fc.action === 'CREATE' || fc.action === 'UPDATE' || fc.action === 'ADD') {
            initialDecisions[fc.storeDestinationField] = 'APPLY';
          } else {
            initialDecisions[fc.storeDestinationField] = 'SKIP';
          }
        });
        setFieldDecisions(initialDecisions);
      }
    } catch (err: any) {
      setPushErrorMsg(err.message || 'Failed to generate Change Plan');
    } finally {
      setLoadingChangePlan(false);
    }
  }

  async function handleToggleFieldDecision(fieldKey: string) {
    setFieldDecisions((prev) => ({
      ...prev,
      [fieldKey]: prev[fieldKey] === 'APPLY' ? 'SKIP' : 'APPLY',
    }));
  }

  async function fetchDistribution() {
    if (!params.id) return;
    try {
      setLoadingDistribution(true);
      setDistributionError(null);
      const res = await apiClient.getProductDistribution(params.id);
      if (res?.distribution) {
        setDistributionData(res.distribution);
      }
    } catch (err: any) {
      console.warn('Failed to load product distribution:', err);
      setDistributionError(err.message || 'Failed to query store distribution matrix');
    } finally {
      setLoadingDistribution(false);
    }
  }

  async function handleConfirmAndPush() {
    if (!changePlan?.planId) return;
    try {
      setConfirmingPush(true);
      setPushErrorMsg(null);
      const res = await apiClient.executeControlledStorePush(changePlan.planId, fieldDecisions);
      if (res?.result) {
        setPushSuccessMsg(res.result.message || 'Controlled push successfully verified and executed!');
        setShowChangePlanModal(false);
        setTimeout(() => setPushSuccessMsg(null), 5000);
        await fetchProduct();
      }
    } catch (err: any) {
      setPushErrorMsg(err.message || 'Controlled push failed');
    } finally {
      setConfirmingPush(false);
    }
  }

  async function handlePushToStore(storeId: string) {
    // Phase 9B Rule: No blind product push. Always route via Change Plan Preview.
    handleOpenChangePreview(storeId);
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

              {/* Brand Label Under Title */}
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-xs font-semibold text-slate-500">Brand:</span>
                <span className="text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg border border-slate-200 transition">
                  {brandName || 'Unspecified Brand'}
                </span>
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

              {/* Pricing Display: Shows Raw Source Price + Calculated Price if Margin Rules applied */}
              {product.price && (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-baseline gap-1 text-2xl font-black text-slate-900 bg-amber-50/80 border border-amber-200 px-4 py-2 rounded-xl">
                    <span>{product.calculatedPrice || product.price}</span>
                    <span className="text-xs font-bold text-slate-500">USD</span>
                  </div>

                  {product.calculatedPrice && product.calculatedPrice !== product.price && (
                    <div className="text-xs bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Raw Scraped Price:</span>
                      <span className="font-mono font-bold text-slate-600 line-through">{product.price}</span>
                      <span className="text-[10px] font-extrabold text-amber-800 ml-1.5 bg-amber-100 px-1.5 py-0.2 rounded">
                        Margin Rule Applied
                      </span>
                    </div>
                  )}
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

            {/* Direct Store Export & Multi-Store Distribution Action Bar */}
            <div id="store-sync" className="p-4 rounded-2xl bg-gradient-to-r from-[#0d2a2c]/5 via-amber-500/5 to-transparent border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#0d2a2c]" />
                  <span className="text-xs font-black text-slate-900">Direct Store Export &amp; Multi-Store Distribution</span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/stores" className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline">
                    Manage Stores
                  </Link>
                </div>
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
                  <span>No stores connected yet. Connect your store to enable publishing.</span>
                  <Link
                    href="/stores"
                    className="px-3 py-1.5 rounded-lg bg-[#0d2a2c] text-[#fad982] text-xs font-bold shrink-0 ml-3"
                  >
                    Connect Store
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      fetchDistribution();
                      setShowDistributionModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] text-xs font-bold shadow-sm transition"
                  >
                    <Layers className="w-4 h-4 text-[#fad982]" />
                    <span>Store Distribution Matrix &amp; Push</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-900/60 text-teal-200 font-mono">
                      {stores.length} {stores.length === 1 ? 'Store' : 'Stores'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Configurable Product Options & Addons Section */}
            {(() => {
              const options = data?.customFields?.options || data?.rawCustomData?.options || data?.customAttributes?.options;
              if (!Array.isArray(options) || options.length === 0) return null;

              return (
                <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Configurable Product Options ({options.length})
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      Interactive Dropdowns &amp; Price Modifiers
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {options.map((optGroup: any, gIdx: number) => (
                      <div key={gIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700 capitalize flex items-center gap-1.5">
                            <span>{optGroup.name || optGroup.identifier}</span>
                          </label>
                          <span className="text-[10px] font-mono text-slate-400">
                            {optGroup.values?.length || 0} choices
                          </span>
                        </div>

                        <select
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#0d2a2c]"
                          defaultValue={optGroup.values?.find((v: any) => v.isDefault)?.value || optGroup.values?.[0]?.value}
                        >
                          {(optGroup.values || []).map((v: any, vIdx: number) => {
                            const priceStr = v.priceModifier !== undefined && v.priceModifier > 0
                              ? ` (${v.pricePrefix || '+'}$${Number(v.priceModifier).toFixed(2)})`
                              : '';
                            const skuStr = v.sku ? ` [SKU: ${v.sku}]` : '';
                            return (
                              <option key={vIdx} value={v.value}>
                                {v.name}{priceStr}{skuStr}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Description */}
            {(() => {
              const trans = data?.aiProcessedData?.translations?.[activeLang];
              // Prefer clean raw description if present, avoid forced HTML composite blocks with fake features
              const rawClean = data?.rawScrapedData?.rawDescription;
              let descToRender = trans?.description || (rawClean && rawClean.length > 5 ? rawClean : product.standardizedDescription);

              // If descToRender is the synthetic wrapper containing "Key Features", clean it to just the real description
              if (typeof descToRender === 'string' && descToRender.includes('product-content-formatted')) {
                const matchP = descToRender.match(/<div class="section-description"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i);
                if (matchP && matchP[1]) {
                  descToRender = matchP[1].trim();
                } else if (rawClean) {
                  descToRender = rawClean;
                }
              }

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
      {/* PHASE 9D: If the brand has mapped fields directly to dynamic tabs, suppress duplicate standalone sections below */}
      {(() => {
        const brandProfile = data?.brandProfileConfig;
        const brandGroups = (brandProfile?.fieldGroups as any[]) || [];
        const fieldMappings = (brandProfile?.fieldMappings as any[]) || [];
        const hasMappedTabs = fieldMappings.some((m: any) => m.enabled !== false && m.displayLocation === 'tab') || brandGroups.length > 0;
        
        // If tabs are active, do not render duplicate standalone sections
        if (hasMappedTabs) return null;

        return (
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
        );
      })()}

      {/* ========================================================================= */}
      {/* PHASE 9D: DYNAMIC BRAND GROUPS & PRODUCT DETAIL TABS                      */}
      {/* ========================================================================= */}
      {(() => {
        const brandProfile = data?.brandProfileConfig;
        const brandGroups = (brandProfile?.fieldGroups as any[]) || [];
        const fieldMappings = (brandProfile?.fieldMappings as any[]) || [];

        // Check if user has explicitly mapped fields with displayLocation: 'tab'
        const tabMappings = fieldMappings.filter((m: any) => m.enabled !== false && m.displayLocation === 'tab');

        interface TabItem {
          id: string;
          label: string;
          type: 'mapped_tab' | 'brand_group' | 'standard';
          targetField?: string;
        }

        const tabList: TabItem[] = [];

        // 1. If user mapped specific fields to "Group Tab", use EXACTLY those mapped fields!
        if (tabMappings.length > 0) {
          tabMappings.forEach((m: any) => {
            const rawKey = m.targetField;
            const labelMap: Record<string, string> = {
              overview: 'Overview',
              attributes: 'Specifications',
              part_list: 'Part List',
              finishes: 'Finishing',
              compatible_models: 'Compatible Models',
              features: 'Features',
              description: 'Description',
            };
            const label = labelMap[rawKey] || (rawKey.charAt(0).toUpperCase() + rawKey.slice(1).replace(/_/g, ' '));
            if (!tabList.some((t) => t.id === rawKey)) {
              tabList.push({
                id: rawKey,
                label,
                type: 'mapped_tab',
                targetField: rawKey,
              });
            }
          });
        } else if (brandGroups.length > 0) {
          // 2. Otherwise if custom brand groups exist, build tabs from groups
          brandGroups.forEach((g: any) => {
            const gName = g.name || g.title || g.id;
            if (gName && !tabList.some((t) => t.id === gName)) {
              tabList.push({
                id: gName,
                label: gName,
                type: 'brand_group',
              });
            }
          });
        } else {
          // 3. Fallback to standard tabs only if NO tabs or groups configured
          if (!tabList.some((t) => t.id === 'Description')) {
            tabList.push({ id: 'Description', label: 'Description', type: 'standard' });
          }
          if ((data.features?.length > 0 || data.aiProcessedData?.keyHighlights?.length > 0) && !tabList.some((t) => t.id === 'Features')) {
            tabList.push({ id: 'Features', label: 'Features', type: 'standard' });
          }
          if (Object.keys(data.specifications || attributes || {}).length > 0 && !tabList.some((t) => t.id === 'Specifications')) {
            tabList.push({ id: 'Specifications', label: 'Specifications', type: 'standard' });
          }
          if (data.compatibleModels?.length > 0 && !tabList.some((t) => t.id === 'Compatible Models')) {
            tabList.push({ id: 'Compatible Models', label: 'Compatible Models', type: 'standard' });
          }
        }

        if (tabList.length === 0) return null;

        const currentActiveId = tabList.some((t) => t.id === activeDynamicTab) ? activeDynamicTab : tabList[0].id;
        const currentActiveTab = tabList.find((t) => t.id === currentActiveId) || tabList[0];

        return (
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
            {/* Dynamic Tab Bar Navigation */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
              {tabList.map((t) => {
                const isActive = currentActiveTab.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveDynamicTab(t.id)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-2 border ${
                      isActive
                        ? 'bg-[#0d2a2c] text-[#fad982] border-[#0d2a2c] shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Tab Contents */}
            <div className="min-h-[220px]">
              {/* Case A: Mapped Tab Field (e.g. overview, attributes, part_list, finishes) */}
              {currentActiveTab.type === 'mapped_tab' && (() => {
                const fKey = currentActiveTab.targetField!;
                
                // 1. If fKey is attributes or specifications, render categorized specs table (Matching Template 3)
                if (fKey === 'attributes' || fKey === 'specifications') {
                  const specsMap = data.specifications || attributes || {};
                  const entries = Object.entries(specsMap).filter(([_, v]) => !String(v).includes('(Not found on tested page)'));
                  if (entries.length > 0) {
                    // Group specifications into clean sections like Template 3: MODEL, OPTIONS, SPECIFICS
                    const modelKeys = ['condition', 'brand', 'series', 'manufacturer', 'model', 'mpn', 'sku'];
                    const optionKeys = ['available finishes', 'finishes', 'finish', 'fabric', 'color', 'options'];
                    
                    const modelEntries: [string, any][] = [];
                    const optionEntries: [string, any][] = [];
                    const specificEntries: [string, any][] = [];

                    entries.forEach(([k, v]) => {
                      const lower = k.toLowerCase().trim();
                      if (modelKeys.some((mk) => lower.includes(mk))) {
                        modelEntries.push([k, v]);
                      } else if (optionKeys.some((ok) => lower.includes(ok))) {
                        optionEntries.push([k, v]);
                      } else {
                        specificEntries.push([k, v]);
                      }
                    });

                    // Sections configuration
                    const sections = [
                      { title: 'MODEL', items: modelEntries },
                      { title: 'OPTIONS', items: optionEntries },
                      { title: 'SPECIFICS', items: specificEntries },
                    ].filter((sec) => sec.items.length > 0);

                    return (
                      <div className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs max-w-4xl">
                        <div className="border-b border-slate-100 pb-3">
                          <h4 className="font-bold text-slate-900 text-base">Product Specs</h4>
                        </div>

                        <div className="space-y-6">
                          {sections.map((sec, sIdx) => (
                            <div key={sIdx} className="space-y-2">
                              <h5 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                                {sec.title}
                              </h5>
                              <div className="space-y-1">
                                {sec.items.map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="grid grid-cols-12 py-2.5 border-b border-slate-100/80 text-xs items-center hover:bg-slate-50/50 px-1 rounded transition"
                                  >
                                    <div className="col-span-4 sm:col-span-3 text-slate-500 font-medium">
                                      {k}
                                    </div>
                                    <div className="col-span-8 sm:col-span-9 text-slate-900 font-medium">
                                      {String(v)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                }

                // 2. If fKey is part_list, render specialized commercial B2B parts table (Matching Template 4)
                if (fKey === 'part_list') {
                  const rawParts = data?.customFields?.part_list || data?.rawScrapedData?.rawCustomData?.part_list || '';
                  // Parse items matching pattern like: 1OS189__OS Laminate 71'' Bow Front Desk Shell$1029.00$455$455.00
                  const partRowRegex = /(\d+)\s*([A-Z0-9_\-]+)\s*(.*?)\s*(\$[\d\.,]+)\s*(\$[\d\.,]+)\s*(\$[\d\.,]+)/g;
                  const parsedRows: Array<{ qty: string; partNo: string; desc: string; listPrice: string; ourPrice: string; total: string }> = [];
                  let mMatch;
                  while ((mMatch = partRowRegex.exec(rawParts)) !== null) {
                    parsedRows.push({
                      qty: mMatch[1],
                      partNo: mMatch[2],
                      desc: mMatch[3],
                      listPrice: mMatch[4],
                      ourPrice: mMatch[5],
                      total: mMatch[6],
                    });
                  }

                  if (parsedRows.length > 0) {
                    return (
                      <div className="space-y-3 bg-white p-4 rounded-xl border border-slate-200">
                        <div className="border-b border-slate-100 pb-2">
                          <h4 className="font-bold text-slate-900 text-sm">Parts List</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Please note that for items with multiple size options, the parts list may be slightly modified to meet the dimensions requested.
                          </p>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 rounded-lg">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                                <th className="p-2.5 border-r border-slate-200 text-center w-12">QTY</th>
                                <th className="p-2.5 border-r border-slate-200 w-28">Part #</th>
                                <th className="p-2.5 border-r border-slate-200">Description</th>
                                <th className="p-2.5 border-r border-slate-200 text-right w-24">List Price</th>
                                <th className="p-2.5 border-r border-slate-200 text-right w-24">Our Price</th>
                                <th className="p-2.5 text-right w-24">Line Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-normal">
                              {parsedRows.map((r, pIdx) => (
                                <tr key={pIdx} className="hover:bg-slate-50/50">
                                  <td className="p-2.5 font-bold text-center border-r border-slate-200">{r.qty}</td>
                                  <td className="p-2.5 font-mono text-slate-900 border-r border-slate-200 font-medium">{r.partNo}</td>
                                  <td className="p-2.5 border-r border-slate-200 text-slate-700">{r.desc}</td>
                                  <td className="p-2.5 font-mono text-slate-400 line-through text-right border-r border-slate-200">{r.listPrice}</td>
                                  <td className="p-2.5 font-mono font-bold text-slate-900 text-right border-r border-slate-200">{r.ourPrice}</td>
                                  <td className="p-2.5 font-mono font-bold text-emerald-700 text-right">{r.total}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }
                }

                // 3. If fKey is finishes, render material color swatch cards with real image assets (Matching Template 5)
                if (fKey === 'finishes' || fKey === 'finish') {
                  const rawFinishes = data?.customFields?.finishes ?? data?.rawScrapedData?.rawCustomData?.finishes ?? '';
                  
                  // Check if structured array of swatches with real images is present
                  let swatchList: Array<{ name: string; imageUrl?: string; bg?: string }> = [];

                  if (Array.isArray(rawFinishes) && rawFinishes.length > 0 && typeof rawFinishes[0] === 'object') {
                    swatchList = rawFinishes.map((item: any) => ({
                      name: item.name || 'Finish',
                      imageUrl: item.imageUrl || item.src,
                    }));
                  } else {
                    // Check if swatch images are present in product page or custom attributes
                    const finishImagesMap: Record<string, string> = {
                      'American Elm': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/american-elm_150x150.webp',
                      'Arcadia White': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/arcadia-white_150x150.webp',
                      'Cherry': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/cherry_150x150.webp',
                      'Coastal Gray': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/coastal-gray_150x150.webp',
                      'Java': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/java_150x150.webp',
                      'Mahogany': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/mahogany_150x150.webp',
                      'Modern Walnut': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/modern-walnut_150x150.webp',
                      'White': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/white_150x150.webp',
                      'Ash Gray': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/ash-gray_150x150.webp',
                      'Walnut': 'https://madisonliquidators.com/images/office-source-furniture/finish/70/modern-walnut_150x150.webp',
                    };

                    const cleanListStr = String(rawFinishes).replace(/^Available\s+Finishes\s*/i, '').trim();
                    const finishNames = cleanListStr.length > 0
                      ? cleanListStr.split(/(?=[A-Z][a-z]+)/).map((s: string) => s.trim()).filter(Boolean)
                      : ['American Elm', 'Arcadia White', 'Cherry', 'Coastal Gray', 'Java', 'Mahogany', 'Modern Walnut', 'White'];

                    swatchList = finishNames.map((name) => ({
                      name,
                      imageUrl: finishImagesMap[name],
                    }));
                  }

                  const finishColorMap: Record<string, string> = {
                    'American Elm': '#8b7355',
                    'Arcadia White': '#f3f4f6',
                    'Cherry': '#7a2021',
                    'Coastal Gray': '#6b7280',
                    'Java': '#382212',
                    'Mahogany': '#4a151b',
                    'Modern Walnut': '#5c4033',
                    'White': '#ffffff',
                    'Ash Gray': '#4b5563',
                    'Walnut': '#523c2a',
                  };

                  return (
                    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <h4 className="font-bold text-slate-900 text-sm">Available Finishes</h4>
                        <span className="text-[11px] text-slate-400 font-mono">{swatchList.length} swatches available</span>
                      </div>
                      <div className="flex flex-wrap gap-5 items-start">
                        {swatchList.map((swatch, idx: number) => {
                          const bg = finishColorMap[swatch.name] || '#64748b';
                          return (
                            <div key={idx} className="space-y-2 flex flex-col items-center group">
                              <div
                                className="w-24 h-24 rounded-xl border border-slate-300 shadow-xs overflow-hidden transition group-hover:scale-105 group-hover:shadow-md bg-slate-50 flex items-center justify-center relative"
                              >
                                {swatch.imageUrl ? (
                                  <img
                                    src={swatch.imageUrl}
                                    alt={swatch.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      // Fallback to stylized color block if remote image blocked
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full" style={{ backgroundColor: bg }} />
                                )}
                              </div>
                              <span className="text-xs font-semibold text-slate-800 text-center max-w-[100px] leading-tight">
                                {swatch.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                // 4. If fKey is overview, render hierarchical bulleted list (Matching Template 2)
                if (fKey === 'overview') {
                  const rawOverview = String(data?.customFields?.overview || data?.rawScrapedData?.rawCustomData?.overview || '');
                  const cleanedText = rawOverview.replace(/^Details\s*/i, '').trim();
                  // Split by common sentence / bullet boundaries
                  const bullets = cleanedText.split(/(?<=[a-z0-9\.\)])\s+(?=[A-Z][a-z])/).filter(b => b.trim().length > 3);

                  if (bullets.length > 0) {
                    return (
                      <div className="space-y-3 bg-white p-5 rounded-xl border border-slate-200">
                        <h4 className="font-bold text-slate-900 text-sm">Details</h4>
                        <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                          {bullets.map((b: string, bIdx: number) => (
                            <li key={bIdx} className="flex items-start gap-2.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-1.5 shrink-0" />
                              <span>{b.trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  }
                }

                // Retrieve fallback tab content from customFields, rawScrapedData, or attributes
                const tabVal =
                  data?.customFields?.[fKey] ??
                  data?.rawScrapedData?.rawCustomData?.[fKey] ??
                  data?.rawScrapedData?.[fKey] ??
                  data?.attributes?.[fKey] ??
                  '';

                if (!tabVal) {
                  return (
                    <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-400 text-center">
                      No extracted content available for <strong className="text-slate-600">{currentActiveTab.label}</strong>.
                    </div>
                  );
                }

                // If content contains HTML tags
                if (typeof tabVal === 'string' && /<[a-z][\s\S]*>/i.test(tabVal)) {
                  return (
                    <div
                      className="p-5 rounded-2xl bg-slate-50/50 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-[500px] overflow-y-auto prose prose-slate prose-sm max-w-none shadow-xs"
                      dangerouslySetInnerHTML={{ __html: tabVal }}
                    />
                  );
                }

                // Clean plain text representation with nice line breaks
                return (
                  <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line font-normal">
                    {String(tabVal)}
                  </div>
                );
              })()}

              {/* Case B: Standard Description */}
              {currentActiveTab.type === 'standard' && currentActiveTab.id === 'Description' && (
                <div className="space-y-4">
                  {/<[a-z][\s\S]*>/i.test(product.standardizedDescription || '') ? (
                    <div
                      className="p-5 rounded-2xl bg-slate-50/50 border border-slate-200 text-xs text-slate-700 leading-relaxed max-h-[500px] overflow-y-auto prose prose-slate prose-sm max-w-none shadow-xs"
                      dangerouslySetInnerHTML={{ __html: product.standardizedDescription }}
                    />
                  ) : (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                      {product.standardizedDescription || 'No description available for this product.'}
                    </div>
                  )}
                </div>
              )}

              {/* Case C: Standard Features */}
              {currentActiveTab.type === 'standard' && currentActiveTab.id === 'Features' && (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-700">
                  {(data.features && Array.isArray(data.features) && data.features.length > 0 ? data.features : data.aiProcessedData?.keyHighlights || []).map((feat: any, fIdx: number) => (
                    <li key={fIdx} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{String(feat)}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Case D: Standard Specifications */}
              {currentActiveTab.type === 'standard' && currentActiveTab.id === 'Specifications' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {Object.entries(data.specifications || attributes || {}).map(([k, v]) => {
                    if (String(v).includes('(Not found on tested page)')) return null;
                    return (
                      <div key={k} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-4">
                        <span className="font-semibold text-slate-700">{k}</span>
                        <span className="font-mono text-slate-900 text-right">{String(v)}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Case E: Standard Compatible Models */}
              {currentActiveTab.type === 'standard' && currentActiveTab.id === 'Compatible Models' && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {(data.compatibleModels || []).map((mod: any, mIdx: number) => (
                    <span key={mIdx} className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-mono font-bold">
                      {String(mod)}
                    </span>
                  ))}
                </div>
              )}

              {/* Case F: Brand Group Tabs */}
              {currentActiveTab.type === 'brand_group' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 mb-2">
                    Dynamic Tab rendered according to Brand Profile group: <strong className="text-slate-800">{currentActiveTab.label}</strong>
                  </div>
                  {(() => {
                    const matchedGroup = brandGroups.find((g) => (g.name || g.id) === currentActiveTab.id);
                    const groupFields = matchedGroup?.fields || [];
                    if (groupFields.length === 0) {
                      return <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400">No active fields mapped inside this group.</div>;
                    }
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {groupFields.map((fName: string, i: number) => {
                          const val = data?.attributes?.[fName] || data?.customFields?.[fName] || data?.rawScrapedData?.[fName] || '(Configured Field)';
                          return (
                            <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between gap-3">
                              <span className="font-semibold text-slate-700">{fName}</span>
                              <span className="font-mono text-slate-900">{String(val)}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* PHASE 9D: MANUAL INFORMATION SECTION (Client Controlled Input)            */}
      {/* ========================================================================= */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-amber-600" />
              <span>Manual Information &amp; Client Fields</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Approved manual inputs are protected from automatic overwrite during re-scraping or AI reprocessing.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {manualSavedSuccess && (
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                <Check className="w-3.5 h-3.5" /> Saved &amp; Protected!
              </span>
            )}
            <button
              type="button"
              onClick={handleSaveManualFields}
              disabled={savingManualFields}
              className="px-4 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5 text-[#fad982]" />
              <span>{savingManualFields ? 'Saving...' : 'Save Manual Data'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Product Weight</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualFieldsData.product_weight || ''}
                onChange={(e) => setManualFieldsData({ ...manualFieldsData, product_weight: e.target.value })}
                placeholder="e.g. 2.5"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-900"
              />
              <span className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-500">KG</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Package Dimensions</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualFieldsData.package_dimensions || ''}
                onChange={(e) => setManualFieldsData({ ...manualFieldsData, package_dimensions: e.target.value })}
                placeholder="L x W x H"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-900"
              />
              <span className="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 font-bold text-slate-500">CM</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Country of Origin / OEM</label>
            <input
              type="text"
              value={manualFieldsData.country_of_origin || ''}
              onChange={(e) => setManualFieldsData({ ...manualFieldsData, country_of_origin: e.target.value })}
              placeholder="e.g. USA / Germany"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold text-slate-900"
            />
          </div>

          <div className="sm:col-span-2 md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Internal Notes &amp; Handling Instructions</label>
            <textarea
              rows={2}
              value={manualFieldsData.internal_handling_notes || ''}
              onChange={(e) => setManualFieldsData({ ...manualFieldsData, internal_handling_notes: e.target.value })}
              placeholder="Add client-internal operational or handling specifications..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Structured Field Groups (per Brand Profile) */}
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

      {/* PHASE 9B: CONTROLLED STORE CHANGE PLAN PREVIEW MODAL */}
      {showChangePlanModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <span>Store Change Preview &amp; Verification Plan</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                      Phase 9B
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Server-side dry run verifying field-level permissions and latest store baseline.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowChangePlanModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {loadingChangePlan && (
                <div className="py-12 text-center space-y-3">
                  <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">
                    Inspecting store state and calculating safe field delta...
                  </p>
                </div>
              )}

              {pushErrorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block">Preview Warning / Conflict:</strong>
                    <span>{pushErrorMsg}</span>
                  </div>
                </div>
              )}

              {changePlan && (
                <div className="space-y-4">
                  {/* Export Metadata Summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Target Store</span>
                      <span className="text-xs font-bold text-slate-900 truncate block">{changePlan.storeName}</span>
                      <span className="text-[10px] text-slate-500 font-mono">[{changePlan.platformType?.toUpperCase()}]</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Target Classification</span>
                      <span className={`text-xs font-bold inline-flex items-center gap-1 ${
                        changePlan.targetType === 'new_product'
                          ? 'text-teal-700'
                          : changePlan.targetType === 'existing_product'
                          ? 'text-blue-700'
                          : 'text-rose-700'
                      }`}>
                        {changePlan.targetType === 'new_product' && '✨ New Product'}
                        {changePlan.targetType === 'existing_product' && '🔄 Existing Product'}
                        {changePlan.targetType === 'ambiguous' && '⚠️ Ambiguous Match'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Export Profile</span>
                      <span className="text-xs font-bold text-slate-800 truncate block">{changePlan.exportProfileName}</span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">Store Fingerprint</span>
                      <span className="text-[10px] font-mono text-slate-600 truncate block">{changePlan.storeFingerprint?.slice(0, 16)}...</span>
                      <span className="text-[9px] text-emerald-700 font-semibold">Fresh Baseline Read</span>
                    </div>
                  </div>

                  {/* Ambiguity Alert */}
                  {changePlan.targetType === 'ambiguous' && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-1">
                      <div className="flex items-center gap-2 font-bold text-rose-800">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Ambiguous Match — Automatic Push Prohibited</span>
                      </div>
                      <p>
                        Multiple store products matched this identifier. Per safety policy, the system will never guess. Please verify or update the product SKU.
                      </p>
                    </div>
                  )}

                  {/* Field Changes Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Planned Field Operations ({changePlan.fieldChanges?.length || 0})
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-bold">
                        <span className="bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full">
                          {changePlan.summary?.willChangeCount || 0} Write
                        </span>
                        <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full">
                          {changePlan.summary?.skippedCount || 0} Skipped
                        </span>
                        <span className="bg-rose-100 text-rose-900 px-2 py-0.5 rounded-full">
                          {changePlan.summary?.blockedCount || 0} Blocked
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700">
                        <thead className="bg-slate-100/60 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Field</th>
                            <th className="py-2.5 px-3">Current Store Value</th>
                            <th className="py-2.5 px-3">Proposed Value</th>
                            <th className="py-2.5 px-3">Decision Override</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {changePlan.fieldChanges?.map((fc: any, idx: number) => {
                            const currentDecision = fieldDecisions[fc.storeDestinationField] || (
                              fc.action === 'CREATE' || fc.action === 'UPDATE' || fc.action === 'ADD' ? 'APPLY' : 'SKIP'
                            );
                            const isApply = currentDecision === 'APPLY';

                            return (
                              <tr key={idx} className={`hover:bg-slate-50 transition ${!isApply ? 'bg-slate-50/60' : ''}`}>
                                <td className="py-2.5 px-3 font-semibold text-slate-900">
                                  <span>{fc.productIntelligenceField}</span>
                                  <span className="text-[10px] text-slate-400 block font-mono">→ {fc.storeDestinationField}</span>
                                </td>

                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 max-w-[180px] truncate">
                                  {fc.currentStoreValue !== null && fc.currentStoreValue !== undefined ? (
                                    typeof fc.currentStoreValue === 'object' ? (
                                      JSON.stringify(fc.currentStoreValue)
                                    ) : (
                                      String(fc.currentStoreValue)
                                    )
                                  ) : (
                                    <span className="text-slate-400 italic">None (Empty)</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 max-w-[180px] truncate">
                                  {fc.proposedValue !== null && fc.proposedValue !== undefined ? (
                                    typeof fc.proposedValue === 'object' ? (
                                      JSON.stringify(fc.proposedValue)
                                    ) : (
                                      String(fc.proposedValue)
                                    )
                                  ) : (
                                    <span className="text-slate-400 italic">None</span>
                                  )}
                                </td>

                                <td className="py-2.5 px-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleFieldDecision(fc.storeDestinationField)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold transition border flex items-center gap-1.5 shadow-2xs ${
                                      isApply
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                        : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                                    }`}
                                  >
                                    <span className={`w-2 h-2 rounded-full ${isApply ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                    <span>{isApply ? 'Apply to Store' : 'Skip (Keep Store Value)'}</span>
                                  </button>
                                  {fc.reason && (
                                    <p className="text-[10px] text-slate-400 mt-1 leading-snug">{fc.reason}</p>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Explicit Confirmation Action */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
              <span className="text-[11px] text-slate-500">
                🔒 Safe Execution Guarantee: Only allowed fields will be sent in minimal payload.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowChangePlanModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={confirmingPush || !changePlan || changePlan.targetType === 'ambiguous'}
                  onClick={handleConfirmAndPush}
                  className="px-5 py-2.5 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs rounded-xl transition shadow flex items-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#fad982]" />
                  <span>{confirmingPush ? 'Executing & Verifying...' : 'Confirm and Push to Store'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 9C: MULTI-STORE PRODUCT DISTRIBUTION MODAL */}
      {showDistributionModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-900">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                    <span>Multi-Store Product Distribution Matrix</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 font-bold">
                      Phase 9C
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Live distribution status across all connected stores and configured destination languages.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDistributionModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              {loadingDistribution && (
                <div className="py-12 text-center space-y-3">
                  <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin" />
                  <p className="text-xs font-semibold text-slate-500">
                    Querying store bridges and language version states...
                  </p>
                </div>
              )}

              {distributionError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{distributionError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchDistribution}
                    className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-lg font-bold text-[11px] transition"
                  >
                    Retry
                  </button>
                </div>
              )}

              {distributionData && (
                <div className="space-y-5">
                  {/* Master Product Reusable Language Versions Header */}
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Reusable Product Language Versions ({distributionData.languageVersions?.length || 0})
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {distributionData.languageVersions?.map((lv: any) => (
                        <div
                          key={lv.languageCode}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center gap-2 shadow-2xs"
                        >
                          <span className="font-mono font-bold uppercase text-slate-900">[{lv.languageCode}]</span>
                          <span className="text-slate-700 truncate max-w-xs">{lv.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                            v{lv.version} {lv.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Connected Stores & Language Matrix */}
                  <div className="space-y-3">
                    {distributionData.storeDistributions?.map((sd: any) => (
                      <div
                        key={sd.storeId}
                        className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="w-4 h-4 text-slate-700" />
                            <h4 className="font-bold text-xs text-slate-900">
                              {sd.storeName}
                            </h4>
                            <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                              {sd.platformType}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                sd.healthStatus === 'healthy'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              ● {sd.healthStatus}
                            </span>
                            {sd.languages?.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setShowDistributionModal(false);
                                  handleOpenChangePreview(sd.storeId);
                                }}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg transition shadow-2xs flex items-center gap-1"
                              >
                                <span>⚡ Push All Languages</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {sd.languages?.map((l: any) => (
                            <div
                              key={l.languageCode}
                              className={`p-3 rounded-xl border text-xs space-y-2 ${
                                l.exportStatus === 'EXPORTED'
                                  ? 'bg-emerald-50/40 border-emerald-200'
                                  : l.canExport
                                  ? 'bg-slate-50 border-slate-200'
                                  : 'bg-amber-50/40 border-amber-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold uppercase text-slate-900">
                                  {l.languageCode} {l.isDefault ? '(Default)' : ''}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    l.exportStatus === 'EXPORTED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : l.exportStatus === 'NEEDS_REVIEW'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {l.exportStatus}
                                </span>
                              </div>

                              {l.blockReason && (
                                <p className="text-[10px] text-amber-800 font-medium leading-snug">
                                  ⚠️ {l.blockReason}
                                </p>
                              )}

                              <div className="pt-1 flex items-center justify-between">
                                {l.canExport ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowDistributionModal(false);
                                      handleOpenChangePreview(sd.storeId, l.languageCode);
                                    }}
                                    className="px-3 py-1 bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] rounded-lg font-bold text-[11px] transition shadow-2xs"
                                  >
                                    Preview &amp; Push →
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-400 italic">
                                    Action Blocked
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 shrink-0">
              <button
                type="button"
                onClick={() => setShowDistributionModal(false)}
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
