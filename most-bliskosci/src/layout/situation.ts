import { cardGeometry } from './geometry.ts';
import { bridgeMark } from './bridgeMark.ts';
import { placeLine, blockBaselines, blockHeight } from './text.ts';
import { wrapText, layoutText } from '../fonts/measure.ts';
import { color, spacing, style } from '../tokens.ts';
import type { CardLayout, LayoutNode, SituationCard, TextLayoutResult } from '../types.ts';

/**
 * CARD / SITUATION
 *
 * Deliberately the inverse of a question card: dark ground, champagne accents,
 * a display-set title and an instruction in two short lines. The header keeps
 * the question card's number-then-label rhythm so the deck still reads as one
 * system, while the footer mirrors it (text left, mark right) instead of
 * repeating it.
 */
export function situationCard(card: SituationCard): CardLayout {
  const geo = cardGeometry();
  const nodes: LayoutNode[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];
  const textLayouts: TextLayoutResult[] = [];

  const bg = color('wineDark');
  const fg = color('ivory100');
  const accent = color('champagne');

  nodes.push({ kind: 'rect', role: 'background', rect: geo.full, fill: bg, box: geo.full, decorative: true });

  const numberText = String(card.number).padStart(2, '0');
  nodes.push(placeLine({
    role: 'header-number', text: numberText, style: style('number'),
    fill: accent, x: geo.content.x, baseline: spacing('headerNumberBaselineMm'),
  }));
  nodes.push(placeLine({
    role: 'header-label', text: 'SYTUACJA', style: style('situationLabel'),
    fill: accent, x: geo.content.x, baseline: spacing('headerLevelBaselineMm'),
  }));

  const titleStyle = style('situationTitle');
  const instrStyle = style('instruction');
  const measure = spacing('questionMeasureMaxMm');
  const gapMm = 7;

  const title = wrapText(card.title, measure, titleStyle);
  if (title.hardOverflow || title.maxLineWidth > measure + 1e-6) {
    failures.push(`situation title overflows the ${measure}mm column`);
  }
  const instructionLines: string[] = [];
  for (const para of card.instruction) {
    const w = wrapText(para, measure, instrStyle);
    if (w.hardOverflow) failures.push(`instruction line overflows the ${measure}mm column: ${para}`);
    instructionLines.push(...w.lines);
  }

  const blockTop = spacing('questionBlockTopMm');
  const blockBottom = spacing('questionBlockBottomMm');
  const available = blockBottom - blockTop;
  const total = blockHeight(title.lines.length, titleStyle) + gapMm + blockHeight(instructionLines.length, instrStyle);
  if (total > available + 1e-6) failures.push('situation body does not fit between header and footer');
  const top = blockTop + (available - total) / 2;

  const titleBaselines = blockBaselines(top, title.lines.length, titleStyle);
  for (const [i, line] of title.lines.entries()) {
    nodes.push(placeLine({
      role: `situation-title-${i + 1}`, text: line, style: titleStyle,
      fill: fg, x: geo.content.x, baseline: titleBaselines[i]!,
    }));
  }

  const instrTop = top + blockHeight(title.lines.length, titleStyle) + gapMm;
  const instrBaselines = blockBaselines(instrTop, instructionLines.length, instrStyle);
  for (const [i, line] of instructionLines.entries()) {
    nodes.push(placeLine({
      role: `situation-instruction-${i + 1}`, text: line, style: instrStyle,
      fill: fg, x: geo.content.x, baseline: instrBaselines[i]!,
    }));
  }

  nodes.push(placeLine({
    role: 'footer-label', text: card.footer, style: style('situationLabel'),
    fill: accent, x: geo.content.x, baseline: spacing('footerNumberBaselineMm'),
  }));

  const markWidth = spacing('footerMarkWidthMm');
  nodes.push(...bridgeMark({
    cx: geo.content.x + geo.content.width - markWidth / 2,
    cy: spacing('footerMarkCenterMm'),
    width: markWidth,
    strokeWidth: spacing('footerMarkStrokeMm'),
    stroke: accent,
  }).nodes);

  textLayouts.push(layoutText(card.title, titleStyle, measure, available, titleStyle.sizePt));
  textLayouts.push(layoutText(card.instruction.join(' '), instrStyle, measure, available, instrStyle.sizePt));

  if (title.lines.length > 3) warnings.push(`situation title runs to ${title.lines.length} lines`);
  if (instructionLines.length > 4) warnings.push(`instruction runs to ${instructionLines.length} lines`);

  return { cardId: card.id, type: 'situation', background: bg, nodes, textLayouts, warnings, failures };
}
