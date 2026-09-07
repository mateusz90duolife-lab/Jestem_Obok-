import { cardGeometry } from './geometry.ts';
import { bridgeMark } from './bridgeMark.ts';
import { placeLine } from './text.ts';
import { color, spacing, style } from '../tokens.ts';
import type { CardLayout, LayoutNode } from '../types.ts';

/**
 * CARD / BACK
 *
 * One back for the whole deck. It takes no arguments, so it cannot leak a level
 * or a card number by construction.
 */
export function backCard(): CardLayout {
  const geo = cardGeometry();
  const nodes: LayoutNode[] = [];
  const bg = color('wineDark');
  const fg = color('ivory100');
  const accent = color('champagne');
  const centreX = geo.full.width / 2;

  nodes.push({ kind: 'rect', role: 'background', rect: geo.full, fill: bg, box: geo.full, decorative: true });

  nodes.push(placeLine({
    role: 'logo-primary', text: 'MOST', style: style('brandPrimary'),
    fill: fg, x: centreX, baseline: spacing('backLogoPrimaryBaselineMm'), align: 'center',
  }));
  nodes.push(placeLine({
    role: 'logo-secondary', text: 'BLISKOŚCI', style: style('brandSecondary'),
    fill: fg, x: centreX, baseline: spacing('backLogoSecondaryBaselineMm'), align: 'center',
  }));

  nodes.push(...bridgeMark({
    cx: centreX,
    cy: spacing('backMarkCenterMm'),
    width: spacing('backMarkWidthMm'),
    strokeWidth: spacing('backMarkStrokeMm'),
    stroke: accent,
  }).nodes);

  return {
    cardId: 'BACK', type: 'back', background: bg, nodes,
    textLayouts: [], warnings: [], failures: [],
  };
}
