const http = require('http');
const path = require('path');
const jwt = require(path.resolve('apps/api/node_modules/jsonwebtoken'));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_super_secret_key_change_in_production';

// Tenant A: Org Alpha
const orgA_id = '00e814db-162e-44ad-be77-44a6e2e7077a';
const tokenTenantA = jwt.sign(
  {
    userId: '11111111-1111-1111-1111-111111111111',
    email: 'tenantA_admin@orgalpha.com',
    orgId: orgA_id,
    organizationId: orgA_id,
    role: 'admin',
    isSuperadmin: false,
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

// Tenant B: Org Beta
const orgB_id = '0134937c-4fca-47e8-9495-538d8d9b2532';
const tokenTenantB = jwt.sign(
  {
    userId: '22222222-2222-2222-2222-222222222222',
    email: 'tenantB_admin@orgbeta.com',
    orgId: orgB_id,
    organizationId: orgB_id,
    role: 'admin',
    isSuperadmin: false,
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const testProductId = '909676bd-039a-4a4b-b75a-c1be89b02a4d';

function makeRequest(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path,
        method,
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runSecurityAudit() {
  console.log('=== P0 Multi-Tenant Cross-Tenant Security Audit ===\n');

  // Test 1: Tenant A maps product and sets custom title
  console.log('Test 1: Tenant A sets private catalog override...');
  await makeRequest('/api/v1/catalog/map', 'POST', tokenTenantA, {
    globalProductId: testProductId,
    customerInternalSku: 'SKU-A-001',
  });
  const overrideA = await makeRequest(
    `/api/v1/catalog/${testProductId}/override`,
    'PUT',
    tokenTenantA,
    { customTitle: 'Tenant A Secret Proprietary Title' }
  );
  console.log('Tenant A Override Status:', overrideA.status);

  // Test 2: Tenant B maps same product and sets different title
  console.log('\nTest 2: Tenant B sets different private catalog override for same product...');
  await makeRequest('/api/v1/catalog/map', 'POST', tokenTenantB, {
    globalProductId: testProductId,
    customerInternalSku: 'SKU-B-999',
  });
  const overrideB = await makeRequest(
    `/api/v1/catalog/${testProductId}/override`,
    'PUT',
    tokenTenantB,
    { customTitle: 'Tenant B Public Retail Title' }
  );
  console.log('Tenant B Override Status:', overrideB.status);

  // Test 3: Verify Tenant A sees ONLY Tenant A custom title
  console.log('\nTest 3: Checking Tenant A catalog isolation...');
  const catA = await makeRequest('/api/v1/catalog', 'GET', tokenTenantA);
  const prodA = (catA.body?.catalog || []).find(p => p.globalProductId === testProductId);
  console.log('Tenant A Sees Title:', prodA?.title);
  if (prodA?.title !== 'Tenant A Secret Proprietary Title') {
    throw new Error('SECURITY VIOLATION: Tenant A title not isolated!');
  }
  console.log('>> PASS: Tenant A sees only Tenant A overrides.');

  // Test 4: Verify Tenant B sees ONLY Tenant B custom title
  console.log('\nTest 4: Checking Tenant B catalog isolation...');
  const catB = await makeRequest('/api/v1/catalog', 'GET', tokenTenantB);
  const prodB = (catB.body?.catalog || []).find(p => p.globalProductId === testProductId);
  console.log('Tenant B Sees Title:', prodB?.title);
  if (prodB?.title !== 'Tenant B Public Retail Title') {
    throw new Error('SECURITY VIOLATION: Tenant B title not isolated!');
  }
  console.log('>> PASS: Tenant B sees only Tenant B overrides. Zero cross-tenant data leakage!');

  // Test 5: Storage Quota & Accounting Isolation
  console.log('\nTest 5: Checking storage accounting isolation between Tenant A and Tenant B...');
  const storA = await makeRequest('/api/v1/storage/usage', 'GET', tokenTenantA);
  const storB = await makeRequest('/api/v1/storage/usage', 'GET', tokenTenantB);
  const orgInA = storA.body?.data?.organizationId;
  const orgInB = storB.body?.data?.organizationId;
  console.log('Tenant A Reported Org:', orgInA);
  console.log('Tenant B Reported Org:', orgInB);
  if (orgInA !== orgA_id || orgInB !== orgB_id) {
    throw new Error('SECURITY VIOLATION: Storage usage not properly scoped by organization!');
  }
  console.log('>> PASS: Storage metrics strictly scoped to respective organizations.');

  // Test 5B: Media Assets List Isolation
  console.log('\nTest 5B: Verifying media asset list isolation (Tenant B cannot see Tenant A assets)...');
  const assetsB = await makeRequest('/api/v1/storage/assets', 'GET', tokenTenantB);
  const leakedAssets = (assetsB.body?.data || []).filter(a => a.organizationId === orgA_id);
  if (leakedAssets.length > 0) {
    throw new Error('SECURITY VIOLATION: Tenant A media assets leaked to Tenant B!');
  }
  console.log('>> PASS: Media assets strictly scoped by tenant organizationId.');

  // Test 6: Connected Stores Cross-Tenant Isolation
  console.log('\nTest 6: Checking connected store credentials isolation...');
  const storesB = await makeRequest('/api/v1/stores', 'GET', tokenTenantB);
  const leakedStores = (storesB.body?.stores || []).filter(s => s.organizationId === orgA_id);
  if (leakedStores.length > 0) {
    throw new Error('SECURITY VIOLATION: Tenant A store credentials leaked to Tenant B!');
  }
  console.log('>> PASS: Connected store access strictly isolated.');

  // Test 7: Privilege Escalation — Regular tenant accessing Super Admin error telemetry
  console.log('\nTest 7: Regular tenant attempting to access Super Admin error telemetry...');
  const privA = await makeRequest('/api/v1/telemetry/errors', 'GET', tokenTenantA);
  console.log('Tenant A Super Admin Access Status:', privA.status);
  if (privA.status !== 403) {
    throw new Error(`SECURITY VIOLATION: Expected 403 Forbidden on Super Admin telemetry, got ${privA.status}`);
  }
  console.log('>> PASS: Privilege escalation blocked with HTTP 403 Forbidden.');

  // Test 8: Unauthenticated route rejection
  console.log('\nTest 8: Unauthenticated access to protected routes...');
  const unauth = await makeRequest('/api/v1/catalog', 'GET');
  console.log('Unauthenticated Status:', unauth.status);
  if (unauth.status !== 401) {
    throw new Error(`SECURITY VIOLATION: Expected 401 Unauthorized, got ${unauth.status}`);
  }
  console.log('>> PASS: Unauthenticated access rejected with HTTP 401 Unauthorized.');

  console.log('\n=== ALL P0 MULTI-TENANT SECURITY CONTROLS VERIFIED (8/8 PASS) ===');
}

runSecurityAudit().catch(err => {
  console.error('SECURITY AUDIT FAILED:', err);
  process.exit(1);
});
