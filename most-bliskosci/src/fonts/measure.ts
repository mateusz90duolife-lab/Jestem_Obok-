import { getFace, type ResolvedFace } from './registry.ts';
import type { TextStyle, TextLayoutResult } from '../types.ts';

/** 1pt = 25.4/72 mm. All layout maths is done in millimetres. */
export const PT_TO_MM = 25.4 / 72;

export function ptToMm(pt: number): number {
  return pt * PT_TO_MM;
}

export interface Measurement {
  /** Advance width in mm, including tracking after every character (CSS letter-spacing semantics). */
  readonly width: number;
  /** Advance width in mm excluding the trailing tracking - the true ink measure. */
  readonly inkWidth: number;
  readonly ascent: number;
  readonly descent: number;
  readonly missingGlyphs: readonly string[];
}

function faceFor(style: TextStyle): ResolvedFace {
  return getFace(style.family, style.weight, style.italic === true);
}

/**
 * Measure a single line using real font metrics: hmtx advances plus pair
 * kerning from `kern`/GPOS. Never estimates from character counts.
 */
export function measureText(text: string, style: TextStyle): Measurement {
  const face = faceFor(style);
  const { cmap, advances } = face.font;
  const upm = face.font.metrics.unitsPerEm;
  const chars = [...text];
  const missing: string[] = [];

  let units = 0;
  let prevGid = -1;
  for (const ch of chars) {
    const cp = ch.codePointAt(0)!;
    const gid = cmap.get(cp);
    if (gid === undefined) {
      if (!missing.includes(ch)) missing.push(ch);
      prevGid = -1;
      continue;
    }
    if (prevGid >= 0) units += face.kerning.get((prevGid << 16) | gid) ?? 0;
    units += advances[gid] ?? 0;
    prevGid = gid;
  }

  const emMm = ptToMm(style.sizePt);
  const base = (units / upm) * emMm;
  const trackMm = style.trackingEm * emMm;
  return {
    width: base + trackMm * chars.length,
    inkWidth: base + trackMm * Math.max(0, chars.length - 1),
    ascent: (face.font.metrics.ascender / upm) * emMm,
    descent: (-face.font.metrics.descender / upm) * emMm,
    missingGlyphs: missing,
  };
}

/** Polish typography: these one-letter words must never end a line. */
const POLISH_ORPHANS = new Set(['a', 'i', 'o', 'u', 'w', 'z', 'A', 'I', 'O', 'U', 'W', 'Z']);

export interface WrapResult {
  readonly lines: readonly string[];
  readonly widths: readonly number[];
  readonly maxLineWidth: number;
  /** True when a single unbreakable token is wider than the column. */
  readonly hardOverflow: boolean;
  readonly missingGlyphs: readonly string[];
}

/**
 * Greedy word wrap against a measured column width.
 *
 * A single-letter Polish preposition or conjunction is never left at the end of
 * a line; it is carried down with the word that follows it. A token wider than
 * the column is kept whole on its own line and flagged as a hard overflow -
 * text is never clipped, broken mid-word, or hidden.
 */
