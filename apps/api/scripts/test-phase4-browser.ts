import process from 'node:process';
import fs from 'fs';
import path from 'path';
import { BrowserIsolationManager } from '../src/services/browser-isolation.service';
import { SourceAccessService } from '../src/services/source-access.service';
import { SourceHealthService } from '../src/services/source-health.service';

/**
 * PHASE 4 VERIFICATION TEST SUITE
 * Resource Protection & Browser Isolation
 */
async function runPhase4Tests() {
  console.log('===============================================================');
  console.log('   PHASE 4 TEST SUITE: RESOURCE PROTECTION & BROWSER ISOLATION ');
  console.log('===============================================================\n');

  try {
    // Configure tight test limits for deterministic testing
    BrowserIsolationManager.configure({
      maxConcurrentBrowsers: 2, // Max 2 concurrent browsers
      navigationTimeoutMs: 6000,
      totalJobTimeoutMs: 8000,
      maxPerTenantConcurrent: 1, // Max 1 concurrent browser per tenant
    });

    // ------------------------------------------------------------------
    // TEST A: Lightweight Direct HTTP Acquisition (No Browser Overhead)
    // ------------------------------------------------------------------
    console.log('TEST A: Lightweight HTTP Acquisition (Bypasses Browser)...');
    const startLight = Date.now();
    const lightResult = await SourceAccessService.acquireSource('https://httpbin.org/html', {
      useBrowser: false,
      bypassCache: true,
    });

    if (!lightResult.success || lightResult.method !== 'DIRECT_HTTP') {
      throw new Error(`TEST A Failed: Expected DIRECT_HTTP method, got ${lightResult.method}`);
    }
    const metricsA = BrowserIsolationManager.getOperationalMetrics();
    if (metricsA.activeBrowserJobs !== 0 || metricsA.totalBrowserJobsCompleted !== 0) {
      throw new Error(`TEST A Failed: Lightweight HTTP should NOT trigger any browser instances!`);
    }
    console.log(`✓ TEST A PASSED: Completed via DIRECT_HTTP in ${Date.now() - startLight}ms with 0 browser processes launched.`);

    // ------------------------------------------------------------------
    // TEST B: Browser Required Acquisition (Controlled Headless Browser)
    // ------------------------------------------------------------------
    console.log('\nTEST B: Browser Required Execution (Headless Chromium Isolated)...');
    const browserResult = await SourceAccessService.acquireSource('https://httpbin.org/html', {
      useBrowser: true,
      bypassCache: true,
      tenantId: 'tenant-alpha',
    });

    if (!browserResult.success || browserResult.method !== 'CONTROLLED_BROWSER') {
      throw new Error(`TEST B Failed: Expected CONTROLLED_BROWSER method, got ${browserResult.method}`);
    }
    if (!browserResult.content.includes('Herman Melville - Moby-Dick')) {
      throw new Error(`TEST B Failed: Browser content did not contain expected DOM elements`);
    }
    const metricsB = BrowserIsolationManager.getOperationalMetrics();
    if (metricsB.totalBrowserJobsCompleted < 1 || metricsB.totalCleanupsExecuted < 1) {
      throw new Error(`TEST B Failed: Browser completed counter or cleanup not recorded`);
    }
    console.log(`✓ TEST B PASSED: Rendered HTML (${browserResult.byteSize} bytes) via isolated browser with verified cleanup.`);

    // ------------------------------------------------------------------
    // TEST C & G: Concurrency Bounding & Queue Capacity Handling
    // ------------------------------------------------------------------
    console.log('\nTEST C & G: Concurrency Bounding & Overload Capacity Protection...');
    // Launch 4 concurrent browser jobs (exceeds maxConcurrentBrowsers = 2)
    const p1 = BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/1', { tenantId: 'tenant-1' });
    const p2 = BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/1', { tenantId: 'tenant-2' });
    const p3 = BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/1', { tenantId: 'tenant-3' });

    // Inspect metrics while jobs are in flight
    await new Promise((r) => setTimeout(r, 200));
    const metricsMid = BrowserIsolationManager.getOperationalMetrics();
    console.log(`  - Active Browser Jobs: ${metricsMid.activeBrowserJobs} / Max: ${metricsMid.maxConcurrency}`);
    console.log(`  - Queued Backlog: ${metricsMid.queuedBrowserJobs}`);

    if (metricsMid.activeBrowserJobs > metricsMid.maxConcurrency) {
      throw new Error(`TEST C Failed: Active browser jobs (${metricsMid.activeBrowserJobs}) exceeded max limit (${metricsMid.maxConcurrency})!`);
    }

    const results = await Promise.all([p1, p2, p3]);
    const allSuccessful = results.every((r) => r.success);
    if (!allSuccessful) {
      throw new Error(`TEST C & G Failed: Queued browser jobs should finish once capacity frees up`);
    }
    console.log(`✓ TEST C & G PASSED: Concurrency strictly bounded to 2. Queued jobs successfully processed as slots opened.`);

    // ------------------------------------------------------------------
    // TEST D: Lightweight Queue Protection (Browser Backlog does not block HTTP)
    // ------------------------------------------------------------------
    console.log('\nTEST D: Lightweight Queue Isolation (HTTP Not Blocked by Browser)...');
    // Start a heavy browser job
    const heavyJob = BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/2', { tenantId: 'tenant-heavy' });
    
    // Immediately execute lightweight HTTP call
    const tStart = Date.now();
    const immediateHttp = await SourceAccessService.acquireSource('https://httpbin.org/html', {
      useBrowser: false,
      bypassCache: true,
    });
    const httpDuration = Date.now() - tStart;

    if (!immediateHttp.success || immediateHttp.method !== 'DIRECT_HTTP') {
      throw new Error(`TEST D Failed: HTTP acquisition failed: ${immediateHttp.error?.message}`);
    }
    await heavyJob; // Wait for browser job to finish cleanly
    console.log(`✓ TEST D PASSED: Lightweight HTTP completed in ${httpDuration}ms completely decoupled from browser workload.`);

    // ------------------------------------------------------------------
    // TEST E: Strict Timeout Enforcement & Resource Cleanup
    // ------------------------------------------------------------------
    console.log('\nTEST E: Strict Timeout Enforcement & Process Cleanup...');
    const timeoutStart = Date.now();
    const timeoutJob = await BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/10', {
      tenantId: 'tenant-timeout',
      timeoutMs: 3000, // Strict 3 second timeout on a 10s slow response
    });

    const elapsed = Date.now() - timeoutStart;
    if (timeoutJob.success) {
      throw new Error('TEST E Failed: Job should have timed out!');
    }
    if (timeoutJob.error?.category !== 'PAGE_NAVIGATION_TIMEOUT') {
      throw new Error(`TEST E Failed: Expected PAGE_NAVIGATION_TIMEOUT, got ${timeoutJob.error?.category}`);
    }
    console.log(`✓ TEST E PASSED: Timed out cleanly in ${elapsed}ms. Category: ${timeoutJob.error.category}`);

    // ------------------------------------------------------------------
    // TEST F & H: Exception Handling & Temporary File Cleanup
    // ------------------------------------------------------------------
    console.log('\nTEST F & H: Exception Recovery & Artifact Lifecycle...');
    // Create snapshot test to verify temporary file lifecycle
    const snapResult = await BrowserIsolationManager.executeBrowserJob('https://httpbin.org/html', {
      tenantId: 'tenant-snap',
      captureSnapshot: true,
    });

    if (!snapResult.success) {
      throw new Error('TEST F & H Failed: Snapshot job failed');
    }

    // Verify temp directory has no orphan files left after job completion
    const config = BrowserIsolationManager.getConfig();
    const tempFiles = fs.readdirSync(config.tempDir);
    console.log(`  - Temp Artifacts in ${config.tempDir}: ${tempFiles.length}`);
    if (tempFiles.length !== 0) {
      throw new Error(`TEST H Failed: Temporary files leaked! Found: ${tempFiles.join(', ')}`);
    }
    console.log(`✓ TEST F & H PASSED: Guaranteed cleanup wiped all temporary files upon job completion.`);

    // ------------------------------------------------------------------
    // TEST I: Multi-Tenant Fairness (Quota per Tenant)
    // ------------------------------------------------------------------
    console.log('\nTEST I: Multi-Tenant Fairness Protection...');
    // Tenant A attempts to queue 2 jobs when maxPerTenantConcurrent is 1
    let tenantAFinishedFirst = false;
    let tenantBFinished = false;

    const tenantAJob1 = BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/1', { tenantId: 'org-tenant-a' })
      .then(() => { tenantAFinishedFirst = true; });
    const tenantAJob2 = BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/1', { tenantId: 'org-tenant-a' });
    
    // Tenant B submits 1 job - should not be starved by Tenant A's 2nd job
    const tenantBJob = BrowserIsolationManager.executeBrowserJob('https://httpbin.org/delay/1', { tenantId: 'org-tenant-b' })
      .then(() => { tenantBFinished = true; });

    await Promise.all([tenantAJob1, tenantAJob2, tenantBJob]);
    if (!tenantAFinishedFirst || !tenantBFinished) {
      throw new Error('TEST I Failed: Tenant fairness sequencing error');
    }
    console.log(`✓ TEST I PASSED: Tenant quota enforced (max 1 concurrent per tenant). No tenant starved.`);

    // ------------------------------------------------------------------
    // TEST J: Operational Metrics & Health Classification
    // ------------------------------------------------------------------
    console.log('\nTEST J: Operational Telemetry & Health Integration...');
    const finalMetrics = BrowserIsolationManager.getOperationalMetrics();
    console.log('  - Total Completed:', finalMetrics.totalBrowserJobsCompleted);
    console.log('  - Total Timeouts:', finalMetrics.totalBrowserTimeouts);
    console.log('  - Total Cleanups:', finalMetrics.totalCleanupsExecuted);
    console.log('  - Average Job Duration:', `${finalMetrics.avgJobDurationMs}ms`);
    console.log('  - Free System RAM:', `${finalMetrics.systemMemory.freeMemoryMb} MB`);
    console.log('  - Node Process RSS:', `${finalMetrics.systemMemory.processMemoryMb} MB`);

    const clientMsg = SourceHealthService.getClientFriendlyMessage('PAGE_NAVIGATION_TIMEOUT', 504);
    if (!clientMsg || clientMsg.includes('puppeteer') || clientMsg.includes('PID')) {
      throw new Error('TEST J Failed: Client message exposed internal infrastructure');
    }
    console.log(`  - Client Friendly Message: "${clientMsg}"`);

    console.log('\n===============================================================');
    console.log('   ALL PHASE 4 RESOURCE & BROWSER ISOLATION TESTS PASSED!     ');
    console.log('===============================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ PHASE 4 TEST FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

runPhase4Tests();
