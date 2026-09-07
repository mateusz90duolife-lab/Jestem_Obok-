import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { generate, cleanArtefacts, type GeneratedCard } from './build/generate.ts';
import { rasterise } from './build/rasterise.ts';
import { exportPrint } from './build/print.ts';
import { loadDeck } from './content/load.ts';
import { validateContent } from './content/validate.ts';
import { resolveFonts } from './fonts/registry.ts';
import { loadTokens } from './tokens.ts';
import { checkSvg } from './qa/svgQa.ts';
import { pixelQa } from './qa/pixel.ts';
import { buildContactSheet, buildProofSheets, buildExtremesSheet } from './qa/sheets.ts';
import { contentStats, designStats, pickExtremes, GOLDEN_CARDS } from './qa/stats.ts';
import { qaDir, writeJson, writeReportHtml, writeOverflowHtml, type QaReport, type StageStatus, type OverflowRow } from './qa/report.ts';
import { writeProofIndex } from './qa/proofIndex.ts';
import { outputDir } from './paths.ts';
import type { CardDiagnostics, Issue, QaStatus } from './types.ts';

export const GENERATOR_VERSION = '1.0.0';

export interface BuildOptions {
  readonly skipRender?: boolean;
  readonly only?: readonly string[];
  readonly quiet?: boolean;
}

export interface BuildResult {
  readonly report: QaReport;
  readonly ok: boolean;
  readonly summary: string;
}

function log(quiet: boolean | undefined, message: string): void {
  if (!quiet) process.stdout.write(`${message}\n`);
}

/**
 * The one pipeline. Every command is a slice of it, and `npm run build` runs it
 * end to end. Nothing writes an artefact by any other route.
 */
