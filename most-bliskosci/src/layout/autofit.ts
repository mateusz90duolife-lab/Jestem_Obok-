import { wrapText, round } from '../fonts/measure.ts';
import { loadTokens } from '../tokens.ts';
import { blockHeight } from './text.ts';
import type { FitOutcome, TextStyle } from '../types.ts';

export interface FitInput {
  readonly text: string;
  readonly baseStyle: TextStyle;
  readonly preferredMeasureMm: number;
  readonly maxMeasureMm: number;
  readonly availableHeightMm: number;
  readonly contentWidthMm: number;
}

export interface FitCandidate {
  readonly stage: number;
  readonly strategy: string;
  readonly style: TextStyle;
  readonly measureMm: number;
  readonly lines: readonly string[];
  readonly widths: readonly number[];
  readonly maxLineWidth: number;
  readonly blockHeightMm: number;
  readonly valid: boolean;
  readonly reasons: readonly string[];
  readonly score: number;
}

export interface FitResult {
  readonly chosen: FitCandidate;
  readonly outcome: FitOutcome;
  readonly attempts: readonly FitCandidate[];
  readonly resolved: boolean;
}

/**
 * Ordered repair strategies.
 *
 * Priority follows the spec: fit first, then keep the type size as large as
 * possible, then the leading, then the editorial measure. Widening the measure
 * comes before touching leading or size because it costs the least hierarchy.
 * At most ten stages are ever tried, and the list is fixed, so the search is
 * deterministic.
 */
function stages(input: FitInput): Array<{ strategy: string; measureMm: number; sizePt: number; lineHeightPt: number }> {
  const t = loadTokens().autofit;
  const p = input.preferredMeasureMm;
  const m = input.maxMeasureMm;
  const mid1 = round(p + (m - p) / 3, 2);
  const mid2 = round(p + (2 * (m - p)) / 3, 2);
  void mid1; void mid2;
  const size = t.preferredFontSizePt;
  const lh = t.preferredLineHeightPt;
  const minLh = t.minimumLineHeightPt;
  const midLh = round((lh + minLh) / 2, 2);
  const minSize = t.minimumFontSizePt;
  const midSize = round((size + minSize) / 2, 2);
  return [
    { strategy: 'preferred',            measureMm: p,    sizePt: size,     lineHeightPt: lh },
    { strategy: 'widen-measure-1',      measureMm: round(p + (m - p) / 3, 2), sizePt: size, lineHeightPt: lh },
    { strategy: 'widen-measure-2',      measureMm: round(p + (2 * (m - p)) / 3, 2), sizePt: size, lineHeightPt: lh },
    { strategy: 'widen-measure-max',    measureMm: m,    sizePt: size,     lineHeightPt: lh },
    { strategy: 'tighten-leading-1',    measureMm: m,    sizePt: size,     lineHeightPt: midLh },
    { strategy: 'tighten-leading-min',  measureMm: m,    sizePt: size,     lineHeightPt: minLh },
    { strategy: 'reduce-size-1',        measureMm: p,    sizePt: midSize,  lineHeightPt: lh },
    { strategy: 'reduce-size-1-wide',   measureMm: m,    sizePt: midSize,  lineHeightPt: midLh },
    { strategy: 'reduce-size-min',      measureMm: p,    sizePt: minSize,  lineHeightPt: midLh },
    { strategy: 'reduce-size-min-wide', measureMm: m,    sizePt: minSize,  lineHeightPt: minLh },
  ];
}

/** Target share of the content column the question block should occupy. */
const MEASURE_TARGET_LO = 0.75;
const MEASURE_TARGET_HI = 0.80;

/**
 * Weights. Type size dominates, so a stage that shrinks the text can never beat
 * one that does not. Below that, an even rag matters more than sitting exactly
 * on the preferred measure - a stranded two-syllable first line is the defect a
 * reader actually sees.
 */
const W_FONT = 40;
const W_LEADING = 15;
const W_MEASURE = 10;
const W_WHITESPACE = 13;
const W_BALANCE = 22;

