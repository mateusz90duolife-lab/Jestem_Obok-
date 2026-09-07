import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { renderAll, svgPage, mmToPx, findBrowser, RendererUnavailableError, DPI } from '../render/chromium.ts';
import { readPngInfo } from '../qa/png.ts';
import { loadTokens } from '../tokens.ts';
import { pngFrontDir, pngBackDir, type GeneratedCard } from './generate.ts';
import type { Issue } from '../types.ts';

export interface RasteriseResult {
  readonly status: 'PASS' | 'BLOCKED' | 'FAIL';
  readonly rendered: number;
  readonly expectedWidthPx: number;
  readonly expectedHeightPx: number;
  readonly dpi: number;
  readonly issues: readonly Issue[];
  readonly pngSha256: ReadonlyMap<string, string>;
  readonly blockedReason?: string;
}

/**
 * Rasterise every generated SVG at 300 DPI.
 *
 * The page behind the artboard is painted in the card's own background colour:
 * the SVG edge otherwise anti-aliases against white, and a blended outer pixel
 * row would show up in pixel QA as ink crossing the trim.
 */
export async function rasterise(
  cards: readonly GeneratedCard[],
  onProgress?: (done: number, total: number) => void,
): Promise<RasteriseResult> {
  const t = loadTokens().geometry;
  const widthPx = mmToPx(t.full.width);
  const heightPx = mmToPx(t.full.height);
  const issues: Issue[] = [];

  if (!findBrowser()) {
    return {
      status: 'BLOCKED', rendered: 0, expectedWidthPx: widthPx, expectedHeightPx: heightPx,
      dpi: DPI, pngSha256: new Map(),
      blockedReason: 'no Chromium binary found; set CHROMIUM_PATH to enable PNG rendering',
      issues: [{ severity: 'ERROR', stage: 'png', message: 'PNG rendering BLOCKED: no renderer available' }],
    };
  }

  fs.mkdirSync(pngFrontDir(), { recursive: true });
  fs.mkdirSync(pngBackDir(), { recursive: true });

  const jobs = cards.map((c) => ({
    html: svgPage(c.svg, widthPx, heightPx, c.layout.background),
    widthPx, heightPx, outPath: c.pngPath,
  }));

  try {
    await renderAll(jobs, undefined, onProgress);
  } catch (err) {
    if (err instanceof RendererUnavailableError) {
      return {
        status: 'BLOCKED', rendered: 0, expectedWidthPx: widthPx, expectedHeightPx: heightPx,
        dpi: DPI, pngSha256: new Map(), blockedReason: err.message,
        issues: [{ severity: 'ERROR', stage: 'png', message: `PNG rendering BLOCKED: ${err.message}` }],
      };
    }
    throw err;
  }

  const pngSha256 = new Map<string, string>();
  let rendered = 0;
  for (const c of cards) {
    if (!fs.existsSync(c.pngPath)) {
      issues.push({ severity: 'FAIL', stage: 'png', cardId: c.card.id, message: 'PNG was not produced' });
      continue;
    }
    const size = fs.statSync(c.pngPath).size;
    if (size === 0) {
      issues.push({ severity: 'FAIL', stage: 'png', cardId: c.card.id, message: 'PNG is zero bytes' });
      continue;
    }
    const info = readPngInfo(c.pngPath);
    if (info.width !== widthPx || info.height !== heightPx) {
      issues.push({
        severity: 'FAIL', stage: 'png', cardId: c.card.id,
        message: `PNG is ${info.width}x${info.height}px, expected ${widthPx}x${heightPx}px`,
      });
      continue;
    }
    pngSha256.set(c.card.id, createHash('sha256').update(fs.readFileSync(c.pngPath)).digest('hex'));
    rendered++;
  }

  return {
    status: issues.length === 0 ? 'PASS' : 'FAIL',
    rendered, expectedWidthPx: widthPx, expectedHeightPx: heightPx, dpi: DPI, issues, pngSha256,
  };
}
