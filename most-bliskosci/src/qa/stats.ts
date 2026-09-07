import { loadDeck } from '../content/load.ts';
import { cardGeometry } from '../layout/geometry.ts';
import { round } from '../fonts/measure.ts';
import type { CardDiagnostics, LevelId } from '../types.ts';

export interface ContentStats {
  readonly totals: { questions: number; situations: number; bridges: number; cards: number };
  readonly words: Distribution;
  readonly characters: Distribution;
  readonly byLevel: Record<LevelId, { count: number; averageWords: number; averageCharacters: number }>;
  readonly shortestQuestion: { id: string; characters: number; text: string };
  readonly longestQuestion: { id: string; characters: number; text: string };
}

export interface Distribution {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
}

function distribution(values: readonly number[]): Distribution {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean: round(values.reduce((a, b) => a + b, 0) / Math.max(1, values.length), 2),
    median: sorted.length === 0 ? 0
      : sorted.length % 2 ? sorted[mid]! : round((sorted[mid - 1]! + sorted[mid]!) / 2, 2),
  };
}

export function contentStats(): ContentStats {
  const deck = loadDeck();
  const words = deck.questions.map((q) => q.text.trim().split(/\s+/).length);
  const chars = deck.questions.map((q) => q.text.length);

  const byLevel = {} as ContentStats['byLevel'];
  for (const level of ['01', '02', '03', '04', '05'] as LevelId[]) {
    const group = deck.questions.filter((q) => q.level === level);
    byLevel[level] = {
      count: group.length,
      averageWords: round(group.reduce((a, q) => a + q.text.trim().split(/\s+/).length, 0) / Math.max(1, group.length), 2),
      averageCharacters: round(group.reduce((a, q) => a + q.text.length, 0) / Math.max(1, group.length), 2),
    };
  }

  const sortedByLength = [...deck.questions].sort((a, b) => a.text.length - b.text.length);
  const shortest = sortedByLength[0]!;
  const longest = sortedByLength[sortedByLength.length - 1]!;

  return {
    totals: {
      questions: deck.questions.length,
      situations: deck.situations.length,
      bridges: deck.bridges.length,
      cards: deck.fronts.length,
    },
    words: distribution(words),
    characters: distribution(chars),
    byLevel,
    shortestQuestion: { id: shortest.id, characters: shortest.text.length, text: shortest.text },
    longestQuestion: { id: longest.id, characters: longest.text.length, text: longest.text },
  };
}

export interface DesignStats {
  readonly fontSizeDistribution: Record<string, number>;
  readonly lineCountDistribution: Record<string, number>;
  readonly lineHeightDistribution: Record<string, number>;
  readonly fitStrategyDistribution: Record<string, number>;
  readonly questionBlockWidthMm: Distribution;
  readonly questionBlockHeightMm: Distribution;
  readonly safeAreaUtilisation: Distribution;
  readonly inkDensity: Distribution;
  readonly measurementTolerance: { note: string };
}

export function designStats(diagnostics: readonly CardDiagnostics[]): DesignStats {
  const geo = cardGeometry();
  const questions = diagnostics.filter((d) => d.type === 'question');
  const count = (values: readonly (string | number)[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const v of values) out[String(v)] = (out[String(v)] ?? 0) + 1;
    return out;
  };

  const widths = questions.flatMap((d) => d.textLayouts.map((t) => t.maxLineWidth));
  const heights = questions.flatMap((d) => d.textLayouts.map((t) => t.totalHeight));
  const utilisation = questions.flatMap((d) => d.textLayouts.map((t) => round(t.maxLineWidth / geo.content.width, 4)));
  const densities = diagnostics.map((d) => d.density).filter((d): d is number => typeof d === 'number');

  return {
    fontSizeDistribution: count(questions.map((d) => d.fit?.fontSize ?? 0)),
    lineCountDistribution: count(questions.map((d) => d.fit?.lineCount ?? 0)),
    lineHeightDistribution: count(questions.map((d) => d.fit?.lineHeight ?? 0)),
    fitStrategyDistribution: count(questions.map((d) => d.fit?.strategy ?? 'none')),
    questionBlockWidthMm: distribution(widths),
    questionBlockHeightMm: distribution(heights),
    safeAreaUtilisation: distribution(utilisation),
    inkDensity: distribution(densities),
    measurementTolerance: {
      note: 'Layout is measured from font metrics; rendered ink is measured from the PNG. See scripts/calibrate.ts for the agreement between the two.',
    },
  };
}

/** Golden cards plus edge cases chosen from the measurements, not by hand. */
export function pickExtremes(diagnostics: readonly CardDiagnostics[]): Array<{ label: string; cardId: string }> {
  const deck = loadDeck();
  const questions = diagnostics.filter((d) => d.type === 'question' && d.fit);
  if (questions.length === 0) return [];

  const byText = new Map(deck.questions.map((q) => [q.id, q.text] as const));
  // A category is only reported when it actually discriminates: if every card
  // scores the same (all at 16pt, say) naming a "smallest" card would be noise.
  const best = (label: string, score: (d: CardDiagnostics) => number): { label: string; cardId: string } | null => {
    let winner = questions[0]!;
    let lowest = score(winner);
    for (const d of questions) {
      const s = score(d);
      if (s > score(winner)) winner = d;
      if (s < lowest) lowest = s;
    }
    if (score(winner) === lowest) return null;
    return { label, cardId: winner.cardId };
  };

  const picks = ([
    best('najkrotsze pytanie', (d) => -(byText.get(d.cardId)?.length ?? 0)),
    best('najdluzsze pytanie', (d) => byText.get(d.cardId)?.length ?? 0),
    best('najwiecej wierszy', (d) => d.fit?.lineCount ?? 0),
    best('najszerszy wiersz', (d) => d.textLayouts[0]?.maxLineWidth ?? 0),
    best('najwyzsza gestosc', (d) => d.density ?? 0),
    best('najnizsza gestosc', (d) => -(d.density ?? 0)),
    best('najmniejszy stopien pisma', (d) => -(d.fit?.fontSize ?? 0)),
    best('najmniejszy margines do safe area', (d) => -(d.textLayouts[0]?.remainingWidth ?? 0)),
  ] as Array<{ label: string; cardId: string } | null>)
    .filter((p): p is { label: string; cardId: string } => p !== null);

  // Keep the first label for any card that wins more than one category.
  const seen = new Set<string>();
  return picks.filter((p) => (seen.has(p.cardId) ? false : (seen.add(p.cardId), true)));
}

export const GOLDEN_CARDS = ['Q01', 'Q13', 'Q25', 'Q37', 'Q49', 'S01', 'B01', 'BACK'] as const;
