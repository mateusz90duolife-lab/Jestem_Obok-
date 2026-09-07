import fs from 'node:fs';
import path from 'node:path';
import { build, GENERATOR_VERSION } from './pipeline.ts';
import { generate } from './build/generate.ts';
import { loadDeck } from './content/load.ts';
import { validateContent } from './content/validate.ts';
import { resolveFonts } from './fonts/registry.ts';
import { loadTokens } from './tokens.ts';
import { layoutCard } from './layout/index.ts';
import { renderCard } from './svg/render.ts';
import { checkSvg } from './qa/svgQa.ts';
import { cardGeometry } from './layout/geometry.ts';
import { findBrowser, svgPage, mmToPx, renderHtmlToPng } from './render/chromium.ts';
import { outputDir, projectRoot } from './paths.ts';

const argv = process.argv.slice(2);
const command = argv[0] ?? 'help';
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.slice(1).filter((a) => !a.startsWith('--'));

function out(text: string): void { process.stdout.write(`${text}\n`); }

async function main(): Promise<number> {
  switch (command) {
    case 'audit': return audit();
    case 'validate': return validate();
    case 'generate': return doGenerate();
    case 'render': return (await build({ only: positional.length ? positional : undefined })).ok ? 0 : 1;
    case 'qa':
    case 'proof':
    case 'contact-sheet':
    case 'build': {
      const result = await build({
        skipRender: flags.has('--skip-render'),
        only: positional.length ? positional : undefined,
      });
      out('');
      out(result.summary);
      return result.ok ? 0 : 1;
    }
    case 'inspect': return inspect();
    case 'help': default: return help();
  }
}

function help(): number {
  out(`MOST BLISKOŚCI — generator talii (${GENERATOR_VERSION})

  npm run audit           środowisko, fonty, treść, tokeny
  npm run validate        walidacja treści i tokenów (bez generowania)
  npm run generate        tylko SVG        (npm run generate -- Q37)
  npm run render          SVG + PNG
  npm run qa              pełny pipeline z raportami
  npm run proof           pełny pipeline (arkusze proof)
  npm run contact-sheet   pełny pipeline (arkusz 77 kart)
  npm run inspect -- Q37  pojedyncza karta: pomiary, auto-fit, ostrzeżenia
  npm test                testy
  npm run build           pełny pipeline — oficjalna droga

  --skip-render           pomiń rasteryzację (PNG oznaczone jako BLOCKED)
  --debug                 (inspect) zapisz nakładkę debug do output/qa/debug/`);
  return 0;
}

function audit(): number {
  const tokens = loadTokens();
  const fonts = resolveFonts(true);
  const deck = loadDeck();
  const geo = cardGeometry();
  const browser = findBrowser();

  out('MOST BLISKOŚCI — audit');
  out('======================');
  out('');
  out(`node            ${process.version}`);
  out(`project         ${projectRoot}`);
  out(`dependencies    none (Node built-ins only)`);
  out(`renderer        ${browser ?? 'NOT FOUND — PNG rendering will be BLOCKED'}`);
  out('');
  out(`design tokens   v${tokens.designVersion}, ${Object.keys(tokens.typography.styles).length} styli, 5 poziomów`);
  out(`geometry        trim ${geo.trim.width}×${geo.trim.height}mm · bleed ${geo.bleedMm}mm · full ${geo.full.width}×${geo.full.height}mm · safe ${geo.safe.width}×${geo.safe.height}mm`);
  out(`content         ${deck.questions.length} pytań, ${deck.situations.length} sytuacji, ${deck.bridges.length} mostów, 1 rewers`);
  out('');
  out(`fonts           ${fonts.status}`);
  out(`  specified     display ${fonts.specFamilies.display} · ui ${fonts.specFamilies.ui}`);
  out(`  rendered      display ${fonts.renderFamilies.display} · ui ${fonts.renderFamilies.ui}`);
  if (fonts.reason) out(`  reason        ${fonts.reason}`);
  for (const s of fonts.substitutions) {
    out(`  substituted   ${s.specFamily} ${s.specFace} -> ${s.renderFamily} ${s.renderWeight}${s.lossy ? '  (lossy weight mapping)' : ''}`);
  }
  for (const m of fonts.missing) out(`  MISSING       ${m}`);
  out('');
  const content = validateContent(deck);
  out(`content QA      ${content.ok ? 'PASS' : 'FAIL'} — ${content.issues.length} uwag`);
  for (const i of content.issues) out(`  ${i.severity} ${i.cardId ?? '-'} ${i.message}`);
  return content.ok && fonts.status !== 'MISSING' ? 0 : 1;
}

