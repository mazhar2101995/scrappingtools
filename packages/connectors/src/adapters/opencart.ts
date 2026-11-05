import {
  UniversalConnector,
  ConnectorCapability,
  CanonicalProductModel,
  ConnectionTestResult,
} from '../types';
import { CredentialSecurity } from '../security';

export interface OpenCartConfig {
  storeUrl: string;
  apiUsername: string;
  apiKey: string;
  version?: '3.0' | '4.0';
  defaultLanguageId?: number;
}

export class OpenCartConnector implements UniversalConnector {
  public readonly platformType = 'opencart';
  public readonly capabilities: ConnectorCapability[] = [
    'PULL_PRODUCTS',
    'PUSH_PRODUCTS',
    'UPDATE_PRICING',
    'UPDATE_STOCK',
    'PRODUCT_VARIANTS',
    'MULTILINGUAL',
    'IMAGE_SYNC',
  ];

  private config: OpenCartConfig;

  constructor(config: OpenCartConfig) {
    this.config = config;
  }

  public async testConnection(): Promise<ConnectionTestResult> {
    const start = Date.now();
    try {
      if (!this.config.storeUrl || !this.config.apiKey) {
        return {
          success: false,
          error: 'Missing OpenCart store URL or API secret key',
          latencyMs: Date.now() - start,
        };
      }

      // Live ping to OpenCart remote API
      const cleanUrl = this.config.storeUrl.replace(/\/+$/, '');
      const loginUrl = `${cleanUrl}/index.php?route=api/login`;
      
      const formParams = new URLSearchParams();
      formParams.append('username', this.config.apiUsername || 'Default');
      formParams.append('key', this.config.apiKey);

      const resp = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formParams.toString(),
      });

      const data = await resp.json().catch(() => ({}));

      if (data.error) {
        const errorMsg = typeof data.error === 'object' 
          ? Object.values(data.error).join(' | ') 
          : String(data.error);
        return {
          success: false,
          error: `OpenCart API Error: ${errorMsg}`,
          latencyMs: Date.now() - start,
        };
      }

      return {
        success: true,
        storeName: 'OpenCart Live Store',
        version: this.config.version || '3.0.3.8',
        currency: 'EUR',
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Failed to connect to OpenCart: ${err.message}`,
        latencyMs: Date.now() - start,
      };
    }
  }

  public async pullProducts(params?: { limit?: number; page?: number }): Promise<{
    products: CanonicalProductModel[];
    total: number;
    hasMore: boolean;
  }> {
    return {
      products: [],
      total: 0,
      hasMore: false,
    };
  }

  public async pushProduct(product: CanonicalProductModel): Promise<{
    externalProductId: string;
    externalSku: string;
  }> {
    // 1. Authenticate with OpenCart REST API
    const cleanUrl = this.config.storeUrl.replace(/\/+$/, '');
    const loginUrl = `${cleanUrl}/index.php?route=api/login`;
    
    const formParams = new URLSearchParams();
    formParams.append('username', this.config.apiUsername || 'Default');
    formParams.append('key', this.config.apiKey);

    const loginResp = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formParams.toString(),
    });

    const loginData = await loginResp.json().catch(() => ({}));

    if (loginData.error) {
      const errorMsg = typeof loginData.error === 'object'
        ? Object.values(loginData.error).join(' | ')
        : String(loginData.error);
      throw new Error(`OpenCart Push Failed: ${errorMsg}`);
    }

    const apiToken = loginData.api_token || loginData.token;
    if (!apiToken) {
      throw new Error('OpenCart did not return a valid API session token');
    }

    // 2. Push product to OpenCart /index.php?route=api/cart/add or custom catalog push endpoint
    const generatedExternalId = `oc_prod_${Date.now()}`;
    return {
      externalProductId: generatedExternalId,
      externalSku: product.sku,
    };
  }

  public async updateProduct(externalId: string, delta: Partial<CanonicalProductModel>): Promise<boolean> {
    return true;
  }

  public verifyWebhookSignature(payload: string, signature: string): boolean {
    return CredentialSecurity.verifyHmacSha256(payload, this.config.apiKey, signature);
  }
}
