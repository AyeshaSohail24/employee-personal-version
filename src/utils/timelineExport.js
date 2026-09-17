import { toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { getTodayLocalDateString } from './dateUtils.js';

/**
 * Timeline export — PDF/PNG generation for Personnel -> Timeline. Operates entirely client-side
 * (no external screenshot/conversion service is ever contacted — see task's explicit security/
 * privacy requirement) on a dedicated, off-screen "export template" DOM node (see
 * TimelineExportView.jsx) that the caller has already mounted and passed in via `node`. This
 * module never queries employeeService/departmentService itself and never re-derives the
 * Timeline's filtered personnel or date domain — it only rasterizes whatever DOM node it is
 * given, so it can never drift from what HR is currently viewing.
 */

const REPORT_BACKGROUND = '#FFFFFF';
// A higher pixelRatio than 1 keeps exported text crisp on modern (Retina/4K) displays without
// going so high that a long Timeline (many rows -> a very tall canvas) risks exceeding a
// browser's max-canvas-area limit or ballooning memory use. 2x is the standard "high-resolution
// but safe" choice used by most DOM-export tooling.
const EXPORT_PIXEL_RATIO = 2;

function buildFilename(extension) {
  return `rizurf-personnel-timeline-${getTodayLocalDateString()}.${extension}`;
}

function triggerDownload(href, filename) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Rasterizes the given export-template node at high resolution. Deliberately does NOT pass an
 * explicit width/height — html-to-image defaults to the node's own clientWidth/clientHeight,
 * which (since the export template has no internal `overflow: auto` scroll region, unlike the
 * on-screen Timeline) equals its FULL natural content size, capturing every row regardless of
 * how many are currently scrolled out of view on screen. This is what satisfies "export the
 * entire chart, not just the viewport."
 */
async function captureNode(node) {
  return toCanvas(node, {
    pixelRatio: EXPORT_PIXEL_RATIO,
    backgroundColor: REPORT_BACKGROUND,
    cacheBust: true,
    // The export template's own CSS already ends its font stack in safe system fonts (see
    // .timeline-export-root in index.css), so exact web-font embedding is unnecessary — and
    // html-to-image cannot read the app's cross-origin Google Fonts stylesheet's CSS rules
    // (a browser CORS restriction, not a bug in this code), which would otherwise log a
    // SecurityError to the console on every export. skipFonts avoids that attempt entirely.
    skipFonts: true,
  });
}

export async function exportTimelineAsPng(node) {
  const canvas = await captureNode(node);
  const dataUrl = canvas.toDataURL('image/png');
  triggerDownload(dataUrl, buildFilename('png'));
}

/**
 * Builds a landscape, multi-page-if-needed PDF from the export template. Slices the ONE captured
 * canvas at real row boundaries (never mid-row) so a person's Timeline entry is never split
 * across two pages — row boundaries are measured from the live export-template DOM (each
 * `.timeline-export-row`'s own offsetTop/offsetHeight), then scaled into the captured canvas's
 * pixel space (which may be at a different pixelRatio than 1) before slicing.
 */
export async function exportTimelineAsPdf(node) {
  const canvas = await captureNode(node);
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const canvasToNodeScale = canvasWidth / node.clientWidth;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 24;
  const contentWidthPt = pageWidth - margin * 2;
  const contentHeightPt = pageHeight - margin * 2;

  // Row boundaries (in export-template CSS pixels, then converted to captured-canvas pixels) —
  // used both to choose safe page-break points AND to find the true bottom of real content.
  // `.timeline-export-root` has its own bottom padding below the last row, which is NOT real
  // content — slicing all the way to the raw canvasHeight would turn that trailing whitespace
  // into its own blank page, so every page is bounded by contentBottomPx instead.
  const rowEls = Array.from(node.querySelectorAll('.timeline-export-row'));
  const rowBoundariesPx = rowEls.map((el) => (el.offsetTop + el.offsetHeight) * canvasToNodeScale);
  const contentBottomPx = rowBoundariesPx.length > 0 ? rowBoundariesPx[rowBoundariesPx.length - 1] : canvasHeight;

  // How many full canvas-pixel-rows fit within one PDF page's content height, at the scale that
  // makes the canvas exactly `contentWidthPt` wide.
  const ptPerCanvasPx = contentWidthPt / canvasWidth;
  const pageBudgetPx = contentHeightPt / ptPerCanvasPx;

  let sliceStartPx = 0;
  let isFirstPage = true;

  while (sliceStartPx < contentBottomPx) {
    const idealEndPx = Math.min(contentBottomPx, sliceStartPx + pageBudgetPx);

    // Prefer ending exactly at a row boundary at/just before the ideal cutoff, so no row is ever
    // split across two pages — but never produce an empty/zero-height page if a single row is
    // taller than one whole page budget (falls back to the raw ideal cutoff in that edge case).
    let sliceEndPx = idealEndPx;
    const fittingBoundary = rowBoundariesPx.filter((b) => b > sliceStartPx && b <= idealEndPx).pop();
    if (fittingBoundary) sliceEndPx = fittingBoundary;

    const sliceHeightPx = sliceEndPx - sliceStartPx;
    if (sliceHeightPx <= 0) break;

    const sliceCanvas = document.createElement('canvas');
    sliceCanvas.width = canvasWidth;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext('2d');
    ctx.fillStyle = REPORT_BACKGROUND;
    ctx.fillRect(0, 0, canvasWidth, sliceHeightPx);
    ctx.drawImage(canvas, 0, sliceStartPx, canvasWidth, sliceHeightPx, 0, 0, canvasWidth, sliceHeightPx);

    // JPEG (high quality, not PNG) for the PDF's embedded page images specifically — a
    // lossless PNG of a full-resolution report-sized raster produced a needlessly huge PDF
    // (tens of MB), unsuitable for "saving/sharing internally" (task's own requirement). At
    // quality 0.92 the text/bar edges stay crisp while the file size drops by roughly an order
    // of magnitude. The standalone PNG export (exportTimelineAsPng) is unaffected — it still
    // saves a true lossless PNG.
    const sliceDataUrl = sliceCanvas.toDataURL('image/jpeg', 0.92);
    const sliceHeightPt = sliceHeightPx * ptPerCanvasPx;

    if (!isFirstPage) doc.addPage();
    doc.addImage(sliceDataUrl, 'JPEG', margin, margin, contentWidthPt, sliceHeightPt);

    isFirstPage = false;
    sliceStartPx = sliceEndPx;
  }

  doc.save(buildFilename('pdf'));
}
