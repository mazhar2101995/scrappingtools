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
    pendingReviewCount: number;
    activeJobs: number;
    failedJobs: number;
    connectedStoresCount: number;
    failedSyncsCount: number;
    dataQualityScore: number;
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

  logout(): void {
    if (typeof window !== 'undefined') {
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
    let token = typeof window !== 'undefined' ? localStorage.getItem('saas_token') || localStorage.getItem(`saas_token_${targetRole}`) : null;

    if (!token && typeof window !== 'undefined') {
      token = await this.ensureSession(targetRole);
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
      // Refresh matching role session if token rejected
      token = await this.ensureSession(targetRole);
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        const retryRes = await fetch(url, { ...options, headers, cache: 'no-store' });
        if (retryRes.ok) return (await retryRes.json()) as T;
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText}`);
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

  async getOrganizations(): Promise<OrganizationItem[]> {
    const res = await this.fetchJson<any>('/organizations', {}, 'admin');
    return res.data || [];
  }

  async getMyTeam(): Promise<any[]> {
    const res = await this.fetchJson<any>('/organizations/my-team', {}, 'client');
    return res.members || [];
  }

  async getStores(): Promise<StoreItem[]> {
    const res = await this.fetchJson<any>('/stores', {}, 'client');
    return res.stores || [];
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

  async generateApiKey(name: string): Promise<any> {
    return this.fetchJson('/keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async getJobs(): Promise<any> {
    return this.fetchJson('/jobs');
  }

  async getHealth(): Promise<any> {
    return this.fetchJson('/jobs/monitoring/health');
  }
}

export const apiClient = new DashboardApiClient();
