'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Award,
  ArrowLeft,
  Globe,
  SlidersHorizontal,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  Play,
  Layers,
  Settings,
  HelpCircle,
  ExternalLink,
  Edit2,
  Check,
  X,
  Code2,
  ListPlus,
  MousePointerClick,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle,
  FolderKanban,
  FolderPlus,
  Eye,
  Sliders,
  ShoppingBag,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const STANDARD_TARGET_FIELDS = [
  { key: 'name', label: 'Product Name', desc: 'Canonical product title or heading' },
  { key: 'model', label: 'Model Number / MPN', desc: 'Manufacturer part number or model code' },
  { key: 'sku', label: 'SKU', desc: 'Stock keeping unit identifier' },
  { key: 'ean', label: 'EAN / GTIN / UPC', desc: 'Standard barcode identifier (EAN-13, UPC-A)' },
  { key: 'description', label: 'Description', desc: 'Standardized or raw product text overview' },
  { key: 'price', label: 'Price', desc: 'Listing price or MSRP numerical value' },
  { key: 'category', label: 'Category / Breadcrumb', desc: 'Product taxonomy or breadcrumb navigation' },
  { key: 'brand', label: 'Brand Name', desc: 'Manufacturer or brand identifier' },
  { key: 'images', label: 'Image Gallery URLs', desc: 'Primary and secondary product image assets' },
  { key: 'attributes', label: 'Technical Specifications', desc: 'Key-value specification pairs table' },
  { key: 'compatible_models', label: 'Compatible Models', desc: 'Associated fitment or compatibility list' },
  { key: 'meta_title', label: 'SEO Meta Title', desc: 'Search engine preview title' },
  { key: 'meta_description', label: 'SEO Meta Description', desc: 'Search engine preview summary text' },
  { key: 'meta_keyword', label: 'SEO Keywords / Tags', desc: 'Comma-separated search keywords' },
  { key: 'seo_keyword', label: 'SEO URL Handle / Slug', desc: 'Unique SEF URL keyword' },
];

const SOURCE_TYPES = [
  { key: 'css', label: 'CSS Selector (e.g. h1.product-title)' },
  { key: 'composite', label: 'Composite / Merge ({desc} + {features} + {specs})' },
  { key: 'xpath', label: 'XPath (e.g. //div[@id="specs"])' },
  { key: 'json_path', label: 'JSON Path (e.g. $.data.attributes)' },
  { key: 'meta_tag', label: 'Meta Tag (e.g. og:title, itemprop)' },
  { key: 'static_value', label: 'Static Value (Hardcoded default)' },
];

const TRANSFORMATIONS = [
  { key: 'none', label: 'None (Raw Extract)' },
  { key: 'trim', label: 'Trim Whitespace' },
  { key: 'clean_html', label: 'Strip HTML Tags' },
  { key: 'extract_number', label: 'Extract Number / Float' },
  { key: 'lowercase', label: 'Convert to Lowercase' },
  { key: 'uppercase', label: 'Convert to Uppercase' },
];

