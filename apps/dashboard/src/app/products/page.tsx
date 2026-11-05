'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Tag,
  ArrowUpDown,
  Layers,
  Filter,
  Plus,
  X,
  Globe,
  SlidersHorizontal,
  Play,
  Save,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Edit2,
  Check,
  Package,
  Download,
  UploadCloud,
  FileSpreadsheet,
  ShoppingBag
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');

  // Add Product Workflow Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [brandsList, setBrandsList] = useState<any[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedSourceUrl, setSelectedSourceUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');
  const [urlValidationError, setUrlValidationError] = useState('');
  const [urlValidSuccess, setUrlValidSuccess] = useState(false);

  // Extraction & Review States
  const [extracting, setExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');
  const [extractedData, setExtractedData] = useState<any | null>(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Review Form & AI Enrichment States
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewModel, setReviewModel] = useState('');
  const [reviewSku, setReviewSku] = useState('');
  const [reviewPrice, setReviewPrice] = useState('');
  const [reviewDescription, setReviewDescription] = useState('');
  const [reviewPrimaryImage, setReviewPrimaryImage] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewAttributes, setReviewAttributes] = useState<Record<string, any>>({});
  const [reviewCustomFields, setReviewCustomFields] = useState<Record<string, any>>({});
  const [aiEnriching, setAiEnriching] = useState(false);
  const [aiEnriched, setAiEnriched] = useState(false);
  const [aiEnrichMeta, setAiEnrichMeta] = useState<any>(null);
  const [originalRawData, setOriginalRawData] = useState<{ title: string; description: string } | null>(null);

  // Bulk Scrape & Export States
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchUrlsInput, setBatchUrlsInput] = useState('');
  const [batchBrandId, setBatchBrandId] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState('');
  const [exportingCsv, setExportingCsv] = useState(false);

  async function loadCatalog() {
    try {
      setLoading(true);
      const [res, brandsRes] = await Promise.allSettled([
        apiClient.getProducts({ limit: 50 }),
        apiClient.getBrands(),
      ]);

      if (res.status === 'fulfilled') {
        setProducts(res.value?.data || res.value?.items || []);
      }
      if (brandsRes.status === 'fulfilled') {
        setBrandsList(Array.isArray(brandsRes.value) ? brandsRes.value : []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  // Load client's tenant brand profiles when opening modal
  async function handleOpenAddModal() {
    setShowAddModal(true);
    setExtractionError('');
    setExtractedData(null);
    setUrlValidationError('');
    setUrlValidSuccess(false);
    setProductUrl('');
    setSelectedBrandId('');
    setSelectedSourceUrl('');

    try {
      setLoadingBrands(true);
      const list = await apiClient.getBrands();
      setBrandsList(Array.isArray(list) ? list : []);

      // If user has exactly one brand, auto-select it
      if (Array.isArray(list) && list.length === 1) {
        handleSelectBrand(list[0].id, list);
      }
    } catch (err: any) {
      console.error('Failed to load brand profiles for Add Product:', err);
    } finally {
      setLoadingBrands(false);
    }
  }

  const selectedBrand = brandsList.find((b) => b.id === selectedBrandId) || null;

  function handleSelectBrand(brandId: string, currentList?: any[]) {
    const list = currentList || brandsList;
    const b = list.find((item) => item.id === brandId);
    setSelectedBrandId(brandId);
    setExtractionError('');
    setExtractedData(null);
    setProductUrl('');
    setUrlValidationError('');
    setUrlValidSuccess(false);

    if (b) {
      // Auto-select source if only 1 source or official website
      const sources = Array.isArray(b.sourceConfigs) ? b.sourceConfigs : [];
      if (sources.length === 1 && sources[0].url) {
        setSelectedSourceUrl(sources[0].url);
      } else if (b.officialWebsite) {
        setSelectedSourceUrl(b.officialWebsite);
      } else if (sources.length > 0 && sources[0].url) {
        setSelectedSourceUrl(sources[0].url);
      } else {
        setSelectedSourceUrl('');
      }
    } else {
      setSelectedSourceUrl('');
    }
  }

  // Validate URL against Brand Domain / Sources dynamically
  function handleUrlChange(newUrl: string) {
    setProductUrl(newUrl);
    setUrlValidationError('');
    setUrlValidSuccess(false);

    if (!newUrl.trim()) return;

    try {
      const parsed = new URL(newUrl.trim());
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');

      if (!selectedBrand) {
        setUrlValidationError('Please select a Brand Profile first');
        return;
      }

      // Collect all authorized domains for this brand
      const allowedDomains: string[] = [];
      if (selectedBrand.officialWebsite) {
        try {
          allowedDomains.push(new URL(selectedBrand.officialWebsite).hostname.toLowerCase().replace(/^www\./, ''));
        } catch (_) {}
      }
      if (Array.isArray(selectedBrand.sourceConfigs)) {
        for (const src of selectedBrand.sourceConfigs) {
          if (src.url) {
            try {
              allowedDomains.push(new URL(src.url).hostname.toLowerCase().replace(/^www\./, ''));
            } catch (_) {}
          }
        }
      }

      // Also check normalized brand name match (e.g. traxxas.com matching traxxas)
      const brandNormalized = selectedBrand.normalizedName || selectedBrand.name?.toLowerCase().replace(/[^a-z0-9]/g, '');

      const isMatch = allowedDomains.some((d) => host === d || host.endsWith(`.${d}`)) ||
        (allowedDomains.length === 0 && host.includes(brandNormalized));

      if (isMatch) {
        setUrlValidSuccess(true);
        setUrlValidationError('');
      } else {
        const domainList = allowedDomains.length > 0 ? allowedDomains.join(', ') : `${brandNormalized}.*`;
        setUrlValidationError(`URL domain "${host}" does not match approved domains for ${selectedBrand.name} (${domainList})`);
      }
    } catch (_) {
      setUrlValidationError('Please enter a valid HTTP/HTTPS URL');
    }
  }

  // Execute Brand-Driven Extraction using Brand's configured field mappings
  async function handleExtractProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBrandId || !productUrl.trim()) return;

    try {
      setExtracting(true);
      setExtractionError('');
      setExtractedData(null);

      // Call test-mapping endpoint with the brand's configured mappings
      const res = await apiClient.testBrandMapping(selectedBrandId, {
        sampleUrl: productUrl.trim(),
        mappings: selectedBrand?.fieldMappings || [],
      });

      if (!res.results || Object.keys(res.results).length === 0) {
        throw new Error('No data could be extracted. Check Brand Profile field mappings.');
      }

      const results = res.results;
      setExtractedData(results);

      // Populate review form with extracted values
      const nameVal = results.name?.extractedValue || results.title?.extractedValue || '';
      const modelVal = results.model?.extractedValue || results.modelNumber?.extractedValue || '';
      const skuVal = results.sku?.extractedValue || '';
      const priceVal = results.price?.extractedValue || '';
      const descVal = typeof results.description?.extractedValue === 'string' ? results.description.extractedValue : '';

      let imgList: string[] = [];
      let primaryImg = '';

      if (Array.isArray(results.images?.extractedValue)) {
        imgList = results.images.extractedValue;
        primaryImg = imgList[0] || '';
      } else if (typeof results.images?.extractedValue === 'string' && results.images.extractedValue.startsWith('http')) {
        imgList = [results.images.extractedValue];
        primaryImg = results.images.extractedValue;
      }

      if (Array.isArray(results.extra_iamge?.extractedValue)) {
        for (const extra of results.extra_iamge.extractedValue) {
          if (!imgList.includes(extra)) imgList.push(extra);
        }
      }

      setReviewTitle(nameVal);
      setReviewModel(modelVal);
      setReviewSku(skuVal);
      setReviewPrice(priceVal);
      setReviewDescription(descVal);
      setReviewPrimaryImage(primaryImg);
      setReviewImages(imgList);
      setReviewAttributes(
        results.attributes?.extractedValue && typeof results.attributes.extractedValue === 'object'
          ? results.attributes.extractedValue
          : {}
      );

      // Collect all custom non-standard fields (e.g. futured, extra_iamge, etc.)
      const customCollected: Record<string, any> = {};
      const standardKeys = ['name', 'model', 'sku', 'price', 'description', 'images', 'attributes'];
      for (const [k, valObj] of Object.entries(results || {})) {
        if (!standardKeys.includes(k) && (valObj as any)?.extractedValue && (valObj as any).status !== 'missing' && (valObj as any).status !== 'error') {
          customCollected[k] = (valObj as any).extractedValue;
        }
      }
      setReviewCustomFields(customCollected);
      setAiEnriched(false);
      setAiEnrichMeta(null);
      setOriginalRawData(null);
    } catch (err: any) {
      setExtractionError(err.message || 'Product extraction failed');
    } finally {
      setExtracting(false);
    }
  }

  // Hierarchical AI Product Enrichment (Global Workspace Prompt + Brand Prompt Rules)
  async function handleEnrichWithAi() {
    if (!reviewTitle.trim() && !reviewDescription.trim()) return;
    try {
      setAiEnriching(true);
      setExtractionError('');

      // Cache original raw scraped data so user can revert anytime
      if (!originalRawData) {
        setOriginalRawData({
          title: reviewTitle,
          description: reviewDescription,
        });
      }

      const res = await apiClient.enrichProductWithAi({
        brandId: selectedBrandId || undefined,
        brandName: selectedBrand?.name || undefined,
        rawTitle: reviewTitle,
        rawDescription: reviewDescription,
        modelNumber: reviewModel || undefined,
        sku: reviewSku || undefined,
        price: reviewPrice || undefined,
        attributes: reviewAttributes,
        customFields: reviewCustomFields,
      });

      if (res?.data) {
        if (res.data.enhancedTitle) setReviewTitle(res.data.enhancedTitle);
        if (res.data.enhancedDescription) setReviewDescription(res.data.enhancedDescription);
        setAiEnriched(true);
        setAiEnrichMeta(res.meta || null);
      }
    } catch (err: any) {
      setExtractionError(err.message || 'AI Enrichment failed');
    } finally {
      setAiEnriching(false);
    }
  }

  function handleRevertToRaw() {
    if (originalRawData) {
      setReviewTitle(originalRawData.title);
      setReviewDescription(originalRawData.description);
      setAiEnriched(false);
    }
  }

  // Save reviewed product directly into Client Catalog
  async function handleSaveExtractedProduct() {
    if (!reviewTitle.trim()) {
      alert('Product title is required');
      return;
    }

    try {
      setSavingProduct(true);
      setExtractionError('');

      await apiClient.createProduct({
        brandId: selectedBrandId,
        productUrl: productUrl.trim(),
        title: reviewTitle.trim(),
        modelNumber: reviewModel.trim() || undefined,
        sku: reviewSku.trim() || undefined,
        price: reviewPrice.trim() || undefined,
        description: reviewDescription.trim() || undefined,
        primaryImageUrl: reviewPrimaryImage || undefined,
        images: reviewImages,
        attributes: reviewAttributes,
        customData: reviewCustomFields,
      });

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setShowAddModal(false);
        loadCatalog();
      }, 1500);
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to save product to catalog');
    } finally {
      setSavingProduct(false);
    }
  }

  // Handle Export to CSV (Shopify or Universal)
  async function handleExportCsv(format: 'shopify' | 'universal' = 'shopify') {
    try {
      setExportingCsv(true);
      const blob = await apiClient.exportCatalogCsv(format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${format}_catalog_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingCsv(false);
    }
  }

  // Handle Open Batch Scrape Modal
  async function handleOpenBatchModal() {
    setShowBatchModal(true);
    setBatchUrlsInput('');
    setBatchSuccessMsg('');
    setExtractionError('');
    try {
      setLoadingBrands(true);
      const list = await apiClient.getBrands();
      setBrandsList(Array.isArray(list) ? list : []);
      if (Array.isArray(list) && list.length > 0 && !batchBrandId) {
        setBatchBrandId(list[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBrands(false);
    }
  }

  // Handle Submit Batch Scraping
  async function handleSubmitBatchScrape(e: React.FormEvent) {
    e.preventDefault();
    const rawList = batchUrlsInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u.length > 0 && (u.startsWith('http://') || u.startsWith('https://')));

    if (rawList.length === 0) {
      alert('Please enter at least one valid product URL (https://...)');
      return;
    }

    try {
      setBatchSubmitting(true);
      setExtractionError('');
      const res = await apiClient.batchScrape({
        brandId: batchBrandId,
        urls: rawList,
      });

      setBatchSuccessMsg(`Success! Queued ${res.count || rawList.length} products for automated background scraping.`);
      setTimeout(() => {
        setShowBatchModal(false);
        setBatchSuccessMsg('');
      }, 3000);
    } catch (err: any) {
      setExtractionError(err.message || 'Batch scrape dispatch failed');
    } finally {
      setBatchSubmitting(false);
    }
  }

  const filtered = products.filter((p) => {
    const matchesSearch =
      p.canonicalTitle?.toLowerCase().includes(search.toLowerCase()) ||
      p.modelNumber?.toLowerCase().includes(search.toLowerCase()) ||
      p.gtinEan?.toLowerCase().includes(search.toLowerCase());
    const matchesBrand = brandFilter === 'ALL' || p.brand?.toLowerCase() === brandFilter.toLowerCase();
    return matchesSearch && matchesBrand;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Product Catalog</h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Browse normalized catalog entries, verified EAN/GTINs, provenance audits, and tenant overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-sm">
            Total Entities: {filtered.length}
          </span>

          {/* Export Dropdown / Button */}
          <button
            onClick={() => handleExportCsv('shopify')}
            disabled={exportingCsv || products.length === 0}
            title="Download full catalog as Shopify-compatible CSV"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{exportingCsv ? 'Exporting...' : 'Export Shopify CSV'}</span>
          </button>

          {/* Bulk Import Button */}
          <button
            onClick={handleOpenBatchModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0d2a2c]/10 hover:bg-[#0d2a2c]/20 text-[#0d2a2c] font-bold text-xs rounded-xl transition"
          >
            <UploadCloud className="w-3.5 h-3.5 text-[#0d2a2c]" />
            <span>Batch Scrape (Multi-URL)</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Title, GTIN/EAN, or MPN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition"
          />
        </div>

        {/* Dynamic Brand Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setBrandFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              brandFilter === 'ALL' ? 'bg-[#0d2a2c] text-[#fad982] shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ALL
          </button>
          {brandsList.map((b) => (
            <button
              key={b.id}
              onClick={() => setBrandFilter(b.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase ${
                brandFilter.toLowerCase() === b.name?.toLowerCase()
                  ? 'bg-[#0d2a2c] text-[#fad982] shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
            <tr>
              <th className="py-3.5 px-5">Product Details</th>
              <th className="py-3.5 px-4">Brand</th>
              <th className="py-3.5 px-4">Identifiers</th>
              <th className="py-3.5 px-4">Sources / Variants</th>
              <th className="py-3.5 px-4">Store Sync</th>
              <th className="py-3.5 px-4">Price Est.</th>
              <th className="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Loading catalog entries from database...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <Package className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">No products in your catalog yet</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      You haven&apos;t added or scraped any products for this organization yet. Click below to add your first product using your configured Brand Profiles.
                    </p>
                    <button
                      onClick={handleOpenAddModal}
                      className="px-4 py-2 bg-[#0d2a2c] text-[#fad982] text-xs font-bold rounded-xl hover:bg-[#143d40] transition shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Add Product</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((prod) => (
                <tr key={prod.id} className="hover:bg-slate-50/80 transition">
                  <td className="py-4 px-5 max-w-sm">
                    <Link
                      href={`/products/${prod.id}`}
                      className="font-bold text-slate-900 hover:text-[#0d2a2c] hover:underline block leading-snug"
                    >
                      {prod.canonicalTitle}
                    </Link>
                    <span className="text-[11px] text-slate-400 block mt-0.5">{prod.categoryPath || 'General'}</span>
                  </td>

                  <td className="py-4 px-4">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#0d2a2c]/5 text-[#0d2a2c] border border-[#0d2a2c]/10">
                      {prod.brand || '—'}
                    </span>
                  </td>

                  <td className="py-4 px-4 font-mono text-[11px] text-slate-600 space-y-0.5">
                    <div>
                      EAN: <span className="text-slate-900 font-bold">{prod.gtinEan || '—'}</span>
                    </div>
                    <div>
                      MPN: <span className="text-slate-500">{prod.modelNumber || '—'}</span>
                    </div>
                  </td>

                  <td className="py-4 px-4 text-[11px] text-slate-600">
                    <div>{prod.sourcesCount || 1} domains</div>
                    <div className="text-slate-400 font-medium">{prod.variantsCount || 1} variants</div>
                  </td>

                  {/* Store Sync Status Badge */}
                  <td className="py-4 px-4">
                    {Array.isArray(prod.syncedStores) && prod.syncedStores.length > 0 ? (
                      <div className="flex flex-col gap-1 items-start">
                        {prod.syncedStores.map((s: any, idx: number) => (
                          <span
                            key={idx}
                            title={`External ID: ${s.externalProductId || 'N/A'}${s.lastPushedAt ? ` • Last Synced: ${new Date(s.lastPushedAt).toLocaleString()}` : ''}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <ShoppingBag className="w-3 h-3 text-emerald-600" />
                            <span>
                              Synced to {s.storeName} ({String(s.platformType || '').toUpperCase()})
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Not Pushed
                      </span>
                    )}
                  </td>

                  <td className="py-4 px-4 font-bold text-slate-900">{prod.priceEstimate || '—'}</td>

                  <td className="py-4 px-5 text-right">
                    <Link
                      href={`/products/${prod.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                    >
                      <span>Inspect</span>
                      <span>›</span>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* BRAND-DRIVEN ADD PRODUCT MODAL (Clean, Non-Technical Client Workflow)      */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8 animate-scaleUp">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0d2a2c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#fad982] flex items-center justify-center text-slate-950 font-black text-sm">
                  +
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Add Product to Catalog</h3>
                  <p className="text-[11px] text-slate-300">Brand-driven automated extraction & review</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* If client has NO Brand Profiles configured */}
              {loadingBrands ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  <div className="inline-block w-5 h-5 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin mb-2"></div>
                  <p>Loading your organization's Brand Profiles...</p>
                </div>
              ) : brandsList.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">No Brand Profiles Configured</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      You need to create a Brand Profile before adding a product from an external source. Brand Profiles define the allowed domains and field extraction rules.
                    </p>
                  </div>
                  <div>
                    <Link
                      href="/brands"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0d2a2c] text-white font-bold text-xs rounded-xl hover:bg-[#143d40] transition shadow"
                    >
                      <Plus className="w-4 h-4 text-[#fad982]" />
                      <span>+ Create Brand Profile</span>
                    </Link>
                  </div>
                </div>
              ) : !extractedData ? (
                /* STEP 1, 2 & 3: FORM INPUT */
                <form onSubmit={handleExtractProduct} className="space-y-5">
                  {/* Step 1: Select Brand Profile */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      Step 1 — Select Brand Profile <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedBrandId}
                      onChange={(e) => handleSelectBrand(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                    >
                      <option value="">-- Choose Brand Profile --</option>
                      {brandsList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.officialWebsite || 'No official domain'} &bull;{' '}
                          {Array.isArray(b.fieldMappings) ? b.fieldMappings.length : 0} Mappings)
                        </option>
                      ))}
                    </select>

                    {/* Brand Status / Guidance Pill */}
                    {selectedBrand && (
                      <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 block">{selectedBrand.name}</span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            Domain: {selectedBrand.officialWebsite || 'Configured via sources'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
                            {selectedBrand.status || 'Active'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fad982] text-slate-950">
                            {Array.isArray(selectedBrand.fieldMappings) ? selectedBrand.fieldMappings.length : 0} Mappings
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Warning if Brand Profile has 0 mappings */}
                  {selectedBrand && (!selectedBrand.fieldMappings || selectedBrand.fieldMappings.length === 0) && (
                    <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">No Field Mappings Configured</span>
                        <span>This Brand Profile does not have extraction mappings configured yet. </span>
                        <Link
                          href={`/brands/${selectedBrand.id}`}
                          className="font-bold underline hover:text-amber-950"
                        >
                          Configure Field Mapping &rarr;
                        </Link>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Select Source (Only if multiple sources exist) */}
                  {selectedBrand && Array.isArray(selectedBrand.sourceConfigs) && selectedBrand.sourceConfigs.length > 1 && (
                    <div>
                      <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                        Step 2 — Select Source / Domain
                      </label>
                      <select
                        value={selectedSourceUrl}
                        onChange={(e) => setSelectedSourceUrl(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
                      >
                        {selectedBrand.officialWebsite && (
                          <option value={selectedBrand.officialWebsite}>
                            Official Website — {selectedBrand.officialWebsite}
                          </option>
                        )}
                        {selectedBrand.sourceConfigs.map((src: any, idx: number) => (
                          <option key={idx} value={src.url}>
                            {src.type || 'Catalog'} — {src.url}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Step 3: Product URL Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                      {selectedBrand && Array.isArray(selectedBrand.sourceConfigs) && selectedBrand.sourceConfigs.length > 1
                        ? 'Step 3 — Product URL'
                        : 'Step 2 — Product URL'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      disabled={!selectedBrand}
                      placeholder={
                        selectedBrand?.officialWebsite
                          ? `${selectedBrand.officialWebsite}/products/...`
                          : 'https://brand-domain.com/product-slug'
                      }
                      value={productUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition focus:outline-none ${
                        urlValidationError
                          ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                          : urlValidSuccess
                          ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 focus:border-emerald-500'
                          : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-[#0d2a2c] focus:bg-white'
                      }`}
                    />

                    {/* Live Validation Guidance */}
                    {urlValidSuccess && (
                      <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>URL belongs to approved {selectedBrand?.name} source</span>
                      </p>
                    )}
                    {urlValidationError && (
                      <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>{urlValidationError}</span>
                      </p>
                    )}
                  </div>

                  {extractionError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {extractionError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        extracting ||
                        !selectedBrandId ||
                        !productUrl.trim() ||
                        Boolean(urlValidationError) ||
                        (!selectedBrand?.fieldMappings || selectedBrand.fieldMappings.length === 0)
                      }
                      className="px-5 py-2.5 rounded-xl bg-[#fad982] hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold text-xs shadow-sm transition flex items-center gap-2"
                    >
                      {extracting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                          <span>Extracting Product...</span>
                        </>
                      ) : (
                        <>
                          <span>Extract Product</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                /* STEP 4: REVIEW & CONFIRM EXTRACTED PRODUCT */
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-900">Extracted Product Review</h4>
                    </div>
                    <button
                      onClick={() => setExtractedData(null)}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
                    >
                      &larr; Re-extract with different URL
                    </button>
                  </div>

                  {saveSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Product saved to catalog successfully! Refreshing...</span>
                    </div>
                  )}

                  {extractionError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                      {extractionError}
                    </div>
                  )}

                  {/* AI ENRICHMENT ACTION BANNER */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#0d2a2c]/5 via-amber-500/5 to-transparent border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-900">Post-Scraping AI Improvement</span>
                          {aiEnriched && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                              Enriched
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Applies Workspace Global Rules + <strong>{selectedBrand?.name || 'Brand'}</strong> AI Rules to format title, optimize SEO description & specs.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {aiEnriched && originalRawData && (
                        <button
                          type="button"
                          onClick={handleRevertToRaw}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-600 transition"
                        >
                          Revert to Raw
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={aiEnriching}
                        onClick={handleEnrichWithAi}
                        className="px-3.5 py-1.5 rounded-xl bg-[#0d2a2c] hover:bg-[#153e41] text-[#fad982] text-xs font-bold transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                      >
                        {aiEnriching ? (
                          <>
                            <div className="w-3 h-3 border-2 border-[#fad982] border-t-transparent rounded-full animate-spin"></div>
                            <span>Improving...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-[#fad982]" />
                            <span>{aiEnriched ? 'Re-run AI' : 'Improve with AI'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Review / Edit Form */}
                  <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Product Title <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={reviewTitle}
                        onChange={(e) => setReviewTitle(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Model Number / MPN
                        </label>
                        <input
                          type="text"
                          value={reviewModel}
                          onChange={(e) => setReviewModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          SKU / Part Number
                        </label>
                        <input
                          type="text"
                          value={reviewSku}
                          onChange={(e) => setReviewSku(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price Est.</label>
                        <input
                          type="text"
                          value={reviewPrice}
                          onChange={(e) => setReviewPrice(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white"
                        />
                      </div>
                    </div>

                    {/* Extracted Images */}
                    {reviewImages.length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
                          Extracted Images ({reviewImages.length})
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {reviewImages.map((img, idx) => (
                            <img
                              key={idx}
                              src={img}
                              alt="thumbnail"
                              className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-white shadow-2xs"
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {reviewDescription && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Extracted Description
                        </label>
                        <textarea
                          rows={4}
                          value={reviewDescription}
                          onChange={(e) => setReviewDescription(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:bg-white"
                        />
                      </div>
                    )}

                    {/* Key-Value Specifications */}
                    {reviewAttributes && Object.keys(reviewAttributes).length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Specifications ({Object.keys(reviewAttributes).length} properties)
                        </label>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-36 overflow-y-auto text-xs">
                          {Object.entries(reviewAttributes).map(([k, v]: [string, any]) => (
                            <div key={k} className="px-3 py-1.5 flex justify-between gap-3">
                              <span className="font-semibold text-slate-700">{k}:</span>
                              <span className="text-slate-900 font-mono text-right">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Client Attributes (e.g. futured) */}
                    {reviewCustomFields && Object.keys(reviewCustomFields).length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Custom Attributes ({Object.keys(reviewCustomFields).length})
                        </label>
                        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 max-h-36 overflow-y-auto text-xs">
                          {Object.entries(reviewCustomFields).map(([k, v]: [string, any]) => (
                            <div key={k} className="px-3 py-2 flex flex-col gap-1">
                              <span className="font-semibold text-slate-700">{k}:</span>
                              <div className="text-slate-900 font-mono text-[11px] whitespace-pre-line max-h-24 overflow-y-auto bg-white p-2 rounded border border-slate-200">
                                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setExtractedData(null)}
                      className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={savingProduct || !reviewTitle.trim()}
                      onClick={handleSaveExtractedProduct}
                      className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs shadow-sm transition flex items-center gap-2"
                    >
                      {savingProduct ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving to Catalog...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 text-[#fad982]" />
                          <span>Save to Catalog</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* BATCH / BULK URL SCRAPE MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-[#0d2a2c]" />
                <h3 className="text-base font-black text-slate-900">Batch Scrape (Multi-URL Queue)</h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {batchSuccessMsg ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{batchSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitBatchScrape} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Select Target Brand Profile
                  </label>
                  <select
                    required
                    value={batchBrandId}
                    onChange={(e) => setBatchBrandId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                  >
                    {brandsList.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.officialWebsite || 'No website'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Product URLs (One per line)
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Paste up to 50 product URLs. The background queue will scrape and extract all fields using the selected brand&apos;s field mappings.
                  </p>
                  <textarea
                    rows={6}
                    required
                    value={batchUrlsInput}
                    onChange={(e) => setBatchUrlsInput(e.target.value)}
                    placeholder={`https://traxxas.com/products/models/electric/slash-4x4-ultimate\nhttps://traxxas.com/products/models/electric/x-maxx\nhttps://traxxas.com/products/models/electric/rustler-4x4-vxl`}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
                  />
                </div>

                {extractionError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                    {extractionError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={batchSubmitting || !batchUrlsInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {batchSubmitting ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Dispatching Jobs...</span>
                      </>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 text-[#fad982]" />
                        <span>Queue Batch Extraction</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
