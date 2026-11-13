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
  ShoppingBag,
  Trash2,
  Send,
  Activity,
  TrendingUp,
  RefreshCw
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState('ALL');

  // Add Product Workflow Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [inputMode, setInputMode] = useState<'URL' | 'IDENTIFIER'>('URL');
  const [identifierInput, setIdentifierInput] = useState('');
  const [discovering, setDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<any | null>(null);
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

  // Phase 1: Smart Data Reuse & Intelligence Match States
  const [intelligenceMatch, setIntelligenceMatch] = useState<any | null>(null);
  const [reusingData, setReusingData] = useState(false);

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

  // Auto-Crawler & Category/Sitemap States
  const [crawlMode, setCrawlMode] = useState<'MANUAL_LIST' | 'CRAWLER'>('MANUAL_LIST');
  const [crawlerEntryUrl, setCrawlerEntryUrl] = useState('');
  const [crawlerMaxPages, setCrawlerMaxPages] = useState(5);
  const [crawlerMaxProducts, setCrawlerMaxProducts] = useState(100);
  const [crawling, setCrawling] = useState(false);
  const [crawlerSummary, setCrawlerSummary] = useState<any | null>(null);

  // Phase 11: Bulk Multi-Product Controlled Push States
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [connectedStores, setConnectedStores] = useState<any[]>([]);
  const [showBulkPushModal, setShowBulkPushModal] = useState(false);
  const [selectedPushStoreId, setSelectedPushStoreId] = useState('');
  const [selectedPushLanguage, setSelectedPushLanguage] = useState('en');
  const [bulkPushing, setBulkPushing] = useState(false);
  const [bulkPushProgress, setBulkPushProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkPushResults, setBulkPushResults] = useState<any | null>(null);

  // Live Price & Stock Audit Scanner States
  const [scanningPrices, setScanningPrices] = useState(false);
  const [checkingSingleId, setCheckingSingleId] = useState<string | null>(null);
  const [priceScanSummary, setPriceScanSummary] = useState<any | null>(null);

  async function loadCatalog() {
    try {
      setLoading(true);
      const [res, brandsRes, storesRes] = await Promise.allSettled([
        apiClient.getProducts({ limit: 50 }),
        apiClient.getBrands(),
        apiClient.getStores(),
      ]);

      if (res.status === 'fulfilled') {
        setProducts(res.value?.data || res.value?.items || []);
      }
      if (brandsRes.status === 'fulfilled') {
        setBrandsList(Array.isArray(brandsRes.value) ? brandsRes.value : []);
      }
      if (storesRes.status === 'fulfilled') {
        const val: any = storesRes.value;
        const sList = Array.isArray(val) ? val : (val?.stores || []);
        setConnectedStores(sList);
        if (sList.length > 0 && !selectedPushStoreId) {
          setSelectedPushStoreId(sList[0].id);
        }
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

  async function handleDeleteProduct(id: string, title?: string) {
    const confirmName = title ? `"${title}"` : 'this product';
    if (!window.confirm(`Are you sure you want to remove ${confirmName} from your catalog?`)) {
      return;
    }

    try {
      setDeletingId(id);
      await apiClient.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id && p.mappingId !== id));
    } catch (err: any) {
      alert(`Failed to delete product: ${err.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  }

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
        } catch (_) { }
      }
      if (Array.isArray(selectedBrand.sourceConfigs)) {
        for (const src of selectedBrand.sourceConfigs) {
          if (src.url) {
            try {
              allowedDomains.push(new URL(src.url).hostname.toLowerCase().replace(/^www\./, ''));
            } catch (_) { }
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

  // Execute Brand-Driven Extraction with Phase 1 Smart Intelligence Pre-Check
  async function handleExtractProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBrandId || !productUrl.trim()) return;

    try {
      setExtracting(true);
      setExtractionError('');
      setExtractedData(null);
      setIntelligenceMatch(null);

      // Phase 1: Smart Lookup before starting live scrape
      try {
        const lookupRes = await apiClient.lookupProductIntelligence({
          productUrl: productUrl.trim(),
          brandId: selectedBrandId,
        });

        if (lookupRes && (lookupRes.decision === 'REUSE_EXISTING' || lookupRes.confidence === 'EXACT' || lookupRes.confidence === 'HIGH_CONFIDENCE') && lookupRes.reusableProduct) {
          setIntelligenceMatch(lookupRes);
          const p = lookupRes.reusableProduct;
          setReviewTitle(p.canonicalTitle || '');
          setReviewModel(p.modelNumber || '');
          const skuId = p.identifiers?.find((i: any) => i.idType === 'MANUFACTURER_SKU' || i.idType === 'MPN')?.idValue;
          setReviewSku(skuId || p.modelNumber || '');
          setReviewPrice('');
          setReviewDescription(p.standardizedDescription || '');
          setReviewPrimaryImage(p.primaryImageUrl || (p.images && p.images[0]) || '');
          setReviewImages(p.images || []);
          setReviewAttributes(p.attributes || {});
          setReviewCustomFields({});
          setOriginalRawData({ title: p.canonicalTitle, description: p.standardizedDescription || '' });
          setExtractedData({ canonicalMatch: true });
          setExtracting(false);
          return;
        }
      } catch (lookupErr) {
        console.warn('Smart lookup check bypassed, proceeding with live mapping extraction:', lookupErr);
      }

      // Fallback to Live Brand Selector Mapping
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

  async function handleDiscoverByIdentifier(e: React.FormEvent) {
    e.preventDefault();
    if (!identifierInput.trim()) return;

    try {
      setDiscovering(true);
      setExtractionError('');
      setDiscoveryResult(null);

      const res = await apiClient.discoverProduct({
        type: 'IDENTIFIER',
        value: identifierInput.trim(),
        brandHint: selectedBrand?.name,
      });

      setDiscoveryResult(res.discovery);

      if (res.discovery?.status === 'FOUND_EXISTING' && res.discovery?.canonicalProduct) {
        const p = res.discovery.canonicalProduct;
        setReviewTitle(p.canonicalTitle || '');
        setReviewModel(p.modelNumber || '');
        setReviewSku(p.modelNumber || '');
        setReviewDescription(p.standardizedDescription || '');
        setReviewPrimaryImage(p.primaryImageUrl || '');
        setReviewImages(p.primaryImageUrl ? [p.primaryImageUrl] : []);
        setExtractedData({ canonicalMatch: true, source: 'Global Intelligence Catalog' });
        setIntelligenceMatch({ canonicalProductId: p.id });
      }
    } catch (err: any) {
      setExtractionError(err.message || 'Discovery search failed');
    } finally {
      setDiscovering(false);
    }
  }

  // Save reviewed product directly into Client Catalog (with Phase 1 smart reuse check)
  async function handleSaveExtractedProduct() {
    if (!reviewTitle.trim()) {
      alert('Product title is required');
      return;
    }

    try {
      setSavingProduct(true);
      setExtractionError('');

      if (intelligenceMatch && intelligenceMatch.canonicalProductId) {
        // Reuse global canonical product directly into tenant catalog
        await apiClient.reuseCanonicalProduct({
          globalProductId: intelligenceMatch.canonicalProductId,
          customTitle: reviewTitle.trim(),
          customSku: reviewSku.trim() || reviewModel.trim() || undefined,
          customPrice: reviewPrice.trim() || undefined,
          customDescription: reviewDescription.trim() || undefined,
          productUrl: productUrl.trim(),
        });
      } else {
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
      }

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
    setCrawlMode('MANUAL_LIST');
    setCrawlerEntryUrl('');
    setCrawlerSummary(null);
    try {
      setLoadingBrands(true);
      const list = await apiClient.getBrands();
      const cleanList = Array.isArray(list) ? list : [];
      setBrandsList(cleanList);
      if (cleanList.length > 0) {
        setBatchBrandId(cleanList[0].id);
      } else {
        setBatchBrandId('');
      }
    } catch (e) {
      console.error('Failed to load brands for batch modal:', e);
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

  // Handle Crawler Trigger
  async function handleExecuteCrawler() {
    if (!crawlerEntryUrl.trim() || !crawlerEntryUrl.startsWith('http')) {
      alert('Please enter a valid Category/Collection or Sitemap XML URL starting with http:// or https://');
      return;
    }

    try {
      setCrawling(true);
      setExtractionError('');
      setCrawlerSummary(null);

      const res = await apiClient.crawlCatalog({
        entryUrl: crawlerEntryUrl.trim(),
        maxPages: crawlerMaxPages,
        maxProducts: crawlerMaxProducts,
      });

      if (res.success && res.result) {
        setCrawlerSummary(res.result);
        if (res.result.productUrls.length > 0) {
          // Pre-fill the batch URLs input with discovered URLs
          setBatchUrlsInput(res.result.productUrls.join('\n'));
        }
      }
    } catch (err: any) {
      setExtractionError(err.message || 'Crawler failed to scan entry URL');
    } finally {
      setCrawling(false);
    }
  }

  // Handle Selection Toggle
  function handleToggleSelectProduct(id: string) {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleSelectAll(filteredItems: any[]) {
    if (selectedProductIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredItems.map((p) => p.id));
    }
  }

  // Handle Bulk Controlled Push Dispatch
  async function handleExecuteBulkPush() {
    if (selectedProductIds.length === 0) {
      alert('Please select at least 1 product to push.');
      return;
    }
    if (!selectedPushStoreId) {
      alert('Please select a target store.');
      return;
    }

    try {
      setBulkPushing(true);
      setBulkPushResults(null);
      setBulkPushProgress({ current: 0, total: selectedProductIds.length });

      const res = await apiClient.executeBulkControlledPush({
        productIds: selectedProductIds,
        storeId: selectedPushStoreId,
        targetLanguage: selectedPushLanguage,
      });

      setBulkPushResults(res.bulkResult);
      setBulkPushProgress({ current: res.bulkResult?.totalRequested || selectedProductIds.length, total: selectedProductIds.length });
      loadCatalog();
    } catch (err: any) {
      alert(`Bulk push failed: ${err.message || 'Unknown error'}`);
    } finally {
      setBulkPushing(false);
    }
  }

  // Handle Instant Price & Stock Verification for a single item
  async function handleCheckSinglePrice(productId: string) {
    try {
      setCheckingSingleId(productId);
      const res = await apiClient.checkLiveProductPrice(productId);
      const r = res.result;
      const statusMsg = r.priceChanged
        ? `Price changed: $${r.oldPrice} ➔ $${r.newPrice} (${r.priceDelta > 0 ? `+$${r.priceDelta}` : `-$${Math.abs(r.priceDelta)}`})`
        : `Price verified: $${r.newPrice} (No change)`;
      const stockMsg = r.newStockStatus ? 'In Stock' : 'OUT OF STOCK';
      alert(`[Price & Stock Check Complete]\n${statusMsg}\nStock: ${stockMsg}\nAuto-Synced Stores: ${r.syncedStoresUpdated}`);
      loadCatalog();
    } catch (err: any) {
      alert(`Check failed: ${err.message}`);
    } finally {
      setCheckingSingleId(null);
    }
  }

  // Handle Full Catalog Price Audit Scan
  async function handleScanAllPrices() {
    if (!confirm('This will scan live supplier websites for all catalog products to verify price and stock availability, and automatically synchronize delta changes to connected stores. Proceed?')) {
      return;
    }

    try {
      setScanningPrices(true);
      setPriceScanSummary(null);
      const res = await apiClient.scanCatalogPriceMonitoring();
      setPriceScanSummary(res);
      alert(`[Catalog Audit Complete]\nScanned: ${res.scanned} products\nPrice Changes Detected: ${res.priceChangesCount}\nStock Changes: ${res.stockChangesCount}`);
      loadCatalog();
    } catch (err: any) {
      alert(`Audit scan failed: ${err.message}`);
    } finally {
      setScanningPrices(false);
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
    <div className="space-y-6 w-full font-sans text-[#4b465c]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#dbdade]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#4b465c]">Product Catalog</h1>
          <p className="text-xs text-[#82808b] mt-1 font-medium">
            Browse normalized catalog entries, verified EAN/GTINs, provenance audits, and tenant overrides.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-white border border-[#dbdade] text-xs font-semibold text-[#4b465c] shadow-2xs">
            Total Entities: {filtered.length}
          </span>

          {/* Export Dropdown / Button */}
          {/* Price & Stock Live Delta Audit Button */}
          <button
            onClick={handleScanAllPrices}
            disabled={scanningPrices || products.length === 0}
            title="Scan live supplier websites to verify prices & stock availability"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#f8f7fa] border border-[#dbdade] text-[#4b465c] font-semibold text-xs rounded-xl shadow-2xs transition disabled:opacity-50"
          >
            <Activity className={`w-3.5 h-3.5 text-teal-700 ${scanningPrices ? 'animate-spin' : ''}`} />
            <span>{scanningPrices ? 'Auditing Prices...' : 'Audit Live Prices'}</span>
          </button>

          <button
            onClick={() => handleExportCsv('shopify')}
            disabled={exportingCsv || products.length === 0}
            title="Download full catalog as Shopify-compatible CSV"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-[#f8f7fa] border border-[#dbdade] text-[#4b465c] font-semibold text-xs rounded-xl shadow-2xs transition disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-[#82808b]" />
            <span>{exportingCsv ? 'Exporting...' : 'Export Shopify CSV'}</span>
          </button>

          {/* Bulk Push to Store Button */}
          <button
            onClick={() => {
              if (selectedProductIds.length === 0) {
                alert('Please select at least 1 product using the table checkboxes first.');
                return;
              }
              setShowBulkPushModal(true);
            }}
            disabled={selectedProductIds.length === 0}
            className={`flex items-center gap-1.5 px-3.5 py-2 font-semibold text-xs rounded-xl transition ${selectedProductIds.length > 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 text-[#82808b] border border-[#dbdade] cursor-not-allowed'
              }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Bulk Push to Store ({selectedProductIds.length})</span>
          </button>

          {/* Bulk Import Button */}
          <button
            onClick={handleOpenBatchModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 hover:bg-teal-100/80 text-teal-900 border border-teal-200/80 font-semibold text-xs rounded-xl transition"
          >
            <UploadCloud className="w-3.5 h-3.5 text-teal-700" />
            <span>Batch Scrape (Multi-URL)</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-semibold text-xs rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4 text-[#fad982]" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#dbdade] shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82808b]" />
          <input
            type="text"
            placeholder="Search by Title, GTIN/EAN, or MPN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#f8f7fa] border border-[#dbdade] rounded-xl text-xs text-[#4b465c] placeholder-[#82808b] focus:outline-none focus:border-teal-700 focus:bg-white transition"
          />
        </div>

        {/* Dynamic Brand Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setBrandFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${brandFilter === 'ALL' ? 'bg-[#0d2a2c] text-white shadow-2xs' : 'bg-[#f8f7fa] text-[#82808b] border border-[#dbdade] hover:bg-slate-100'
              }`}
          >
            ALL
          </button>
          {brandsList.map((b) => (
            <button
              key={b.id}
              onClick={() => setBrandFilter(b.name)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition uppercase ${brandFilter.toLowerCase() === b.name?.toLowerCase()
                  ? 'bg-[#0d2a2c] text-white shadow-2xs'
                  : 'bg-[#f8f7fa] text-[#82808b] border border-[#dbdade] hover:bg-slate-100'
                }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-xl border border-[#dbdade] shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs text-[#4b465c]">
          <thead className="bg-[#f8f7fa] border-b border-[#dbdade] text-[11px] uppercase tracking-wider text-[#82808b] font-semibold">
            <tr>
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && selectedProductIds.length === filtered.length}
                  onChange={() => handleSelectAll(filtered)}
                  title="Select All Products"
                  className="w-4 h-4 rounded border-[#dbdade] text-[#0d2a2c] focus:ring-teal-700 cursor-pointer"
                />
              </th>
              <th className="py-3 px-5">Product Details</th>
              <th className="py-3 px-4">Brand</th>
              <th className="py-3 px-4">Quality Status</th>
              <th className="py-3 px-4">Identifiers</th>
              <th className="py-3 px-4">Sources / Variants</th>
              <th className="py-3 px-4">Store Sync</th>
              <th className="py-3 px-4">Price Est.</th>
              <th className="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#dbdade] font-medium">
            {loading ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[#82808b]">
                  Loading catalog entries from database...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="max-w-md mx-auto space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-[#f8f7fa] border border-[#dbdade] flex items-center justify-center mx-auto text-[#82808b]">
                      <Package className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-[#4b465c]">No products in your catalog yet</h3>
                    <p className="text-xs text-[#82808b] leading-relaxed">
                      You haven&apos;t added or scraped any products for this organization yet. Click below to add your first product using your configured Brand Profiles.
                    </p>
                    <button
                      onClick={handleOpenAddModal}
                      className="px-4 py-2 bg-[#0d2a2c] text-white text-xs font-semibold rounded-xl hover:bg-[#143d40] transition shadow-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 text-[#fad982]" />
                      <span>+ Add Product</span>
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((prod) => {
                const isSelected = selectedProductIds.includes(prod.id);
                return (
                  <tr key={prod.id} className={`transition ${isSelected ? 'bg-teal-50/40' : 'hover:bg-[#f8f7fa]/60'}`}>
                    <td className="py-4 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectProduct(prod.id)}
                        className="w-4 h-4 rounded border-[#dbdade] text-[#0d2a2c] focus:ring-teal-700 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-5 max-w-sm">
                      <Link
                        href={`/products/${prod.id}`}
                        className="font-bold text-[#4b465c] hover:text-teal-700 block leading-snug"
                      >
                        {prod.canonicalTitle}
                      </Link>
                      <span className="text-[11px] text-[#82808b] block mt-0.5">
                        {prod.categoryPath ? prod.categoryPath.split('>')[0].trim() : 'General'}
                      </span>
                    </td>

                    <td className="py-4 px-4">
                      <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#f8f7fa] text-[#4b465c] border border-[#dbdade]">
                        {prod.brand || '—'}
                      </span>
                    </td>

                    <td className="py-4 px-4 font-mono text-[11px] text-[#4b465c] space-y-0.5">
                      {/* Phase 6 Quality Status Badge */}
                      <div className="mb-1">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase font-mono border ${prod.verificationStatus === 'verified'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : prod.verificationStatus === 'conflict'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{prod.verificationStatus || 'NEEDS_REVIEW'}</span>
                        </span>
                      </div>
                      <div>
                        EAN: <span className="text-[#4b465c] font-bold">{prod.gtinEan || '—'}</span>
                      </div>
                      <div>
                        MPN: <span className="text-[#82808b]">{prod.modelNumber || '—'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-[11px] text-[#4b465c]">
                      <div>{prod.sourcesCount || 1} domains</div>
                      <div className="text-[#82808b] font-medium">{prod.variantsCount || 1} variants</div>
                    </td>

                    {/* Store Sync Status Badge (Single consolidated badge on listing) */}
                    <td className="py-4 px-4">
                      {Array.isArray(prod.syncedStores) && prod.syncedStores.length > 0 ? (
                        (() => {
                          const first = prod.syncedStores[0];
                          const extraCount = prod.syncedStores.length - 1;
                          return (
                            <div className="flex items-center gap-1.5">
                              <span
                                title={`Synced with ${prod.syncedStores.map((st: any) => st.storeName).join(', ')}`}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs whitespace-nowrap"
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <ShoppingBag className="w-3 h-3 text-emerald-600" />
                                <span>
                                  Synced to {first.storeName} ({String(first.platformType || '').toUpperCase()})
                                </span>
                                {extraCount > 0 && (
                                  <span className="ml-1 px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 text-[9px] font-black">
                                    +{extraCount}
                                  </span>
                                )}
                              </span>
                              <Link
                                href={`/products/${prod.id}#store-sync`}
                                title="Click to view detailed store sync history & credentials"
                                className="text-slate-400 hover:text-slate-700 transition p-0.5 rounded hover:bg-slate-100"
                              >
                                <AlertCircle className="w-3.5 h-3.5 rotate-180" />
                              </Link>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-[#dbdade]">
                          Not Pushed
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 font-bold text-slate-900">{prod.priceEstimate || '—'}</td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Instant Live Price & Stock Verification */}
                        <button
                          type="button"
                          onClick={() => handleCheckSinglePrice(prod.id)}
                          disabled={checkingSingleId === prod.id}
                          title="Verify live supplier price & stock now"
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition"
                        >
                          {checkingSingleId === prod.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                          ) : (
                            <TrendingUp className="w-3.5 h-3.5" />
                          )}
                        </button>

                        <Link
                          href={`/products/${prod.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
                        >
                          <span>Inspect</span>
                          <span>›</span>
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(prod.id, prod.canonicalTitle)}
                          disabled={deletingId === prod.id}
                          title="Delete product from catalog"
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* BRAND-DRIVEN ADD PRODUCT MODAL (Clean, Non-Technical Client Workflow)      */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl border border-[#dbdade] overflow-hidden my-8 animate-scaleUp">
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
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
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
                <div className="space-y-5">
                  {/* Phase 5 Multi-Source Discovery Mode Selector Tabs */}
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setInputMode('URL')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${inputMode === 'URL'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      Option A: Brand Website URL
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMode('IDENTIFIER')}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${inputMode === 'IDENTIFIER'
                          ? 'bg-[#0d2a2c] text-[#fad982] shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                        }`}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Option B: Multi-Source Discovery (Barcode / MPN)</span>
                    </button>
                  </div>

                  {inputMode === 'IDENTIFIER' ? (
                    /* PHASE 5: ADVANCED PRODUCT DISCOVERY BY IDENTIFIER */
                    <form onSubmit={handleDiscoverByIdentifier} className="space-y-4">
                      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-teal-500/10 to-transparent border border-amber-200/60 space-y-1">
                        <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-amber-600" />
                          <span>Phase 5 Multi-Source Discovery Engine</span>
                        </span>
                        <p className="text-[11px] text-slate-600">
                          Enter any Barcode (EAN-13, GTIN-14, UPC-A) or Model Number. The platform will query existing verified intelligence and ranked distributor sources.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                          Product Identifier (GTIN / EAN / MPN / Model) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 0020334680864 or WH1000XM5/B"
                          value={identifierInput}
                          onChange={(e) => setIdentifierInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                        />
                      </div>

                      {discoveryResult && (
                        <div className="p-4 rounded-xl bg-slate-50 border border-[#dbdade] space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-slate-700">Discovery Status:</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold">
                              {discoveryResult.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">{discoveryResult.message}</p>
                        </div>
                      )}

                      {extractionError && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                          {extractionError}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setShowAddModal(false)}
                          className="px-4 py-2 rounded-xl border border-[#dbdade] text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={discovering || !identifierInput.trim()}
                          className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] disabled:opacity-50 text-[#fad982] font-bold text-xs shadow-sm transition flex items-center gap-2"
                        >
                          {discovering ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-[#fad982] border-t-transparent rounded-full animate-spin"></div>
                              <span>Discovering Sources...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Discover Product</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
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
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbdade] bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
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
                          <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-[#dbdade] text-xs flex items-center justify-between">
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
                            className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbdade] bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
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
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition focus:outline-none ${urlValidationError
                              ? 'border-rose-300 bg-rose-50/50 text-rose-900 focus:border-rose-500'
                              : urlValidSuccess
                                ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 focus:border-emerald-500'
                                : 'border-[#dbdade] bg-slate-50 text-slate-900 focus:border-[#0d2a2c] focus:bg-white'
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
                          className="px-4 py-2 rounded-xl border border-[#dbdade] text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
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
                  )}
                </div>
              ) : (
                /* STEP 4: REVIEW & CONFIRM EXTRACTED PRODUCT */
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <h4 className="text-xs font-bold text-slate-900">
                        {intelligenceMatch ? 'Product Intelligence Match Review' : 'Extracted Product Review'}
                      </h4>
                    </div>
                    <button
                      onClick={() => {
                        setExtractedData(null);
                        setIntelligenceMatch(null);
                      }}
                      className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
                    >
                      &larr; Re-extract with different URL
                    </button>
                  </div>

                  {/* Phase 1: Smart Data Reuse Notification Banner */}
                  {intelligenceMatch && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-amber-500/10 to-transparent border border-emerald-200 flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-emerald-950 uppercase tracking-wide">
                            Product Intelligence Reused &bull; Scraping Avoided
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800 uppercase">
                            {intelligenceMatch.confidence} ({Math.round(intelligenceMatch.confidenceScore * 100)}%)
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${intelligenceMatch.freshnessStatus === 'fresh' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>
                            {intelligenceMatch.freshnessStatus}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          {intelligenceMatch.matchReason}. Canonical intelligence has been loaded instantly without hitting the target website or burning AI tokens.
                        </p>
                      </div>
                    </div>
                  )}

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
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0d2a2c]/5 via-amber-500/5 to-transparent border border-[#dbdade] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                          className="px-2.5 py-1.5 rounded-lg border border-[#dbdade] hover:bg-slate-100 text-[11px] font-semibold text-slate-600 transition"
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
                        className="w-full px-3.5 py-2 rounded-xl border border-[#dbdade] bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white"
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
                          className="w-full px-3 py-2 rounded-xl border border-[#dbdade] bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
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
                          className="w-full px-3 py-2 rounded-xl border border-[#dbdade] bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Price Est.</label>
                        <input
                          type="text"
                          value={reviewPrice}
                          placeholder="Price not available from this source"
                          onChange={(e) => setReviewPrice(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-[#dbdade] bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white placeholder:text-amber-600 placeholder:italic"
                        />
                        {!reviewPrice && (
                          <span className="text-[10px] text-amber-700 italic block mt-0.5">
                            Price not available from this source
                          </span>
                        )}
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
                              className="w-12 h-12 object-contain rounded-lg border border-[#dbdade] bg-white shadow-2xs"
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
                          className="w-full px-3.5 py-2 rounded-xl border border-[#dbdade] bg-slate-50 text-xs text-slate-800 focus:outline-none focus:bg-white"
                        />
                      </div>
                    )}

                    {/* Key-Value Specifications */}
                    {reviewAttributes && Object.keys(reviewAttributes).length > 0 && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Specifications ({Object.keys(reviewAttributes).length} properties)
                        </label>
                        <div className="bg-slate-50 rounded-xl border border-[#dbdade] divide-y divide-slate-100 max-h-36 overflow-y-auto text-xs">
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
                        <div className="bg-slate-50 rounded-xl border border-[#dbdade] divide-y divide-slate-100 max-h-36 overflow-y-auto text-xs">
                          {Object.entries(reviewCustomFields).map(([k, v]: [string, any]) => (
                            <div key={k} className="px-3 py-2 flex flex-col gap-1">
                              <span className="font-semibold text-slate-700">{k}:</span>
                              <div className="text-slate-900 font-mono text-[11px] whitespace-pre-line max-h-24 overflow-y-auto bg-white p-2 rounded border border-[#dbdade]">
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
                      className="px-4 py-2 rounded-xl border border-[#dbdade] text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
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
          <div className="bg-white rounded-xl border border-[#dbdade] shadow-2xl max-w-xl w-full p-6 sm:p-7 space-y-5 animate-in fade-in zoom-in-95">
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
                {/* Mode Selector Tabs: Manual List vs Full Auto-Crawler */}
                <div className="flex p-1 bg-slate-100 rounded-xl border border-[#dbdade] text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCrawlMode('MANUAL_LIST')}
                    className={`flex-1 py-1.5 rounded-xl transition ${
                      crawlMode === 'MANUAL_LIST'
                        ? 'bg-[#0d2a2c] text-[#fad982] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Manual URLs List
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrawlMode('CRAWLER')}
                    className={`flex-1 py-1.5 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      crawlMode === 'CRAWLER'
                        ? 'bg-[#0d2a2c] text-[#fad982] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#fad982]" />
                    <span>Auto-Crawler (Category / Sitemap)</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
                    Select Target Brand Profile <span className="text-rose-500">*</span>
                  </label>
                  {loadingBrands ? (
                    <div className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbdade] bg-slate-50 text-xs text-slate-400">
                      Loading configured brand profiles...
                    </div>
                  ) : brandsList.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center justify-between">
                      <span>No Brand Profiles found. Please create one first in Brand Profiles.</span>
                      <Link href="/brands" className="underline font-bold ml-2">
                        Create Brand
                      </Link>
                    </div>
                  ) : (
                    <select
                      required
                      value={batchBrandId}
                      onChange={(e) => setBatchBrandId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#dbdade] bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                    >
                      {brandsList.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.officialWebsite || 'No website'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* If Auto-Crawler Mode */}
                {crawlMode === 'CRAWLER' ? (
                  <div className="space-y-3.5 p-4 bg-slate-50 border border-[#dbdade]/80 rounded-xl">
                    <div>
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Category / Collection URL or Sitemap XML
                      </label>
                      <input
                        type="url"
                        value={crawlerEntryUrl}
                        onChange={(e) => setCrawlerEntryUrl(e.target.value)}
                        placeholder="e.g. https://store.com/collections/chairs or https://store.com/sitemap.xml"
                        className="w-full px-3.5 py-2 bg-white border border-[#dbdade] rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c]"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        System will automatically crawl pagination pages or parse XML sitemaps to discover all product links.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Pages to Crawl</label>
                        <select
                          value={crawlerMaxPages}
                          onChange={(e) => setCrawlerMaxPages(parseInt(e.target.value))}
                          className="w-full px-3 py-1.5 bg-white border border-[#dbdade] rounded-xl text-xs"
                        >
                          <option value={1}>1 Page (Single Page)</option>
                          <option value={3}>Up to 3 Pages</option>
                          <option value={5}>Up to 5 Pages (Standard)</option>
                          <option value={10}>Up to 10 Pages (Deep)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Max Products Limit</label>
                        <select
                          value={crawlerMaxProducts}
                          onChange={(e) => setCrawlerMaxProducts(parseInt(e.target.value))}
                          className="w-full px-3 py-1.5 bg-white border border-[#dbdade] rounded-xl text-xs"
                        >
                          <option value={25}>25 Products</option>
                          <option value={50}>50 Products</option>
                          <option value={100}>100 Products</option>
                          <option value={250}>250 Products (Full Batch)</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={handleExecuteCrawler}
                        disabled={crawling || !crawlerEntryUrl.trim()}
                        className="w-full py-2.5 px-4 bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {crawling ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-[#fad982] border-t-transparent rounded-full animate-spin"></div>
                            <span>Scanning &amp; Discovering Links...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-[#fad982]" />
                            <span>Scan Category / Sitemap Now</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Crawler Results Preview */}
                    {crawlerSummary && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-1 animate-in fade-in">
                        <div className="font-bold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Discovered {crawlerSummary.totalFound} Product URLs ({crawlerSummary.sourceType})</span>
                        </div>
                        <p className="text-[11px] text-emerald-700">
                          Scanned {crawlerSummary.pagesScanned} page(s). URLs have been automatically populated below ready for queue dispatch.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span>Product URLs Queue ({batchUrlsInput.split('\n').filter(u => u.trim().startsWith('http')).length})</span>
                    {batchUrlsInput && (
                      <button
                        type="button"
                        onClick={() => setBatchUrlsInput('')}
                        className="text-[10px] text-rose-600 font-bold hover:underline"
                      >
                        Clear List
                      </button>
                    )}
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    {crawlMode === 'CRAWLER' ? 'Review or modify the discovered URLs before queuing for extraction.' : 'Paste individual product URLs, or use the Auto-Crawler tab above to discover an entire category.'}
                  </p>
                  <textarea
                    rows={6}
                    required
                    value={batchUrlsInput}
                    onChange={(e) => setBatchUrlsInput(e.target.value)}
                    placeholder={`https://traxxas.com/products/models/electric/slash-4x4-ultimate\nhttps://traxxas.com/products/models/electric/x-maxx\nhttps://traxxas.com/products/models/electric/rustler-4x4-vxl`}
                    className="w-full p-3.5 bg-slate-50 border border-[#dbdade] rounded-xl text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white transition leading-relaxed"
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
                    className="px-4 py-2 rounded-xl border border-[#dbdade] text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
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

      {/* Bulk Store Push Modal */}
      {showBulkPushModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-[#dbdade] w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#0d2a2c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#fad982]/20 flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#fad982]" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight text-white">Bulk Store Export Dispatch</h3>
                  <p className="text-[11px] text-slate-300">
                    Pushing <span className="font-bold text-[#fad982]">{selectedProductIds.length}</span> selected items to connected store
                  </p>
                </div>
              </div>
              {!bulkPushing && (
                <button
                  onClick={() => setShowBulkPushModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* If Push Completed */}
              {bulkPushResults ? (
                <div className="space-y-4">
                  <div className={`p-4 rounded-xl border ${bulkPushResults.failedCount === 0
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}>
                    <div className="flex items-center gap-2 font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span>Bulk Export Run Complete</span>
                    </div>
                    <div className="mt-2 text-xs grid grid-cols-3 gap-2 text-center pt-2 border-t border-[#dbdade]/50">
                      <div className="p-2 bg-white/60 rounded-lg">
                        <span className="block font-bold text-sm text-slate-900">{bulkPushResults.totalRequested}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">Total</span>
                      </div>
                      <div className="p-2 bg-white/60 rounded-lg">
                        <span className="block font-bold text-sm text-emerald-600">{bulkPushResults.succeededCount}</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">Succeeded</span>
                      </div>
                      <div className="p-2 bg-white/60 rounded-lg">
                        <span className="block font-bold text-sm text-rose-600">{bulkPushResults.failedCount}</span>
                        <span className="text-[10px] text-rose-700 font-semibold">Failed</span>
                      </div>
                    </div>
                  </div>

                  {/* Errors display if any */}
                  {bulkPushResults.failedCount > 0 && bulkPushResults.results.some((r: any) => !r.success) && (
                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-3 rounded-xl bg-rose-50/50 border border-rose-200 text-xs">
                      <span className="font-bold text-rose-800 block text-[11px]">Push Failures:</span>
                      {bulkPushResults.results
                        .filter((r: any) => !r.success)
                        .map((r: any, idx: number) => (
                          <div key={idx} className="text-rose-700 text-[11px] flex items-start gap-1.5">
                            <span className="text-rose-400 font-bold">•</span>
                            <span className="font-mono text-[10px] font-semibold">{r.productId.slice(0, 8)}:</span>
                            <span>{r.error || 'Execution failed'}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBulkPushModal(false);
                        setSelectedProductIds([]);
                        setBulkPushResults(null);
                      }}
                      className="px-5 py-2 rounded-xl bg-[#0d2a2c] text-[#fad982] hover:bg-[#143d40] font-bold text-xs shadow-sm transition"
                    >
                      Done & Close
                    </button>
                  </div>
                </div>
              ) : bulkPushing ? (
                /* Progress Display while exporting */
                <div className="py-6 text-center space-y-4">
                  <div className="w-12 h-12 mx-auto rounded-full bg-[#fad982]/20 flex items-center justify-center">
                    <div className="w-6 h-6 border-3 border-[#0d2a2c] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Pushing to Store in Progress...</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Generating change plans, validating schemas & safely syncing {selectedProductIds.length} products.
                    </p>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-[#0d2a2c] h-full rounded-full animate-pulse w-3/4"></div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">Please do not close this window</span>
                </div>
              ) : (
                /* Form Options */
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Store Destination <span className="text-rose-500">*</span>
                    </label>
                    {connectedStores.length === 0 ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        No active stores connected. Please connect an OpenCart or Shopify store in Store Settings first.
                      </div>
                    ) : (
                      <select
                        value={selectedPushStoreId}
                        onChange={(e) => setSelectedPushStoreId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#dbdade] rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                      >
                        {connectedStores.map((st) => {
                          const platformStr = String(st.platformType || st.platform || 'STORE').toUpperCase();
                          const storeTitle = st.storeName || st.name || 'Store';
                          return (
                            <option key={st.id} value={st.id}>
                              {storeTitle} ({platformStr} - {st.storeUrl || 'Connected'})
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Target Translation Language
                    </label>
                    <select
                      value={selectedPushLanguage}
                      onChange={(e) => setSelectedPushLanguage(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-[#dbdade] rounded-xl bg-white font-medium focus:outline-none focus:ring-2 focus:ring-[#0d2a2c]/20"
                    >
                      <option value="en">English (Default)</option>
                      <option value="nl">Dutch (Nederlands)</option>
                      <option value="de">German (Deutsch)</option>
                      <option value="fr">French (Français)</option>
                      <option value="es">Spanish (Español)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Multilingual AI translations will automatically populate the store's language records.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-[#dbdade]/80 text-[11px] text-slate-600 space-y-1">
                    <span className="font-bold text-slate-700 block">Safety & Integrity Checks:</span>
                    <div>✓ Automated idempotent schema validation</div>
                    <div>✓ Audit logs recorded for each pushed product</div>
                    <div>✓ Images uploaded & Journal 3 tabs synced</div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setShowBulkPushModal(false)}
                      className="px-4 py-2 rounded-xl border border-[#dbdade] text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteBulkPush}
                      disabled={connectedStores.length === 0}
                      className="px-5 py-2.5 rounded-xl bg-[#0d2a2c] hover:bg-[#143d40] text-[#fad982] font-bold text-xs shadow-sm transition flex items-center gap-2 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5 text-[#fad982]" />
                      <span>Start Bulk Push ({selectedProductIds.length})</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
