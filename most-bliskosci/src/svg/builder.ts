/** Deterministic, self-contained SVG emission. No external refs, no scripts. */

export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fixed-precision numbers so identical input yields byte-identical output. */
export function n(value: number, dp = 3): string {
  const v = Math.round(value * 10 ** dp) / 10 ** dp;
  return Object.is(v, -0) ? '0' : String(v);
}

export class SvgDocument {
  private readonly parts: string[] = [];
  private readonly width: number;
  private readonly height: number;
  private readonly viewBox: string;

  constructor(widthMm: number, heightMm: number, viewBox: string) {
    this.width = widthMm;
    this.height = heightMm;
    this.viewBox = viewBox;
  }

  push(markup: string): void {
    this.parts.push(markup);
  }

  comment(text: string): void {
    this.parts.push(`  <!-- ${text.replace(/--/g, '- -')} -->`);
  }

  toString(): string {
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" version="1.1"`,
      `     width="${n(this.width)}mm" height="${n(this.height)}mm"`,
      `     viewBox="${this.viewBox}">`,
      ...this.parts,
      '</svg>',
      '',
    ].join('\n');
  }
}
