/**
 * Regenerate the visual regression baseline.
 *
 * Run this ONLY when a change to tokens, layout or content is intended, and
 * read the diff it prints before committing: it is the record of what the change
 * did to the deck.
 *
 *   node scripts/update-baseline.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadDeck } from '../src/content/load.ts';
import { layoutCard } from '../src/layout/index.ts';
import { renderCard } from '../src/svg/render.ts';
import { loadTokens } from '../src/tokens.ts';
import { resolveFonts } from '../src/fonts/registry.ts';
import { projectRoot } from '../src/paths.ts';

export const BASELINE_FILE = path.join(projectRoot, 'test', 'snapshots', 'baseline.json');

export interface Baseline {
  designVersion: string;
  contentVersion: string;
  fontStatus: string;
  fontFiles: Record<string, string>;
  cards: Record<string, string>;
}

export function computeBaseline(): Baseline {
  const deck = loadDeck();
  const fonts = resolveFonts();
  const cards: Record<string, string> = {};
  for (const card of deck.all) {
    cards[card.id] = createHash('sha256').update(renderCard(layoutCard(card))).digest('hex');
  }
  const fontFiles: Record<string, string> = {};
  for (const [key, face] of fonts.faces) fontFiles[key] = face.sha256;
  return {
    designVersion: loadTokens().designVersion,
    contentVersion: deck.contentVersion,
    fontStatus: fonts.status,
    fontFiles,
    cards,
  };
}

export function readBaseline(): Baseline | null {
  if (!fs.existsSync(BASELINE_FILE)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) as Baseline;
}

if (import.meta.filename === process.argv[1]) {
  const next = computeBaseline();
  const prev = readBaseline();
  if (prev) {
    const changed = Object.keys(next.cards).filter((id) => prev.cards[id] !== next.cards[id]);
    const added = Object.keys(next.cards).filter((id) => !(id in prev.cards));
    const removed = Object.keys(prev.cards).filter((id) => !(id in next.cards));
    process.stdout.write(`changed: ${changed.length} / ${Object.keys(next.cards).length}\n`);
    if (changed.length) process.stdout.write(`  ${changed.join(' ')}\n`);
    if (added.length) process.stdout.write(`added:   ${added.join(' ')}\n`);
    if (removed.length) process.stdout.write(`removed: ${removed.join(' ')}\n`);
    if (prev.fontStatus !== next.fontStatus) {
      process.stdout.write(`font status: ${prev.fontStatus} -> ${next.fontStatus}\n`);
    }
  } else {
    process.stdout.write(`creating a new baseline for ${Object.keys(next.cards).length} cards\n`);
  }
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(next, null, 2)}\n`);
  process.stdout.write(`written: ${path.relative(projectRoot, BASELINE_FILE)}\n`);
}