export function scoreCandidate(c: Omit<FitCandidate, 'score'>, input: FitInput): number {
  if (!c.valid) return 0;
  const t = loadTokens().autofit;
  const fontScore = (c.style.sizePt - t.minimumFontSizePt) / Math.max(1e-9, t.preferredFontSizePt - t.minimumFontSizePt);
  const leadScore = (c.style.lineHeightPt - t.minimumLineHeightPt) / Math.max(1e-9, t.preferredLineHeightPt - t.minimumLineHeightPt);
  const measurePenalty = (c.measureMm - input.preferredMeasureMm) / Math.max(1e-9, input.maxMeasureMm - input.preferredMeasureMm);
  const measureScore = 1 - clamp01(measurePenalty);

  // Whitespace: how close the widest line sits to the 75-80% editorial target.
  const share = c.maxLineWidth / input.contentWidthMm;
  const whitespaceScore = share >= MEASURE_TARGET_LO && share <= MEASURE_TARGET_HI
    ? 1
    : 1 - clamp01(Math.min(Math.abs(share - MEASURE_TARGET_LO), Math.abs(share - MEASURE_TARGET_HI)) / 0.25);

  // Balance: how even the rag is across all but the last line, minus a penalty
  // for any line stranded far below the widest one. The first line is weighted
  // hardest because a short opening line is the most visible break failure.
  const body = c.widths.length > 1 ? c.widths.slice(0, -1) : c.widths;
  const mean = body.reduce((a, b) => a + b, 0) / Math.max(1, body.length);
  const variance = body.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, body.length);
  const evenness = 1 - clamp01(Math.sqrt(variance) / Math.max(1e-9, c.measureMm * 0.5));

  const widest = Math.max(...c.widths, 1e-9);
  let strandPenalty = 0;
  for (const [i, w] of body.entries()) {
    const share = w / widest;
    if (share < SHORT_LINE_SHARE) {
      strandPenalty += (SHORT_LINE_SHARE - share) * (i === 0 ? 1.6 : 1);
    }
  }
  const balanceScore = clamp01(evenness - strandPenalty);

  return round(
    W_FONT * fontScore + W_LEADING * leadScore + W_MEASURE * measureScore +
    W_WHITESPACE * whitespaceScore + W_BALANCE * balanceScore,
    2,
  );
}

/** A line narrower than this share of the widest line reads as stranded. */
const SHORT_LINE_SHARE = 0.5;

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Fit a question into its column.
 *
 * Every stage in the fixed ten-stage list is evaluated, then the highest-scoring
 * valid one wins, ties broken by the earlier stage. Because type size dominates
 * the score, a stage that shrinks the text can never beat one that does not; the
 * scoring only decides between equally-sized options, where an even rag should
 * win over sitting exactly on the preferred measure. The search is bounded and
 * deterministic: same input, same ten candidates, same winner.
 */
export function autofit(input: FitInput): FitResult {
  const t = loadTokens().autofit;
  const attempts: FitCandidate[] = [];

  for (const [i, stage] of stages(input).entries()) {
    const style: TextStyle = { ...input.baseStyle, sizePt: stage.sizePt, lineHeightPt: stage.lineHeightPt };
    const wrapped = wrapText(input.text, stage.measureMm, style);
    const h = blockHeight(wrapped.lines.length, style);
    const reasons: string[] = [];
    if (wrapped.lines.length > t.maximumLines) reasons.push(`${wrapped.lines.length} lines exceeds maximum ${t.maximumLines}`);
    if (wrapped.hardOverflow) reasons.push('an unbreakable token is wider than the column');
    if (wrapped.maxLineWidth > stage.measureMm + 1e-6) reasons.push('horizontal overflow');
    if (h > input.availableHeightMm + 1e-6) reasons.push('vertical overflow');
    if (wrapped.missingGlyphs.length) reasons.push(`missing glyphs: ${wrapped.missingGlyphs.join(' ')}`);

    const partial = {
      stage: i + 1,
      strategy: stage.strategy,
      style,
      measureMm: stage.measureMm,
      lines: wrapped.lines,
      widths: wrapped.widths,
      maxLineWidth: round(wrapped.maxLineWidth),
      blockHeightMm: round(h),
      valid: reasons.length === 0,
      reasons,
    };
    attempts.push({ ...partial, score: scoreCandidate(partial, input) });
  }

  let chosen: FitCandidate | null = null;
  for (const c of attempts) {
    if (!c.valid) continue;
    if (!chosen || c.score > chosen.score) chosen = c;
  }

  const final = chosen ?? attempts[attempts.length - 1]!;
  return {
    chosen: final,
    resolved: chosen !== null,
    attempts,
    outcome: {
      fontSize: final.style.sizePt,
      lineHeight: final.style.lineHeightPt,
      measureMm: final.measureMm,
      lineCount: final.lines.length,
      iterations: attempts.length,
      strategy: final.strategy,
      score: final.score,
      resolved: chosen !== null,
    },
  };
}
