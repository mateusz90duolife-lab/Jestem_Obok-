import { cardGeometry } from './geometry.ts';
import { bridgeMark } from './bridgeMark.ts';
import { placeLine, blockBaselines, blockHeight } from './text.ts';
import { autofit } from './autofit.ts';
import { layoutText, round } from '../fonts/measure.ts';
import { color, levelLabel, levelToken, spacing, style } from '../tokens.ts';
import type { CardLayout, LayoutNode, QuestionCard, TextLayoutResult } from '../types.ts';

/**
 * CARD / QUESTION
 *
 *   CONTENT
 *     HEADER  - number, then level. Fixed baselines, left axis.
 *     QUESTION - measured block, optically centred in the space that is left.
 *     FOOTER  - bridge mark left, card number right. Fixed baselines.
 *
 * Header and footer never move. Only the question block is free, and it is
 * centred in the gap between them, so a two-line and a six-line card share the
 * same frame.
 */
export function questionCard(card: QuestionCard): CardLayout {
  const geo = cardGeometry();
  const nodes: LayoutNode[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  const bg = color('ivory100');
  const ink = color('ink');
  const champagne = color('champagne');
  const levelColour = levelToken(card.level).color;

  nodes.push({
    kind: 'rect', role: 'background',
    rect: geo.full, fill: bg, box: geo.full, decorative: true,
  });

  const numberText = String(card.number).padStart(2, '0');
  nodes.push(placeLine({
    role: 'header-number', text: numberText, style: style('number'),
    fill: champagne, x: geo.content.x, baseline: spacing('headerNumberBaselineMm'),
  }));
  nodes.push(placeLine({
    role: 'header-level', text: levelLabel(card.level), style: style('level'),
    fill: levelColour, x: geo.content.x, baseline: spacing('headerLevelBaselineMm'),
  }));

  const blockTop = spacing('questionBlockTopMm');
  const blockBottom = spacing('questionBlockBottomMm');
  const availableHeight = blockBottom - blockTop;

  const fit = autofit({
    text: card.text,
    baseStyle: style('question'),
    preferredMeasureMm: spacing('questionMeasurePreferredMm'),
    maxMeasureMm: spacing('questionMeasureMaxMm'),
    availableHeightMm: availableHeight,
    contentWidthMm: geo.content.width,
  });

  const qStyle = fit.chosen.style;
  const height = blockHeight(fit.chosen.lines.length, qStyle);
  const top = blockTop + (availableHeight - height) / 2;
  const baselines = blockBaselines(top, fit.chosen.lines.length, qStyle);
  for (const [i, line] of fit.chosen.lines.entries()) {
    nodes.push(placeLine({
      role: `question-line-${i + 1}`, text: line, style: qStyle,
      fill: ink, x: geo.content.x, baseline: baselines[i]!,
    }));
  }

  if (!fit.resolved) {
    failures.push(
      `question does not fit after ${fit.outcome.iterations} repair iterations ` +
      `(${fit.chosen.reasons.join('; ')})`,
    );
  }

  const mark = bridgeMark({
    cx: geo.content.x + spacing('footerMarkWidthMm') / 2,
    cy: spacing('footerMarkCenterMm'),
    width: spacing('footerMarkWidthMm'),
    strokeWidth: spacing('footerMarkStrokeMm'),
    stroke: champagne,
  });
  nodes.push(...mark.nodes);

  nodes.push(placeLine({
    role: 'footer-number', text: numberText, style: style('footerNumber'),
    fill: champagne, x: geo.content.x + geo.content.width,
    baseline: spacing('footerNumberBaselineMm'), align: 'end',
  }));

  const textLayouts: TextLayoutResult[] = [
    layoutText(card.text, qStyle, fit.chosen.measureMm, availableHeight, style('question').sizePt),
  ];

  // Quality signals that are valid but worth seeing in the report.
  const share = fit.chosen.maxLineWidth / geo.content.width;
  if (share > 0.9) warnings.push(`question block fills ${(share * 100).toFixed(0)}% of the content width`);
  if (fit.chosen.lines.length >= 6) warnings.push('question occupies the maximum of 6 lines');
  if (qStyle.sizePt <= 14) warnings.push(`question set at the minimum size (${qStyle.sizePt}pt)`);
  if (qStyle.lineHeightPt <= 18) warnings.push(`question set at the minimum leading (${qStyle.lineHeightPt}pt)`);

  const slackTop = round(top - blockTop);
  const slackBottom = round(blockBottom - (top + height));
  if (Math.abs(slackTop - slackBottom) > 0.5) {
    warnings.push(`question block is off centre by ${round(Math.abs(slackTop - slackBottom) / 2)}mm`);
  }

  return {
    cardId: card.id,
    type: 'question',
    level: card.level,
    background: bg,
    nodes,
    textLayouts,
    warnings,
    failures,
    fit: fit.outcome,
  };
}
