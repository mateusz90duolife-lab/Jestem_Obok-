import { loadDeck, expectedLevel, type Deck } from './load.ts';
import { levelToken } from '../tokens.ts';
import type { Issue, LevelId } from '../types.ts';

const PLACEHOLDER = /\b(TODO|TBD|FIXME|lorem ipsum|placeholder)\b|\{\{[^}]*\}\}|<[a-z_]+>/i;

export interface ContentReport {
  readonly ok: boolean;
  readonly counts: { questions: number; situations: number; bridges: number; total: number };
  readonly issues: readonly Issue[];
  readonly exactDuplicates: readonly string[][];
  readonly nearDuplicates: ReadonlyArray<{ a: string; b: string; similarity: number }>;
}

/** Normalised form used only for duplicate detection. Originals are untouched. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’“”„]/g, '')
    .replace(/[.,;:!?()–—-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token-level Jaccard similarity. Cheap, stable, and good enough to flag echoes. */
export function similarity(a: string, b: string): number {
  const sa = new Set(normalise(a).split(' '));
  const sb = new Set(normalise(b).split(' '));
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const t of sa) if (sb.has(t)) shared++;
  return shared / (sa.size + sb.size - shared);
}

const NEAR_DUPLICATE_THRESHOLD = 0.62;

export function validateContent(deck: Deck = loadDeck()): ContentReport {
  const issues: Issue[] = [];
  const fail = (message: string, cardId?: string): void => {
    issues.push({ severity: 'FAIL', stage: 'content', cardId, message });
  };
  const warn = (message: string, cardId?: string): void => {
    issues.push({ severity: 'WARNING', stage: 'content', cardId, message });
  };

  if (deck.questions.length !== 60) fail(`expected 60 questions, found ${deck.questions.length}`);
  if (deck.situations.length !== 12) fail(`expected 12 situations, found ${deck.situations.length}`);
  if (deck.bridges.length !== 5) fail(`expected 5 bridges, found ${deck.bridges.length}`);
  if (deck.fronts.length !== 77) fail(`expected 77 front cards, found ${deck.fronts.length}`);

  // Identifiers: unique, correctly formed, sequential, no gaps.
  const seen = new Set<string>();
  for (const card of deck.all) {
    if (seen.has(card.id)) fail(`duplicate card id ${card.id}`, card.id);
    seen.add(card.id);
  }
  checkSequence(deck.questions.map((q) => q.id), 'Q', 60, fail);
  checkSequence(deck.situations.map((s) => s.id), 'S', 12, fail);
  checkSequence(deck.bridges.map((b) => b.id), 'B', 5, fail);

  for (const q of deck.questions) {
    if (q.id !== `Q${String(q.number).padStart(2, '0')}`) fail(`id ${q.id} does not match number ${q.number}`, q.id);
    const expected = expectedLevel(q.number);
    if (q.level !== expected) fail(`${q.id} is level ${q.level} but its position implies ${expected}`, q.id);
  }

  // Level tokens must resolve, and bridges must cover every level once.
  const bridgeLevels = new Set<LevelId>();
  for (const b of deck.bridges) {
    levelToken(b.level);
    if (bridgeLevels.has(b.level)) fail(`two bridges share level ${b.level}`, b.id);
    bridgeLevels.add(b.level);
  }
  for (const level of ['01', '02', '03', '04', '05'] as LevelId[]) {
    if (!bridgeLevels.has(level)) fail(`no bridge card for level ${level}`);
  }

  // Text hygiene.
  const texts: Array<{ id: string; text: string }> = [
    ...deck.questions.map((q) => ({ id: q.id, text: q.text })),
    ...deck.situations.map((s) => ({ id: s.id, text: `${s.title} ${s.instruction.join(' ')}` })),
    ...deck.bridges.map((b) => ({ id: b.id, text: b.caption })),
  ];
  for (const { id, text } of texts) {
    if (PLACEHOLDER.test(text)) fail(`placeholder text detected: ${text}`, id);
    if (/\s\s/.test(text)) warn('contains a double space', id);
    if (text !== text.trim()) warn('has leading or trailing whitespace', id);
  }
  for (const q of deck.questions) {
    const words = q.text.trim().split(/\s+/).length;
    if (words > 20) warn(`question runs to ${words} words`, q.id);
    if (words < 4) warn(`question is only ${words} words`, q.id);
    if (!q.text.includes('?')) warn('question has no question mark', q.id);
  }

  // Duplicates.
  const byNormalised = new Map<string, string[]>();
  for (const q of deck.questions) {
    const key = normalise(q.text);
    const list = byNormalised.get(key);
    if (list) list.push(q.id); else byNormalised.set(key, [q.id]);
  }
  const exactDuplicates: string[][] = [];
  for (const [, ids] of byNormalised) {
    if (ids.length > 1) {
      exactDuplicates.push(ids);
      fail(`questions are exact duplicates after normalisation: ${ids.join(', ')}`, ids[0]);
    }
  }

  const nearDuplicates: Array<{ a: string; b: string; similarity: number }> = [];
  for (let i = 0; i < deck.questions.length; i++) {
    for (let j = i + 1; j < deck.questions.length; j++) {
      const a = deck.questions[i]!;
      const b = deck.questions[j]!;
      const sim = similarity(a.text, b.text);
      if (sim >= NEAR_DUPLICATE_THRESHOLD && sim < 1) {
        nearDuplicates.push({ a: a.id, b: b.id, similarity: Math.round(sim * 100) / 100 });
        warn(`near-duplicate of ${b.id} (similarity ${sim.toFixed(2)})`, a.id);
      }
    }
  }

  return {
    ok: !issues.some((i) => i.severity === 'FAIL'),
    counts: {
      questions: deck.questions.length,
      situations: deck.situations.length,
      bridges: deck.bridges.length,
      total: deck.fronts.length,
    },
    issues, exactDuplicates, nearDuplicates,
  };
}

function checkSequence(
  ids: readonly string[],
  prefix: string,
  expectedCount: number,
  fail: (message: string, cardId?: string) => void,
): void {
  const numbers = ids.map((id) => Number(id.slice(1)));
  for (let i = 1; i <= expectedCount; i++) {
    if (!numbers.includes(i)) fail(`missing ${prefix}${String(i).padStart(2, '0')}`);
  }
  for (const [i, num] of numbers.entries()) {
    if (num !== i + 1) { fail(`${prefix} ids are not sequential at position ${i + 1} (found ${ids[i]})`); break; }
  }
}
