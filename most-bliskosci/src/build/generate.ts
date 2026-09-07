import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { layoutCard } from '../layout/index.ts';
import { renderCard } from '../svg/render.ts';
import { loadDeck, fileStem } from '../content/load.ts';
import { outputDir } from '../paths.ts';
import type { Card, CardLayout } from '../types.ts';

export interface GeneratedCard {
  readonly card: Card;
  readonly layout: CardLayout;
  readonly svg: string;
  readonly svgPath: string;
  readonly svgRelative: string;
  readonly pngPath: string;
  readonly pngRelative: string;
  readonly svgSha256: string;
}

export function frontDir(): string { return path.join(outputDir, 'front'); }
export function backDir(): string { return path.join(outputDir, 'back'); }
export function pngFrontDir(): string { return path.join(outputDir, 'png', 'front'); }
export function pngBackDir(): string { return path.join(outputDir, 'png', 'back'); }

/**
 * Build every card from data through layout to SVG.
 *
 * `only` narrows the set for `npm run generate -- Q37`, but the path is the
 * same one the full build uses; there is no second renderer.
 */
export function generate(only?: readonly string[]): GeneratedCard[] {
  const deck = loadDeck();
  const wanted = only && only.length > 0 ? new Set(only.map((s) => s.toUpperCase())) : null;
  const cards = wanted ? deck.all.filter((c) => wanted.has(c.id)) : deck.all;
  if (wanted) {
    for (const id of wanted) {
      if (!deck.all.some((c) => c.id === id)) throw new Error(`unknown card id '${id}'`);
    }
  }

  fs.mkdirSync(frontDir(), { recursive: true });
  fs.mkdirSync(backDir(), { recursive: true });

  const out: GeneratedCard[] = [];
  for (const card of cards) {
    const layout = layoutCard(card);
    const svg = renderCard(layout);
    const stem = fileStem(card);
    const isBack = card.type === 'back';
    const svgRelative = isBack ? `back/${stem}.svg` : `front/${stem}.svg`;
    const pngRelative = isBack ? `png/back/${stem}.png` : `png/front/${stem}.png`;
    const svgPath = path.join(outputDir, svgRelative);
    fs.writeFileSync(svgPath, svg);
    out.push({
      card, layout, svg, svgPath, svgRelative,
      pngPath: path.join(outputDir, pngRelative),
      pngRelative,
      svgSha256: createHash('sha256').update(svg).digest('hex'),
    });
  }
  return out;
}

/** Remove generated SVG/PNG files so a rebuild cannot leave stale artefacts behind. */
export function cleanArtefacts(): void {
  for (const dir of [frontDir(), backDir(), pngFrontDir(), pngBackDir()]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
  }
}
