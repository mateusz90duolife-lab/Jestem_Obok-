import fs from 'node:fs';
import { cardGeometry, contains } from '../layout/geometry.ts';
import { loadTokens } from '../tokens.ts';
import { round } from '../fonts/measure.ts';
import type { CardLayout, Issue, Rect } from '../types.ts';

/**
 * Safe-area checks inflate every ink box by this margin, so the check errs
 * towards rejecting rather than accepting.
 *
 * `node scripts/calibrate.ts` measures the engine against the renderer on this
 * font set and reports a worst-case disagreement of 0.025mm, so 0.3mm is about
 * twelve times the observed error - conservative without being slack. The
 * calibration test asserts the margin still covers the measured delta.
 */
export const MEASUREMENT_TOLERANCE_MM = 0.3;

const FORBIDDEN = [
  { pattern: /<script\b/i, what: 'a <script> element' },
  { pattern: /<image\b/i, what: 'a raster <image> element' },
  { pattern: /xlink:href\s*=/i, what: 'an xlink:href reference' },
  { pattern: /@import\b/i, what: 'a CSS @import' },
  { pattern: /url\(\s*['"]?https?:/i, what: 'a remote url() reference' },
  { pattern: /\bhttps?:\/\/(?!www\.w3\.org)/i, what: 'a remote URL' },
  { pattern: /<foreignObject\b/i, what: 'a <foreignObject> element' },
];

export interface SvgQaResult {
  readonly cardId: string;
  readonly issues: readonly Issue[];
  readonly safeAreaViolations: readonly string[];
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly viewBox: string | null;
}

/** Structural, geometric and safety checks on one generated SVG. */
export function checkSvg(cardId: string, svg: string, layout: CardLayout): SvgQaResult {
  const issues: Issue[] = [];
  const geo = cardGeometry();
  const t = loadTokens().geometry;

  const widthMatch = /\bwidth="([\d.]+)mm"/.exec(svg);
  const heightMatch = /\bheight="([\d.]+)mm"/.exec(svg);
  const viewBoxMatch = /\bviewBox="([^"]+)"/.exec(svg);
  const widthMm = widthMatch ? Number(widthMatch[1]) : null;
  const heightMm = heightMatch ? Number(heightMatch[1]) : null;
  const viewBox = viewBoxMatch ? viewBoxMatch[1]! : null;

  if (widthMm !== t.full.width) issues.push(fail(cardId, `SVG width is ${widthMm ?? 'absent'}mm, expected ${t.full.width}mm`));
  if (heightMm !== t.full.height) issues.push(fail(cardId, `SVG height is ${heightMm ?? 'absent'}mm, expected ${t.full.height}mm`));
  const expectedViewBox = `0 0 ${t.full.width} ${t.full.height}`;
  if (viewBox !== expectedViewBox) issues.push(fail(cardId, `viewBox is '${viewBox ?? 'absent'}', expected '${expectedViewBox}'`));

  for (const rule of FORBIDDEN) {
    if (rule.pattern.test(svg)) issues.push(fail(cardId, `SVG contains ${rule.what}; production SVG must be self-contained`));
  }
  if (!svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    issues.push(fail(cardId, 'SVG is missing its XML declaration'));
  }
  if (/id="debug"/.test(svg)) {
    issues.push(fail(cardId, 'SVG carries a debug overlay; debug output must never reach production'));
  }

  // Safe-area containment. Full-bleed backgrounds are semantically exempt.
  const safeAreaViolations: string[] = [];
  for (const node of layout.nodes) {
    if (node.decorative) continue;
    const inflated = inflate(node.box, MEASUREMENT_TOLERANCE_MM);
    if (!contains(geo.safe, inflated)) {
      safeAreaViolations.push(
        `${node.role} at ${describe(node.box)} crosses the safe area ${describe(geo.safe)}`,
      );
    }
    if (!contains(geo.trim, inflated)) {
      safeAreaViolations.push(`${node.role} at ${describe(node.box)} crosses the trim box`);
    }
  }
  for (const v of safeAreaViolations) issues.push(fail(cardId, v));

  for (const layoutResult of layout.textLayouts) {
    if (layoutResult.overflow) {
      issues.push(fail(cardId, `text overflow: ${layoutResult.lineCount} lines, widest ${layoutResult.maxLineWidth}mm in ${layoutResult.availableWidth}mm`));
    }
  }
  for (const f of layout.failures) issues.push(fail(cardId, f));

  return { cardId, issues, safeAreaViolations, widthMm, heightMm, viewBox };
}

export function checkSvgFile(cardId: string, file: string, layout: CardLayout): SvgQaResult {
  return checkSvg(cardId, fs.readFileSync(file, 'utf8'), layout);
}

function inflate(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, width: r.width + by * 2, height: r.height + by * 2 };
}

function describe(r: Rect): string {
  return `${round(r.x, 2)},${round(r.y, 2)} ${round(r.width, 2)}x${round(r.height, 2)}mm`;
}

function fail(cardId: string, message: string): Issue {
  return { severity: 'FAIL', stage: 'svg', cardId, message };
}
