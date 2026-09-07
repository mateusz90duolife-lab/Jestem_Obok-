import { cardGeometry } from './geometry.ts';
import { bridgeMark } from './bridgeMark.ts';
import { placeLine, blockBaselines, blockHeight } from './text.ts';
import { wrapText, layoutText } from '../fonts/measure.ts';
import { color, levelLabel, levelToken, spacing, style } from '../tokens.ts';
import type { BridgeCard, CardLayout, LayoutNode, TextLayoutResult } from '../types.ts';

/**
 * CARD / BRIDGE
 *
 * The chapter divider. Centred, almost empty, and the one place the brand mark
 * is allowed to be the largest thing on the card - still a hairline, just at
 * full span.
 */
export function bridgeCard(card: BridgeCard): CardLayout {
  const geo = cardGeometry();
  const nodes: LayoutNode[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const textLayouts: TextLayoutResult[] = [];

  const bg = color('ivory100');
  const ink = color('ink');
  const accent = color('champagne');
  const centreX = geo.full.width / 2;

  nodes.push({ kind: 'rect', role: 'background', rect: geo.full, fill: bg, box: geo.full, decorative: true });

  const mark = bridgeMark({
    cx: centreX,
    cy: spacing('bridgeMarkCenterMm'),
    width: spacing('bridgeMarkWidthMm'),
    strokeWidth: spacing('bridgeMarkStrokeMm'),
    stroke: accent,
  });
  nodes.push(...mark.nodes);

  const titleStyle = style('bridgeTitle');
  const titleText = `MOST ${String(card.number).padStart(2, '0')}`;
  nodes.push(placeLine({
    role: 'bridge-title', text: titleText, style: titleStyle,
    fill: ink, x: centreX, baseline: spacing('bridgeTitleBaselineMm'), align: 'center',
  }));

  nodes.push(placeLine({
    role: 'bridge-level', text: levelLabel(card.level), style: style('bridgeLevel'),
    fill: levelToken(card.level).color, x: centreX,
    baseline: spacing('bridgeLevelBaselineMm'), align: 'center',
  }));

  const capStyle = style('bridgeCaption');
  const measure = spacing('bridgeCaptionMeasureMm');
  const caption = wrapText(card.caption, measure, capStyle);
  if (caption.hardOverflow) failures.push(`bridge caption overflows the ${measure}mm column`);
  if (caption.lines.length > 2) warnings.push(`bridge caption runs to ${caption.lines.length} lines`);
  const capTop = spacing('bridgeCaptionTopMm');
  const capBaselines = blockBaselines(capTop, caption.lines.length, capStyle);
  for (const [i, line] of caption.lines.entries()) {
    nodes.push(placeLine({
      role: `bridge-caption-${i + 1}`, text: line, style: capStyle,
      fill: ink, x: centreX, baseline: capBaselines[i]!, align: 'center',
    }));
  }

  textLayouts.push(layoutText(card.caption, capStyle, measure, blockHeight(2, capStyle), capStyle.sizePt));

  return { cardId: card.id, type: 'bridge', level: card.level, background: bg, nodes, textLayouts, warnings, failures };
}
