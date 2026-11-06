const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface ClientWorkspaceData {
  organization: {
    id: string;
    name: string;
    planTier: string;
  };
  metrics: {
    totalProducts: number;
    recentlyUpdated: number;
    aiProcessed?: number;
    pendingReviewCount: number;
    activeJobs: number;
    failedJobs: number;
    connectedStoresCount: number;
    failedSyncsCount: number;
    dataQualityScore: number;
    qualityDistribution?: {
      verified: number;
      highConfidence: number;
      needsReview: number;
      incomplete: number;
      conflict: number;
      stale: number;
    };
    intelligenceValue?: {
      reusedFromIntelligence: number;
      discoveredFromTrusted: number;
      enrichedWithAi: number;
      duplicateMergesPrevented: number;
    };
  };
  needsAttention: Array<{
    id: string;
    type: 'failed_sync' | 'store_conflict' | 'failed_job' | 'stale_provenance';
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    timestamp: string;
    actionUrl: string;
    actionLabel: string;
  }>;
  activeJobs: any[];
  recentProducts: Array<{
    mappingId: string;
    globalProductId: string;
    customerInternalSku: string | null;
    importedAt: string;
    canonicalTitle: string;
    modelNumber: string | null;
    categoryPath: string | null;
    verificationStatus: string;
  }>;
  stores: Array<{
    id: string;
    storeName: string;
    platformType: string;
    storeUrl: string;
    status: string;
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
}

export interface PlatformAdminData {
  systemStatus: {
    coreApi: string;
    database: string;
    redis: string;
    workers: string;
  };
  globalMetrics: {
    totalOrganizations: number;
    totalUsers: number;
    totalConnectedStores: number;
    totalProducts: number;
    verifiedProducts: number;
    totalJobs: number;
    activeJobs: number;
    failedJobs: number;
    aiTokensUsed: number;
    aiExecutions: number;
    aiEstimatedCostUsd: number;
    pendingReviewCount: number;
    totalTenantMappings?: number;
    duplicateScrapesPrevented?: number;
    dataReuseRatePercent?: number;
  };
  criticalIncidents: Array<{
    id: string;
    service: string;
    severity: 'critical' | 'high' | 'medium';
    description: string;
    detectedAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    targetUrl: string;
    jobType: string;
    status: string;
    itemsExtracted: number;
    createdAt: string;
  }>;
}

export interface OverviewMetrics {
  isPlatformAdmin: boolean;
  totalProducts: number;
  totalBrands: number;
  totalSources: number;
  connectedStores: number;
  totalJobs: number;
  activeJobs: number;
  totalOrganizations: number;
  totalUsers: number;
  systemHealth: string;
}

export interface AiMetrics {
  totalTokensUsed: number;
  totalExecutions: number;
  estimatedCostUsd: number;
  avgLatencyMs: number;
  cachedTranslationsCount: number;
  totalCharactersTranslated: number;
}

export interface AiPromptTemplate {
  id: string;
  name?: string;
  slug: string;
  version: number;
  taskType: string;
  systemPrompt: string;
  userPromptTemplate: string;
  modelPreference: string;
  temperature: string;
  isActive: boolean;
}

export interface ReviewQueueItem {
  id: string;
  sourceProductListingId: string;
  suggestedGlobalProductId: string;
  matchConfidence?: string | number;
  confidenceScore?: number;
  matchReasons?: string[];
  reason?: string;
  resolutionStatus?: string;
  status?: string;
  candidateProductId?: string;
  listingTitle?: string;
  listingUrl?: string;
  suggestedTitle?: string;
  createdAt: string;
}

export interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  planTier: string;
  isActive: boolean;
  createdAt: string;
}

export interface StoreItem {
  id: string;
  platformType: string;
  storeName: string;
  storeUrl: string;
  status: string;
  capabilities: string[];
  lastSyncAt: string | null;
  createdAt: string;
}

