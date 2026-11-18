const http = require('http');
const path = require('path');
const jwt = require(path.resolve('apps/api/node_modules/jsonwebtoken'));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_super_secret_key_change_in_production';

// Generate Super Admin token
const superAdminToken = jwt.sign(
  {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'admin@productintel.internal',
    orgId: 'c9361815-b6b7-4f7c-bbf3-192c671105d6',
    role: 'super_admin',
    isSuperadmin: true,
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function run() {
  console.log('=== Centralized Error Telemetry Verification ===\n');

  // Test 1: Frontend error report ingestion with sensitive data redaction
  console.log('Test 1: Ingesting frontend error report with sensitive fields...');
  const frontendErrorPayload = {
    source: 'frontend',
    severity: 'error',
    errorName: 'PaymentFormException',
    errorMessage: 'Card authorization token rejected',
    stackTrace: 'Error: Card authorization token rejected\n    at checkout.tsx:42',
    httpPath: '/checkout/pay',
    organizationId: 'c9361815-b6b7-4f7c-bbf3-192c671105d6',
    userId: '00000000-0000-0000-0000-000000000001',
    context: {
      password: 'superSecretPassword123!',
      apiKey: 'sk-prod-998877665544',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive',
      userNote: 'Customer attempted checkout with promo code PROMO2026',
      nestedAuth: {
        authorization: 'Bearer secret_access_token',
        safeProperty: 'Visa-4242'
      }
    }
  };

  const reportRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/telemetry/errors',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`
      }
    },
    frontendErrorPayload
  );

  console.log('Ingest Response Status:', reportRes.status);
  console.log('Ingest Response Body:', JSON.stringify(reportRes.body, null, 2));

  if (!reportRes.body?.errorReferenceId) {
    throw new Error('Failed to ingest error: No errorReferenceId returned');
  }

  const generatedRefId = reportRes.body.errorReferenceId;
  console.log('Generated Error Reference ID:', generatedRefId);

  // Test 2: Query system error logs via Super Admin endpoint
  console.log('\nTest 2: Querying error logs via Super Admin API (GET /api/v1/telemetry/errors)...');
  const queryRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/telemetry/errors?search=${generatedRefId}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${superAdminToken}`
    }
  });

  console.log('Query Response Status:', queryRes.status);
  console.log('Found Logs Count:', queryRes.body?.logs?.length);

  const matchedLog = queryRes.body?.logs?.[0];
  if (!matchedLog) {
    throw new Error('Could not find logged error in database');
  }

  console.log('\nRetrieved Log Record:');
  console.log('- Reference ID:', matchedLog.errorReferenceId);
  console.log('- Source:', matchedLog.source);
  console.log('- Severity:', matchedLog.severity);
  console.log('- Error Name:', matchedLog.errorName);
  console.log('- Organization ID:', matchedLog.organizationId);
  console.log('- User ID:', matchedLog.userId);

  // Test 3: Verify sensitive data was redacted
  console.log('\nTest 3: Checking Sensitive Data Redaction in Context...');
  const ctx = matchedLog.context;
  console.log('Context Object:', JSON.stringify(ctx, null, 2));

  const redactionsPassed =
    ctx.password === '[REDACTED]' &&
    ctx.apiKey === '[REDACTED]' &&
    ctx.token === '[REDACTED]' &&
    ctx.nestedAuth?.authorization === '[REDACTED]' &&
    ctx.nestedAuth?.safeProperty === 'Visa-4242' &&
    ctx.userNote.includes('PROMO2026');

  if (redactionsPassed) {
    console.log('>> SUCCESS: All sensitive credentials recursively redacted to [REDACTED], safe data preserved!');
  } else {
    throw new Error('Redaction failed! Sensitive credentials leaked into context.');
  }

  // Test 4: Verify non-admin access is rejected
  console.log('\nTest 4: Verifying Non-Admin RBAC Protection...');
  const tenantToken = jwt.sign(
    {
      userId: 'c9361815-b6b7-4f7c-bbf3-192c67110001',
      email: 'member@tenant.com',
      orgId: 'c9361815-b6b7-4f7c-bbf3-192c671105d6',
      role: 'member',
      isSuperadmin: false,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const forbiddenRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/telemetry/errors',
    method: 'GET',
    headers: {
      Authorization: `Bearer ${tenantToken}`
    }
  });

  console.log('Tenant Access Response Status:', forbiddenRes.status);
  if (forbiddenRes.status === 403) {
    console.log('>> SUCCESS: Non-admin query access properly rejected with 403 Forbidden!');
  } else {
    throw new Error(`Expected 403 Forbidden, got ${forbiddenRes.status}`);
  }

  // Test 5: Verify backend error middleware interception and reference ID generation
  console.log('\nTest 5: Triggering unhandled backend exception via error middleware...');
  const backendErrRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/telemetry/simulate-backend-error',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superAdminToken}`
    }
  });

  console.log('Backend Error Response Status:', backendErrRes.status);
  console.log('Backend Error Response Body:', JSON.stringify(backendErrRes.body, null, 2));

  if (backendErrRes.status !== 500) {
    throw new Error(`Expected 500 status code, got ${backendErrRes.status}`);
  }
  if (!backendErrRes.body?.errorReferenceId) {
    throw new Error('Backend error did not return errorReferenceId');
  }

  const backendRefId = backendErrRes.body.errorReferenceId;
  console.log('Backend Generated Ref ID:', backendRefId);

  // Verify backend error was persisted in database
  const queryBackendRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/telemetry/errors?search=${backendRefId}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${superAdminToken}`
    }
  });

  const backendLog = queryBackendRes.body?.logs?.[0];
  if (!backendLog || backendLog.source !== 'backend') {
    throw new Error('Backend error was not logged correctly in system_error_logs');
  }
  console.log('>> SUCCESS: Backend error intercepted by middleware, assigned Ref ID and persisted in system_error_logs!');

  console.log('\n=== ALL CENTRALIZED ERROR TELEMETRY CHECKS PASSED ===');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
