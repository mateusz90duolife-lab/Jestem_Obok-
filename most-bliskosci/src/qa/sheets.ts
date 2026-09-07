import fs from 'node:fs';
import path from 'node:path';
import { renderHtmlToPng } from '../render/chromium.ts';
import { readPngInfo } from './png.ts';
import { outputDir } from '../paths.ts';
import { levelLabel, levelToken } from '../tokens.ts';
import { esc } from '../svg/builder.ts';
import type { GeneratedCard } from '../build/generate.ts';
import type { Issue, LevelId } from '../types.ts';

const THUMB_W = 150;
const THUMB_H = 209; // 150 * 106/76, rounded
const LABEL_H = 22;
const GAP = 14;
const PAD = 22;

export const CONTACT_COLUMNS = 7;
export const CONTACT_ROWS = 11;

export interface SheetResult {
  readonly file: string;
  readonly cardIds: readonly string[];
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface ContactSheetResult extends SheetResult {
  readonly expected: number;
  readonly actual: number;
  readonly issues: readonly Issue[];
}

function cell(card: GeneratedCard, label: string): string {
  return `<figure><img src="file://${card.pngPath}" alt="${esc(card.card.id)}"><figcaption>${esc(label)}</figcaption></figure>`;
}

function page(title: string, columns: number, cells: string, extraCss = ''): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:#FFFDF9;font-family:'Instrument Sans',sans-serif;}
h1{font-size:15px;font-weight:700;letter-spacing:.14em;margin:0 0 ${PAD}px 0;color:#43202A;text-transform:uppercase;}
.grid{display:grid;grid-template-columns:repeat(${columns},${THUMB_W}px);gap:${GAP}px;padding:${PAD}px;}
figure{margin:0;}
img{width:${THUMB_W}px;height:${THUMB_H}px;display:block;border:1px solid #E3DACB;}
figcaption{height:${LABEL_H}px;line-height:${LABEL_H}px;font-size:11px;letter-spacing:.09em;color:#672F3D;text-align:center;}
${extraCss}
</style></head><body><div class="grid">${cells}</div>
<div style="padding:0 ${PAD}px ${PAD}px;font-size:12px;color:#75464F">${esc(title)}</div></body></html>`;
}

/**
 * The full 77-card contact sheet: 7 columns by 11 rows, in deck order, every
 * thumbnail labelled outside the artwork. The back is deliberately excluded.
 */
export async function buildContactSheet(cards: readonly GeneratedCard[]): Promise<ContactSheetResult> {
  const fronts = cards.filter((c) => c.card.type !== 'back');
  const issues: Issue[] = [];
  const expected = CONTACT_COLUMNS * CONTACT_ROWS;

  const ids = fronts.map((c) => c.card.id);
  if (ids.length !== expected) {
    issues.push({ severity: 'FAIL', stage: 'contact-sheet', message: `expected ${expected} cards, found ${ids.length}` });
  }
  if (new Set(ids).size !== ids.length) {
    issues.push({ severity: 'FAIL', stage: 'contact-sheet', message: 'contact sheet contains duplicate card ids' });
  }
  const expectedOrder = [
    ...Array.from({ length: 60 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 5 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`),
  ];
  for (const [i, id] of expectedOrder.entries()) {
    if (ids[i] !== id) {
      issues.push({ severity: 'FAIL', stage: 'contact-sheet', message: `position ${i + 1} is ${ids[i] ?? 'empty'}, expected ${id}` });
      break;
    }
  }
  for (const id of expectedOrder) {
    if (!ids.includes(id)) issues.push({ severity: 'FAIL', stage: 'contact-sheet', message: `missing ${id}` });
  }

  const dir = path.join(outputDir, 'contact-sheet');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'all-77-cards.png');

  const rows = Math.ceil(fronts.length / CONTACT_COLUMNS);
  const widthPx = PAD * 2 + CONTACT_COLUMNS * THUMB_W + (CONTACT_COLUMNS - 1) * GAP;
  const heightPx = PAD * 2 + rows * (THUMB_H + LABEL_H) + (rows - 1) * GAP + 34;
  const html = page(
    'MOST BLISKOSCI - 77 kart (Q01-Q60, S01-S12, B01-B05). Rewers nie jest czescia arkusza.',
    CONTACT_COLUMNS,
    fronts.map((c) => cell(c, c.card.id)).join(''),
  );
  await renderHtmlToPng({ html, widthPx, heightPx, outPath: file });

