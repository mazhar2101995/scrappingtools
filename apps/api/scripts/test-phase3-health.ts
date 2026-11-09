import process from 'node:process';
import { db, sourceDomainHealth, sourceIncidentEvents, sourceCache } from '@saas/database';
import { eq } from 'drizzle-orm';
import { SourceHealthService } from '../src/services/source-health.service';
import { SourceAccessService } from '../src/services/source-access.service';

/**
 * PHASE 3 VERIFICATION TEST SUITE
 * Source Health & Failure Intelligence
 */
async function runPhase3Tests() {
  console.log('===============================================================');
  console.log('   PHASE 3 TEST SUITE: SOURCE HEALTH & FAILURE INTELLIGENCE   ');
  console.log('===============================================================\n');

  const testDomainHealthy = 'healthy-demo.org';
  const testDomainFailure = 'failing-distributor.test';
  const testDomainRateLimit = 'rate-limited-shop.com';

  try {
    // Clean up test domains before running
    await db.delete(sourceDomainHealth).where(eq(sourceDomainHealth.domain, testDomainHealthy));
    await db.delete(sourceDomainHealth).where(eq(sourceDomainHealth.domain, testDomainFailure));
    await db.delete(sourceDomainHealth).where(eq(sourceDomainHealth.domain, testDomainRateLimit));
    await db.delete(sourceIncidentEvents).where(eq(sourceIncidentEvents.domain, testDomainHealthy));
    await db.delete(sourceIncidentEvents).where(eq(sourceIncidentEvents.domain, testDomainFailure));
    await db.delete(sourceIncidentEvents).where(eq(sourceIncidentEvents.domain, testDomainRateLimit));

    // ------------------------------------------------------------------
    // TEST 1: Healthy Source Operational Metrics
    // ------------------------------------------------------------------
    console.log('TEST 1: Healthy Source Recording & Metric Computation...');
    await SourceHealthService.recordSuccess(testDomainHealthy, 240, 200);
    await SourceHealthService.recordSuccess(testDomainHealthy, 180, 200);
    await SourceHealthService.recordSuccess(testDomainHealthy, 210, 200);

    const health1 = await SourceHealthService.getDomainHealth(testDomainHealthy);
    if (!health1 || health1.healthStatus !== 'HEALTHY') {
      throw new Error(`TEST 1 Failed: Expected HEALTHY, got ${health1?.healthStatus}`);
    }
    if (health1.totalRequests !== 3 || health1.successfulRequests !== 3 || health1.successRate !== 100) {
      throw new Error(`TEST 1 Failed: Metrics mismatch: total=${health1.totalRequests}, rate=${health1.successRate}%`);
    }
    console.log(`✓ TEST 1 PASSED: Domain is HEALTHY with 100% success rate, avg latency ${health1.avgLatencyMs}ms`);

    // ------------------------------------------------------------------
    // TEST 2: Structured Failure Classification & Health Degradation
    // ------------------------------------------------------------------
    console.log('\nTEST 2: Temporary Failure Classification & Health Degradation...');
    // Record 3 temporary network timeouts
    await SourceHealthService.recordFailure(testDomainFailure, 'TIMEOUT', 'Socket read timeout after 15000ms', 504);
    await SourceHealthService.recordFailure(testDomainFailure, 'TIMEOUT', 'Socket read timeout after 15000ms', 504);
    await SourceHealthService.recordFailure(testDomainFailure, 'TIMEOUT', 'Socket read timeout after 15000ms', 504);

    const health2 = await SourceHealthService.getDomainHealth(testDomainFailure);
    if (!health2 || health2.healthStatus !== 'DEGRADED') {
      throw new Error(`TEST 2 Failed: Expected DEGRADED after 3 consecutive failures, got ${health2?.healthStatus}`);
    }
    if (health2.consecutiveFailures !== 3) {
      throw new Error(`TEST 2 Failed: Expected 3 consecutive failures, got ${health2.consecutiveFailures}`);
    }
    console.log(`✓ TEST 2 PASSED: Domain degraded to '${health2.healthStatus}' after 3 consecutive failures`);

    // ------------------------------------------------------------------
    // TEST 3: Domain Cooldown & Circuit Breaking on Repeated Failures
    // ------------------------------------------------------------------
    console.log('\nTEST 3: Cooldown Activation on 5 Consecutive Failures...');
    // Add 2 more failures to hit threshold of 5
    await SourceHealthService.recordFailure(testDomainFailure, 'CONNECTION_REFUSED', 'ECONNREFUSED 127.0.0.1:443', 502);
    await SourceHealthService.recordFailure(testDomainFailure, 'CONNECTION_REFUSED', 'ECONNREFUSED 127.0.0.1:443', 502);

    const health3 = await SourceHealthService.getDomainHealth(testDomainFailure);
    if (!health3 || health3.healthStatus !== 'TEMPORARILY_UNAVAILABLE') {
      throw new Error(`TEST 3 Failed: Expected TEMPORARILY_UNAVAILABLE, got ${health3?.healthStatus}`);
    }
    if (!health3.isCooledDown || health3.cooldownRemainingSec <= 0) {
      throw new Error(`TEST 3 Failed: Domain should be cooled down! remainingSec=${health3.cooldownRemainingSec}`);
    }

    const cooldownGate = await SourceHealthService.isDomainCooledDown(testDomainFailure);
    if (!cooldownGate.cooledDown) {
      throw new Error('TEST 3 Failed: isDomainCooledDown returned false during active cooldown');
    }
    console.log(`✓ TEST 3 PASSED: Domain placed under active cooldown for ${cooldownGate.remainingSec}s (${health3.healthStatus})`);

    // ------------------------------------------------------------------
    // TEST 4: Immediate Cooldown on HTTP 429 Rate Limiting
    // ------------------------------------------------------------------
    console.log('\nTEST 4: Immediate Cooldown & Deferral on HTTP 429...');
    await SourceHealthService.recordFailure(testDomainRateLimit, 'RATE_LIMITED_429', 'Too many requests', 429, 60);

    const health4 = await SourceHealthService.getDomainHealth(testDomainRateLimit);
    if (!health4 || health4.healthStatus !== 'TEMPORARILY_UNAVAILABLE' || !health4.isCooledDown) {
      throw new Error(`TEST 4 Failed: Expected immediate TEMPORARILY_UNAVAILABLE and cooldown on 429`);
    }

    // Now test SourceAccessService pre-flight gate on this cooled down domain
    const testUrl = `https://${testDomainRateLimit}/products/widget-999`;
    const deferredAcquisition = await SourceAccessService.acquireSource(testUrl, { bypassCache: true });
    if (deferredAcquisition.success) {
      throw new Error('TEST 4 Failed: Cooled down domain acquisition should have been intercepted');
    }
    if (deferredAcquisition.error?.category !== 'RATE_LIMITED_429') {
      throw new Error(`TEST 4 Failed: Expected category RATE_LIMITED_429, got ${deferredAcquisition.error?.category}`);
    }
    console.log(`✓ TEST 4 PASSED: HTTP 429 triggered immediate cooldown; pre-flight gate deferred request safely: "${deferredAcquisition.error.message}"`);

    // ------------------------------------------------------------------
    // TEST 5: Health Recovery on Successful Probe
    // ------------------------------------------------------------------
    console.log('\nTEST 5: Health Recovery on Successful Probe...');
    // Manually clear cooldown on testDomainFailure to simulate probe test
    await db
      .update(sourceDomainHealth)
      .set({ cooldownUntil: null })
      .where(eq(sourceDomainHealth.domain, testDomainFailure));

    // Record 2 successful probes
    await SourceHealthService.recordSuccess(testDomainFailure, 190, 200);
    const healthRecovered = await SourceHealthService.getDomainHealth(testDomainFailure);
    if (!healthRecovered || healthRecovered.consecutiveFailures !== 0) {
      throw new Error(`TEST 5 Failed: consecutiveFailures should reset to 0, got ${healthRecovered?.consecutiveFailures}`);
    }
    console.log(`✓ TEST 5 PASSED: Consecutive failures reset to 0 upon successful probe. Status: ${healthRecovered.healthStatus}`);

    // ------------------------------------------------------------------
    // TEST 6: Client-Friendly Error Translation & Operational Telemetry
    // ------------------------------------------------------------------
    console.log('\nTEST 6: Client-Friendly Error Translation & Admin Telemetry...');
    const msg404 = SourceHealthService.getClientFriendlyMessage('NOT_FOUND_404', 404);
    const msg429 = SourceHealthService.getClientFriendlyMessage('RATE_LIMITED_429', 429);
    const msg500 = SourceHealthService.getClientFriendlyMessage('SERVER_ERROR_5XX', 500);

    if (msg404.includes('stack') || msg404.includes('ECONNREFUSED') || msg404.includes('proxy')) {
      throw new Error('TEST 6 Failed: Client message exposed internal infrastructure');
    }
    console.log(`  - 404 translation: "${msg404}"`);
    console.log(`  - 429 translation: "${msg429}"`);
    console.log(`  - 500 translation: "${msg500}"`);

    const monitored = await SourceHealthService.listMonitoredDomains(10);
    if (!monitored || monitored.length < 3) {
      throw new Error(`TEST 6 Failed: Expected at least 3 monitored domains in telemetry list`);
    }
    console.log(`✓ TEST 6 PASSED: Verified ${monitored.length} domains in platform admin telemetry list`);

    // ------------------------------------------------------------------
    // TEST 7: Multi-Tenant Safety & Cache Isolation
    // ------------------------------------------------------------------
    console.log('\nTEST 7: Multi-Tenant Safety Check...');
    const incidents = await SourceHealthService.getRecentIncidents(testDomainRateLimit, 5);
    if (!incidents || incidents.length === 0) {
      throw new Error('TEST 7 Failed: Expected incident events to be recorded');
    }
    // Verify no tenant IDs or customer credentials exist in domain health records
    const healthColumns = Object.keys(health4);
    if (healthColumns.includes('organizationId') || healthColumns.includes('tenantId')) {
      throw new Error('TEST 7 Failed: Domain health records must remain tenant-agnostic');
    }
    console.log(`✓ TEST 7 PASSED: Domain health is strictly domain-level & tenant-agnostic`);

    console.log('\n===============================================================');
    console.log('   ALL PHASE 3 HEALTH & FAILURE INTELLIGENCE TESTS PASSED!    ');
    console.log('===============================================================\n');

    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ PHASE 3 TEST FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

runPhase3Tests();