export async function build(opts: BuildOptions = {}): Promise<BuildResult> {
  const tokens = loadTokens();
  const deck = loadDeck();
  const fonts = resolveFonts(true);
  const stages: StageStatus[] = [];
  const issues: Issue[] = [];

  // 1. Content -----------------------------------------------------------
  log(opts.quiet, 'content   : validating');
  const content = validateContent(deck);
  issues.push(...content.issues);
  stages.push({
    name: 'content',
    status: content.ok ? (content.issues.length ? 'WARNING' : 'PASS') : 'FAIL',
    detail: `${content.counts.questions} pytań, ${content.counts.situations} sytuacji, ${content.counts.bridges} mostów = ${content.counts.total}`,
  });

  // 2. Fonts -------------------------------------------------------------
  const fontStatus: QaStatus = fonts.status === 'EXACT' ? 'PASS' : fonts.status === 'SUBSTITUTED' ? 'WARNING' : 'FAIL';
  if (fonts.status === 'MISSING') {
    for (const m of fonts.missing) {
      issues.push({ severity: 'FAIL', stage: 'fonts', message: `missing font: ${m}` });
    }
  } else if (fonts.status === 'SUBSTITUTED') {
    for (const s of fonts.substitutions) {
      issues.push({
        severity: 'WARNING', stage: 'fonts',
        message: `${s.specFamily} ${s.specFace} substituted by ${s.renderFamily} ${s.renderWeight}${s.lossy ? ' (weight mapping is lossy)' : ''}`,
      });
    }
  }
  stages.push({
    name: 'fonts',
    status: fontStatus,
    detail: fonts.status === 'EXACT'
      ? `${fonts.specFamilies.display} + ${fonts.specFamilies.ui}`
      : `SUBSTITUTED: ${fonts.specFamilies.display} -> ${fonts.renderFamilies.display}, ${fonts.specFamilies.ui} -> ${fonts.renderFamilies.ui}`,
  });
  log(opts.quiet, `fonts     : ${fonts.status}`);

  // 3. Layout + SVG ------------------------------------------------------
  log(opts.quiet, 'generate  : layout and SVG');
  if (!opts.only) cleanArtefacts();
  const cards: GeneratedCard[] = generate(opts.only);
  const svgIssues: Issue[] = [];
  const safeAreaByCard = new Map<string, string[]>();
  for (const c of cards) {
    const result = checkSvg(c.card.id, c.svg, c.layout);
    svgIssues.push(...result.issues);
    safeAreaByCard.set(c.card.id, [...result.safeAreaViolations]);
  }
  issues.push(...svgIssues);
  stages.push({
    name: 'svg',
    status: svgIssues.length === 0 ? 'PASS' : 'FAIL',
    detail: `${cards.length} plików, ${svgIssues.length} błędów`,
  });

  const overflowRows: OverflowRow[] = cards
    .filter((c) => c.card.type === 'question')
    .map((c) => {
      const layoutResult = c.layout.textLayouts[0]!;
      return {
        cardId: c.card.id,
        overflow: layoutResult.overflow || c.layout.failures.length > 0,
        overflowX: layoutResult.overflowX,
        overflowY: layoutResult.overflowY,
        lineCount: layoutResult.lineCount,
        maxLines: tokens.autofit.maximumLines,
        fontSize: layoutResult.fontSize,
        minimumFontSize: tokens.autofit.minimumFontSizePt,
        maxLineWidth: layoutResult.maxLineWidth,
        availableWidth: layoutResult.availableWidth,
        strategy: c.layout.fit?.strategy ?? 'none',
      } satisfies OverflowRow;
    });
  const overflowCount = overflowRows.filter((r) => r.overflow).length;
  stages.push({
    name: 'overflow',
    status: overflowCount === 0 ? 'PASS' : 'FAIL',
    detail: `${overflowCount} kart z przepełnieniem`,
  });

  // 4. Print export ------------------------------------------------------
  log(opts.quiet, 'print     : CARD / MASTER trim variant');
  const printExport = exportPrint(cards);
  stages.push({
    name: 'print',
    status: printExport.written === cards.length ? 'PASS' : 'FAIL',
    detail: `bleed 76x106mm w front/ + back/, master 70x100mm w print/master-70x100/ (${printExport.written} plikow)`,
  });

  // 5. Rasterise ---------------------------------------------------------
  let raster = null as Awaited<ReturnType<typeof rasterise>> | null;
  if (opts.skipRender) {
    stages.push({ name: 'png', status: 'BLOCKED', detail: 'pominięto (--skip-render)' });
  } else {
    log(opts.quiet, `render    : ${cards.length} kart @ 300 DPI`);
    raster = await rasterise(cards, (done, total) => {
      if (!opts.quiet && done % 10 === 0) process.stdout.write(`render    : ${done}/${total}\n`);
    });
    issues.push(...raster.issues);
    stages.push({
      name: 'png',
      status: raster.status === 'PASS' ? 'PASS' : raster.status === 'BLOCKED' ? 'BLOCKED' : 'FAIL',
      detail: raster.status === 'BLOCKED'
        ? raster.blockedReason ?? 'renderer unavailable'
        : `${raster.rendered}/${cards.length} @ ${raster.expectedWidthPx}x${raster.expectedHeightPx}px (${raster.dpi} DPI)`,
    });
  }

  // 6. Pixel QA ----------------------------------------------------------
  const pixelByCard = new Map<string, { density: number; violations: string[] }>();
  let pixelStatus: StageStatus;
  if (raster && raster.status === 'PASS') {
    log(opts.quiet, 'pixel QA  : measuring rendered ink');
    let violations = 0;
    for (const c of cards) {
      const r = pixelQa(c.card.id, c.pngPath, c.layout.background);
      pixelByCard.set(c.card.id, { density: r.density, violations: [...r.violations] });
      violations += r.violations.length;
      issues.push(...r.issues);
    }
    pixelStatus = {
      name: 'pixel-qa',
      status: violations === 0 ? 'PASS' : 'FAIL',
      detail: `${cards.length} kart zmierzonych, ${violations} naruszeń safe area`,
    };
  } else {
    pixelStatus = {
      name: 'pixel-qa',
      status: 'BLOCKED',
      detail: 'pixel-level verification unavailable: no rendered PNG to measure',
    };
  }
  stages.push(pixelStatus);

  // 7. Diagnostics -------------------------------------------------------
  const diagnostics: CardDiagnostics[] = cards.map((c) => {
    const safeViolations = safeAreaByCard.get(c.card.id) ?? [];
    const pixel = pixelByCard.get(c.card.id);
    const failures = [
      ...c.layout.failures,
      ...safeViolations,
      ...(pixel?.violations ?? []),
    ];
    const overflow = c.layout.textLayouts.some((t) => t.overflow);
    const status: QaStatus = failures.length > 0 || overflow ? 'FAIL' : c.layout.warnings.length > 0 ? 'WARNING' : 'PASS';
    return {
      cardId: c.card.id,
      type: c.card.type,
      level: c.layout.level,
      status,
      textLayouts: c.layout.textLayouts,
      safeAreaViolations: safeViolations,
      overflow,
      warnings: c.layout.warnings,
      failures,
      fit: c.layout.fit,
      density: pixel?.density,
    };
  });

  // 8. Sheets ------------------------------------------------------------
  let contactDetail = 'pominięto: brak PNG';
  let contactStatus: StageStatus['status'] = 'BLOCKED';
  const extremes = pickExtremes(diagnostics);
  if (raster && raster.status === 'PASS' && !opts.only) {
    log(opts.quiet, 'sheets    : contact sheet, proofs, extremes');
    const contact = await buildContactSheet(cards);
    issues.push(...contact.issues);
    contactStatus = contact.issues.length === 0 ? 'PASS' : 'FAIL';
    contactDetail = `${contact.actual}/${contact.expected} kart, ${contact.widthPx}x${contact.heightPx}px, ${contact.cardIds.length} etykiet`;
    const proofs = await buildProofSheets(cards);
    const extremeSheet = await buildExtremesSheet(cards, extremes);
    writeProofIndex(cards, diagnostics, [...GOLDEN_CARDS], extremes, proofs, extremeSheet, contact);
  }
  stages.push({ name: 'contact-sheet', status: contactStatus, detail: contactDetail });

  // 9. Statistics and reports -------------------------------------------
  log(opts.quiet, 'report    : statistics, manifest, QA report');
  const cStats = contentStats();
  const dStats = designStats(diagnostics);
  writeJson(path.join(qaDir(), 'content-stats.json'), cStats);
  writeJson(path.join(qaDir(), 'design-stats.json'), dStats);
  writeJson(path.join(qaDir(), 'overflow-report.json'), { overflow: overflowCount, rows: overflowRows });
  writeOverflowHtml(path.join(qaDir(), 'overflow-report.html'), overflowRows);

  // Content revisions: recorded whenever the pipeline alters authored text.
  // Nothing here rewrites content, so the log stays empty by construction.
  const revisionsFile = path.join(qaDir(), 'content-revisions.json');
  if (!fs.existsSync(revisionsFile)) {
    writeJson(revisionsFile, {
      note: 'Every automatic change to authored content is appended here. The generator never rewrites content silently.',
      revisions: [],
    });
  }

  const failures = issues.filter((i) => i.severity === 'FAIL');
  const warnings = issues.filter((i) => i.severity === 'WARNING' || i.severity === 'ERROR');
  const blocked = stages.some((s) => s.status === 'BLOCKED');
  const automatedStatus: 'PASS' | 'FAIL' = failures.length === 0 && !blocked ? 'PASS' : 'FAIL';

  const report: QaReport = {
    deck: 'MOST BLISKOŚCI',
    automatedStatus,
    humanReview: 'REQUIRED',
    designVersion: tokens.designVersion,
    generatorVersion: GENERATOR_VERSION,
    contentVersion: deck.contentVersion,
    fonts: {
      status: fonts.status,
      specified: fonts.specFamilies,
      rendered: fonts.renderFamilies,
      reason: fonts.reason,
      missing: fonts.missing,
      substitutions: fonts.substitutions,
      files: [...fonts.faces.values()].map((f) => ({
        role: f.role, face: f.key, file: path.relative(outputDir, f.file), sha256: f.sha256,
      })),
    },
    stages,
    counts: {
      questions: deck.questions.length,
      situations: deck.situations.length,
      bridges: deck.bridges.length,
      fronts: deck.fronts.length,
      svg: cards.length,
      png: raster?.rendered ?? 0,
      overflow: overflowCount,
      safeAreaViolations: diagnostics.reduce((a, d) => a + d.safeAreaViolations.length, 0),
    },
    cards: diagnostics,
    issues,
    warnings,
    failures,
  };
  writeJson(path.join(qaDir(), 'report.json'), report);
  writeReportHtml(path.join(qaDir(), 'report.html'), report);
  writeManifest(cards, report, raster?.pngSha256 ?? new Map());

  return { report, ok: automatedStatus === 'PASS', summary: summarise(report, extremes) };
}