export class DashboardApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  // Ensure authenticated session token in local browser storage
  async ensureSession(role: 'client' | 'admin' = 'client'): Promise<string> {
    if (typeof window === 'undefined') return '';

    try {
      const res = await fetch(`${this.baseUrl}/auth/session?role=${role}`);
      if (!res.ok) throw new Error('Session initialization failed');
      const data = await res.json();
      if (data.accessToken) {
        localStorage.setItem(`saas_token_${role}`, data.accessToken);
        localStorage.setItem('saas_current_role', role);
        localStorage.setItem('saas_token', data.accessToken);
        if (data.organization?.id) {
          localStorage.setItem('saas_org_id', data.organization.id);
        }
        return data.accessToken;
      }
    } catch (e) {
      console.error('Failed to bootstrap session:', e);
    }
    return '';
  }

  async login(email: string, password: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Login failed');
    }
    const data = await res.json();
    if (typeof window !== 'undefined') {
      localStorage.setItem('saas_token', data.accessToken);
      localStorage.setItem('saas_token_client', data.accessToken);
      localStorage.setItem('saas_current_user', JSON.stringify(data.user));
      if (data.organization?.id) {
        localStorage.setItem('saas_org_id', data.organization.id);
        localStorage.setItem('saas_current_org_name', data.organization.name);
      }
    }
    return data;
  }

  async register(payload: { email: string; password: string; fullName: string; organizationName: string }): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }
    const data = await res.json();
    if (typeof window !== 'undefined') {
      localStorage.setItem('saas_token', data.accessToken);
      localStorage.setItem('saas_token_client', data.accessToken);
      localStorage.setItem('saas_current_user', JSON.stringify(data.user));
      if (data.organization?.id) {
        localStorage.setItem('saas_org_id', data.organization.id);
        localStorage.setItem('saas_current_org_name', data.organization.name);
      }
    }
    return data;
  }

  async forgotPassword(email: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to request password reset');
    }
    return await res.json();
  }

  async resetPassword(token: string, email: string, newPassword: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, email, newPassword }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Password reset failed');
    }
    return await res.json();
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      try {
        fetch(`${this.baseUrl}/auth/logout`, { method: 'POST' }).catch(() => {});
      } catch (_) {}
      localStorage.removeItem('saas_token');
      localStorage.removeItem('saas_token_client');
      localStorage.removeItem('saas_token_admin');
      localStorage.removeItem('saas_current_user');
      localStorage.removeItem('saas_org_id');
      localStorage.removeItem('saas_current_org_name');
      window.location.href = '/login';
    }
  }

  private async fetchJson<T>(path: string, options: RequestInit = {}, rolePreference?: 'client' | 'admin'): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    // Auto-detect role from path if not explicitly provided
    const targetRole = rolePreference || (path.includes('/admin') || path.includes('/organizations') ? 'admin' : 'client');
    const token = typeof window !== 'undefined' ? localStorage.getItem('saas_token') || localStorage.getItem(`saas_token_${targetRole}`) : null;

    if (!token && typeof window !== 'undefined') {
      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register' || window.location.pathname === '/forgot-password' || window.location.pathname === '/reset-password';
      if (!isAuthPage) {
        window.location.href = '/login';
        throw new Error('Authentication required. Redirecting to login...');
      }
    }

    const orgId = typeof window !== 'undefined' ? localStorage.getItem('saas_org_id') : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (orgId) headers['x-organization-id'] = orgId;

    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
    });

    if ((response.status === 401 || response.status === 403) && typeof window !== 'undefined') {
      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register' || window.location.pathname === '/forgot-password' || window.location.pathname === '/reset-password';
      if (!isAuthPage) {
        localStorage.removeItem('saas_token');
        localStorage.removeItem('saas_token_client');
        localStorage.removeItem('saas_token_admin');
        window.location.href = '/login';
        throw new Error('Session expired or unauthorized. Redirecting to login...');
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      let parsedMsg = errText;
      try {
        const j = JSON.parse(errText);
        parsedMsg = j.details || j.error || j.message || errText;
      } catch (_) { }
      throw new Error(parsedMsg);
    }

    return (await response.json()) as T;
  }

  // --- Dedicated Dashboards ---
  async getClientWorkspace(): Promise<ClientWorkspaceData> {
    const res = await this.fetchJson<any>('/metrics/client-overview', {}, 'client');
    return res.data;
  }

  async getPlatformAdminOverview(): Promise<PlatformAdminData> {
    const res = await this.fetchJson<any>('/metrics/admin-overview', {}, 'admin');
    return res.data;
  }

  // --- Legacy Overview & Subsystems ---
  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const res = await this.fetchJson<any>('/metrics/overview');
    return res.data;
  }

  async getAiMetrics(): Promise<AiMetrics> {
    const res = await this.fetchJson<any>('/ai/metrics', {}, 'admin');
    return res.data;
  }

  async getAiPrompts(): Promise<AiPromptTemplate[]> {
    const res = await this.fetchJson<any>('/ai/prompts', {}, 'admin');
    return res.data || [];
  }

  async getIntelligenceMetrics(): Promise<any> {
    const res = await this.fetchJson<any>('/review/metrics');
    return res.data || null;
  }

  async getReviewQueue(status = 'pending'): Promise<any[]> {
    const res = await this.fetchJson<any>(`/review/queue?status=${status}`);
    return res.data || [];
  }

  async resolveReviewItem(id: string, action: string, note?: string): Promise<any> {
    return this.fetchJson(`/review/queue/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action, note }),
    });
  }

  async getOrganizations(): Promise<any[]> {
    const res = await this.fetchJson<any>('/organizations', {}, 'admin');
    return res.data || [];
  }

  async inspectOrganization(id: string): Promise<any> {
    const res = await this.fetchJson<any>(`/organizations/${id}/inspect`, {}, 'admin');
    return res;
  }

  async impersonateOrganization(id: string): Promise<any> {
    const res = await this.fetchJson<any>(`/organizations/${id}/impersonate`, {
      method: 'POST',
    }, 'admin');
    if (res.token && typeof window !== 'undefined') {
      localStorage.setItem('saas_token', res.token);
      localStorage.setItem('saas_token_client', res.token);
      localStorage.setItem('saas_org_id', res.organization.id);
      localStorage.setItem('saas_current_org_name', res.organization.name);
      localStorage.setItem('saas_current_user', JSON.stringify(res.user));
    }
    return res;
  }

  async toggleOrganizationStatus(id: string): Promise<any> {
    return this.fetchJson(`/organizations/${id}/toggle-status`, {
      method: 'PATCH',
    }, 'admin');
  }

  async getGlobalBrands(): Promise<any[]> {
    const res = await this.fetchJson<any>('/brands?scope=global', {}, 'admin');
    return res.brands || [];
  }

  // --- Billing & Subscription Methods ---
  async getMySubscription(): Promise<any> {
    return this.fetchJson('/billing/my-subscription', {}, 'client');
  }

  async changePlan(planId: string, billingCycle: 'monthly' | 'annual'): Promise<any> {
    return this.fetchJson('/billing/change-plan', {
      method: 'POST',
      body: JSON.stringify({ planId, billingCycle }),
    }, 'client');
  }

  async getAdminRevenue(): Promise<any> {
    return this.fetchJson('/billing/admin-revenue', {}, 'admin');
  }

  async getMyTeam(): Promise<any[]> {
    const res = await this.fetchJson<any>('/organizations/my-team', {}, 'client');
    return res.members || [];
  }

  async getStores(): Promise<StoreItem[]> {
    const res = await this.fetchJson<any>('/stores', {}, 'client');
    return res.stores || [];
  }

  async connectStore(payload: {
    platformType: string;
    storeName: string;
    storeUrl: string;
    credentials: Record<string, any>;
    capabilities?: string[];
  }): Promise<any> {
    return this.fetchJson('/stores', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  async triggerStoreSync(storeId: string): Promise<any> {
    return this.fetchJson(`/stores/${storeId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ direction: 'PULL' }),
    }, 'client');
  }

  async getProducts(params?: { q?: string; limit?: number; offset?: number }): Promise<any> {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    return this.fetchJson(`/products?${qs.toString()}`);
  }

  async getProductById(id: string): Promise<any> {
    return this.fetchJson(`/products/${id}`);
  }

  // --- Phase 1: Smart Product Intelligence Lookup & Canonical Reuse ---
  async lookupProductIntelligence(payload: {
    productUrl?: string;
    brandId?: string;
    sku?: string;
    modelNumber?: string;
    ean?: string;
    title?: string;
  }): Promise<{
    decision: 'REUSE_EXISTING' | 'EXTRACT_NEW' | 'REVIEW_REQUIRED';
    confidence: 'EXACT' | 'HIGH_CONFIDENCE' | 'POSSIBLE_MATCH' | 'NO_MATCH';
    confidenceScore: number;
    matchReason: string;
    isAlreadyMappedInTenant: boolean;
    tenantMappingId: string | null;
    reusableProduct: any | null;
    canonicalProductId: string | null;
    freshnessStatus: 'fresh' | 'stale' | 'unknown';
    recommendedAction: 'REUSE' | 'SCRAPE' | 'CONFIRM_MERGE';
  }> {
    const res = await this.fetchJson<any>('/products/lookup-intelligence', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  async reuseCanonicalProduct(payload: {
    globalProductId: string;
    customSku?: string;
    customPrice?: string;
    customTitle?: string;
    customDescription?: string;
    productUrl?: string;
  }): Promise<any> {
    return this.fetchJson('/products/reuse-canonical', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async createProduct(payload: {
    brandId: string;
    productUrl: string;
    sourceId?: string;
    title: string;
    modelNumber?: string;
    sku?: string;
    price?: string;
    description?: string;
    primaryImageUrl?: string;
    images?: string[];
    attributes?: Record<string, any>;
    customData?: Record<string, any>;
  }): Promise<any> {
    return this.fetchJson('/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  async getBrands(): Promise<any[]> {
    const res = await this.fetchJson<any>('/brands', {}, 'client');
    return res.brands || [];
  }

  async getBrandById(id: string): Promise<any> {
    const res = await this.fetchJson<any>(`/brands/${id}`, {}, 'client');
    return res.brand;
  }

  async createBrand(payload: {
    name: string;
    officialWebsite?: string;
    logoUrl?: string;
    notes?: string;
    sourceConfigs?: any[];
    fieldMappings?: any[];
    fieldGroups?: any[];
    customFields?: any[];
  }): Promise<any> {
    return this.fetchJson('/brands', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  async updateBrand(id: string, payload: {
    name?: string;
    officialWebsite?: string;
    logoUrl?: string;
    status?: string;
    notes?: string;
    sourceConfigs?: any[];
    fieldMappings?: any[];
    fieldGroups?: any[];
    customFields?: any[];
    aiPromptRules?: string;
  }): Promise<any> {
    return this.fetchJson(`/brands/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, 'client');
  }

  async deleteBrand(id: string): Promise<any> {
    return this.fetchJson(`/brands/${id}`, {
      method: 'DELETE',
    }, 'client');
  }

  async testBrandMapping(id: string, payload: { sampleUrl?: string; sampleHtml?: string; mappings?: any[] }): Promise<any> {
    return this.fetchJson(`/brands/${id}/test-mapping`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  async previewBrandPage(id: string, url: string): Promise<any> {
    return this.fetchJson(`/brands/${id}/preview-page`, {
      method: 'POST',
      body: JSON.stringify({ url }),
    }, 'client');
  }

  async getApiKeys(): Promise<any> {
    const res = await this.fetchJson<any>('/keys');
    return res.keys || [];
  }

  async generateApiKey(name: string, scopes?: string[]): Promise<any> {
    return this.fetchJson('/keys', {
      method: 'POST',
      body: JSON.stringify({ name, scopes }),
    });
  }

  async revokeApiKey(keyId: string): Promise<any> {
    return this.fetchJson(`/keys/${keyId}`, {
      method: 'DELETE',
    });
  }

  async getWebhookSubscriptions(): Promise<any> {
    return this.fetchJson('/integrations/webhooks/subscriptions');
  }

  async createWebhookSubscription(targetUrl: string, events: string[]): Promise<any> {
    return this.fetchJson('/integrations/webhooks/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ targetUrl, events }),
    });
  }

  async getJobs(): Promise<any> {
    return this.fetchJson('/jobs');
  }

  async getHealth(): Promise<any> {
    return this.fetchJson('/jobs/monitoring/health');
  }

  // --- Organization AI Settings ---
  async getAiSettings(): Promise<any> {
    return this.fetchJson('/organizations/ai-settings', {}, 'client');
  }

  async saveAiSettings(payload: {
    model?: string;
    provider?: string;
    temperature?: number;
    apiKey?: string;
    globalRules?: string;
    titlePrompt?: string;
    descriptionPrompt?: string;
  }): Promise<any> {
    return this.fetchJson('/organizations/ai-settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, 'client');
  }

  // --- AI Product Enrichment ---
  async enrichProductWithAi(payload: {
    brandId?: string;
    brandName?: string;
    rawTitle: string;
    rawDescription?: string;
    modelNumber?: string;
    sku?: string;
    price?: number | string;
    features?: string[];
    attributes?: Record<string, any>;
    customFields?: Record<string, any>;
  }): Promise<any> {
    return this.fetchJson('/ai/enrich-product', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  // --- Catalog Export & Batch Scrape ---
  async exportCatalogCsv(format: 'shopify' | 'universal' = 'shopify'): Promise<Blob> {
    let token = '';
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('saas_token_client') || localStorage.getItem('saas_token') || '';
    }
    const res = await fetch(`${this.baseUrl}/products/export/csv?format=${format}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) {
      throw new Error(`Export failed with HTTP ${res.status}`);
    }
    return res.blob();
  }

  async batchScrape(payload: { brandId: string; urls: string[] }): Promise<any> {
    return this.fetchJson('/products/batch-scrape', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  // --- Push Product to Connected Store ---
  async pushProductToStore(payload: { storeId: string; productId: string }): Promise<any> {
    return this.fetchJson('/stores/push-product', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  // --- Price & Stock Monitoring ---
  async getProductQuality(productId: string): Promise<any> {
    return this.fetchJson(`/review/quality/${productId}`, {}, 'client');
  }

  async applyProductCorrection(productId: string, payload: {
    canonicalTitle?: string;
    modelNumber?: string;
    standardizedDescription?: string;
    reason: string;
  }): Promise<any> {
    return this.fetchJson(`/review/quality/${productId}/correct`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  async discoverProduct(payload: {
    type?: 'URL' | 'IDENTIFIER';
    value: string;
    brandHint?: string;
  }): Promise<any> {
    return this.fetchJson('/products/discover', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }

  async getProductMonitoring(productId: string): Promise<any> {
    return this.fetchJson(`/products/${productId}/monitoring`, {}, 'client');
  }

  async updateProductMonitoring(productId: string, payload: {
    enabled?: boolean;
    frequency?: string;
    targetUrl?: string;
    baselinePrice?: string | number;
    currentPrice?: string | number;
    inStock?: boolean;
  }): Promise<any> {
    return this.fetchJson(`/products/${productId}/monitoring`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 'client');
  }
}

export const apiClient = new DashboardApiClient();
