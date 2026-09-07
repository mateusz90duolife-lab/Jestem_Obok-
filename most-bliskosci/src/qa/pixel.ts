import { decodePng, hexToRgb, type PngImage } from './png.ts';
import { cardGeometry } from '../layout/geometry.ts';
import { mmToPx } from '../render/chromium.ts';
import type { Issue } from '../types.ts';

/**
 * Pixel-level QA on the rendered card.
 *
 * The engine predicts where ink will land; this measures where it actually did.
 * Ink is any pixel far enough from the card's declared background colour, so a
 * full-bleed background is not mistaken for content - only marks on top of it
 * count.
 */

/** Squared euclidean RGB distance above which a pixel counts as ink. */
const INK_THRESHOLD = 26;
/** Anti-aliasing may spill a pixel or two past a glyph edge. */
const EDGE_TOLERANCE_PX = 3;

export interface PixelQaResult {
  readonly cardId: string;
  readonly available: true;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly inkBox: { x: number; y: number; width: number; height: number } | null;
  readonly inkPixels: number;
  /** Share of the safe area covered by ink. */
  readonly density: number;
  readonly violations: readonly string[];
  readonly issues: readonly Issue[];
}

export interface PixelQaUnavailable {
  readonly cardId: string;
  readonly available: false;
  readonly reason: string;
}

export function pixelQa(cardId: string, pngPath: string, backgroundHex: string): PixelQaResult {
  const img = decodePng(pngPath);
  const [br, bg, bb] = hexToRgb(backgroundHex);
  const geo = cardGeometry();

  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  let inkPixels = 0;

  for (let y = 0; y < img.height; y++) {
    const rowBase = y * img.width * 4;
    for (let x = 0; x < img.width; x++) {
      const o = rowBase + x * 4;
      const dr = img.pixels[o]! - br;
      const dg = img.pixels[o + 1]! - bg;
      const db = img.pixels[o + 2]! - bb;
      if (dr * dr + dg * dg + db * db <= INK_THRESHOLD * INK_THRESHOLD) continue;
      inkPixels++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  const safe = {
    x: mmToPx(geo.safe.x),
    y: mmToPx(geo.safe.y),
    right: mmToPx(geo.safe.x + geo.safe.width),
    bottom: mmToPx(geo.safe.y + geo.safe.height),
  };
  const violations: string[] = [];
  const inkBox = maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };

  if (inkBox) {
    if (minX < safe.x - EDGE_TOLERANCE_PX) violations.push(`ink reaches x=${minX}px, safe area starts at ${safe.x}px`);
    if (minY < safe.y - EDGE_TOLERANCE_PX) violations.push(`ink reaches y=${minY}px, safe area starts at ${safe.y}px`);
    if (maxX > safe.right + EDGE_TOLERANCE_PX) violations.push(`ink reaches x=${maxX}px, safe area ends at ${safe.right}px`);
    if (maxY > safe.bottom + EDGE_TOLERANCE_PX) violations.push(`ink reaches y=${maxY}px, safe area ends at ${safe.bottom}px`);
  } else {
    violations.push('no ink found on the card');
  }

  const safeArea = (safe.right - safe.x) * (safe.bottom - safe.y);
  return {
    cardId,
    available: true,
    widthPx: img.width,
    heightPx: img.height,
    inkBox,
    inkPixels,
    density: Math.round((inkPixels / safeArea) * 10000) / 10000,
    violations,
    issues: violations.map((message) => ({ severity: 'FAIL' as const, stage: 'pixel', cardId, message })),
  };
}

/** Ink bounding box only, used by the extremes picker and debug overlays. */
export function inkBounds(img: PngImage, backgroundHex: string): { x: number; y: number; width: number; height: number } | null {
  const [br, bg, bb] = hexToRgb(backgroundHex);
  let minX = img.width, minY = img.height, maxX = -1, maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const o = (y * img.width + x) * 4;
      const dr = img.pixels[o]! - br, dg = img.pixels[o + 1]! - bg, db = img.pixels[o + 2]! - bb;
      if (dr * dr + dg * dg + db * db <= INK_THRESHOLD * INK_THRESHOLD) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
