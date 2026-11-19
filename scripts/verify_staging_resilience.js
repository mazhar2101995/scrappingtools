const http = require('http');
const path = require('path');
const { ShopifyConnector } = require(path.resolve(__dirname, '../packages/connectors/dist/index.js'));

async function runResilienceTests() {
  console.log('=== GATE D.1: RESILIENCE & ERROR VERIFICATION (STG-RTR-01 & STG-ERR-01) ===\n');

  let mode = 'rate_limit';
  let requestCount = 0;

  const server = http.createServer((req, res) => {
    requestCount++;
    console.log(`[Staging Fault Proxy] Request #${requestCount} received: ${req.method} ${req.url}`);

    if (mode === 'rate_limit') {
      if (requestCount === 1) {
        console.log('[Staging Fault Proxy] Injecting HTTP 429 Too Many Requests (Retry-After: 1)...');
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': '1',
        });
        res.end(JSON.stringify({ errors: 'Exceeded 2.0 calls/second rate limit.' }));
      } else {
        console.log('[Staging Fault Proxy] Resolving HTTP 200 on retry...');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ shop: { name: 'Fault-Tolerant Store', currency: 'USD' } }));
      }
    } else if (mode === '401_auth_error') {
      console.log('[Staging Fault Proxy] Injecting HTTP 401 with echoed sensitive token header...');
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': 'shpat_super_secret_token_abc123',
      });
      res.end(JSON.stringify({ errors: '[API] Invalid API key or access token (unrecognized login or wrong password)' }));
    } else if (mode === '422_validation_error') {
      console.log('[Staging Fault Proxy] Injecting HTTP 422 Unprocessable Entity...');
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: { title: ["can't be blank"], sku: ["has already been taken"] } }));
    } else if (mode === '404_not_found') {
      console.log('[Staging Fault Proxy] Injecting HTTP 404 Not Found...');
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: 'Not Found' }));
    }
  });

  await new Promise((resolve) => server.listen(9876, '127.0.0.1', resolve));
  console.log('[+] Staging Fault Proxy listening on http://127.0.0.1:9876\n');

  try {
    // -------------------------------------------------------------
    // STG-RTR-01: Rate-Limit Handling (429 Backoff & Automatic Retry)
    // -------------------------------------------------------------
    console.log('--- TEST 1: STG-RTR-01 Rate Limit Backoff ---');
    mode = 'rate_limit';
    requestCount = 0;

    const connectorRtr = new ShopifyConnector({
      shopDomain: 'http://127.0.0.1:9876',
      accessToken: 'shpat_real_test_token_555',
    });

    const startRtr = Date.now();
    const rtrResult = await connectorRtr.testConnection();
    const durationRtr = Date.now() - startRtr;

    console.log('[+] STG-RTR-01 Result:', JSON.stringify(rtrResult, null, 2));
    console.log(`[+] Total Time with Backoff: ${durationRtr}ms (Total Attempts: ${requestCount})`);

    const rtrPassed = rtrResult.success === true && requestCount === 2 && durationRtr >= 1000;
    console.log(`>> STG-RTR-01 Status: ${rtrPassed ? 'VERIFIED (PASS)' : 'FAILED'}\n`);

    // -------------------------------------------------------------
    // STG-ERR-01: Shopify Error Classification & Redaction
    // -------------------------------------------------------------
    console.log('--- TEST 2: STG-ERR-01 Error Classification & Redaction ---');
    
    // Scenario A: 401 Unauthorized with token redaction
    mode = '401_auth_error';
    requestCount = 0;
    const err401 = await connectorRtr.testConnection();
    console.log('[+] Scenario A (401 Error):', JSON.stringify(err401, null, 2));
    const tokenRedacted = !JSON.stringify(err401).includes('shpat_') && err401.error.includes('Invalid API key');

    // Scenario B: 422 Unprocessable Entity
    mode = '422_validation_error';
    requestCount = 0;
    const err422 = await connectorRtr.testConnection();
    console.log('[+] Scenario B (422 Error):', JSON.stringify(err422, null, 2));

    // Scenario C: 404 Not Found
    mode = '404_not_found';
    requestCount = 0;
    const err404 = await connectorRtr.testConnection();
    console.log('[+] Scenario C (404 Error):', JSON.stringify(err404, null, 2));

    const errPassed = err401.success === false && tokenRedacted && err422.success === false && err404.success === false;
    console.log(`>> STG-ERR-01 Status: ${errPassed ? 'VERIFIED (PASS)' : 'FAILED'}\n`);

  } finally {
    server.close();
  }
}

runResilienceTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