  const info = readPngInfo(file);
  if (info.width !== widthPx || info.height !== heightPx) {
    issues.push({ severity: 'FAIL', stage: 'contact-sheet', message: `contact sheet is ${info.width}x${info.height}px, expected ${widthPx}x${heightPx}px` });
  }

  return { file, cardIds: ids, widthPx, heightPx, expected, actual: ids.length, issues };
}

const LEVELS: readonly LevelId[] = ['01', '02', '03', '04', '05'];

/** Grouped proof sheets, one per level plus situations, bridges and the back. */
export async function buildProofSheets(cards: readonly GeneratedCard[]): Promise<SheetResult[]> {
  const dir = path.join(outputDir, 'proof');
  fs.mkdirSync(dir, { recursive: true });
  const groups: Array<{ name: string; title: string; members: GeneratedCard[]; columns: number }> = [];

  for (const level of LEVELS) {
    const members = cards.filter((c) => c.card.type === 'question' && c.card.level === level);
    groups.push({
      name: `level-${level}-${slugAscii(levelToken(level).name)}`,
      title: `POZIOM ${level} - ${levelLabel(level)} (${members.length} kart)`,
      members, columns: 6,
    });
  }
  groups.push({
    name: 'situations',
    title: 'SYTUACJE (12 kart)',
    members: cards.filter((c) => c.card.type === 'situation'), columns: 6,
  });
  groups.push({
    name: 'bridges',
    title: 'MOSTY (5 kart)',
    members: cards.filter((c) => c.card.type === 'bridge'), columns: 5,
  });
  groups.push({
    name: 'back',
    title: 'REWERS (1 karta, wspolna dla calej talii)',
    members: cards.filter((c) => c.card.type === 'back'), columns: 1,
  });

  const results: SheetResult[] = [];
  for (const group of groups) {
    if (group.members.length === 0) continue;
    const rows = Math.ceil(group.members.length / group.columns);
    const widthPx = PAD * 2 + group.columns * THUMB_W + (group.columns - 1) * GAP;
    const heightPx = PAD * 2 + rows * (THUMB_H + LABEL_H) + (rows - 1) * GAP + 34;
    const file = path.join(dir, `${group.name}.png`);
    await renderHtmlToPng({
      html: page(group.title, group.columns, group.members.map((c) => cell(c, c.card.id)).join('')),
      widthPx, heightPx, outPath: file,
    });
    results.push({ file, cardIds: group.members.map((c) => c.card.id), widthPx, heightPx });
  }
  return results;
}

/** Golden cards plus automatically chosen edge cases, side by side. */
export async function buildExtremesSheet(
  cards: readonly GeneratedCard[],
  picks: ReadonlyArray<{ label: string; cardId: string }>,
): Promise<SheetResult> {
  const dir = path.join(outputDir, 'proof', 'extremes');
  fs.mkdirSync(dir, { recursive: true });
  const chosen = picks
    .map((p) => ({ pick: p, card: cards.find((c) => c.card.id === p.cardId) }))
    .filter((x): x is { pick: { label: string; cardId: string }; card: GeneratedCard } => x.card !== undefined);

  const columns = Math.min(4, Math.max(1, chosen.length));
  const rows = Math.ceil(chosen.length / columns);
  const widthPx = PAD * 2 + columns * THUMB_W + (columns - 1) * GAP;
  const heightPx = PAD * 2 + rows * (THUMB_H + LABEL_H + 16) + (rows - 1) * GAP + 34;
  const file = path.join(dir, 'extremes.png');
  await renderHtmlToPng({
    html: page(
      'PRZYPADKI SKRAJNE - wybrane automatycznie z pomiarow',
      columns,
      chosen.map((c) => cell(c.card, `${c.card.card.id} - ${c.pick.label}`)).join(''),
      'figcaption{height:38px;line-height:14px;white-space:normal;padding-top:4px;}',
    ),
    widthPx, heightPx, outPath: file,
  });
  return { file, cardIds: chosen.map((c) => c.card.card.id), widthPx, heightPx };
}

function slugAscii(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
