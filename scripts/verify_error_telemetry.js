const http = require('http');
const path = require('path');
const jwt = require(path.resolve('apps/api/node_modules/jsonwebtoken'));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_super_secret_key_change_in_production';

// Super Admin token
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
  console.log('=== Comprehensive Error Telemetry Security Verification ===\n');

  // TEL-01 & TEL-03 & TEL-04 & TEL-05: Deep Redaction Verification
  console.log('TEL-01: Ingesting frontend error report with comprehensive sensitive vectors...');
  const deepPayload = {
    source: 'frontend',
    severity: 'error',
    errorName: 'PaymentAndAuthFailure',
    errorMessage: 'Card failed on checkout for url https://checkout.store.com/pay?apiKey=sk_live_verysecret123&token=jwt_xyz_998',
    stackTrace: 'Error: Card rejected\n    at checkout.tsx:120\n    auth: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sensitive_payload_string',
    httpPath: '/checkout/pay?password=myPassword123&session_id=sess_48291',
    organizationId: 'c9361815-b6b7-4f7c-bbf3-192c671105d6',
    userId: '00000000-0000-0000-0000-000000000001',
    context: {
      password: 'plainTextPassword999!',
      apiKey: 'sk-prod-998877665544',
      token: 'jwt_token_here',
      cookie: 'connect.sid=s%3A12345.abcdef',
      creditCard: '4111111111111111',
      cvv: '123',
      nested: {
        authorization: 'Bearer secret_auth_token_value',
        rawPan: '5500000000000004',
        safeNotes: 'Transaction attempt #3'
      },
      arrayData: [
        { clientSecret: 'pi_3MtwBwLkdIwHu7ix28a3tqPa_secret_Yr9' },
        'Embedded token string: Bearer abcdef123456789'
      ]
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
    deepPayload
  );

  console.log('Ingest HTTP Status:', reportRes.status);
  const refId = reportRes.body?.errorReferenceId;
  console.log('Generated Ref ID:', refId);
  if (!refId) throw new Error('TEL-01 Failed: No errorReferenceId returned');

  // TEL-02: Query by Ref ID
  console.log('\nTEL-02: Querying error record via Super Admin API...');
  const queryRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: `/api/v1/telemetry/errors?search=${refId}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${superAdminToken}` }
  });

  const record = queryRes.body?.logs?.[0];
  if (!record) throw new Error('TEL-02 Failed: Could not locate persisted error log');
  console.log('>> SUCCESS: Error log successfully retrieved by Reference ID');

  // TEL-03: Passwords, tokens, API keys
  console.log('\nTEL-03: Verifying passwords, tokens, and API key redaction...');
  if (record.context.password !== '[REDACTED]' || record.context.apiKey !== '[REDACTED]' || record.context.token !== '[REDACTED]') {
    throw new Error('TEL-03 Failed: Direct sensitive keys were not redacted');
  }
  console.log('>> SUCCESS: Passwords, tokens, and API keys scrubbed to [REDACTED]');

  // TEL-04: Payment credentials & card numbers
  console.log('\nTEL-04: Verifying card number and CVV redaction...');
  if (
    record.context.creditCard !== '[REDACTED]' ||
    record.context.cvv !== '[REDACTED]' ||
    (record.context.nested.rawPan !== '[REDACTED]' && record.context.nested.rawPan !== '[CARD_REDACTED]')
  ) {
    throw new Error('TEL-04 Failed: Credit card PAN or CVV leaked');
  }
  console.log('>> SUCCESS: Credit card numbers and CVV scrubbed');

  // TEL-05: Embedded credentials in URL and error message
  console.log('\nTEL-05: Verifying URL query parameter and error message credential scrubbing...');
  if (record.errorMessage.includes('sk_live_verysecret123') || !record.errorMessage.includes('apiKey=[REDACTED]')) {
    throw new Error('TEL-05 Failed: Sensitive query parameters in errorMessage were not scrubbed');
  }
  if (record.httpPath.includes('myPassword123') || !record.httpPath.includes('password=[REDACTED]')) {
    throw new Error('TEL-05 Failed: Password query parameter in httpPath was not scrubbed');
  }
  console.log('>> SUCCESS: Embedded query parameter secrets sanitized in errorMessage and httpPath');

  // TEL-06: Authorization Bearer headers & nested objects/arrays
  console.log('\nTEL-06: Verifying Bearer tokens and nested arrays...');
  if (record.context.nested.authorization !== '[REDACTED]') {
    throw new Error('TEL-06 Failed: Nested authorization was not redacted');
  }
  if (record.context.arrayData[0].clientSecret !== '[REDACTED]' || !record.context.arrayData[1].includes('[REDACTED]')) {
    throw new Error('TEL-06 Failed: Array-nested client secrets were not redacted');
  }
  console.log('>> SUCCESS: Nested structures and Bearer tokens fully sanitized');

  // TEL-07: Unauthenticated error capture (anonymous session)
  console.log('\nTEL-07: Ingesting error from unauthenticated/anonymous visitor...');
  const anonPayload = {
    source: 'frontend',
    severity: 'warning',
    errorName: 'AnonymousLandingPageError',
    errorMessage: 'Failed to load public feature banner',
    context: { visitorIp: '203.0.113.19' }
  };
  const anonRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/telemetry/errors',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    },
    anonPayload
  );
  if (anonRes.status !== 201 || !anonRes.body?.errorReferenceId) {
    throw new Error('TEL-07 Failed: Anonymous error report rejected');
  }
  console.log('>> SUCCESS: Unauthenticated error logged cleanly with Ref ID:', anonRes.body.errorReferenceId);

  // TEL-08: RBAC Enforcement
  console.log('\nTEL-08: Verifying RBAC protection for log querying...');
  const regularTenantToken = jwt.sign(
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
  const rbacRes = await makeRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/telemetry/errors',
    method: 'GET',
    headers: { Authorization: `Bearer ${regularTenantToken}` }
  });
  if (rbacRes.status !== 403) {
    throw new Error(`TEL-08 Failed: Expected 403 Forbidden, got ${rbacRes.status}`);
  }
  console.log('>> SUCCESS: Regular tenant query access strictly blocked with HTTP 403 Forbidden');

  console.log('\n=== ALL 8 ERROR TELEMETRY SECURITY TESTS (TEL-01..TEL-08) PASSED ===');
}

run().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