function validate(): number {
  loadTokens();
  const content = validateContent();
  const fonts = resolveFonts(true);
  let failures = content.issues.filter((i) => i.severity === 'FAIL').length;
  for (const i of content.issues) out(`${i.severity} ${i.stage} ${i.cardId ?? '-'} ${i.message}`);
  if (fonts.status === 'MISSING') {
    failures += fonts.missing.length;
    for (const m of fonts.missing) out(`FAIL fonts - missing font: ${m}`);
  }
  const cards = loadDeck().all;
  for (const card of cards) {
    const layout = layoutCard(card);
    const result = checkSvg(card.id, renderCard(layout), layout);
    for (const i of result.issues) { failures++; out(`${i.severity} ${i.stage} ${i.cardId} ${i.message}`); }
  }
  out(failures === 0 ? 'VALIDATE: PASS' : `VALIDATE: FAIL (${failures})`);
  return failures === 0 ? 0 : 1;
}

function doGenerate(): number {
  const cards = generate(positional.length ? positional : undefined);
  for (const c of cards) out(`${c.card.id.padEnd(5)} ${c.svgRelative}`);
  out(`generated ${cards.length} SVG into ${path.relative(process.cwd(), outputDir)}`);
  return 0;
}

async function inspect(): Promise<number> {
  const id = positional[0];
  if (!id) { out('usage: npm run inspect -- Q37'); return 1; }
  const deck = loadDeck();
  const card = deck.all.find((c) => c.id.toUpperCase() === id.toUpperCase());
  if (!card) { out(`unknown card '${id}'`); return 1; }

  const layout = layoutCard(card);
  const svg = renderCard(layout);
  const qa = checkSvg(card.id, svg, layout);
  const geo = cardGeometry();

  out(`CARD  ${card.id}  (${card.type}${layout.level ? `, poziom ${layout.level}` : ''})`);
  if (card.type === 'question') out(`TEXT  ${card.text}`);
  if (card.type === 'situation') out(`TEXT  ${card.title} | ${card.instruction.join(' | ')}`);
  if (card.type === 'bridge') out(`TEXT  ${card.caption}`);
  out('');
  const fonts = resolveFonts();
  out(`FONT  display ${fonts.renderFamilies.display} · ui ${fonts.renderFamilies.ui} (${fonts.status})`);
  if (layout.fit) {
    out(`FIT   ${layout.fit.fontSize}pt / ${layout.fit.lineHeight}pt · measure ${layout.fit.measureMm}mm · ${layout.fit.lineCount} wierszy`);
    out(`      strategy '${layout.fit.strategy}' after ${layout.fit.iterations} iteration(s), score ${layout.fit.score}, resolved ${layout.fit.resolved}`);
  }
  for (const t of layout.textLayouts) {
    out('');
    out(`LINES ${t.lineCount}, widest ${t.maxLineWidth}mm of ${t.availableWidth}mm (zapas ${t.remainingWidth}mm)`);
    out(`      height ${t.totalHeight}mm of ${t.availableHeight}mm (zapas ${t.remainingHeight}mm)`);
    out(`      overflow=${t.overflow} (x=${t.overflowX} y=${t.overflowY})`);
    for (const line of t.lines) out(`      | ${line}`);
  }
  out('');
  out(`SAFE  ${geo.safe.width}×${geo.safe.height}mm at ${geo.safe.x},${geo.safe.y} — ${qa.safeAreaViolations.length} naruszeń`);
  for (const v of qa.safeAreaViolations) out(`      ${v}`);
  out(`WARN  ${layout.warnings.length ? layout.warnings.join(' | ') : 'brak'}`);
  out(`FAIL  ${layout.failures.length ? layout.failures.join(' | ') : 'brak'}`);

  if (flags.has('--debug')) {
    const dir = path.join(outputDir, 'qa', 'debug');
    fs.mkdirSync(dir, { recursive: true });
    const debugSvg = renderCard(layout, { debug: true });
    fs.writeFileSync(path.join(dir, `${card.id}-debug.svg`), debugSvg);
    if (findBrowser()) {
      const w = mmToPx(76);
      const h = mmToPx(106);
      await renderHtmlToPng({
        html: svgPage(debugSvg, w, h, layout.background),
        widthPx: w, heightPx: h,
        outPath: path.join(dir, `${card.id}-debug.png`),
      });
      out('');
      out(`DEBUG output/qa/debug/${card.id}-debug.svg + .png`);
    } else {
      out('');
      out(`DEBUG output/qa/debug/${card.id}-debug.svg (PNG BLOCKED: no renderer)`);
    }
  }
  return qa.issues.length === 0 ? 0 : 1;
}

process.exitCode = await main();
