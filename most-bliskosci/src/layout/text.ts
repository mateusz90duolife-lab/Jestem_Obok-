import { measureText, ptToMm } from '../fonts/measure.ts';
import type { TextNode, TextStyle } from '../types.ts';

export type Align = 'start' | 'center' | 'end';

export interface PlaceOptions {
  readonly role: string;
  readonly text: string;
  readonly style: TextStyle;
  readonly fill: string;
  /** Reference x. Meaning depends on `align`. */
  readonly x: number;
  readonly baseline: number;
  readonly align?: Align;
  readonly decorative?: boolean;
}

/**
 * Place one line of text.
 *
 * Every run is emitted with text-anchor="start" and an x we compute ourselves.
 * Relying on the renderer to centre tracked text would shift it by half the
 * trailing letter-space, so centring is done here against the measured ink
 * width instead - which also makes the geometric QA exact.
 */
export function placeLine(opts: PlaceOptions): TextNode {
  const m = measureText(opts.text, opts.style);
  const align = opts.align ?? 'start';
  const x = align === 'start' ? opts.x
    : align === 'center' ? opts.x - m.inkWidth / 2
      : opts.x - m.inkWidth;
  return {
    kind: 'text',
    role: opts.role,
    x,
    baseline: opts.baseline,
    text: opts.text,
    style: opts.style,
    fill: opts.fill,
    width: m.inkWidth,
    box: {
      x,
      y: opts.baseline - m.ascent,
      width: m.inkWidth,
      height: m.ascent + m.descent,
    },
    decorative: opts.decorative,
  };
}

/**
 * Baselines for a block of lines set on a given leading, using half-leading so
 * the block is optically centred inside its line boxes.
 */
export function blockBaselines(topMm: number, lineCount: number, style: TextStyle): number[] {
  const lineBox = ptToMm(style.lineHeightPt);
  const probe = measureText('Hxp', style);
  const contentHeight = probe.ascent + probe.descent;
  const halfLeading = (lineBox - contentHeight) / 2;
  const first = topMm + halfLeading + probe.ascent;
  return Array.from({ length: lineCount }, (_, i) => first + i * lineBox);
}

/** Height of a block of `lineCount` lines at this style's leading. */
export function blockHeight(lineCount: number, style: TextStyle): number {
  return lineCount * ptToMm(style.lineHeightPt);
}
