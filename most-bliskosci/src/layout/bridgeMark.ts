import { bridgeToken } from '../tokens.ts';
import type { PathNode, Rect } from '../types.ts';

export interface BridgeMarkOptions {
  /** Centre of the mark, millimetres. */
  readonly cx: number;
  readonly cy: number;
  readonly width?: number;
  readonly rise?: number;
  readonly gap?: number;
  readonly stroke: string;
  readonly strokeWidth?: number;
  readonly role?: string;
}

export interface BridgeMark {
  readonly nodes: readonly PathNode[];
  readonly box: Rect;
  readonly width: number;
  readonly rise: number;
  readonly gap: number;
}

/**
 * The brand mark: two hairlines that run in from either side, ease upward and
 * stop short of each other, leaving a gap on the centre line.
 *
 * It is a span with a keystone gap, not a picture of a bridge. Every parameter
 * scales, so one function serves the footer hairline and the large bridge-card
 * statement without redrawing anything.
 */
export function bridgeMark(opts: BridgeMarkOptions): BridgeMark {
  const width = opts.width ?? bridgeToken('defaultWidthMm');
  // Rise and gap scale with the span, so the footer hairline and the
  // bridge-card statement are the same shape at two sizes, not two shapes.
  const rise = opts.rise ?? width * bridgeToken('riseRatio');
  const gap = opts.gap ?? width * bridgeToken('gapRatio');
  const strokeWidth = opts.strokeWidth ?? bridgeToken('strokeWidthMm');
  const shoulderRatio = bridgeToken('shoulderRatio');
  const deckRatio = bridgeToken('deckRatio');
  const role = opts.role ?? 'bridge-mark';

  const { cx, cy } = opts;
  const halfW = width / 2;
  const halfGap = gap / 2;
  // One half runs: approach (flat, low) -> shoulder (eased rise) -> deck (flat, high).
  const halfSpan = halfW - halfGap;
  const deck = deckRatio * halfSpan;
  const shoulder = shoulderRatio * halfSpan;

  const build = (sign: 1 | -1): string => {
    const outerX = cx + sign * halfW;
    const innerX = cx + sign * halfGap;
    const deckStart = innerX + sign * deck;
    const kneeX = deckStart + sign * shoulder;
    const c1x = kneeX - sign * shoulder * 0.5;
    const c2x = deckStart + sign * shoulder * 0.5;
    const topY = cy - rise;
    return [
      `M ${f(outerX)} ${f(cy)}`,
      `L ${f(kneeX)} ${f(cy)}`,
      `C ${f(c1x)} ${f(cy)} ${f(c2x)} ${f(topY)} ${f(deckStart)} ${f(topY)}`,
      `L ${f(innerX)} ${f(topY)}`,
    ].join(' ');
  };

  const box: Rect = {
    x: cx - halfW - strokeWidth / 2,
    y: cy - rise - strokeWidth / 2,
    width: width + strokeWidth,
    height: rise + strokeWidth,
  };

  const mk = (d: string, suffix: string): PathNode => ({
    kind: 'path', role: `${role}-${suffix}`, d,
    stroke: opts.stroke, strokeWidth, box,
  });

  return {
    nodes: [mk(build(-1), 'left'), mk(build(1), 'right')],
    box, width, rise, gap,
  };
}

/** Fixed 3-dp formatting keeps generated paths byte-identical between runs. */
function f(n: number): string {
  const v = Math.round(n * 1000) / 1000;
  return Object.is(v, -0) ? '0' : String(v);
}
