import fs from 'node:fs';
import path from 'node:path';
import { dataDir } from '../paths.ts';
import type { BridgeCard, Card, FrontCard, LevelId, QuestionCard, SituationCard } from '../types.ts';

export interface Deck {
  readonly contentVersion: string;
  readonly questions: readonly QuestionCard[];
  readonly situations: readonly SituationCard[];
  readonly bridges: readonly BridgeCard[];
  /** Deck order: Q01..Q60, S01..S12, B01..B05. The back is not part of it. */
  readonly fronts: readonly FrontCard[];
  readonly all: readonly Card[];
}

const LEVELS: readonly LevelId[] = ['01', '02', '03', '04', '05'];

function readJson(file: string): Record<string, unknown> {
  const full = path.join(dataDir, file);
  if (!fs.existsSync(full)) throw new Error(`content file missing: ${path.relative(process.cwd(), full)}`);
  return JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>;
}

function asLevel(value: unknown, where: string): LevelId {
  if (typeof value !== 'string' || !LEVELS.includes(value as LevelId)) {
    throw new Error(`${where}: '${String(value)}' is not a valid level`);
  }
  return value as LevelId;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${where}: expected a non-empty string`);
  }
  return value;
}

function asNumber(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${where}: expected an integer`);
  }
  return value;
}

let cache: Deck | null = null;

/** Load the deck from JSON. Content is data; nothing here knows about layout. */
export function loadDeck(force = false): Deck {
  if (cache && !force) return cache;

  const q = readJson('questions.json');
  const s = readJson('situations.json');
  const b = readJson('bridges.json');

  const questions: QuestionCard[] = (q.questions as unknown[]).map((row, i) => {
    const r = row as Record<string, unknown>;
    const where = `questions.json[${i}]`;
    return {
      type: 'question',
      id: asString(r.id, `${where}.id`),
      number: asNumber(r.number, `${where}.number`),
      level: asLevel(r.level, `${where}.level`),
      text: asString(r.text, `${where}.text`),
    };
  });

  const footer = asString(s.footer, 'situations.json.footer');
  const situations: SituationCard[] = (s.situations as unknown[]).map((row, i) => {
    const r = row as Record<string, unknown>;
    const where = `situations.json[${i}]`;
    const instruction = r.instruction;
    if (!Array.isArray(instruction) || instruction.length === 0) {
      throw new Error(`${where}.instruction: expected a non-empty array`);
    }
    return {
      type: 'situation',
      id: asString(r.id, `${where}.id`),
      number: asNumber(r.number, `${where}.number`),
      title: asString(r.title, `${where}.title`),
      instruction: instruction.map((line, j) => asString(line, `${where}.instruction[${j}]`)),
      footer,
    };
  });

  const bridges: BridgeCard[] = (b.bridges as unknown[]).map((row, i) => {
    const r = row as Record<string, unknown>;
    const where = `bridges.json[${i}]`;
    return {
      type: 'bridge',
      id: asString(r.id, `${where}.id`),
      number: asNumber(r.number, `${where}.number`),
      level: asLevel(r.level, `${where}.level`),
      caption: asString(r.caption, `${where}.caption`),
    };
  });

  const fronts: FrontCard[] = [...questions, ...situations, ...bridges];
  cache = {
    contentVersion: asString(q.contentVersion, 'questions.json.contentVersion'),
    questions, situations, bridges, fronts,
    all: [...fronts, { type: 'back', id: 'BACK' }],
  };
  return cache;
}

/** Level a question number belongs to, derived from its position in the deck. */
export function expectedLevel(questionNumber: number): LevelId {
  const index = Math.floor((questionNumber - 1) / 12);
  const level = LEVELS[index];
  if (!level) throw new Error(`question number ${questionNumber} is outside 1..60`);
  return level;
}

/** ASCII-safe filename stem, e.g. Q25-otworz-sie. */
export function fileStem(card: Card): string {
  switch (card.type) {
    case 'question': return `${card.id}-${slug(levelSlug(card.level))}`;
    case 'situation': return `${card.id}-sytuacja`;
    case 'bridge': return `${card.id}-most`;
    case 'back': return 'back';
  }
}

function levelSlug(level: LevelId): string {
  const names: Record<LevelId, string> = {
    '01': 'poznaj', '02': 'odkryj', '03': 'otworz sie', '04': 'zbliz sie', '05': 'wybierz nas',
  };
  return names[level];
}

/** Transliterate to ASCII and hyphenate. Filenames never carry diacritics. */
export function slug(value: string): string {
  const map: Record<string, string> = {
    ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
    Ą: 'a', Ć: 'c', Ę: 'e', Ł: 'l', Ń: 'n', Ó: 'o', Ś: 's', Ź: 'z', Ż: 'z',
  };
  return value
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
