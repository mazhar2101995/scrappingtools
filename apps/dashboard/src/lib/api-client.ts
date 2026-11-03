const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface MetricSummary {
  totalProducts: number;
  totalBrands: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  systemHealth: 'healthy' | 'degraded' | 'down';
}

export interface GlobalProduct {
  id: string;
  canonicalTitle: string;
  brand: string;
  brandId?: string;
  eanGtin?: string | null;
  manufacturerPartNumber?: string | null;
  modelNumber?: string | null;
  status: string;
  variantsCount: number;
  sourcesCount: number;
  lastScrapedAt: string;
  createdAt: string;
  primaryImage?: string;
}

export interface ProductDetail extends GlobalProduct {
  attributes: Record<string, any>;
  variants: Array<{
    id: string;
    sku: string;
    title: string;
    price: number | null;
    currency: string;
    stockStatus: string;
  }>;
  sources: Array<{
    id: string;
    sourceDomain: string;
    sourceUrl: string;
    firstSeenAt: string;
    lastCrawledAt: string;
    extractionConfidence: number;
  }>;
  provenance: Array<{
    field: string;
    source: string;
    confidence: number;
    extractedAt: string;
  }>;
}

export interface BrandItem {
  id: string;
  name: string;
  slug: string;
  websiteUrl: string;
  logoUrl?: string;
  productCount: number;
  status: 'active' | 'pending' | 'disabled';
  lastScrapedAt: string;
  profileConfig?: {
    engine: string;
    selectors: Record<string, string>;
  };
}

export interface ScrapingJob {
  id: string;
  brand: string;
  targetUrl: string;
  status: 'pending' | 'waiting' | 'active' | 'completed' | 'failed';
  worker: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  processedAt?: string;
  error?: string | null;
}

export interface SystemServiceStatus {
  service: string;
  status: 'online' | 'degraded' | 'offline';
  latencyMs: number;
  uptime: string;
  details?: Record<string, any>;
}

export class DashboardApiClient {
  private baseUrl: string;

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API HTTP ${response.status}: ${errorText}`);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      // In SSR or when API server isn't actively reachable, provide typed fallback data
      // to ensure UI renders with resilience
      console.warn(`[DashboardApiClient] Network call failed to ${url}: ${err.message}`);
      throw err;
    }
  }

  async getHealth(): Promise<{ status: string; uptime: number; redis: string; postgres: string }> {
    return this.fetchJson('/jobs/monitoring/health');
  }

  async getProducts(params?: { search?: string; brand?: string; limit?: number; offset?: number }): Promise<{
    items: GlobalProduct[];
    total: number;
  }> {
    const query = new URLSearchParams();
    if (params?.search) query.set('q', params.search);
    if (params?.brand) query.set('brand', params.brand);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await this.fetchJson<any>(`/products${qs}`);
    return {
      items: res.data || res.products || [],
      total: res.total || (res.data ? res.data.length : 0),
    };
  }

  async getProductById(id: string): Promise<ProductDetail> {
    const res = await this.fetchJson<any>(`/products/${id}`);
    return res.data || res;
  }

  async getBrands(): Promise<BrandItem[]> {
    const res = await this.fetchJson<any>('/brands');
    return res.data || res.brands || [];
  }

  async getJobs(): Promise<ScrapingJob[]> {
    const res = await this.fetchJson<any>('/jobs');
    return res.data || res.jobs || [];
  }

  async triggerScrapeJob(data: { brand: string; targetUrl: string; priority?: number }): Promise<{ jobId: string }> {
    return this.fetchJson('/jobs/scrape', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async retryJob(jobId: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/jobs/${jobId}/retry`, {
      method: 'POST',
    });
  }
}

export const apiClient = new DashboardApiClient();