export default function BrandProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const brandId = params.id as string;

  const [activeTab, setActiveTab] = useState<'visual' | 'mappings' | 'groups' | 'sources' | 'store_export' | 'custom' | 'ai_prompts' | 'model_rules' | 'seo' | 'test' | 'overview'>('visual');
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Editable brand state
  const [brandName, setBrandName] = useState('');
  const [officialWebsite, setOfficialWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('active');
  const [aiPromptRules, setAiPromptRules] = useState('');
  const [languagePromptRules, setLanguagePromptRules] = useState<Record<string, string>>({});
  const [activeBrandPromptLang, setActiveBrandPromptLang] = useState('en');
  const [storeLanguages, setStoreLanguages] = useState<{ primary: string; supported: string[] }>({
    primary: 'en',
    supported: ['en'],
  });

  // Model Pattern Normalization Rules state
  const [modelPatternEnabled, setModelPatternEnabled] = useState(false);
  const [modelPrefix, setModelPrefix] = useState('');
  const [modelSuffix, setModelSuffix] = useState('');
  const [modelTransform, setModelTransform] = useState('NONE');
  const [modelTestInput, setModelTestInput] = useState('77097-4');

  // Dynamic AI SEO Settings state
  const [seoEnabled, setSeoEnabled] = useState(false);
  const [seoFields, setSeoFields] = useState<string[]>(['metaTitle', 'metaDescription', 'targetKeywords', 'urlSlug']);
  const [customSeoPrompt, setCustomSeoPrompt] = useState('');

  // Dynamic field mappings state
  const [fieldMappings, setFieldMappings] = useState<any[]>([]);
  // Field groups state
  const [fieldGroups, setFieldGroups] = useState<any[]>([]);
  // Dynamic sources state
  const [sourceConfigs, setSourceConfigs] = useState<any[]>([]);
  // Dynamic sources form fields
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [newSourceTypeConfig, setNewSourceTypeConfig] = useState('official_website');
  const [newSourcePriority, setNewSourcePriority] = useState(1);
  const [newSourceTrustScore, setNewSourceTrustScore] = useState(0.95);
  // Custom client fields state
  const [customFields, setCustomFields] = useState<any[]>([]);

  // Group Management Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupFields, setNewGroupFields] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Add / Edit Manual Mapping Form Modal
  const [showAddMappingModal, setShowAddMappingModal] = useState(false);
  const [editingMappingIndex, setEditingMappingIndex] = useState<number | null>(null);
  const [newTargetField, setNewTargetField] = useState('name');
  const [customTargetField, setCustomTargetField] = useState('');
  const [newSourceType, setNewSourceType] = useState('css');
  const [newSourceValue, setNewSourceValue] = useState('');
  const [newTransformation, setNewTransformation] = useState('trim');

  // Add / Edit Custom Field Form
  const [editingCustomFieldIndex, setEditingCustomFieldIndex] = useState<number | null>(null);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState('string');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Test Mapping State
  const [testUrl, setTestUrl] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  // --- Phase 9A: Store Export Mapping State ---
  const [connectedStores, setConnectedStores] = useState<any[]>([]);
  const [selectedExportStoreId, setSelectedExportStoreId] = useState<string>('');
  const [storeSchema, setStoreSchema] = useState<any>(null);
  const [storeSchemaLoading, setStoreSchemaLoading] = useState(false);
  const [exportMappings, setExportMappings] = useState<any[]>([]);
  const [exportProfileName, setExportProfileName] = useState<string>('Default Brand Store Mapping');
  const [exportProfileSaving, setExportProfileSaving] = useState(false);
  const [exportValidation, setExportValidation] = useState<any>(null);
  const [exportStatusMsg, setExportStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- VISUAL AUTO MAPPER STATE ---
  const [visualProductUrl, setVisualProductUrl] = useState('');
  const [visualLoading, setVisualLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [selectedTargetField, setSelectedTargetField] = useState('name');
  const [visualSelection, setVisualSelection] = useState<{
    selector: string;
    candidates?: Array<{
      selector: string;
      type: string;
      matchCount: number;
      confidence: string;
      stability: string;
      reason: string;
      warning: string | null;
    }>;
    value: string;
    tagName: string;
    isImage: boolean;
    matchCount: number;
    confidence?: string;
    stability?: string;
    warning?: string | null;
    previewHtml: string;
  } | null>(null);
  const [selectorEditMode, setSelectorEditMode] = useState(false);
  const [editedSelector, setEditedSelector] = useState('');
  const [testingSelector, setTestingSelector] = useState(false);
  const [testSelectorCount, setTestSelectorCount] = useState<number | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  async function loadBrand() {
    try {
      setLoading(true);
      setErrorMsg('');
      const data = await apiClient.getBrandById(brandId);
      if (!data) {
        setErrorMsg('Brand profile not found or access denied.');
        return;
      }
      setBrand(data);
      setBrandName(data.name || '');
      setOfficialWebsite(data.officialWebsite || '');
      setLogoUrl(data.logoUrl || '');
      setNotes(data.notes || '');
      setStatus(data.status || 'active');
      setAiPromptRules(data.aiPromptRules || '');
      setLanguagePromptRules(data.languagePromptRules || {});

      apiClient.getStoreLanguages().then((langs) => {
        if (langs?.supported) {
          setStoreLanguages(langs);
          setActiveBrandPromptLang(langs.primary || 'en');
        }
      }).catch(() => {});
      setFieldMappings(Array.isArray(data.fieldMappings) ? data.fieldMappings : []);
      setFieldGroups(Array.isArray(data.fieldGroups) ? data.fieldGroups : []);
      setSourceConfigs(Array.isArray(data.sourceConfigs) ? data.sourceConfigs : []);
      setCustomFields(Array.isArray(data.customFields) ? data.customFields : []);

      // Load Model Pattern Rules
      const mRules = data.modelPatternRules || {};
      setModelPatternEnabled(Boolean(mRules.enabled));
      setModelPrefix(mRules.prefix || '');
      setModelSuffix(mRules.suffix || '');
      setModelTransform(mRules.transform || 'NONE');

      // Load SEO Settings
      const sSettings = data.seoSettings || {};
      setSeoEnabled(Boolean(sSettings.enabled));
      setSeoFields(Array.isArray(sSettings.fields) && sSettings.fields.length > 0 ? sSettings.fields : ['metaTitle', 'metaDescription', 'targetKeywords', 'urlSlug']);
      setCustomSeoPrompt(sSettings.customPrompt || '');

      if (data.officialWebsite) {
        setOfficialWebsite(data.officialWebsite);
        setTestUrl(data.officialWebsite);
        setVisualProductUrl(data.officialWebsite);
      }
      if (Array.isArray(data.sourceConfigs) && data.sourceConfigs.length > 0 && data.sourceConfigs[0].url) {
        setTestUrl(data.sourceConfigs[0].url);
        setVisualProductUrl(data.sourceConfigs[0].url);
      }

      // Load connected stores for export mapping
      apiClient.getStores().then((stores) => {
        if (Array.isArray(stores)) {
          setConnectedStores(stores);
          if (stores.length > 0 && !selectedExportStoreId) {
            setSelectedExportStoreId(stores[0].id);
          }
        }
      }).catch(() => {});
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load brand profile.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (brandId) loadBrand();
  }, [brandId]);

  // Listen for messages from injected visual inspection iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === 'VISUAL_MAPPER_SELECTION') {
        const payload = event.data.payload;
        setVisualSelection(payload);
        setEditedSelector(payload.selector);
        setSelectorEditMode(false);
        setTestSelectorCount(payload.matchCount);
      } else if (event.data?.type === 'SELECTOR_TEST_RESULT') {
        setTestSelectorCount(event.data.matchCount);
        setTestingSelector(false);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function handleTestEditedSelector() {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    setTestingSelector(true);
    iframeRef.current.contentWindow.postMessage(
      {
        type: 'TEST_SELECTOR_COUNT',
        selector: editedSelector.trim(),
      },
      '*'
    );
  }

  function handleSelectCandidate(cand: any) {
    setEditedSelector(cand.selector);
    setTestSelectorCount(cand.matchCount);
    if (visualSelection) {
      setVisualSelection({
        ...visualSelection,
        selector: cand.selector,
        matchCount: cand.matchCount,
        confidence: cand.confidence,
        stability: cand.stability,
        warning: cand.warning,
      });
    }
  }

  async function handleSaveChanges(mappingsOverride?: any[], groupsOverride?: any[], sourcesOverride?: any[]) {
    try {
      setSaving(true);
      setErrorMsg('');
      const finalMappings = mappingsOverride || fieldMappings;
      const finalGroups = groupsOverride || fieldGroups;
      const finalSources = sourcesOverride || sourceConfigs;
      const res = await apiClient.updateBrand(brandId, {
        name: brandName,
        officialWebsite,
        logoUrl,
        notes,
        status,
        fieldMappings: finalMappings,
        fieldGroups: finalGroups,
        sourceConfigs: finalSources,
        customFields,
        aiPromptRules,
        languagePromptRules,
        modelPatternRules: {
          enabled: modelPatternEnabled,
          prefix: modelPrefix,
          suffix: modelSuffix,
          transform: modelTransform,
        },
        seoSettings: {
          enabled: seoEnabled,
          fields: seoFields,
          customPrompt: customSeoPrompt.trim(),
        },
      });
      if (res?.brand?.modelPatternRules) {
        const mRules = res.brand.modelPatternRules;
        setModelPatternEnabled(Boolean(mRules.enabled));
        setModelPrefix(mRules.prefix || '');
        setModelSuffix(mRules.suffix || '');
        setModelTransform(mRules.transform || 'NONE');
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  }

  // --- Visual Mapper Page Fetch ---
  async function handleLoadVisualPreview(e: React.FormEvent) {
    e.preventDefault();
    if (!visualProductUrl.trim()) return;
    try {
      setVisualLoading(true);
      setErrorMsg('');
      setVisualSelection(null);
      const res = await apiClient.previewBrandPage(brandId, visualProductUrl.trim());
      setPreviewHtml(res.sanitizedHtml);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load visual product preview');
    } finally {
      setVisualLoading(false);
    }
  }

  // --- Confirm Visual Mapping ---
  async function handleSaveVisualMapping() {
    if (!visualSelection) return;
    const finalSelector = (selectorEditMode ? editedSelector : visualSelection.selector).trim();
    if (!finalSelector) {
      alert('A valid CSS selector is required');
      return;
    }

    // Check if target field is already mapped; update or append
    const existingIndex = fieldMappings.findIndex((m) => m.targetField === selectedTargetField);
    const newMapping = {
      id: `map_${Date.now()}`,
      targetField: selectedTargetField,
      sourceType: 'css',
      sourceValue: finalSelector,
      transformation: visualSelection.isImage ? 'none' : 'trim',
      enabled: true,
      previewValue: visualSelection.value,
    };

    let updatedList: any[] = [];
    if (existingIndex >= 0) {
      updatedList = [...fieldMappings];
      updatedList[existingIndex] = newMapping;
    } else {
      updatedList = [...fieldMappings, newMapping];
    }

    setFieldMappings(updatedList);
    await handleSaveChanges(updatedList);
    setVisualSelection(null);

    // Automatically prompt next unmapped field for smooth flow
    const allAvailable = [
      ...STANDARD_TARGET_FIELDS.map((f) => f.key),
      ...customFields.map((cf) => cf.key),
    ];
    const unmapped = allAvailable.find((key) => !updatedList.some((m) => m.targetField === key));
    if (unmapped) {
      setSelectedTargetField(unmapped);
    }
  }

  // --- Manual Mapping Operations ---
  function handleOpenAddModal() {
    setEditingMappingIndex(null);
    setNewTargetField('name');
    setCustomTargetField('');
    setNewSourceType('css');
    setNewSourceValue('');
    setNewTransformation('trim');
    setShowAddMappingModal(true);
  }

  function handleOpenEditModal(index: number) {
    const item = fieldMappings[index];
    if (!item) return;
    setEditingMappingIndex(index);

    const isStandard = STANDARD_TARGET_FIELDS.some((f) => f.key === item.targetField);
    const isCustomField = customFields.some((cf) => cf.key === item.targetField);

    if (isStandard || isCustomField) {
      setNewTargetField(item.targetField);
      setCustomTargetField('');
    } else {
      setNewTargetField('__custom__');
      setCustomTargetField(item.targetField);
    }

    setNewSourceType(item.sourceType || 'css');
    setNewSourceValue(item.sourceValue || '');
    setNewTransformation(item.transformation || 'trim');
    setShowAddMappingModal(true);
  }

  function handleAddManualMapping(e: React.FormEvent) {
    e.preventDefault();
    const finalTarget = newTargetField === '__custom__' ? customTargetField.trim() : newTargetField;
    if (!finalTarget) {
      alert('Target field is required');
      return;
    }
    if (!newSourceValue.trim()) {
      alert('Source selector/value is required');
      return;
    }

    if (editingMappingIndex !== null && editingMappingIndex >= 0) {
      // Edit existing mapping
      const updated = [...fieldMappings];
      updated[editingMappingIndex] = {
        ...updated[editingMappingIndex],
        targetField: finalTarget,
        sourceType: newSourceType,
        sourceValue: newSourceValue.trim(),
        transformation: newTransformation,
      };
      setFieldMappings(updated);
      setShowAddMappingModal(false);
      setEditingMappingIndex(null);
      handleSaveChanges(updated);
    } else {
      // Add new mapping
      const mapping = {
        id: `map_${Date.now()}`,
        targetField: finalTarget,
        sourceType: newSourceType,
        sourceValue: newSourceValue.trim(),
        transformation: newTransformation,
        enabled: true,
      };

      const updated = [...fieldMappings, mapping];
      setFieldMappings(updated);
      setNewSourceValue('');
      setCustomTargetField('');
      setShowAddMappingModal(false);
      handleSaveChanges(updated);
    }
  }

  function handleDeleteMapping(index: number) {
    const updated = fieldMappings.filter((_, i) => i !== index);
    setFieldMappings(updated);
    handleSaveChanges(updated);
  }

  function handleToggleMapping(index: number) {
    const updated = [...fieldMappings];
    updated[index].enabled = !updated[index].enabled;
    setFieldMappings(updated);
    handleSaveChanges(updated);
  }

  // --- Dynamic Source Operations ---
  function handleAddSource(e: React.FormEvent) {
    e.preventDefault();
    if (!newSourceUrl.trim()) return;
    let domain = '';
    try {
      domain = new URL(newSourceUrl.trim()).hostname.replace(/^www\./, '');
    } catch (_) {
      domain = newSourceUrl.trim();
    }

    const src = {
      id: `src_${Date.now()}`,
      name: newSourceName.trim() || domain,
      url: newSourceUrl.trim(),
      domain: domain,
      sourceType: newSourceTypeConfig,
      priority: Number(newSourcePriority) || 1,
      trustScore: Number(newSourceTrustScore) || 0.95,
      isActive: true,
      addedAt: new Date().toISOString(),
    };
    const updated = [...sourceConfigs, src].sort((a, b) => (a.priority || 1) - (b.priority || 1));
    setSourceConfigs(updated);
    setNewSourceName('');
    setNewSourceUrl('');
    setNewSourcePriority(updated.length + 1);
    handleSaveChanges(undefined, undefined, updated);
  }

  function handleToggleSourceStatus(index: number) {
    const updated = [...sourceConfigs];
    updated[index].isActive = updated[index].isActive === false ? true : false;
    setSourceConfigs(updated);
    handleSaveChanges(undefined, undefined, updated);
  }

  function handleDeleteSource(index: number) {
    const updated = sourceConfigs.filter((_, i) => i !== index);
    setSourceConfigs(updated);
    handleSaveChanges(undefined, undefined, updated);
  }

  // --- Dynamic Custom Field Operations ---
  function handleOpenEditCustomField(index: number) {
    const cf = customFields[index];
    if (!cf) return;
    setEditingCustomFieldIndex(index);
    setNewFieldName(cf.name || '');
    setNewFieldKey(cf.key || '');
    setNewFieldType(cf.type || 'string');
    setNewFieldRequired(Boolean(cf.required));
  }

  function handleCancelEditCustomField() {
    setEditingCustomFieldIndex(null);
    setNewFieldName('');
    setNewFieldKey('');
    setNewFieldType('string');
    setNewFieldRequired(false);
  }

  function handleAddCustomField(e: React.FormEvent) {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    const key = newFieldKey.trim() || newFieldName.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    if (editingCustomFieldIndex !== null && editingCustomFieldIndex >= 0) {
      const oldKey = customFields[editingCustomFieldIndex].key;
      const updated = [...customFields];
      updated[editingCustomFieldIndex] = {
        ...updated[editingCustomFieldIndex],
        name: newFieldName.trim(),
        key,
        type: newFieldType,
        required: newFieldRequired,
      };

      // Also sync if any fieldMapping is pointing to oldKey
      let updatedMappings = [...fieldMappings];
      if (oldKey !== key) {
        updatedMappings = updatedMappings.map((m) =>
          m.targetField === oldKey ? { ...m, targetField: key } : m
        );
        setFieldMappings(updatedMappings);
      }

      setCustomFields(updated);
      handleCancelEditCustomField();
      handleSaveChanges(updatedMappings);
    } else {
      const field = {
        id: `cf_${Date.now()}`,
        name: newFieldName.trim(),
        key,
        type: newFieldType,
        required: newFieldRequired,
      };
      const updated = [...customFields, field];
      setCustomFields(updated);
      setNewFieldName('');
      setNewFieldKey('');
      handleSaveChanges();
    }
  }

  function handleDeleteCustomField(index: number) {
    const updated = customFields.filter((_, i) => i !== index);
    setCustomFields(updated);
    handleSaveChanges();
  }

  // --- Dynamic Field Groups Operations ---
  function handleOpenAddGroup() {
    setEditingGroupId(null);
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupFields([]);
  }

  function handleOpenEditGroup(group: any) {
    setEditingGroupId(group.id);
    setNewGroupName(group.name || '');
    setNewGroupDesc(group.description || '');
    setNewGroupFields(Array.isArray(group.fields) ? group.fields : []);
  }

  function handleSaveGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    let updatedGroups: any[] = [];
    if (editingGroupId) {
      updatedGroups = fieldGroups.map((g) =>
        g.id === editingGroupId
          ? { ...g, name: newGroupName.trim(), description: newGroupDesc.trim(), fields: newGroupFields, updatedAt: new Date().toISOString() }
          : g
      );
    } else {
      const newGroup = {
        id: `grp_${Date.now()}`,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        fields: newGroupFields,
        createdAt: new Date().toISOString(),
      };
      updatedGroups = [...fieldGroups, newGroup];
    }

    setFieldGroups(updatedGroups);
    setEditingGroupId(null);
    setNewGroupName('');
    setNewGroupDesc('');
    setNewGroupFields([]);
    handleSaveChanges(undefined, updatedGroups);
  }

  function handleDeleteGroup(groupId: string) {
    const updatedGroups = fieldGroups.filter((g) => g.id !== groupId);
    setFieldGroups(updatedGroups);
    handleSaveChanges(undefined, updatedGroups);
  }

  function handleToggleFieldInGroup(fieldKey: string) {
    if (newGroupFields.includes(fieldKey)) {
      setNewGroupFields(newGroupFields.filter((f) => f !== fieldKey));
    } else {
      setNewGroupFields([...newGroupFields, fieldKey]);
    }
  }

  // --- Phase 9A Store Export Mapping Handlers ---
  async function loadExportProfile(storeId: string) {
    if (!storeId || !brandId) return;
    try {
      setStoreSchemaLoading(true);
      setExportStatusMsg(null);

      // 1. Discover or fetch cached schema
      const discovery = await apiClient.discoverStoreSchema(storeId);
      if (discovery?.schema) {
        setStoreSchema(discovery.schema);
      }

      // 2. Fetch existing brand export profile for this store
      const profile = await apiClient.getBrandStoreExportProfile(brandId, storeId);
      if (profile && profile.fieldMappings && profile.fieldMappings.length > 0) {
        setExportMappings(profile.fieldMappings);
        if (profile.profileName) setExportProfileName(profile.profileName);
      } else {
        // Initialize with default safe mappings
        const defaultMappings = [
          { sourceField: 'name', storeTargetField: 'name', permission: 'new_and_existing', writePolicy: 'replace', transformType: 'direct', enabled: true },
          { sourceField: 'description', storeTargetField: 'description', permission: 'new_and_existing', writePolicy: 'replace', transformType: 'direct', enabled: true },
          { sourceField: 'price', storeTargetField: 'price', permission: 'new_only', writePolicy: 'create_only', transformType: 'direct', enabled: true },
          { sourceField: 'model', storeTargetField: 'model', permission: 'new_and_existing', writePolicy: 'create_only', transformType: 'direct', enabled: true },
          { sourceField: 'sku', storeTargetField: 'sku', permission: 'new_and_existing', writePolicy: 'create_only', transformType: 'direct', enabled: true },
          { sourceField: 'images', storeTargetField: 'images', permission: 'new_and_existing', writePolicy: 'replace', transformType: 'direct', enabled: true },
          { sourceField: 'compatible_models', storeTargetField: 'custom_fields', permission: 'new_and_existing', writePolicy: 'add_only', transformType: 'direct', enabled: true },
        ];
        setExportMappings(defaultMappings);
        setExportProfileName(`${brandName || 'Brand'} - Store Mapping`);
      }
    } catch (err: any) {
      setExportStatusMsg({ type: 'error', text: err.message || 'Failed to load store export schema' });
    } finally {
      setStoreSchemaLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'store_export' && selectedExportStoreId) {
      loadExportProfile(selectedExportStoreId);
    }
  }, [activeTab, selectedExportStoreId]);

  function handleUpdateExportMappingRow(index: number, key: string, value: any) {
    const updated = [...exportMappings];
    updated[index] = { ...updated[index], [key]: value };
    setExportMappings(updated);
  }

  function handleAddExportMappingRow() {
    setExportMappings([
      ...exportMappings,
      {
        sourceField: 'name',
        storeTargetField: '',
        permission: 'new_and_existing',
        writePolicy: 'replace',
        transformType: 'direct',
        enabled: true,
      },
    ]);
  }

  function handleRemoveExportMappingRow(index: number) {
    setExportMappings(exportMappings.filter((_, i) => i !== index));
  }

  async function handleValidateAndSaveExportProfile() {
    try {
      setExportProfileSaving(true);
      setExportStatusMsg(null);

      // Step 1: Validate mappings first
      const val = await apiClient.validateExportMapping(exportMappings);
      setExportValidation(val);

      if (!val.valid) {
        setExportStatusMsg({
          type: 'error',
          text: `Export mapping validation failed with ${val.errors.length} error(s). Please review and correct.`,
        });
        return;
      }

      // Step 2: Save Brand Store Export Profile
      await apiClient.saveBrandStoreExportProfile(brandId, selectedExportStoreId, {
        profileName: exportProfileName,
        fieldMappings: exportMappings,
      });

      setExportStatusMsg({
        type: 'success',
        text: 'Store export profile saved and validated successfully! Note: Store products will NOT be modified until Phase 9B.',
      });
    } catch (err: any) {
      setExportStatusMsg({ type: 'error', text: err.message || 'Failed to save store export profile' });
    } finally {
      setExportProfileSaving(false);
    }
  }

  // --- Test Mapping Dry-run ---
  async function handleRunTestMapping(e: React.FormEvent) {
    e.preventDefault();
    const targetUrl = testUrl.trim() || visualProductUrl.trim();
    if (!targetUrl) return;
    try {
      setTestLoading(true);
      setTestResults(null);
      setErrorMsg('');
      const res = await apiClient.testBrandMapping(brandId, {
        sampleUrl: targetUrl,
        mappings: fieldMappings,
      });
      setTestResults(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Mapping test failed');
    } finally {
      setTestLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200">
        <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-[#0d2a2c] rounded-full animate-spin mb-3"></div>
        <p className="text-xs font-semibold text-slate-500">Loading brand profile configuration...</p>
      </div>
    );
  }

  if (errorMsg && !brand) {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-white rounded-2xl border border-rose-200 text-center space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">{errorMsg}</h2>
        <Link
          href="/brands"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#0d2a2c] text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Brand Profiles</span>
        </Link>
      </div>
    );
  }

  const initials = brandName.substring(0, 2).toUpperCase() || 'BP';

  return (
    <div className="space-y-6 w-full font-sans text-slate-800 pb-16">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/brands"
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition flex items-center gap-1.5 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Brand Profiles</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">{brandName}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">
              {status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Saved!</span>
            </div>
          )}

          <button
            onClick={() => handleSaveChanges()}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs rounded-xl shadow-sm transition"
          >
            <Save className="w-4 h-4 text-[#fad982]" />
            <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      {/* Two Column Layout: Left Vertical Vertical Tab Navigation + Right Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Vertical Tab Menu (Khada Sidebar Style) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm space-y-1 sticky top-6">
          <div className="px-3 py-2 border-b border-slate-100 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Configuration Modules
            </span>
          </div>

          {[
            { key: 'visual', label: 'Visual Auto Mapping', icon: MousePointerClick, badge: 'NEW' },
            { key: 'mappings', label: 'Manual Field Mapping', icon: SlidersHorizontal, count: fieldMappings.length },
            { key: 'groups', label: 'Field Groups', icon: FolderKanban, count: fieldGroups.length },
            { key: 'sources', label: 'Product Sources', icon: Layers, count: sourceConfigs.length },
            { key: 'store_export', label: 'Store Export Mapping', icon: ShoppingBag, badge: 'Phase 9A' },
            { key: 'custom', label: 'Custom Client Fields', icon: ListPlus, count: customFields.length },
            { key: 'model_rules', label: 'Model Normalization', icon: Sliders, badge: modelPatternEnabled ? 'ON' : undefined },
            { key: 'seo', label: 'AI SEO Settings', icon: Globe, badge: seoEnabled ? 'ON' : undefined },
            { key: 'ai_prompts', label: 'AI Prompt Rules', icon: Sparkles, badge: 'AI' },
            { key: 'test', label: 'Test & Preview', icon: Play },
            { key: 'overview', label: 'Brand Details', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setActiveTab(tab.key as any);
                  if (tab.key === 'test' && visualProductUrl && (!testUrl || testUrl === officialWebsite)) {
                    setTestUrl(visualProductUrl);
                  }
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                  isActive
                    ? 'bg-[#0d2a2c] text-[#fad982] shadow-sm'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#fad982]' : 'text-slate-400'}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {tab.badge && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                      isActive ? 'bg-[#fad982] text-slate-950' : 'bg-amber-100 text-amber-900'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.count !== undefined && (
                    <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isActive ? 'bg-teal-900 text-[#fad982]' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Column: Tab Content Body */}
        <div className="lg:col-span-9 space-y-6">

      {/* TAB 1: VISUAL AUTO MAPPING (CLICK-TO-MAP) */}
      {activeTab === 'visual' && (
        <div className="space-y-6">
          {/* Step 1: Enter Product URL */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Visual Auto Mapper — Click-to-Map Product Elements</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter a product URL to load a live visual sandbox. Hover over any title, price, SKU, or image and click to automatically generate reliable CSS selectors.
                </p>
              </div>
            </div>

            <form onSubmit={handleLoadVisualPreview} className="flex flex-col sm:flex-row gap-3 pt-1">
              <input
                type="url"
                required
                placeholder="https://traxxas.com/products/models/electric/slash-4x4-vxl"
                value={visualProductUrl}
                onChange={(e) => setVisualProductUrl(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
              />
              <button
                type="submit"
                disabled={visualLoading}
                className="px-5 py-2.5 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-[#fad982]" />
                <span>{visualLoading ? 'Loading Page...' : 'Load Product Preview'}</span>
              </button>
            </form>
          </div>

          {/* Interactive Split View: Left = Visual Preview Sandbox | Right = Mapping Confirmation Panel */}
          {previewHtml ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
              {/* Left Sandbox Preview */}
              <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className="font-semibold text-slate-800">Visual Sandbox Preview:</span>
                    <span className="text-slate-500 truncate max-w-sm">{visualProductUrl}</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                    Click Any Element
                  </span>
                </div>

                <div className="flex-1 relative bg-white">
                  <iframe
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    title="Product Page Visual Mapper"
                    className="w-full h-[650px] border-none"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>

              {/* Right Configuration & Mapping Status Side Panel */}
              <div className="lg:col-span-4 space-y-4">
                {/* Active Selection Confirmation Card */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="border-b border-slate-100 pb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Step 2 & 3</span>
                    <h4 className="text-sm font-bold text-slate-900">Map Clicked Element</h4>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Target Field
                    </label>
                    <select
                      value={selectedTargetField}
                      onChange={(e) => setSelectedTargetField(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                    >
                      <optgroup label="Standard Fields">
                        {STANDARD_TARGET_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} ({f.key})
                          </option>
                        ))}
                      </optgroup>
                      {customFields.length > 0 && (
                        <optgroup label="Custom Client Fields">
                          {customFields.map((cf) => (
                            <option key={cf.key} value={cf.key}>
                              {cf.name} ({cf.key})
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {visualSelection ? (
                    <div className="space-y-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 animate-fadeIn">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Selected Value</span>
                        <div className="text-xs font-bold text-slate-900 bg-white p-2.5 rounded-lg border border-slate-200 break-words max-h-24 overflow-y-auto">
                          {visualSelection.isImage ? (
                            <div className="space-y-1">
                              <span className="text-[10px] text-amber-700 font-bold block">[Product Image Detected]</span>
                              <img src={visualSelection.value} alt="Preview" className="h-16 w-auto object-contain rounded border border-slate-100" />
                              <span className="text-[9px] font-mono text-slate-400 truncate block">{visualSelection.value}</span>
                            </div>
                          ) : (
                            visualSelection.value || <span className="italic text-slate-400">Empty string</span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">CSS Selector</span>
                          <div className="flex items-center gap-2">
                            {selectorEditMode && (
                              <button
                                type="button"
                                onClick={handleTestEditedSelector}
                                disabled={testingSelector}
                                className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1"
                              >
                                <span>{testingSelector ? 'Testing...' : 'Test Match'}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectorEditMode(!selectorEditMode);
                                if (!selectorEditMode) setEditedSelector(visualSelection.selector);
                              }}
                              className="text-[10px] font-bold text-[#0d2a2c] hover:underline flex items-center gap-1"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                              <span>{selectorEditMode ? 'Done' : 'Edit'}</span>
                            </button>
                          </div>
                        </div>

                        {selectorEditMode ? (
                          <div className="space-y-1.5">
                            <input
                              type="text"
                              value={editedSelector}
                              onChange={(e) => setEditedSelector(e.target.value)}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 bg-white focus:outline-none focus:border-[#0d2a2c]"
                            />
                            {testSelectorCount !== null && (
                              <div className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                <span>Matches:</span>
                                <span className={testSelectorCount === 1 ? 'text-emerald-700 font-bold' : testSelectorCount > 1 ? 'text-amber-700 font-bold' : 'text-rose-600 font-bold'}>
                                  {testSelectorCount} elements found in preview
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs font-mono font-bold text-[#0d2a2c] bg-white px-2.5 py-2 rounded-lg border border-slate-200 truncate">
                            {visualSelection.selector}
                          </div>
                        )}
                      </div>

                      {/* Multi-Candidate Selector Recommendation Engine */}
                      {visualSelection.candidates && visualSelection.candidates.length > 1 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block">
                            Recommended Alternatives ({visualSelection.candidates.length})
                          </span>
                          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                            {visualSelection.candidates.map((cand, cIdx) => {
                              const isSelected = cand.selector === (selectorEditMode ? editedSelector : visualSelection.selector);
                              return (
                                <button
                                  key={cIdx}
                                  type="button"
                                  onClick={() => handleSelectCandidate(cand)}
                                  className={`w-full text-left p-1.5 rounded-lg text-[11px] border transition flex items-center justify-between gap-1.5 ${
                                    isSelected
                                      ? 'bg-amber-50 border-amber-300 text-slate-950 font-bold'
                                      : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  <div className="truncate flex-1">
                                    <div className="font-mono truncate">{cand.selector}</div>
                                    <div className="text-[9px] text-slate-400 font-sans">{cand.reason}</div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                      cand.matchCount === 1
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {cand.matchCount} {cand.matchCount === 1 ? 'match' : 'matches'}
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-semibold uppercase">{cand.stability}</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Selector Quality Status & Health Confidence */}
                      <div className="space-y-1.5 pt-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">Confidence</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                            (visualSelection as any).confidence === 'High' || visualSelection.matchCount === 1
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : (visualSelection as any).confidence === 'Medium' || visualSelection.matchCount > 1
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {(visualSelection as any).confidence || (visualSelection.matchCount === 1 ? 'High' : 'Medium')} Confidence
                          </span>
                        </div>

                        {visualSelection.matchCount === 1 ? (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-lg border border-emerald-200 w-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>1 element found &bull; Optimal stable selector</span>
                          </div>
                        ) : visualSelection.matchCount > 1 ? (
                          <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200 w-full">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>{visualSelection.matchCount} matching elements found on page</span>
                            </div>
                            {(visualSelection as any).warning && (
                              <p className="text-[10px] text-amber-700 italic">{(visualSelection as any).warning}</p>
                            )}
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-800 bg-rose-50/80 px-2.5 py-1 rounded-lg border border-rose-200 w-full">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                            <span>0 elements found with current selector</span>
                          </div>
                        )}
                      </div>

                      <div className="pt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveVisualMapping}
                          className="flex-1 py-2 px-3 bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
                        >
                          <Check className="w-4 h-4 text-slate-950" />
                          <span>Save Mapping</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setVisualSelection(null)}
                          className="p-2 border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-100 transition"
                          title="Cancel selection"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400 space-y-2">
                      <MousePointerClick className="w-6 h-6 text-slate-300 mx-auto" />
                      <p>Move your mouse over the page preview on the left and click the data you want to assign to <strong>{selectedTargetField}</strong>.</p>
                    </div>
                  )}
                </div>

                {/* Configured Fields Checklist */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Workspace Fields ({fieldMappings.length})
                    </h4>
                    <span className="text-[10px] text-slate-400">Click to edit</span>
                  </div>

                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {STANDARD_TARGET_FIELDS.slice(0, 7).map((f) => {
                      const mapping = fieldMappings.find((m) => m.targetField === f.key);
                      const isMapped = !!mapping;
                      const isCurrentlySelected = selectedTargetField === f.key;

                      return (
                        <div
                          key={f.key}
                          onClick={() => setSelectedTargetField(f.key)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition ${
                            isCurrentlySelected
                              ? 'bg-[#fad982]/30 border border-amber-300 font-bold text-slate-950'
                              : 'hover:bg-slate-50 text-slate-600'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {isMapped ? (
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                            )}
                            <span className="truncate">{f.label}</span>
                          </div>
                          {isMapped && (
                            <span className="font-mono text-[9px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[90px]">
                              {mapping.sourceValue}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 max-w-xl mx-auto shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <MousePointerClick className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">Enter a URL to Start Visual Auto Mapping</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide a product detail page from <strong>{brandName}</strong>. The server will safely sanitize and render the page preview so you can click titles, prices, and SKUs directly.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANUAL FIELD MAPPINGS (Advanced Option) */}
      {activeTab === 'mappings' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Manual Field Mappings (Advanced)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Technical clients can manually write and fine-tune CSS selectors, XPath expressions, or JSON paths.
              </p>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4 text-slate-950" />
              <span>+ Add Field Mapping</span>
            </button>
          </div>

          {fieldMappings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 mx-auto flex items-center justify-center">
                <SlidersHorizontal className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-sm font-bold text-slate-900">No Field Mappings Configured</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                This brand currently has zero field mappings. Use the <strong>Visual Auto Mapping</strong> tab above or click below to enter selectors manually.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleOpenAddModal}
                  className="px-4 py-2 bg-[#0d2a2c] text-white font-bold text-xs rounded-xl hover:bg-[#143d40] transition shadow"
                >
                  + Add First Field Mapping
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-3.5">Target Field</th>
                    <th className="px-6 py-3.5">Source Type</th>
                    <th className="px-6 py-3.5">Source Selector / Value</th>
                    <th className="px-6 py-3.5">Selector Health</th>
                    <th className="px-6 py-3.5">Transformation</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fieldMappings.map((m, idx) => {
                    const stdField = STANDARD_TARGET_FIELDS.find((f) => f.key === m.targetField);
                    const label = stdField ? stdField.label : m.targetField;
                    const health = m.healthStatus || 'healthy';

                    return (
                      <tr key={m.id || idx} className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{label}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{m.targetField}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                            {m.sourceType || 'css'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-slate-900 font-semibold">
                          {m.sourceValue}
                        </td>
                        <td className="px-6 py-4">
                          {health === 'healthy' ? (
                            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 w-fit">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-[10px] font-bold">Healthy (100%)</span>
                            </div>
                          ) : health === 'degraded' ? (
                            <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 w-fit">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                              <span className="text-[10px] font-bold">Degraded ({m.consecutiveFailures || 1} fails)</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-200 w-fit">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span className="text-[10px] font-bold">Broken / Re-map</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {m.transformation && m.transformation !== 'none' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              {m.transformation}
                            </span>
                          ) : (
                            <span className="text-slate-400">Direct</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleToggleMapping(idx)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition ${
                              m.enabled !== false
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-400 border border-slate-200'
                            }`}
                          >
                            {m.enabled !== false ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(idx)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-[#0d2a2c] hover:bg-slate-100 transition"
                              title="Edit Field Mapping"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMapping(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Mapping"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: FIELD GROUPS */}
      {activeTab === 'groups' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingGroupId ? 'Edit Field Group' : 'Create New Field Group'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Organize your product mappings into logical groups (e.g. "Core Identifiers", "Media & Gallery", "Technical Specs", "Pricing & Stock").
                </p>
              </div>
              {editingGroupId && (
                <button
                  onClick={handleOpenAddGroup}
                  className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Group Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Media & Image Assets"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                    Group Description / Purpose (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. High resolution photos, thumbnails and action banners"
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">
                  Select Mappings To Include In This Group ({newGroupFields.length} selected)
                </label>
                {fieldMappings.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400 italic">
                    No field mappings configured yet. Add field mappings first to assign them to groups.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto p-1">
                    {fieldMappings.map((m) => {
                      const stdField = STANDARD_TARGET_FIELDS.find((f) => f.key === m.targetField);
                      const label = stdField ? stdField.label : m.targetField;
                      const isSelected = newGroupFields.includes(m.targetField);

                      return (
                        <div
                          key={m.targetField}
                          onClick={() => handleToggleFieldInGroup(m.targetField)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition ${
                            isSelected
                              ? 'bg-[#fad982]/20 border-amber-300 font-bold text-slate-900 shadow-xs'
                              : 'bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="block truncate">{label}</span>
                            <span className="text-[10px] font-mono text-slate-400">{m.targetField}</span>
                          </div>
                          <div className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] ${
                            isSelected ? 'bg-[#0d2a2c] text-white border-[#0d2a2c]' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-[#fad982]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!newGroupName.trim()}
                  className="px-5 py-2.5 bg-[#0d2a2c] hover:bg-[#143d40] text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
                >
                  <FolderPlus className="w-4 h-4 text-[#fad982]" />
                  <span>{editingGroupId ? 'Update Field Group' : '+ Create Field Group'}</span>
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">Configured Field Groups ({fieldGroups.length})</h4>
            </div>

            {fieldGroups.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FolderKanban className="w-8 h-8 text-slate-300 mx-auto" />
                <h5 className="text-sm font-bold text-slate-700">No Groups Defined Yet</h5>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Create your first group above (e.g. "Primary Specs", "Media Assets") to group mapped fields together.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {fieldGroups.map((g) => (
                  <div key={g.id} className="p-6 hover:bg-slate-50/60 transition space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <FolderKanban className="w-4 h-4 text-[#0d2a2c]" />
                          <h5 className="text-sm font-bold text-slate-900">{g.name}</h5>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {Array.isArray(g.fields) ? g.fields.length : 0} fields
                          </span>
                        </div>
                        {g.description && (
                          <p className="text-xs text-slate-500 pl-6">{g.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleOpenEditGroup(g)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#0d2a2c] hover:bg-slate-100 transition"
                          title="Edit Group"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGroup(g.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete Group"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="pl-6 flex flex-wrap gap-2">
                      {Array.isArray(g.fields) && g.fields.length > 0 ? (
                        g.fields.map((fieldKey: string) => {
                          const mapping = fieldMappings.find((m) => m.targetField === fieldKey);
                          const stdField = STANDARD_TARGET_FIELDS.find((f) => f.key === fieldKey);
                          const label = stdField ? stdField.label : fieldKey;

                          return (
                            <span
                              key={fieldKey}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs"
                            >
                              <span>{label}</span>
                              {mapping && (
                                <span className="font-mono text-[9px] text-slate-400 font-normal">
                                  ({mapping.sourceValue})
                                </span>
                              )}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-xs text-slate-400 italic">No fields assigned to this group.</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT SOURCES (PART 1: MULTI-SOURCE ARCHITECTURE) */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Approved Product Source</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure official websites, regional domains, authorized distributors, or marketplaces with dynamic priority and trust scores.
              </p>
            </div>

            <form onSubmit={handleAddSource} className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
              <div className="sm:col-span-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Official US Store"
                  value={newSourceName}
                  onChange={(e) => setNewSourceName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source URL / Domain</label>
                <input
                  type="url"
                  required
                  placeholder="https://traxxas.com"
                  value={newSourceUrl}
                  onChange={(e) => setNewSourceUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Source Type</label>
                <select
                  value={newSourceTypeConfig}
                  onChange={(e) => setNewSourceTypeConfig(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="official_website">Official Website</option>
                  <option value="authorized_distributor">Authorized Distributor</option>
                  <option value="marketplace">Marketplace</option>
                  <option value="supplier">Supplier Feed</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Priority</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newSourcePriority}
                  onChange={(e) => setNewSourcePriority(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none text-center font-bold"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow transition"
                >
                  + Add Source
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">Approved Dynamic Sources ({sourceConfigs.length})</h4>
                <p className="text-[11px] text-slate-500">Extraction queue prioritizes sources according to rank.</p>
              </div>
            </div>
            {sourceConfigs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No source websites configured yet. Add an official domain above.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sourceConfigs.map((src, idx) => (
                  <div key={src.id || idx} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition">
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 font-bold text-xs flex items-center justify-center border border-amber-200 shadow-sm">
                        #{src.priority || idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">{src.name || src.domain || src.url}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            src.isActive !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {src.isActive !== false ? 'Active' : 'Disabled'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1 font-mono">
                          <a href={src.url} target="_blank" rel="noreferrer" className="hover:text-amber-600 flex items-center gap-1">
                            <span>{src.url}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </a>
                          <span>&bull;</span>
                          <span className="capitalize">{src.sourceType?.replace('_', ' ') || 'Website'}</span>
                          <span>&bull;</span>
                          <span className="text-amber-700 font-semibold">Trust: {Math.round((src.trustScore || 0.95) * 100)}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSourceStatus(idx)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 hover:bg-slate-100 transition"
                      >
                        {src.isActive !== false ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeleteSource(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete source"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOM CLIENT FIELDS */}
      {activeTab === 'custom' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingCustomFieldIndex !== null ? 'Edit Custom Attribute' : 'Define Custom Product Attributes'}
                </h3>
                <p className="text-xs text-slate-500">
                  Create client-specific attributes (e.g. Compatible RC Model, Scale, Material, Motor Type) stored cleanly in product metadata.
                </p>
              </div>
              {editingCustomFieldIndex !== null && (
                <button
                  onClick={handleCancelEditCustomField}
                  className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg"
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <form onSubmit={handleAddCustomField} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Field Label</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Compatible RC Model"
                  value={newFieldName}
                  onChange={(e) => {
                    setNewFieldName(e.target.value);
                    if (!newFieldKey || editingCustomFieldIndex === null) {
                      setNewFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Attribute Key</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. compatible_rc_model"
                  value={newFieldKey}
                  onChange={(e) => setNewFieldKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Data Type</label>
                <select
                  value={newFieldType}
                  onChange={(e) => setNewFieldType(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="string">Text / String</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean (Yes/No)</option>
                  <option value="array">List / Array</option>
                </select>
              </div>

              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  className="w-full py-2 px-4 bg-[#0d2a2c] text-white font-bold text-xs rounded-xl hover:bg-[#143d40] transition shadow"
                >
                  {editingCustomFieldIndex !== null ? 'Update Custom Field' : '+ Add Custom Field'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">Registered Custom Fields ({customFields.length})</h4>
            </div>
            {customFields.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 italic">
                No custom fields defined. Create one above to extend your product schema dynamically.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {customFields.map((cf, idx) => (
                  <div key={cf.id || idx} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 transition">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{cf.name}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">key: {cf.key} &bull; type: {cf.type}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEditCustomField(idx)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-[#0d2a2c] hover:bg-slate-100 transition"
                        title="Edit Custom Field"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomField(idx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete Custom Field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: TEST & PREVIEW EXTRACTION */}
      {activeTab === 'test' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Dry-Run Field Mapping Test</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter a real product URL to test your configured selectors ({fieldMappings.length} mappings active) and verify extracted values before deploying to production ingestion.
                </p>
              </div>
              {fieldMappings.length === 0 && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  No mappings yet. Use Visual Mapper or Manual Mapping first.
                </span>
              )}
            </div>

            <form onSubmit={handleRunTestMapping} className="flex flex-col sm:flex-row gap-3">
              <input
                type="url"
                required
                placeholder="https://traxxas.com/10911-blue-funco-pro-scale-replica-blue-body"
                value={testUrl}
                onChange={(e) => setTestUrl(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white font-mono"
              />
              <button
                type="submit"
                disabled={testLoading}
                className="px-5 py-2.5 bg-[#fad982] hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition shadow flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>{testLoading ? 'Evaluating Selectors...' : 'Run Test Extraction'}</span>
              </button>
            </form>
          </div>

          {testResults && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">Live Field Extraction Results</h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {testResults.successfulFieldsCount || 0} / {testResults.totalConfiguredMappings || 0} Extracted Successfully
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    URL: {testResults.testUrl}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(testResults.results || {}).map(([key, val]: [string, any]) => {
                  const isSuccess = val.status === 'success' || val.status === 'cached_preview' || val.status === 'evaluated';
                  const standardMatch = STANDARD_TARGET_FIELDS.find((f) => f.key === key);
                  const label = standardMatch ? standardMatch.label : key;

                  return (
                    <div
                      key={key}
                      className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white hover:shadow-sm transition"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900">{label}</span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-200/60 px-1.5 py-0.2 rounded">
                            {key}
                          </span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                              isSuccess
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {val.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                          <span>Selector: <strong className="text-slate-700">{val.sourceValue}</strong></span>
                          <span>&bull;</span>
                          <span>Transform: {val.transformation || 'none'}</span>
                        </div>
                      </div>

                      <div className="sm:text-right max-w-lg w-full sm:w-auto">
                        {Array.isArray(val.extractedValue) ? (
                          <div className="space-y-1.5 flex flex-col items-end">
                            <span className="text-[10px] font-bold text-slate-500">
                              {val.extractedValue.length} items extracted (Array)
                            </span>
                            <div className="flex flex-wrap gap-1.5 justify-end max-w-sm">
                              {val.extractedValue.map((item: string, i: number) => {
                                const isImg = typeof item === 'string' && (item.startsWith('http') && (item.match(/\.(jpg|jpeg|png|webp|gif)/i) || key.includes('image') || key.includes('iamge')));
                                if (isImg) {
                                  return (
                                    <a
                                      key={i}
                                      href={item}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={item}
                                      className="block group relative"
                                    >
                                      <img
                                        src={item}
                                        alt={`img-${i}`}
                                        className="w-10 h-10 object-contain rounded-lg border border-slate-200 bg-white hover:border-[#0d2a2c] hover:scale-105 transition shadow-xs"
                                      />
                                    </a>
                                  );
                                }
                                return (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                                  >
                                    {item}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ) : val.extractedValue && typeof val.extractedValue === 'object' && !Array.isArray(val.extractedValue) ? (
                          <div className="space-y-1 max-w-md w-full">
                            <span className="text-[10px] font-bold text-slate-500 block text-right">
                              {Object.keys(val.extractedValue).length} Key-Value Specifications
                            </span>
                            <div className="bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 text-[11px] text-left shadow-xs">
                              {Object.entries(val.extractedValue).map(([specKey, specVal]: [string, any]) => (
                                <div key={specKey} className="px-3 py-1.5 flex justify-between gap-3">
                                  <span className="font-semibold text-slate-700">{specKey}:</span>
                                  <span className="text-slate-900 font-mono text-right">{String(specVal)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : val.extractedValue && typeof val.extractedValue === 'string' && val.extractedValue.startsWith('http') && (key.includes('image') || key.includes('iamge') || val.extractedValue.match(/\.(jpg|jpeg|png|webp)/i)) ? (
                          <div className="flex items-center gap-2 justify-end">
                            <img
                              src={val.extractedValue}
                              alt="preview"
                              className="w-10 h-10 object-contain rounded border border-slate-200 bg-white"
                            />
                            <a
                              href={val.extractedValue}
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-[10px] text-indigo-600 underline truncate max-w-[200px]"
                            >
                              {val.extractedValue}
                            </a>
                          </div>
                        ) : (
                          <span
                            className={`inline-block font-mono font-bold px-3 py-1.5 rounded-lg border text-xs break-all ${
                              isSuccess
                                ? 'text-emerald-800 bg-emerald-50/80 border-emerald-200'
                                : 'text-slate-500 bg-slate-100 border-slate-200'
                            }`}
                          >
                            {val.extractedValue || '(Empty)'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: BRAND AI PROMPT RULES */}
      {activeTab === 'ai_prompts' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#0d2a2c]/10 text-[#0d2a2c] uppercase tracking-wider">
                  Brand Intelligence
                </span>
                <span className="text-xs text-slate-400 font-mono">Inherits Workspace Global Rules</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                {brandName} AI Prompt & Persona Rules
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure brand-specific rules for tone of voice, terminology, mandatory feature callouts, and prohibited phrases.
              </p>
            </div>

            <button
              onClick={() => handleSaveChanges()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save AI Rules'}</span>
            </button>
          </div>

          {/* Language Switcher Tabs for Brand Rules */}
          {storeLanguages?.supported && storeLanguages.supported.length > 0 && (
            <div className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-slate-800">
                  Target Store Language: <span className="uppercase font-mono text-emerald-800">[{activeBrandPromptLang}]</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {storeLanguages.supported.map((code) => {
                  const isActive = activeBrandPromptLang === code;
                  const isPrimary = code === storeLanguages.primary;
                  return (
                    <button
                      type="button"
                      key={code}
                      onClick={() => setActiveBrandPromptLang(code)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#0d2a2c] text-[#fad982] shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="uppercase">{code}</span>
                      {isPrimary && (
                        <span className={`text-[10px] font-normal px-1 rounded ${isActive ? 'bg-teal-900 text-amber-200' : 'bg-slate-100 text-slate-500'}`}>
                          Main
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inheritance explanation card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1 text-slate-600">
              <span className="font-bold text-slate-900">Rule Hierarchy in Execution:</span>
              <p>
                When scraping or enriching products for <strong className="text-slate-900">{brandName}</strong> in <strong className="uppercase font-mono text-emerald-800">[{activeBrandPromptLang}]</strong>, the AI engine first applies your <strong className="text-slate-900">Workspace Global AI Rules</strong>, then applies the brand-specific instructions configured below. Brand rules specialize the output for {brandName}&apos;s catalog.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Brand-Specific AI Guidelines &amp; Prompt Rules [{activeBrandPromptLang.toUpperCase()}]
              </label>
              <textarea
                rows={7}
                value={activeBrandPromptLang === 'en' ? aiPromptRules : (languagePromptRules[activeBrandPromptLang] || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (activeBrandPromptLang === 'en') {
                    setAiPromptRules(val);
                  } else {
                    setLanguagePromptRules((prev) => ({
                      ...prev,
                      [activeBrandPromptLang]: val,
                    }));
                  }
                }}
                placeholder={activeBrandPromptLang === 'en' ? `Example for ${brandName}:
- Emphasize waterproof electronics and heavy-duty drivetrain durability.
- Never use generic superlatives like 'best in the world'; use verified technical specs.
- Call out modular chassis design and battery compatibility (2S/3S LiPo).
- Always include the official part number in titles and key specification bullet points.` : `Add custom rules for ${brandName} in ${activeBrandPromptLang.toUpperCase()} (e.g. terminology, tone, or specific phrases)...`}
                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white leading-relaxed"
              />
            </div>

            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-800 space-y-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Active Post-Scraping Enrichment Workflow
              </span>
              <p className="text-[11px] leading-relaxed">
                When adding products for <strong>{brandName}</strong> in the Product Catalog, clicking &quot;Improve with AI&quot; will automatically apply these rules along with your Workspace Global Templates to polish the title, generate SEO descriptions, and extract key selling points.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MODEL PATTERN NORMALIZATION RULES */}
      {activeTab === 'model_rules' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#0d2a2c]/10 text-[#0d2a2c] uppercase tracking-wider">
                  Store SKU Alignment
                </span>
                <span className="text-xs text-slate-400 font-mono">Inventory &amp; Import Matching</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Model Number &amp; SKU Pattern Normalization
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Configure dynamic pattern formatting for {brandName} (e.g., adding store prefix like <code>Trx-</code>) to ensure 100% exact match when importing existing store products.
              </p>
            </div>

            <button
              onClick={() => handleSaveChanges()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Pattern Rules'}</span>
            </button>
          </div>

          <div className="space-y-6">
            {/* Enable switch */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900">Enable Model Pattern Formatting</span>
                <p className="text-[11px] text-slate-500">
                  When enabled, scraped raw model numbers will be standardized with your store&apos;s custom prefix/suffix and case transform.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={modelPatternEnabled}
                  onChange={(e) => setModelPatternEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0d2a2c]"></div>
              </label>
            </div>

            {/* Config inputs */}
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${!modelPatternEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Prefix (e.g. Trx- or TRA-)
                </label>
                <input
                  type="text"
                  value={modelPrefix}
                  onChange={(e) => setModelPrefix(e.target.value)}
                  placeholder="Trx-"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Suffix (Optional)
                </label>
                <input
                  type="text"
                  value={modelSuffix}
                  onChange={(e) => setModelSuffix(e.target.value)}
                  placeholder="-OEM"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Case Transformation
                </label>
                <select
                  value={modelTransform}
                  onChange={(e) => setModelTransform(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
                >
                  <option value="NONE">Preserve Original Case</option>
                  <option value="UPPERCASE">ALL UPPERCASE (e.g. TRX-77097-4)</option>
                  <option value="LOWERCASE">all lowercase (e.g. trx-77097-4)</option>
                  <option value="STRIP_SPECIAL">Strip Hyphens/Spaces (e.g. TRX770974)</option>
                </select>
              </div>
            </div>

            {/* Live Interactive Pattern Tester */}
            <div className="p-5 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">
                  Live Pattern Simulator &amp; Store Match Preview
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Raw Scraped Model Sample:
                  </label>
                  <input
                    type="text"
                    value={modelTestInput}
                    onChange={(e) => setModelTestInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-amber-200 bg-white font-mono text-xs text-slate-900"
                  />
                </div>

                <div className="p-3 rounded-xl bg-white border border-amber-200">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                    Formatted Store Match Key:
                  </span>
                  <span className="font-mono text-sm font-black text-emerald-700">
                    {(() => {
                      if (!modelPatternEnabled) return modelTestInput;
                      let b = modelTestInput.trim();
                      if (modelTransform === 'UPPERCASE') b = b.toUpperCase();
                      else if (modelTransform === 'LOWERCASE') b = b.toLowerCase();
                      else if (modelTransform === 'STRIP_SPECIAL') b = b.replace(/[^a-zA-Z0-9]/g, '');
                      if (!b.startsWith(modelPrefix)) b = `${modelPrefix}${b}`;
                      if (!b.endsWith(modelSuffix)) b = `${b}${modelSuffix}`;
                      return b;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: DYNAMIC AI SEO GENERATION SETTINGS */}
      {activeTab === 'seo' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#0d2a2c]/10 text-[#0d2a2c] uppercase tracking-wider">
                  SEO &amp; Discoverability
                </span>
                <span className="text-xs text-slate-400 font-mono">Dynamic AI Metadata Generator</span>
              </div>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Brand AI SEO &amp; Meta Generation Settings
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Control whether the AI engine generates custom SEO data (Page Titles, Meta Descriptions, Keywords, URL Handles) instead of copying generic scraped tags.
              </p>
            </div>

            <button
              onClick={() => handleSaveChanges()}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#fad982] hover:bg-[#f6cd64] text-slate-950 font-bold text-xs rounded-xl shadow-sm transition"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save SEO Settings'}</span>
            </button>
          </div>

          <div className="space-y-6">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-900">Generate AI SEO Metadata</span>
                <p className="text-[11px] text-slate-500">
                  When enabled, the Product Intelligence AI engine will create verified, high-CTR e-commerce SEO metadata specifically for {brandName}.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={seoEnabled}
                  onChange={(e) => setSeoEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0d2a2c]"></div>
              </label>
            </div>

            {/* Selective Fields Checkbox Grid */}
            <div className={`space-y-4 ${!seoEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Which SEO Fields To Generate:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { id: 'metaTitle', label: 'SEO Meta Title', desc: 'Max 60-70 chars, includes Brand & Model' },
                  { id: 'metaDescription', label: 'Meta Description', desc: '140-160 chars, high-CTR search snippet' },
                  { id: 'targetKeywords', label: 'Target Search Keywords', desc: 'Array of high-intent tags for ranking' },
                  { id: 'urlSlug', label: 'URL Handle / Slug', desc: 'Clean, hyphenated URL for store routing' },
                  { id: 'ogTitle', label: 'OpenGraph Social Title', desc: 'Optimized for social sharing & WhatsApp' },
                  { id: 'ogDescription', label: 'OpenGraph Social Description', desc: 'Social snippet for link previews' },
                ].map((f) => {
                  const isChecked = seoFields.includes(f.id);
                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        if (isChecked) {
                          setSeoFields(seoFields.filter((item) => item !== f.id));
                        } else {
                          setSeoFields([...seoFields, f.id]);
                        }
                      }}
                      className={`p-3.5 rounded-xl border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                        isChecked
                          ? 'bg-emerald-50/40 border-emerald-300 text-slate-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-[#0d2a2c] focus:ring-0"
                      />
                      <div>
                        <div className="font-bold text-slate-900">{f.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{f.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Brand-Specific SEO Guidelines Prompt */}
              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Custom Brand SEO Guidelines &amp; Keyword Strategy (Optional)
                </label>
                <textarea
                  rows={4}
                  value={customSeoPrompt}
                  onChange={(e) => setCustomSeoPrompt(e.target.value)}
                  placeholder={`Example for ${brandName}:
- Always include 'Genuine OEM' and the official model number in the meta description.
- Target keywords should focus on replacement parts and performance upgrades.
- Format title as: [Product Name] - [Model] | Genuine Traxxas.`}
                  className="w-full p-3.5 rounded-xl border border-slate-200 bg-slate-50 font-mono text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#0d2a2c] focus:bg-white leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: OVERVIEW & BASIC SETTINGS */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5 max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900">Brand Profile Basic Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Official Website
              </label>
              <input
                type="url"
                value={officialWebsite}
                onChange={(e) => setOfficialWebsite(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Brand Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Internal Brand Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#0d2a2c] focus:bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB: BRAND-LEVEL STORE EXPORT MAPPING (PHASE 9A) */}
      {activeTab === 'store_export' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-[#0d2a2c]">
                  <ShoppingBag className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">
                      Brand-Level Store Export Mapping (Layer C)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-[#0d2a2c]">
                      Controlled Export
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Map final approved Product Intelligence data specifically for <strong className="text-slate-800">{brandName}</strong> to your store structure.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadExportProfile(selectedExportStoreId)}
                  disabled={storeSchemaLoading || !selectedExportStoreId}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${storeSchemaLoading ? 'animate-spin' : ''}`} />
                  <span>Discover / Refresh Store Fields</span>
                </button>
                <button
                  type="button"
                  onClick={handleValidateAndSaveExportProfile}
                  disabled={exportProfileSaving || !selectedExportStoreId}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#0d2a2c] hover:bg-[#143d40] text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  <Save className="w-3.5 h-3.5 text-[#fad982]" />
                  <span>{exportProfileSaving ? 'Saving...' : 'Save & Validate Profile'}</span>
                </button>
              </div>
            </div>

            {/* Read-Only Safety Banner */}
            <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <strong className="font-bold">Safe Discovery & Staging Guarantee:</strong> Schema discovery inspects your store fields in a strictly read-only mode. Saving this mapping defines how product data is prepared, but will <em>never automatically modify or push products to your live store</em> until you explicitly initiate an export preview.
              </div>
            </div>

            {/* Store Selector */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Connected Store
                </label>
                <select
                  value={selectedExportStoreId}
                  onChange={(e) => setSelectedExportStoreId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                >
                  {connectedStores.length === 0 ? (
                    <option value="">No connected stores found (Add in Stores menu)</option>
                  ) : (
                    connectedStores.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.platformType.toUpperCase()}) - {st.storeUrl}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Export Profile Name
                </label>
                <input
                  type="text"
                  value={exportProfileName}
                  onChange={(e) => setExportProfileName(e.target.value)}
                  placeholder="e.g. Traxxas -> OpenCart US Store"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                />
              </div>
            </div>

            {/* Status alerts */}
            {exportStatusMsg && (
              <div
                className={`mt-4 p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  exportStatusMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {exportStatusMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{exportStatusMsg.text}</span>
              </div>
            )}

            {/* Validation Warnings */}
            {exportValidation && exportValidation.warnings && exportValidation.warnings.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  Configuration Warnings:
                </span>
                <ul className="text-[11px] text-amber-800 list-disc list-inside">
                  {exportValidation.warnings.map((w: string, idx: number) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Discovered Store Schema Overview */}
          {storeSchema && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Discovered Schema for {storeSchema.platform?.toUpperCase()}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Discovered at {new Date(storeSchema.discoveredAt).toLocaleString()} ({storeSchema.readOnly ? 'Verified Read-Only' : ''})
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-mono font-bold text-slate-600">
                  <span className="bg-slate-100 px-2 py-1 rounded-lg">
                    {storeSchema.fields?.length || 0} Standard Fields
                  </span>
                  <span className="bg-slate-100 px-2 py-1 rounded-lg">
                    {storeSchema.attributes?.length || 0} Attributes
                  </span>
                  <span className="bg-slate-100 px-2 py-1 rounded-lg">
                    {storeSchema.categories?.length || 0} Categories
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Export Field Mappings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Brand Export Field Directives</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure field target mappings, export permissions (new vs existing), and granular write policies.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddExportMappingRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-xl text-xs font-bold transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Field Directive</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Portal Field</th>
                    <th className="py-3 px-4">Store Target Field</th>
                    <th className="py-3 px-4">Export Permission</th>
                    <th className="py-3 px-4">Write Policy</th>
                    <th className="py-3 px-4">Transform</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {exportMappings.map((row, index) => {
                    // Extract all field keys that are encapsulated in a field group
                    const groupedFieldKeys = new Set(
                      (fieldGroups || []).flatMap((g: any) => (Array.isArray(g.fields) ? g.fields : []))
                    );

                    // If a standard field is inside a group, filter it out from individual display
                    const availableStandardFields = STANDARD_TARGET_FIELDS.filter((f) => !groupedFieldKeys.has(f.key));
                    const availableCustomFields = (customFields || []).filter((cf: any) => !groupedFieldKeys.has(cf.key));

                    return (
                    <tr key={index} className={`hover:bg-slate-50 transition ${!row.enabled ? 'opacity-50' : ''}`}>
                      {/* Portal Field (Standard, Custom, or Field Group Name) */}
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <select
                          value={row.sourceField}
                          onChange={(e) => handleUpdateExportMappingRow(index, 'sourceField', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none"
                        >
                          {/* Standard Ungrouped Fields */}
                          <optgroup label="Standard Portal Fields">
                            {availableStandardFields.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label} ({f.key})
                              </option>
                            ))}
                          </optgroup>

                          {/* Field Groups (Display Group Name instead of individual grouped fields) */}
                          {fieldGroups && fieldGroups.length > 0 && (
                            <optgroup label="Brand Field Groups">
                              {fieldGroups.map((g: any) => (
                                <option key={g.id || g.name} value={g.name || g.id}>
                                  📁 {g.name} (Field Group)
                                </option>
                              ))}
                            </optgroup>
                          )}

                          {/* Ungrouped Custom Fields */}
                          {availableCustomFields.length > 0 && (
                            <optgroup label="Custom Attributes">
                              {availableCustomFields.map((cf: any) => (
                                <option key={cf.key} value={cf.key}>
                                  [Custom] {cf.name} ({cf.key})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </td>

                      {/* Store Target Field */}
                      <td className="py-3 px-4">
                        <select
                          value={row.storeTargetField}
                          onChange={(e) => handleUpdateExportMappingRow(index, 'storeTargetField', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none"
                        >
                          <option value="">-- Select Store Field --</option>
                          {storeSchema?.fields && storeSchema.fields.length > 0 ? (
                            storeSchema.fields.map((sf: any) => (
                              <option key={sf.name || sf.key} value={sf.name || sf.key}>
                                {sf.table ? `[${sf.table}] ` : ''}{sf.name || sf.key} ({sf.label || sf.name || sf.key})
                              </option>
                            ))
                          ) : (
                            <>
                              <optgroup label="Table: oc_product (Catalog Item)">
                                <option value="model">[oc_product] model (Model Number)</option>
                                <option value="sku">[oc_product] sku (Stock Keeping Unit)</option>
                                <option value="upc">[oc_product] upc (Universal Product Code)</option>
                                <option value="ean">[oc_product] ean (EAN Barcode)</option>
                                <option value="mpn">[oc_product] mpn (Manufacturer Part Number)</option>
                                <option value="price">[oc_product] price (Selling Price)</option>
                                <option value="quantity">[oc_product] quantity (Stock Level)</option>
                                <option value="image">[oc_product] image (Primary Asset)</option>
                                <option value="location">[oc_product] location (Warehouse Code)</option>
                              </optgroup>

                              <optgroup label="Table: oc_product_description (Localized & SEO)">
                                <option value="name">[oc_product_description] name (Product Name)</option>
                                <option value="description">[oc_product_description] description (Full HTML Description)</option>
                                <option value="tag">[oc_product_description] tag (Product Tags)</option>
                                <option value="meta_title">[oc_product_description] meta_title (SEO Meta Title)</option>
                                <option value="meta_description">[oc_product_description] meta_description (SEO Meta Description)</option>
                                <option value="meta_keyword">[oc_product_description] meta_keyword (SEO Keywords)</option>
                              </optgroup>

                              <optgroup label="Table: oc_seo_url (SEF URL Routing)">
                                <option value="keyword">[oc_seo_url] keyword (SEO URL Handle / Slug)</option>
                              </optgroup>

                              <optgroup label="Table: oc_product_image (Gallery Assets)">
                                <option value="images">[oc_product_image] image (Additional Photo Assets)</option>
                              </optgroup>

                              <optgroup label="Table: oc_product_attribute (Specifications)">
                                <option value="custom_fields">[oc_product_attribute] text (Technical Specification Values)</option>
                              </optgroup>
                            </>
                          )}
                        </select>
                      </td>

                      {/* Export Permission */}
                      <td className="py-3 px-4">
                        <select
                          value={row.permission || 'new_and_existing'}
                          onChange={(e) => handleUpdateExportMappingRow(index, 'permission', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none"
                        >
                          <option value="new_and_existing">New & Existing Products</option>
                          <option value="new_only">New Products Only</option>
                          <option value="existing_only">Existing Products Only</option>
                          <option value="disabled">Disabled</option>
                        </select>
                      </td>

                      {/* Write Policy */}
                      <td className="py-3 px-4">
                        <select
                          value={row.writePolicy || 'replace'}
                          onChange={(e) => handleUpdateExportMappingRow(index, 'writePolicy', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none"
                        >
                          <option value="replace">Replace (Overwrite)</option>
                          <option value="create_only">Create Only (Skip if present)</option>
                          <option value="update_existing">Update Existing Only</option>
                          <option value="add_only">Add Only (Append)</option>
                          <option value="disabled">Disabled (Do not touch)</option>
                        </select>
                      </td>

                      {/* Transformation */}
                      <td className="py-3 px-4">
                        <select
                          value={row.transformType || 'direct'}
                          onChange={(e) => handleUpdateExportMappingRow(index, 'transformType', e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-900 focus:outline-none"
                        >
                          <option value="direct">Direct Value</option>
                          <option value="json_to_text">Format JSON to Text</option>
                          <option value="array_to_csv">Join List to Comma Text</option>
                          <option value="html_to_markdown">HTML to Markdown</option>
                        </select>
                      </td>

                      {/* Enabled Checkbox */}
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={row.enabled !== false}
                          onChange={(e) => handleUpdateExportMappingRow(index, 'enabled', e.target.checked)}
                          className="w-4 h-4 rounded text-[#0d2a2c] focus:ring-teal-900"
                        />
                      </td>

                      {/* Delete Action */}
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveExportMappingRow(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

      {/* Add / Edit Manual Field Mapping Modal */}
      {showAddMappingModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-[#0d2a2c]" />
                <h3 className="font-bold text-sm text-slate-900">
                  {editingMappingIndex !== null ? 'Edit Field Mapping' : '+ Add Manual Field Mapping'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAddMappingModal(false);
                  setEditingMappingIndex(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualMapping} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Product Field <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newTargetField}
                  onChange={(e) => setNewTargetField(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none"
                >
                  <optgroup label="Standard Fields">
                    {STANDARD_TARGET_FIELDS.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label} ({f.key})
                      </option>
                    ))}
                  </optgroup>
                  {customFields.length > 0 && (
                    <optgroup label="Custom Client Fields">
                      {customFields.map((cf) => (
                        <option key={cf.key} value={cf.key}>
                          {cf.name} ({cf.key})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Other">
                    <option value="__custom__">Custom Field Key...</option>
                  </optgroup>
                </select>
              </div>

              {newTargetField === '__custom__' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Custom Field Key
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. battery_connector_type"
                    value={customTargetField}
                    onChange={(e) => setCustomTargetField(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Source Type
                </label>
                <select
                  value={newSourceType}
                  onChange={(e) => setNewSourceType(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none"
                >
                  {SOURCE_TYPES.map((st) => (
                    <option key={st.key} value={st.key}>{st.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Source Selector / Path / Formula <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    newSourceType === 'composite'
                      ? 'e.g. .description + #features + #specs  OR  {div.description}\n\n### Features\n{#features}'
                      : 'e.g. h1.product-title, .sku, $.data.ean'
                  }
                  value={newSourceValue}
                  onChange={(e) => setNewSourceValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0d2a2c]"
                />
                {newSourceType === 'composite' && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Combine multiple sections together! Use <code>.description + #features + #specs</code> or template placeholders like <code>&#123;.desc&#125; \n\n &#123;#specs&#125;</code>.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Optional Transformation
                </label>
                <select
                  value={newTransformation}
                  onChange={(e) => setNewTransformation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-900 focus:outline-none"
                >
                  {TRANSFORMATIONS.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMappingModal(false);
                    setEditingMappingIndex(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#fad982] hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition shadow"
                >
                  {editingMappingIndex !== null ? 'Update Field Mapping' : 'Save Field Mapping'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}
