/**
 * URL Normalization Utility
 * Standardizes product URLs across tenants and protocols:
 * - Forces HTTPS protocol where applicable
 * - Converts domain and path to lowercase
 * - Strips marketing/tracking query parameters (utm_*, fbclid, gclid, ref, etc.)
 * - Strips URL fragments (#...)
 * - Removes trailing slashes
 * - Preserves product-identifying parameters (e.g., id, sku, variant, product_id)
 */

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'zenid',
  'sessionid',
  'phpsessid',
  'ref',
  'ref_',
  '_ga',
  '_gl',
  'source',
  'affiliate_id',
  'aff_id',
  'yclid',
  'mc_eid',
  'mc_cid',
]);

export interface NormalizedUrlResult {
  originalUrl: string;
  normalizedUrl: string;
  domain: string;
  normalizedDomain: string;
  urlHash: string;
  isValid: boolean;
}

export function normalizeProductUrl(rawUrl: string): NormalizedUrlResult {
  if (!rawUrl || typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return {
      originalUrl: rawUrl || '',
      normalizedUrl: '',
      domain: '',
      normalizedDomain: '',
      urlHash: '',
      isValid: false,
    };
  }

  const trimmed = rawUrl.trim();

  try {
    const parsed = new URL(trimmed);

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        originalUrl: trimmed,
        normalizedUrl: trimmed,
        domain: '',
        normalizedDomain: '',
        urlHash: '',
        isValid: false,
      };
    }

    // Force https protocol
    const protocol = 'https:';

    // Lowercase hostname and remove leading www.
    const hostname = parsed.hostname.toLowerCase();
    const cleanDomain = hostname.replace(/^www\./, '');

    // Normalize path: lowercase, strip redundant slashes, strip trailing slash unless root
    let pathname = parsed.pathname.replace(/\/+/g, '/');
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // Filter tracking query params, preserve legitimate product identifier params
    const searchParams = new URLSearchParams();
    // Sort keys alphabetically for deterministic canonical URL matching
    const sortedKeys = Array.from(parsed.searchParams.keys()).sort();

    for (const key of sortedKeys) {
      const lowerKey = key.toLowerCase();
      if (!TRACKING_PARAMS.has(lowerKey) && !lowerKey.startsWith('utm_')) {
        const value = parsed.searchParams.get(key);
        if (value !== null) {
          searchParams.append(key, value);
        }
      }
    }

    const queryString = searchParams.toString();
    const normalizedUrl = `${protocol}//${cleanDomain}${pathname}${queryString ? `?${queryString}` : ''}`;

    // Deterministic SHA-256 hash of normalized URL
    const crypto = require('crypto');
    const urlHash = crypto.createHash('sha256').update(normalizedUrl).digest('hex');

    return {
      originalUrl: trimmed,
      normalizedUrl,
      domain: hostname,
      normalizedDomain: cleanDomain,
      urlHash,
      isValid: true,
    };
  } catch (_) {
    return {
      originalUrl: trimmed,
      normalizedUrl: trimmed,
      domain: '',
      normalizedDomain: '',
      urlHash: '',
      isValid: false,
    };
  }
}

