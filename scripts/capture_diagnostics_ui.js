const path = require('path');
const { pathToFileURL } = require('url');
const jwt = require(path.resolve('apps/api/node_modules/jsonwebtoken'));

async function captureAuthenticatedStores() {
  const jwtSecret = 'dev_jwt_super_secret_key_change_in_production';
  // Org ID: c9361815-b6b7-4f7c-bbf3-192c671105d6 (owner of staging stores)
  const token = jwt.sign(
    {
      userId: '642cff50-f633-4fe3-961e-371494f6f478',
      email: 'majhar.inception@gmail.com',
      organizationId: 'c9361815-b6b7-4f7c-bbf3-192c671105d6',
      role: 'owner',
      isSuperadmin: false,
    },
    jwtSecret,
    { expiresIn: '7d' }
  );

  console.log('Importing puppeteer...');
  const puppeteerPath = path.resolve('node_modules/.pnpm/puppeteer@25.16.0/node_modules/puppeteer/lib/puppeteer/puppeteer.js');
  const puppeteerModule = await import(pathToFileURL(puppeteerPath).href);
  const puppeteer = puppeteerModule.default || puppeteerModule;

  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to /login to establish origin & localStorage...');
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });

  await page.evaluate((t) => {
    localStorage.setItem('saas_token', t);
    localStorage.setItem('saas_token_client', t);
    localStorage.setItem('saas_current_role', 'client');
    localStorage.setItem('saas_org_id', 'c9361815-b6b7-4f7c-bbf3-192c671105d6');
    localStorage.setItem('saas_current_user', JSON.stringify({
      id: '642cff50-f633-4fe3-961e-371494f6f478',
      name: 'mazhar kharawla',
      email: 'majhar.inception@gmail.com',
      role: 'owner',
      organizationName: 'Primary Staging Org'
    }));
    localStorage.setItem('saas_current_org_name', 'Primary Staging Org');
  }, token);

  console.log('Navigating to http://localhost:3000/stores...');
  await page.goto('http://localhost:3000/stores', { waitUntil: 'networkidle2' });

  // Wait 4 seconds for store cards to render
  await new Promise((r) => setTimeout(r, 4000));

  const artifactDir = 'C:\\Users\\oApps\\.gemini\\antigravity\\brain\\cb456e43-365e-48ae-a8da-f493afe6f884';

  const cardScreenshotPath = path.join(artifactDir, 'stores_diagnostics_cards.png');
  await page.screenshot({ path: cardScreenshotPath, fullPage: true });
  console.log('Screenshot 1: Saved stores cards to:', cardScreenshotPath);

  // Find Diagnostics button
  const buttons = await page.$$('button');
  console.log(`Checking ${buttons.length} buttons for "Diagnostics"...`);
  let clicked = false;
  for (const b of buttons) {
    const text = await page.evaluate((el) => el.textContent, b);
    if (text && text.includes('Diagnostics')) {
      console.log('Clicking Diagnostics button...');
      await b.click();
      clicked = true;
      break;
    }
  }

  if (clicked) {
    await new Promise((r) => setTimeout(r, 3000));
    const modalScreenshotPath = path.join(artifactDir, 'stores_diagnostics_modal_open.png');
    await page.screenshot({ path: modalScreenshotPath, fullPage: true });
    console.log('Screenshot 2: Saved modal screenshot to:', modalScreenshotPath);
  } else {
    console.warn('Diagnostics button not found');
  }

  await browser.close();
  console.log('Done!');
}

captureAuthenticatedStores().catch(console.error);
