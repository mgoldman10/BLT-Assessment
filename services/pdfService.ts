/**
 * pdfService.ts
 *
 * Client-side PDF generation using html2canvas + jsPDF.
 * Captures the DOM element as rendered on screen (full layout, correct colors),
 * splits it across Letter-size pages, and triggers a download.
 *
 * Why client-side instead of Puppeteer:
 *   - Netlify's container environment is missing system libraries required by Chromium
 *   - html2canvas renders at full screen width — layout matches exactly what the user sees
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Letter size in points (72pt = 1 inch)
const PAGE_WIDTH_PT = 612;   // 8.5in
const PAGE_HEIGHT_PT = 792;  // 11in
const MARGIN_PT = 36;        // 0.5in

const CONTENT_WIDTH_PT = PAGE_WIDTH_PT - MARGIN_PT * 2;
const CONTENT_HEIGHT_PT = PAGE_HEIGHT_PT - MARGIN_PT * 2;

/**
 * Generates and downloads a PDF for the given DOM element.
 *
 * @param elementId - The `id` attribute of the element to capture
 * @param filename  - Suggested filename (without .pdf extension)
 */
export async function downloadPdf(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Element #${elementId} not found in DOM`);
  }

  // Capture the element at its current rendered size (full screen width)
  const canvas = await html2canvas(element, {
    scale: 2,                  // 2x for retina-quality sharpness
    useCORS: true,             // allow cross-origin images (logo, fonts)
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    // Capture the full scrollable height
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgWidth = canvas.width;
  const imgHeight = canvas.height;

  // Scale factor: fit content width to page content area
  const scale = CONTENT_WIDTH_PT / imgWidth;
  const scaledPageHeightPx = CONTENT_HEIGHT_PT / scale;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  let yOffset = 0;
  let pageIndex = 0;

  while (yOffset < imgHeight) {
    if (pageIndex > 0) pdf.addPage();

    // Slice just this page's portion from the canvas
    const sliceHeight = Math.min(scaledPageHeightPx, imgHeight - yOffset);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = imgWidth;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext('2d')!;
    ctx.drawImage(canvas, 0, yOffset, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);

    const imgData = pageCanvas.toDataURL('image/jpeg', 0.95);
    const renderedHeight = sliceHeight * scale;

    pdf.addImage(imgData, 'JPEG', MARGIN_PT, MARGIN_PT, CONTENT_WIDTH_PT, renderedHeight);

    yOffset += sliceHeight;
    pageIndex++;
  }

  pdf.save(`${filename}.pdf`);
}
