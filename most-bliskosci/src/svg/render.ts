import { SvgDocument, esc, n } from './builder.ts';
import { cardGeometry } from '../layout/geometry.ts';
import { resolveFonts, getFace } from '../fonts/registry.ts';
import { ptToMm } from '../fonts/measure.ts';
import { loadTokens } from '../tokens.ts';
import type { CardLayout, LayoutNode, TextNode } from '../types.ts';

export interface RenderOptions {
  /** Emit trim/safe-area guides. Debug artefacts only - never production output. */
  readonly debug?: boolean;
}

/**
 * Turn a resolved layout into a self-contained SVG.
 *
 * No external CSS, no remote fonts, no scripts, no raster references: the file
 * carries only vector geometry and text, which is what a prepress RIP wants and
 * what the SVG safety rule requires.
 */
export function renderCard(layout: CardLayout, opts: RenderOptions = {}): string {
  const geo = cardGeometry();
  const tokens = loadTokens();
  const fonts = resolveFonts();
  const doc = new SvgDocument(geo.full.width, geo.full.height, geo.viewBox);

  doc.push(`  <title>MOST BLISKOSCI - ${esc(layout.cardId)}</title>`);
  doc.push(`  <desc>${esc(describe(layout, tokens.designVersion, fonts.status))}</desc>`);
  doc.comment(`trim ${geo.trim.width}x${geo.trim.height}mm at ${geo.trim.x},${geo.trim.y} | safe area ${geo.safe.width}x${geo.safe.height}mm at ${geo.safe.x},${geo.safe.y}`);
  if (fonts.status !== 'EXACT') {
    doc.comment(`FONT SUBSTITUTION IN FORCE: display ${fonts.specFamilies.display} -> ${fonts.renderFamilies.display}; ui ${fonts.specFamilies.ui} -> ${fonts.renderFamilies.ui}`);
  }

  for (const node of layout.nodes) doc.push(emit(node, fonts.renderFamilies));

  if (opts.debug) {
    doc.comment('DEBUG OVERLAY - not present in production output');
    doc.push(`  <g id="debug" fill="none">`);
    doc.push(`    <rect x="${n(geo.trim.x)}" y="${n(geo.trim.y)}" width="${n(geo.trim.width)}" height="${n(geo.trim.height)}" stroke="#00A0FF" stroke-width="0.15" stroke-dasharray="1 1"/>`);
    doc.push(`    <rect x="${n(geo.safe.x)}" y="${n(geo.safe.y)}" width="${n(geo.safe.width)}" height="${n(geo.safe.height)}" stroke="#12B886" stroke-width="0.15" stroke-dasharray="0.6 0.6"/>`);
    for (const node of layout.nodes) {
      if (node.decorative) continue;
      const b = node.box;
      doc.push(`    <rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.width)}" height="${n(b.height)}" stroke="#E8590C" stroke-width="0.08"/>`);
      if (node.kind === 'text') {
        doc.push(`    <line x1="${n(node.x)}" y1="${n(node.baseline)}" x2="${n(node.x + node.width)}" y2="${n(node.baseline)}" stroke="#F03E3E" stroke-width="0.06"/>`);
      }
    }
    doc.push(`  </g>`);
  }

  return doc.toString();
}

function describe(layout: CardLayout, designVersion: string, fontStatus: string): string {
  const parts = [`type=${layout.type}`, `id=${layout.cardId}`];
  if (layout.level) parts.push(`level=${layout.level}`);
  parts.push(`design=${designVersion}`, `fonts=${fontStatus}`);
  return parts.join(' ');
}

function emit(node: LayoutNode, families: Record<string, string>): string {
  switch (node.kind) {
    case 'rect': {
      const r = node.rect;
      const rx = node.rx !== undefined ? ` rx="${n(node.rx)}"` : '';
      return `  <rect id="${esc(node.role)}" x="${n(r.x)}" y="${n(r.y)}" width="${n(r.width)}" height="${n(r.height)}"${rx} fill="${node.fill}"/>`;
    }
    case 'path':
      return `  <path id="${esc(node.role)}" d="${node.d}" fill="none" stroke="${node.stroke}" stroke-width="${n(node.strokeWidth)}" stroke-linecap="round"/>`;
    case 'text':
      return emitText(node, families);
  }
}

function emitText(node: TextNode, families: Record<string, string>): string {
  // Emit the weight that actually exists in the resolved face. Emitting the
  // specified weight would invite the renderer to synthesise or round to a
  // different face than the one we measured against.
  const face = getFace(node.style.family, node.style.weight, node.style.italic === true);
  const sizeMm = ptToMm(node.style.sizePt);
  const trackMm = node.style.trackingEm * sizeMm;
  const family = families[node.style.family] ?? node.style.family;
  const attrs = [
    `id="${esc(node.role)}"`,
    `x="${n(node.x)}"`,
    `y="${n(node.baseline)}"`,
    `font-family="${esc(family)}"`,
    `font-size="${n(sizeMm)}"`,
    `font-weight="${face.renderWeight}"`,
  ];
  if (node.style.italic) attrs.push('font-style="italic"');
  if (Math.abs(trackMm) > 1e-6) attrs.push(`letter-spacing="${n(trackMm)}"`);
  attrs.push(`fill="${node.fill}"`);
  return `  <text ${attrs.join(' ')}>${esc(node.text)}</text>`;
}