function writeManifest(
  cards: readonly GeneratedCard[],
  report: QaReport,
  pngSha: ReadonlyMap<string, string>,
): void {
  const tokens = loadTokens();
  writeJson(path.join(outputDir, 'manifest.json'), {
    deck: 'MOST BLISKOŚCI',
    version: '1.0.0',
    generatorVersion: GENERATOR_VERSION,
    designVersion: tokens.designVersion,
    contentVersion: report.contentVersion,
    fonts: report.fonts,
    totalCards: report.counts.fronts,
    questions: report.counts.questions,
    situations: report.counts.situations,
    bridges: report.counts.bridges,
    dimensions: {
      unit: 'mm',
      trim: tokens.geometry.trim,
      bleed: tokens.geometry.bleedMm,
      full: tokens.geometry.full,
      safeArea: { width: tokens.geometry.trim.width - 2 * tokens.geometry.safeInsetFromTrimMm, height: tokens.geometry.trim.height - 2 * tokens.geometry.safeInsetFromTrimMm },
      cornerRadius: tokens.geometry.cornerRadiusMm,
      raster: { dpi: 300, widthPx: 898, heightPx: 1252 },
      colourSpace: 'sRGB; convert to CMYK at print-prep against the printer ICC profile',
    },
    cards: cards.map((c) => ({
      id: c.card.id,
      type: c.card.type,
      level: c.layout.level ?? null,
      svg: c.svgRelative,
      png: c.pngRelative,
      svgSha256: c.svgSha256,
      pngSha256: pngSha.get(c.card.id) ?? null,
    })),
    files: {
      contactSheet: 'contact-sheet/all-77-cards.png',
      proofIndex: 'proof/index.html',
      report: 'qa/report.json',
      reportHtml: 'qa/report.html',
      overflowReport: 'qa/overflow-report.json',
      contentStats: 'qa/content-stats.json',
      designStats: 'qa/design-stats.json',
      contentRevisions: 'qa/content-revisions.json',
      printSpec: 'print/print-spec.json',
      printMaster: 'print/master-70x100',
    },
  });
}