export function wrapText(text: string, maxWidthMm: number, style: TextStyle): WrapResult {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  const missing = new Set<string>();
  if (words.length === 0) {
    return { lines: [], widths: [], maxLineWidth: 0, hardOverflow: false, missingGlyphs: [] };
  }

  const cache = new Map<string, number>();
  const measure = (s: string): number => {
    const hit = cache.get(s);
    if (hit !== undefined) return hit;
    const m = measureText(s, style);
    for (const g of m.missingGlyphs) missing.add(g);
    cache.set(s, m.inkWidth);
    return m.inkWidth;
  };
  /** Width of words[i..j) joined by single spaces. */
  const spanWidth = (i: number, j: number): number => measure(words.slice(i, j).join(' '));

  /** A break after words[j-1] must not strand a one-letter Polish word. */
  const breakAllowed = (j: number): boolean =>
    j >= words.length || !POLISH_ORPHANS.has(words[j - 1]!);

  // Pass 1: greedy, to establish the minimum achievable line count.
  const greedy: number[] = [0];
  let cursor = 0;
  while (cursor < words.length) {
    let j = cursor + 1;
    let best = -1;
    let lastFitting = cursor + 1;
    while (j <= words.length) {
      const w = spanWidth(cursor, j);
      if (w > maxWidthMm + 1e-9 && j > cursor + 1) break;
      lastFitting = j;
      if (breakAllowed(j)) best = j;
      j++;
    }
    const cut = best > 0 ? best : lastFitting;
    greedy.push(cut);
    cursor = cut;
  }
  const targetLines = greedy.length - 1;

  // Pass 2: with the line count fixed, choose the breaks that minimise
  // raggedness (sum of squared slack on every line but the last).
  const INF = Number.POSITIVE_INFINITY;
  const cost: number[][] = [];
  const from: number[][] = [];
  for (let l = 0; l <= targetLines; l++) {
    cost.push(new Array<number>(words.length + 1).fill(INF));
    from.push(new Array<number>(words.length + 1).fill(-1));
  }
  cost[0]![0] = 0;
  for (let l = 1; l <= targetLines; l++) {
    for (let j = 1; j <= words.length; j++) {
      if (!breakAllowed(j)) continue;
      for (let i = l - 1; i < j; i++) {
        const prev = cost[l - 1]![i]!;
        if (prev === INF) continue;
        const w = spanWidth(i, j);
        if (w > maxWidthMm + 1e-9) break;
        const slack = j === words.length ? 0 : (maxWidthMm - w) ** 2;
        const total = prev + slack;
        if (total < cost[l]![j]!) { cost[l]![j] = total; from[l]![j] = i; }
      }
    }
  }

  let breaks: number[];
  if (cost[targetLines]![words.length]! < INF) {
    breaks = [words.length];
    let l = targetLines;
    let j = words.length;
    while (l > 0) { const i = from[l]![j]!; breaks.unshift(i); j = i; l--; }
  } else {
    breaks = greedy; // unbreakable token present; keep the greedy shape
  }

  const lines: string[] = [];
  const widths: number[] = [];
  let hardOverflow = false;
  for (let k = 0; k < breaks.length - 1; k++) {
    const line = words.slice(breaks[k]!, breaks[k + 1]!).join(' ');
    const w = measure(line);
    if (w > maxWidthMm + 1e-9) hardOverflow = true;
    lines.push(line);
    widths.push(w);
  }

  return {
    lines,
    widths,
    maxLineWidth: widths.length ? Math.max(...widths) : 0,
    hardOverflow,
    missingGlyphs: [...missing],
  };
}

/** Number of lines a string needs in a given column. */
export function calculateLines(text: string, maxWidthMm: number, style: TextStyle): number {
  return wrapText(text, maxWidthMm, style).lines.length;
}

/** Total block height for a line count at a given leading. */
export function calculateHeight(lineCount: number, lineHeightPt: number): number {
  return lineCount <= 0 ? 0 : (lineCount - 1) * ptToMm(lineHeightPt) + ptToMm(lineHeightPt);
}

export interface BoundingBox {
  readonly width: number;
  readonly height: number;
  readonly lineCount: number;
}

export function calculateBoundingBox(text: string, maxWidthMm: number, style: TextStyle): BoundingBox {
  const wrapped = wrapText(text, maxWidthMm, style);
  return {
    width: wrapped.maxLineWidth,
    height: calculateHeight(wrapped.lines.length, style.lineHeightPt),
    lineCount: wrapped.lines.length,
  };
}

/** Build the full TextLayoutResult contract for a wrapped block. */
export function layoutText(
  text: string,
  style: TextStyle,
  availableWidth: number,
  availableHeight: number,
  referenceFontSize: number,
): TextLayoutResult {
  const wrapped = wrapText(text, availableWidth, style);
  const totalHeight = calculateHeight(wrapped.lines.length, style.lineHeightPt);
  const overflowX = wrapped.maxLineWidth > availableWidth + 1e-6;
  const overflowY = totalHeight > availableHeight + 1e-6;
  return {
    lines: wrapped.lines,
    lineCount: wrapped.lines.length,
    maxLineWidth: round(wrapped.maxLineWidth),
    totalHeight: round(totalHeight),
    availableWidth: round(availableWidth),
    availableHeight: round(availableHeight),
    overflowX,
    overflowY,
    overflow: overflowX || overflowY,
    fontSize: style.sizePt,
    lineHeight: style.lineHeightPt,
    scaleFactor: round(style.sizePt / referenceFontSize),
    remainingWidth: round(availableWidth - wrapped.maxLineWidth),
    remainingHeight: round(availableHeight - totalHeight),
  };
}

export function round(n: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
