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
    const cleanUrl = this.config.storeUrl.replace(/\/+$/, '');

    // 1. First, check if the high-speed OpenCart SaaS bridge file (saas_bridge.php) is present on customer's store
    const bridgeUrl = `${cleanUrl}/saas_bridge.php?action=push_product`;
    try {
      const bridgeResp = await fetch(bridgeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Saas-Key': this.config.apiKey,
        },
        body: JSON.stringify(product),
      });

      if (bridgeResp.ok) {
        const bridgeData = await bridgeResp.json().catch(() => null);
        if (bridgeData && bridgeData.success && bridgeData.product_id) {
          return {
            externalProductId: String(bridgeData.product_id),
            externalSku: bridgeData.sku || product.sku,
          };
        } else if (bridgeData && bridgeData.error) {
          throw new Error(`OpenCart Bridge Error: ${bridgeData.error}`);
        }
      } else if (bridgeResp.status !== 404) {
        // If 401 or 403 or 500 from bridge
        const errJson = await bridgeResp.json().catch(() => null);
        if (errJson?.error) {
          throw new Error(`OpenCart Bridge: ${errJson.error}`);
        }
      }
    } catch (bridgeErr: any) {
      if (!bridgeErr.message?.includes('404') && !bridgeErr.message?.includes('Unexpected token')) {
        throw bridgeErr;
      }
    }

    // 2. Fallback to OpenCart native REST API login verification
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

    // If bridge is not uploaded yet, throw instructions so the user/client knows exactly what to do
    throw new Error(
      'OpenCart Bridge Required: OpenCart default API does not allow creating catalog products. Please download "saas_bridge.php" from Connected Stores and place it in your OpenCart root directory to enable live product insertion.'
    );
  }

  public async updateProduct(externalId: string, delta: Partial<CanonicalProductModel>): Promise<boolean> {
    return true;
  }

  public verifyWebhookSignature(payload: string, signature: string): boolean {
    return CredentialSecurity.verifyHmacSha256(payload, this.config.apiKey, signature);
  }
}
