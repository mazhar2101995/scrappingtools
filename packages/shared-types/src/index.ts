export interface ServiceHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
}

export interface ProductScrapeJob {
  id: string;
  targetUrl: string;
  brand: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface ExtractedProduct {
  id: string;
  title: string;
  brand: string;
  price: number | null;
  currency: string;
  sku?: string;
  images: string[];
  attributes: Record<string, any>;
  scrapedAt: string;
}

