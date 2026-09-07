import { loadTokens } from '../tokens.ts';
import type { Rect } from '../types.ts';

export interface CardGeometry {
  /** Full artboard including bleed. */
  readonly full: Rect;
  /** Trim box - the finished card. */
  readonly trim: Rect;
  /** Safe area; no critical content may cross it. */
  readonly safe: Rect;
  /** Content box - the padded column the layout actually uses. */
  readonly content: Rect;
  readonly bleedMm: number;
  readonly cornerRadiusMm: number;
  readonly viewBox: string;
}

export function cardGeometry(): CardGeometry {
  const t = loadTokens();
  const g = t.geometry;
  const bleed = g.bleedMm;
  const full: Rect = { x: 0, y: 0, width: g.full.width, height: g.full.height };
  const trim: Rect = { x: bleed, y: bleed, width: g.trim.width, height: g.trim.height };
  const inset = g.safeInsetFromTrimMm;
  const safe: Rect = {
    x: trim.x + inset,
    y: trim.y + inset,
    width: trim.width - inset * 2,
    height: trim.height - inset * 2,
  };
  const px = t.spacing.cardPaddingXMm!;
  const pt = t.spacing.cardPaddingTopMm!;
  const pb = t.spacing.cardPaddingBottomMm!;
  const content: Rect = {
    x: trim.x + px,
    y: trim.y + pt,
    width: trim.width - px * 2,
    height: trim.height - pt - pb,
  };
  return {
    full, trim, safe, content,
    bleedMm: bleed,
    cornerRadiusMm: g.cornerRadiusMm,
    viewBox: `0 0 ${g.full.width} ${g.full.height}`,
  };
}

export function contains(outer: Rect, inner: Rect, toleranceMm = 0): boolean {
  return (
    inner.x >= outer.x - toleranceMm &&
    inner.y >= outer.y - toleranceMm &&
    inner.x + inner.width <= outer.x + outer.width + toleranceMm &&
    inner.y + inner.height <= outer.y + outer.height + toleranceMm
  );
}

/** 12-column grid helper. The grid informs positions; it is never drawn. */
export function column(index: number, span = 1): { x: number; width: number } {
  const t = loadTokens();
  const geo = cardGeometry();
  const cols = t.geometry.grid.columns;
  const gutter = t.geometry.grid.gutterMm;
  const colWidth = (geo.content.width - gutter * (cols - 1)) / cols;
  return {
    x: geo.content.x + index * (colWidth + gutter),
    width: span * colWidth + (span - 1) * gutter,
  };
}

/** Snap a millimetre value onto the baseline grid. */
export function snapBaseline(mm: number): number {
  const step = loadTokens().geometry.grid.baselineMm;
  return Math.round(mm / step) * step;
}
