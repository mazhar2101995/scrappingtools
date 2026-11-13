import axios from 'axios';
import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

export interface CrawlDiscoveryOptions {
  entryUrl: string;
  brandHint?: string;
  maxPages?: number;
  maxProducts?: number;
}

export interface CrawlDiscoveryResult {
  sourceType: 'SITEMAP' | 'CATEGORY_PAGINATION' | 'DIRECT_PAGE';
  entryUrl: string;
  totalFound: number;
  productUrls: string[];
  pagesScanned: number;
  sampleTitles: string[];
}

export class CatalogCrawlerService {
  private static readonly DEFAULT_TIMEOUT = 15000;
  private static readonly USER_AGENT =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

  /**
   * Main Crawler Dispatcher:
   * Inspects entryUrl:
   * - If ends in .xml or contains sitemap -> Runs Sitemap Parser
   * - Otherwise -> Fetches HTML, detects category pagination & extracts all product links
   */
  public static async crawlAndDiscover(options: CrawlDiscoveryOptions): Promise<CrawlDiscoveryResult> {
    const { entryUrl, maxPages = 5, maxProducts = 250 } = options;
    const cleanUrl = entryUrl.trim();

    // 1. Is this a Sitemap XML?
    if (cleanUrl.toLowerCase().endsWith('.xml') || cleanUrl.toLowerCase().includes('sitemap')) {
      return this.crawlSitemapXml(cleanUrl, maxProducts);
    }

    // 2. Otherwise treat as Category / Collection Listing Page with Pagination
    return this.crawlCategoryListing(cleanUrl, maxPages, maxProducts);
  }

  /**
   * Parse XML Sitemap or Sitemap Index
   */
  private static async crawlSitemapXml(sitemapUrl: string, maxProducts: number): Promise<CrawlDiscoveryResult> {
    try {
      const resp = await axios.get(sitemapUrl, {
        headers: { 'User-Agent': this.USER_AGENT },
        timeout: this.DEFAULT_TIMEOUT,
      });

      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
      });
      const parsed = parser.parse(resp.data);

      const foundUrls = new Set<string>();

      // A: Sitemap Index (<sitemapindex><sitemap><loc>...)
      if (parsed.sitemapindex && parsed.sitemapindex.sitemap) {
        const submaps = Array.isArray(parsed.sitemapindex.sitemap)
          ? parsed.sitemapindex.sitemap
          : [parsed.sitemapindex.sitemap];

        // Filter for product sub-sitemaps if named specifically (e.g. sitemap_products_1.xml)
        const productSubmaps = submaps.filter((s: any) =>
          typeof s.loc === 'string' && (s.loc.includes('product') || s.loc.includes('item') || submaps.length <= 3)
        );

        const chosenSubmaps = productSubmaps.length > 0 ? productSubmaps : submaps.slice(0, 3);

        for (const sub of chosenSubmaps) {
          if (foundUrls.size >= maxProducts) break;
          try {
            const subResp = await axios.get(sub.loc, {
              headers: { 'User-Agent': this.USER_AGENT },
              timeout: this.DEFAULT_TIMEOUT,
            });
            const subParsed = parser.parse(subResp.data);
            this.extractUrlsFromUrlset(subParsed, foundUrls, maxProducts);
          } catch (e) {
            console.warn(`[Crawler] Failed to read sub-sitemap ${sub.loc}:`, e);
          }
        }
      }
      // B: Direct URL Set (<urlset><url><loc>...)
      else if (parsed.urlset) {
        this.extractUrlsFromUrlset(parsed, foundUrls, maxProducts);
      }

      const productUrls = Array.from(foundUrls);