function summarise(report: QaReport, extremes: ReadonlyArray<{ label: string; cardId: string }>): string {
  const stage = (name: string): StageStatus => report.stages.find((s) => s.name === name)
    ?? { name, status: 'FAIL', detail: 'not run' };
  const lines: string[] = [
    'MOST BLISKOŚCI',
    '==============================',
    '',
    'Cards',
    `  Questions:  ${String(report.counts.questions).padStart(3)}`,
    `  Situations: ${String(report.counts.situations).padStart(3)}`,
    `  Bridges:    ${String(report.counts.bridges).padStart(3)}`,
    `  Total:      ${String(report.counts.fronts).padStart(3)}`,
    '',
    'Assets',
    `  SVG:        ${String(report.counts.svg - 1).padStart(3)}`,
    `  PNG:        ${String(Math.max(0, report.counts.png - 1)).padStart(3)}`,
    '  Back:         1',
    '',
    'QA',
    `  Overflow:   ${String(report.counts.overflow).padStart(3)}`,
    `  Safe-area:  ${String(report.counts.safeAreaViolations).padStart(3)}`,
    `  SVG errors: ${String(report.failures.filter((f) => f.stage === 'svg').length).padStart(3)}`,
    `  PNG errors: ${String(report.failures.filter((f) => f.stage === 'png').length).padStart(3)}`,
    `  Content:    ${stage('content').status}`,
    `  Fonts:      ${stage('fonts').status}${report.fonts && typeof report.fonts === 'object' && 'status' in report.fonts ? ` (${String((report.fonts as { status: string }).status)})` : ''}`,
    `  Pixel QA:   ${stage('pixel-qa').status}`,
    `  Contact:    ${stage('contact-sheet').detail}`,
    '',
  ];
  if (report.failures.length > 0) {
    lines.push('Failures:');
    for (const f of report.failures.slice(0, 40)) {
      lines.push(`- ${f.cardId ? `${f.cardId}: ` : ''}${f.message}`);
    }
    if (report.failures.length > 40) lines.push(`- ... and ${report.failures.length - 40} more`);
    lines.push('');
  }
  if (extremes.length > 0) {
    lines.push('Edge cases picked from measurements:');
    for (const e of extremes) lines.push(`  ${e.cardId.padEnd(5)} ${e.label}`);
    lines.push('');
  }
  const fontStatus = report.fonts && typeof report.fonts === 'object' && 'status' in report.fonts
    ? String((report.fonts as { status: string }).status)
    : 'UNKNOWN';
  const qualifier = fontStatus === 'EXACT' ? '' : ` (FONT-${fontStatus})`;
  lines.push(`STATUS: ${report.automatedStatus}${qualifier}`);
  if (report.automatedStatus === 'PASS') {
    lines.push('(AUTOMATED PASS. Human visual review is a separate, still-required step.)');
  }
  if (fontStatus !== 'EXACT') {
    lines.push(`Fonts are substituted, so this output is NOT print-ready as specified.`);
    lines.push(`Install the specified families in assets/fonts and rebuild for EXACT status.`);
  }
  return lines.join('\n');
}
