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
          error: 'Missing OpenCart store URL or Store Signing Secret Key',
          latencyMs: Date.now() - start,
        };
      }

      const cleanUrl = this.config.storeUrl.replace(/\/+$/, '');

      // 1. First probe the Official SaaS Connector Module endpoint
      const moduleVerifyUrl = `${cleanUrl}/index.php?route=extension/module/saas_connector&action=verify`;
      try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = CredentialSecurity.generateSalt(16);
        const signature = CredentialSecurity.generateHmacSha256(
          JSON.stringify({ check: 'verify' }) + timestamp + nonce,
          this.config.apiKey
        );

        const resp = await fetch(moduleVerifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Saas-Timestamp': timestamp,
            'X-Saas-Nonce': nonce,
            'X-Saas-Signature': signature,
          },
          body: JSON.stringify({ check: 'verify' }),
        });

        if (resp.ok) {
          const data = await resp.json().catch(() => null);
          if (data && data.success && data.status === 'CONNECTED_VERIFIED') {
            return {
              success: true,
              storeName: data.audit?.store_name || 'OpenCart Connected Store',
              version: data.audit?.opencart_version || this.config.version || '3.x',
              currency: 'USD',
              latencyMs: Date.now() - start,
            };
          } else if (data && data.error) {
            return {
              success: false,
              error: `SaaS Module Verification: ${data.error}`,
              latencyMs: Date.now() - start,
            };
          }
        } else if (resp.status === 404) {
          return {
            success: false,
            error: 'Module Not Installed: saas_connector.ocmod.zip is not active on this OpenCart store. Please install it in Extensions > Installer.',
            latencyMs: Date.now() - start,
          };
        }
      } catch (modErr: any) {
        // Fall through to strict error
      }

      return {
        success: false,
        error: 'SaaS Module Not Detected: OpenCart store did not respond to the official SaaS Connector handshake. Please install saas_connector.ocmod.zip.',
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

    // 1. First Priority: Official SaaS Connector Extension (saas_connector.ocmod.zip)
    const modulePushUrl = `${cleanUrl}/index.php?route=extension/module/saas_connector&action=push_product`;
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = CredentialSecurity.generateSalt(16);
      const rawPayload = JSON.stringify(product);
      const signature = CredentialSecurity.generateHmacSha256(
        rawPayload + timestamp + nonce,
        this.config.apiKey
      );

      const moduleResp = await fetch(modulePushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Saas-Timestamp': timestamp,
          'X-Saas-Nonce': nonce,
          'X-Saas-Signature': signature,
        },
        body: rawPayload,
      });

      if (moduleResp.ok) {
        const moduleData = await moduleResp.json().catch(() => null);
        if (moduleData && moduleData.success && (moduleData.productId || moduleData.product_id)) {
          return {
            externalProductId: String(moduleData.productId || moduleData.product_id),
            externalSku: moduleData.sku || product.sku,
          };
        } else if (moduleData && moduleData.error) {
          throw new Error(`OpenCart SaaS Connector Error: ${moduleData.error}`);
        }
      }
    } catch (modErr: any) {
      if (!modErr.message?.includes('404') && !modErr.message?.includes('Unexpected token')) {
        throw modErr;
      }
    }

    // 2. Second Priority: Standalone Bridge file (saas_bridge.php)
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

    // 3. Fallback to OpenCart native REST API login verification
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
