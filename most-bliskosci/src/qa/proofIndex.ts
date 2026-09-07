import fs from 'node:fs';
import path from 'node:path';
import { outputDir } from '../paths.ts';
import { esc } from '../svg/builder.ts';
import { loadDeck } from '../content/load.ts';
import type { GeneratedCard } from '../build/generate.ts';
import type { CardDiagnostics } from '../types.ts';
import type { SheetResult, ContactSheetResult } from './sheets.ts';

const STATUS_COLOUR: Record<string, string> = { PASS: '#2F7A4F', WARNING: '#B07D2B', FAIL: '#B3261E' };

/** A browsable index of golden cards, edge cases, proof sheets and metrics. */
export function writeProofIndex(
  cards: readonly GeneratedCard[],
  diagnostics: readonly CardDiagnostics[],
  golden: readonly string[],
  extremes: ReadonlyArray<{ label: string; cardId: string }>,
  proofs: readonly SheetResult[],
  extremeSheet: SheetResult,
  contact: ContactSheetResult,
): void {
  const dir = path.join(outputDir, 'proof');
  fs.mkdirSync(dir, { recursive: true });
  const deck = loadDeck();
  const textOf = new Map<string, string>([
    ...deck.questions.map((q) => [q.id, q.text] as const),
    ...deck.situations.map((s) => [s.id, `${s.title} — ${s.instruction.join(' ')}`] as const),
    ...deck.bridges.map((b) => [b.id, b.caption] as const),
    ['BACK', 'Rewers, wspólny dla całej talii'],
  ]);
  const byId = new Map(cards.map((c) => [c.card.id, c] as const));
  const diagById = new Map(diagnostics.map((d) => [d.cardId, d] as const));

  const cardBlock = (id: string, label?: string): string => {
    const card = byId.get(id);
    const d = diagById.get(id);
    if (!card || !d) return '';
    const metrics = d.textLayouts[0];
    return `<figure>
  <img src="${path.relative(dir, card.pngPath)}" alt="${esc(id)}">
  <figcaption>
    <strong>${esc(id)}</strong>${label ? ` <em>${esc(label)}</em>` : ''}
    <span class="badge" style="background:${STATUS_COLOUR[d.status]}">${esc(d.status)}</span>
    <span class="t">${esc(textOf.get(id) ?? '')}</span>
    <span class="m">${d.fit ? `${d.fit.fontSize}pt / ${d.fit.lineHeight}pt · ${d.fit.lineCount} w. · ${esc(d.fit.strategy)} · score ${d.fit.score}` : 'brak auto-fitu'}</span>
    <span class="m">${metrics ? `szerokość ${metrics.maxLineWidth}mm / ${metrics.availableWidth}mm · zapas ${metrics.remainingWidth}mm` : ''}${d.density !== undefined ? ` · gęstość ${(d.density * 100).toFixed(2)}%` : ''}</span>
    ${d.warnings.length ? `<span class="w">${esc(d.warnings.join(' · '))}</span>` : ''}
    ${d.failures.length ? `<span class="f">${esc(d.failures.join(' · '))}</span>` : ''}
  </figcaption>
</figure>`;
  };

  const sheetLink = (s: SheetResult, title: string): string =>
    `<li><a href="${esc(path.relative(dir, s.file))}">${esc(title)}</a> <span class="m">${s.cardIds.length} kart · ${s.widthPx}×${s.heightPx}px</span></li>`;

  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>MOST BLISKOŚCI — proof index</title><style>
body{font:14px/1.55 ui-sans-serif,system-ui,sans-serif;margin:0;padding:34px;background:#F7F3EC;color:#211D1A}
h1{font-size:24px;letter-spacing:.05em;margin:0 0 2px}
h2{font-size:14px;letter-spacing:.13em;text-transform:uppercase;color:#672F3D;margin:34px 0 12px}
.muted{color:#75464F}
.row{display:flex;flex-wrap:wrap;gap:20px}
figure{margin:0;width:196px}
img{width:196px;height:273px;display:block;border:1px solid #E3DACB;background:#fff}
figcaption{display:flex;flex-direction:column;gap:2px;padding-top:7px;font-size:11.5px}
figcaption em{color:#8E6260;font-style:normal}
.t{color:#211D1A;font-size:12px}
.m{color:#75464F;font-size:11px}
.w{color:#B07D2B}
.f{color:#B3261E}
.badge{color:#fff;padding:1px 7px;border-radius:9px;font-size:10px;width:max-content}
ul{padding-left:20px}
a{color:#672F3D}
.note{background:#EDE6DA;border-left:3px solid #B69A68;padding:10px 14px;margin:16px 0;font-size:13px}
</style></head><body>
<h1>MOST BLISKOŚCI</h1>
<p class="muted">Proof index — szybki przegląd wizualny przed drukiem.</p>
<div class="note"><strong>AUTOMATED PASS ≠ PRINT PROOF APPROVED.</strong> Ta strona służy do przeglądu przez człowieka. Walidacja maszynowa jest w <a href="../qa/report.html">qa/report.html</a>.</div>

<h2>Golden cards</h2>
<div class="row">${golden.map((id) => cardBlock(id)).join('')}</div>

<h2>Przypadki skrajne (wybrane automatycznie)</h2>
<div class="row">${extremes.map((e) => cardBlock(e.cardId, e.label)).join('')}</div>

<h2>Arkusze</h2>
<ul>
<li><a href="${esc(path.relative(dir, contact.file))}">Contact sheet — wszystkie 77 kart</a> <span class="m">${contact.actual}/${contact.expected} · ${contact.widthPx}×${contact.heightPx}px</span></li>
${sheetLink(extremeSheet, 'Przypadki skrajne')}
${proofs.map((p) => sheetLink(p, path.basename(p.file, '.png'))).join('\n')}
</ul>

<h2>Raporty</h2>
<ul>
<li><a href="../qa/report.html">QA report</a></li>
<li><a href="../qa/overflow-report.html">Overflow report</a></li>
<li><a href="../manifest.json">manifest.json</a></li>
<li><a href="../qa/content-stats.json">content-stats.json</a> · <a href="../qa/design-stats.json">design-stats.json</a></li>
</ul>
</body></html>
`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}
