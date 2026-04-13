// Netlify Serverless Function: Generate PDF via Puppeteer
// Receives { html, filename } via POST, returns Letter-size PDF as base64.
// Renders at 1400px in screen media mode so md: Tailwind breakpoints fire normally.

const chromium = require('@sparticuz/chromium-min');
const puppeteer = require('puppeteer-core');

// Chromium binary hosted on GitHub Releases (~50MB, cached in /tmp after first download)
const CHROMIUM_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v130.0.0/chromium-v130.0.0-pack.tar';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  let html, filename;
  try {
    ({ html, filename } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  if (!html) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'html is required' }) };
  }

  const safeFilename = (filename || 'BLT-Report').replace(/[^a-zA-Z0-9._-]/g, '-');

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1400, height: 900 },
      executablePath: await chromium.executablePath(CHROMIUM_URL),
      headless: chromium.headless,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    // Use print media so break-before:right (force odd/right page) works for batch page ordering.
    // Tailwind's responsive md: classes still fire because they're based on viewport width (1400px),
    // not media type — so md:grid-cols-3 etc. are unaffected.
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'networkidle2', timeout: 25000 });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.4in', right: '0.5in', bottom: '0.4in', left: '0.5in' },
    });

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}.pdf"`,
      },
      body: Buffer.from(pdfBuffer).toString('base64'),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error('generate-pdf error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'PDF generation failed', message: err.message }),
    };
  } finally {
    if (browser) await browser.close();
  }
};
