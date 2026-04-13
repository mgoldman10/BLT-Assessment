/**
 * pdfService.ts
 *
 * Captures a DOM element, wraps it in a self-contained HTML document,
 * sends it to the Netlify generate-pdf function, and triggers a download.
 *
 * Why this approach:
 *   - Browser window.print() collapses to a ~720px viewport, breaking Tailwind
 *     md: classes and forcing the exec summary into a single tall column.
 *   - Puppeteer renders at 1400px in screen-media mode, so md:grid-cols-3 fires
 *     naturally and the layout is exactly what the user sees on screen.
 */

const PDF_FUNCTION_URL = '/.netlify/functions/generate-pdf';

/**
 * Builds a self-contained HTML document around the captured element HTML.
 * Includes Tailwind CDN (with brand color config), Google Fonts, and
 * a small CSS block that handles page breaks and hides no-print elements.
 */
function buildHtmlDocument(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              black: '#212121',
              orange: '#FF3C00',
              grey: '#C6C6C6',
              dark: '#121212',
              light: '#f8fafc'
            }
          },
          fontFamily: {
            sans: ['Montserrat', 'Inter', 'sans-serif'],
            body: ['Inter', 'sans-serif']
          }
        }
      }
    }
  <\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* Reset for PDF rendering */
    html, body {
      background: white !important;
      color: #1e293b;
      margin: 0;
      padding: 0;
      font-family: 'Montserrat', 'Inter', sans-serif;
    }
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* Hide interactive UI elements */
    .no-print, .print-hidden {
      display: none !important;
    }

    /* exec-summary 3-column flex layout */
    .exec-summary-cols {
      display: flex;
      gap: 1.5rem;
    }
    .exec-summary-cols > div {
      flex: 1;
      min-width: 0;
    }

    /* Page breaks — these work in Puppeteer screen-mode PDF generation */
    .print-category-break {
      break-before: page !important;
      page-break-before: always !important;
    }
    .batch-company-start {
      break-before: right !important;
      page-break-before: right !important;
    }

    /* Remove the bottom action bar background that would bleed into PDF */
    .fixed {
      position: static !important;
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Generates and downloads a PDF for the given DOM element.
 *
 * @param elementId  - The `id` attribute of the element to capture
 * @param filename   - Suggested filename (without .pdf extension)
 * @param onProgress - Optional callback fired at key stages: 'capturing' | 'generating' | 'done' | 'error'
 */
export async function downloadPdf(
  elementId: string,
  filename: string,
  onProgress?: (stage: 'capturing' | 'generating' | 'done' | 'error', message?: string) => void
): Promise<void> {
  onProgress?.('capturing');

  const element = document.getElementById(elementId);
  if (!element) {
    onProgress?.('error', `Element #${elementId} not found`);
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  // Capture the element's current rendered HTML
  const bodyContent = element.outerHTML;
  const html = buildHtmlDocument(bodyContent);

  onProgress?.('generating');

  const response = await fetch(PDF_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html, filename }),
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      message = err.message || err.error || message;
    } catch { /* ignore */ }
    onProgress?.('error', message);
    throw new Error(`PDF generation failed: ${message}`);
  }

  // Trigger browser download
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  onProgress?.('done');
}