      return {
        sourceType: 'SITEMAP',
        entryUrl: sitemapUrl,
        totalFound: productUrls.length,
        productUrls,
        pagesScanned: 1,
        sampleTitles: [],
      };
    } catch (err: any) {
      throw new Error(`Failed to crawl sitemap XML: ${err.message}`);
    }
  }

  /**
   * Helper to extract filtered product URLs from <urlset>
   */
  private static extractUrlsFromUrlset(parsedData: any, urlSet: Set<string>, limit: number) {
    if (!parsedData.urlset || !parsedData.urlset.url) return;
    const urls = Array.isArray(parsedData.urlset.url) ? parsedData.urlset.url : [parsedData.urlset.url];

    for (const u of urls) {
      if (urlSet.size >= limit) break;
      const loc = typeof u.loc === 'string' ? u.loc.trim() : '';
      if (!loc) continue;

      // Filter out non-product URLs (blogs, policies, accounts, carts)
      const isProduct =
        loc.includes('/product') ||
        loc.includes('/item') ||
        loc.includes('/p/') ||
        loc.includes('/dp/') ||
        !loc.match(/\/(blog|article|page|tag|category|cart|account|checkout|contact|about)/i);

      if (isProduct && (loc.startsWith('http://') || loc.startsWith('https://'))) {
        urlSet.add(loc);
      }
    }
  }

  /**
   * Category / Listing Page Crawler with Automated Pagination
   */
  private static async crawlCategoryListing(
    startUrl: string,
    maxPages: number,
    maxProducts: number
  ): Promise<CrawlDiscoveryResult> {
    const discoveredUrls = new Set<string>();
    const sampleTitles: string[] = [];
    let currentUrl: string | null = startUrl;
    let pageCount = 0;

    const baseDomain = new URL(startUrl).origin;

    while (currentUrl && pageCount < maxPages && discoveredUrls.size < maxProducts) {
      pageCount++;
      try {
        console.log(`[Crawler] Scanning page ${pageCount}: ${currentUrl}`);
        const resp = await axios.get(currentUrl, {
          headers: { 'User-Agent': this.USER_AGENT },
          timeout: this.DEFAULT_TIMEOUT,
        });

        const $ = cheerio.load(resp.data);

        // 1. Find product links inside common e-commerce containers
        const linkSelectors = [
          'a[href*="/product/"]',
          'a[href*="/products/"]',
          'a[href*="/item/"]',
          'a[href*="/p/"]',
          '.product-item a',
          '.product-card a',
          '.product-grid a',
          '.grid-item a',
          '.woocommerce-loop-product__link',
          '.product-thumb h4 a',
          '.product-thumb a',
          'article a',
        ];

        $(linkSelectors.join(', ')).each((_, el) => {
          if (discoveredUrls.size >= maxProducts) return;
          const href = $(el).attr('href');
          const title = $(el).text().trim() || $(el).attr('title') || '';
          if (!href) return;

          try {
            const absolute = new URL(href, currentUrl!).href.split('#')[0].split('?')[0];

            // Basic quality filtering
            if (
              absolute.startsWith(baseDomain) &&
              !absolute.match(/\/(cart|checkout|login|account|wishlist|compare|tag|category|search)/i) &&
              absolute.length > baseDomain.length + 5
            ) {
              discoveredUrls.add(absolute);
              if (title && title.length > 5 && sampleTitles.length < 5) {
                sampleTitles.push(title);
              }
            }
          } catch (_) {}
        });

        // 2. Detect Next Page URL for pagination
        let nextPageUrl: string | null = null;
        const nextSelectors = [
          'a[rel="next"]',
          '.pagination .next a',
          'li.next a',
          '.next-page',
          'a:contains("Next")',
          'a:contains("»")',
          'a:contains(">")',
        ];

        for (const selector of nextSelectors) {
          const nextHref = $(selector).first().attr('href');
          if (nextHref) {
            try {
              nextPageUrl = new URL(nextHref, currentUrl).href;
              break;
            } catch (_) {}
          }
        }

        // If no explicit next link, try query param increment: ?page=2 or &p=2
        if (!nextPageUrl) {
          const parsedTarget: globalThis.URL = new URL(currentUrl);
          const pageParam = parsedTarget.searchParams.get('page') || parsedTarget.searchParams.get('p');
          if (pageParam && !isNaN(parseInt(pageParam))) {
            parsedTarget.searchParams.set('page', String(parseInt(pageParam) + 1));
            nextPageUrl = parsedTarget.href;
          }
        }

        // Stop pagination if next page is identical or reached limits
        if (nextPageUrl === currentUrl) {
          nextPageUrl = null;
        }

        currentUrl = nextPageUrl;
      } catch (err: any) {
        console.error(`[Crawler] Failed scanning ${currentUrl}:`, err.message);
        break;
      }
    }

    const productUrls = Array.from(discoveredUrls);

    return {
      sourceType: pageCount > 1 ? 'CATEGORY_PAGINATION' : 'DIRECT_PAGE',
      entryUrl: startUrl,
      totalFound: productUrls.length,
      productUrls,
      pagesScanned: pageCount,
      sampleTitles,
    };
  }
}
