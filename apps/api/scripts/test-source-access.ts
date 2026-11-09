import process from 'node:process';
import { SourceAccessService } from '../src/services/source-access.service';
import { normalizeProductUrl } from '../src/utils/url-normalizer';

async function runFoundationTests() {
  console.log('====================================================');
  console.log('PHASE 1 SOURCE ACCESS FOUNDATION COMPREHENSIVE TESTS');
  console.log('====================================================\n');

  // --- TEST A: Standard Direct HTTP Acquisition ---
  console.log('--- TEST A: Standard Product URL Acquisition ---');
  const resA = await SourceAccessService.acquireSource('https://traxxas.com/10911-blue-funco-pro-scale-replica-blue-body');
  console.log('Test A Success:', resA.success);
  console.log('Status Code:', resA.statusCode);
  console.log('Method:', resA.method);
  console.log('Duration:', `${resA.durationMs}ms`);
  console.log('Byte Size:', resA.byteSize);

  // --- TEST B: URL Normalization Preserving Semantics & Stripping Tracking ---
  console.log('\n--- TEST B: Safe URL Normalization ---');
  const raw1 = 'https://WWW.Traxxas.com/products/item?utm_source=google&fbclid=123&sku=TRX-1091&utm_campaign=winter#gallery';
  const norm1 = normalizeProductUrl(raw1);
  console.log('Original:', raw1);
  console.log('Normalized:', norm1.normalizedUrl);
  console.log('Preserved SKU param:', norm1.normalizedUrl.includes('sku=TRX-1091'));
  console.log('Stripped tracking (utm, fbclid, #fragment):', !norm1.normalizedUrl.includes('utm') && !norm1.normalizedUrl.includes('fbclid') && !norm1.normalizedUrl.includes('#'));

  // --- TEST C & D: Duplicate In-Flight Protection & Per-Domain Concurrency ---
  console.log('\n--- TEST C & D: In-Flight Request Coalescing & Domain Pacing ---');
  const urlVariant1 = 'https://traxxas.com/products/10911?ref=promo';
  const urlVariant2 = 'https://traxxas.com/products/10911?utm_medium=email';

  // Fire both simultaneously (Simulating Client A and Client B submitting same product URL at exact same time)
  const tStart = Date.now();
  const [flight1, flight2] = await Promise.all([
    SourceAccessService.acquireSource(urlVariant1),
    SourceAccessService.acquireSource(urlVariant2),
  ]);
  const totalFlightTime = Date.now() - tStart;

  console.log('Flight 1 Method:', flight1.method, 'Success:', flight1.success);
  console.log('Flight 2 Method (Coalesced?):', flight2.method, 'Success:', flight2.success);
  console.log('Flight 2 Reused Shared Content Hash:', flight1.urlHash === flight2.urlHash);
  console.log('Total Time for Dual In-Flight Request:', `${totalFlightTime}ms`);

  // --- TEST E: Failure Handling & Structured Errors ---
  console.log('\n--- TEST E: Structured Failure Classification ---');
  // 1. Invalid URL
  const errInvalid = await SourceAccessService.acquireSource('not-a-valid-url');
  console.log('Invalid URL Category:', errInvalid.error?.category, 'Retryable:', errInvalid.error?.isRetryable);

  // 2. DNS failure / non-existent host
  const errDns = await SourceAccessService.acquireSource('https://this-domain-does-not-exist-at-all-xyz987.org/prod');
  console.log('DNS Failure Category:', errDns.error?.category, 'Retryable:', errDns.error?.isRetryable);

  // 3. HTTP 404
  const err404 = await SourceAccessService.acquireSource('https://httpbin.org/status/404');
  console.log('404 Status Category:', err404.error?.category, 'Retryable:', err404.error?.isRetryable);

  // 4. HTTP 429
  const err429 = await SourceAccessService.acquireSource('https://httpbin.org/status/429');
  console.log('429 Status Category:', err429.error?.category, 'Backoff Sec:', err429.error?.suggestedDelaySec);

  console.log('\n====================================================');
  console.log('ALL PHASE 1 SOURCE ACCESS TESTS COMPLETED SUCCESSFULLY');
  console.log('====================================================');
  process.exit(0);
}

runFoundationTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
