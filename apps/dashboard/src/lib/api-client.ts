const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

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
  matchConfidence: string;
  matchReasons: string[];
  resolutionStatus: string;
  createdAt: string;
  listingTitle: string;
  listingUrl: string;
  suggestedTitle: string;
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

  private async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('saas_token') : null;
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

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API ${response.status}: ${errText}`);
    }

    return (await response.json()) as T;
  }

  async getOverviewMetrics(): Promise<OverviewMetrics> {
    const res = await this.fetchJson<any>('/metrics/overview');
    return res.data;
  }

  async getAiMetrics(): Promise<AiMetrics> {
    const res = await this.fetchJson<any>('/ai/metrics');
    return res.data;
  }

  async getAiPrompts(): Promise<AiPromptTemplate[]> {
    const res = await this.fetchJson<any>('/ai/prompts');
    return res.data;
  }

  async getReviewQueue(): Promise<ReviewQueueItem[]> {
    const res = await this.fetchJson<any>('/review/queue');
    return res.data;
  }

  async resolveReviewItem(id: string, action: string): Promise<any> {
    return this.fetchJson(`/review/queue/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async getOrganizations(): Promise<OrganizationItem[]> {
    const res = await this.fetchJson<any>('/organizations');
    return res.data;
  }

  async getStores(): Promise<StoreItem[]> {
    const res = await this.fetchJson<any>('/stores');
    return res.stores;
  }

  async triggerStoreSync(storeId: string): Promise<any> {
    return this.fetchJson(`/stores/${storeId}/sync`, {
      method: 'POST',
      body: JSON.stringify({ direction: 'PULL' }),
    });
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

  async getBrands(): Promise<any> {
    return this.fetchJson('/brands');
  }

  async getJobs(): Promise<any> {
    return this.fetchJson('/jobs');
  }

  async getHealth(): Promise<any> {
    return this.fetchJson('/jobs/monitoring/health');
  }
}

export const apiClient = new DashboardApiClient();
