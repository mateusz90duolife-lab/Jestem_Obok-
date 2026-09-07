import fs from 'node:fs';
import path from 'node:path';
import { outputDir } from '../paths.ts';
import { esc } from '../svg/builder.ts';
import type { CardDiagnostics, Issue, QaStatus } from '../types.ts';

export interface StageStatus {
  readonly name: string;
  readonly status: QaStatus | 'BLOCKED';
  readonly detail: string;
}

export interface QaReport {
  readonly deck: string;
  readonly automatedStatus: 'PASS' | 'FAIL';
  readonly humanReview: 'REQUIRED';
  readonly designVersion: string;
  readonly generatorVersion: string;
  readonly contentVersion: string;
  readonly fonts: unknown;
  readonly stages: readonly StageStatus[];
  readonly counts: Record<string, number>;
  readonly cards: readonly CardDiagnostics[];
  readonly issues: readonly Issue[];
  readonly warnings: readonly Issue[];
  readonly failures: readonly Issue[];
}

export function qaDir(): string { return path.join(outputDir, 'qa'); }

export function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

const STATUS_COLOUR: Record<string, string> = {
  PASS: '#2F7A4F', WARNING: '#B07D2B', FAIL: '#B3261E', BLOCKED: '#6B5B95',
};

export function writeReportHtml(file: string, report: QaReport): void {
  const rows = report.stages.map((s) => `
      <tr><td>${esc(s.name)}</td>
          <td><span class="badge" style="background:${STATUS_COLOUR[s.status] ?? '#555'}">${esc(s.status)}</span></td>
          <td>${esc(s.detail)}</td></tr>`).join('');

  const issueRows = (issues: readonly Issue[]): string => issues.length === 0
    ? '<tr><td colspan="4" class="muted">brak</td></tr>'
    : issues.map((i) => `<tr><td>${esc(i.severity)}</td><td>${esc(i.stage)}</td><td>${esc(i.cardId ?? '-')}</td><td>${esc(i.message)}</td></tr>`).join('');

  const cardRows = report.cards.map((c) => `
      <tr><td>${esc(c.cardId)}</td><td>${esc(c.type)}</td><td>${esc(c.level ?? '-')}</td>
          <td><span class="badge" style="background:${STATUS_COLOUR[c.status]}">${esc(c.status)}</span></td>
          <td>${c.fit ? `${c.fit.fontSize}pt / ${c.fit.lineHeight}pt` : '-'}</td>
          <td>${c.fit ? c.fit.lineCount : '-'}</td>
          <td>${c.fit ? esc(c.fit.strategy) : '-'}</td>
          <td>${c.density !== undefined ? (c.density * 100).toFixed(2) + '%' : '-'}</td>
          <td>${esc([...c.warnings, ...c.failures].join(' | ') || '-')}</td></tr>`).join('');

  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8">
<title>MOST BLISKOSCI - raport QA</title><style>
body{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;margin:0;padding:32px;background:#F7F3EC;color:#211D1A}
h1{font-size:22px;letter-spacing:.06em;margin:0 0 4px}
h2{font-size:15px;letter-spacing:.1em;text-transform:uppercase;margin:32px 0 10px;color:#672F3D}
table{border-collapse:collapse;width:100%;background:#FFFDF9;font-size:13px}
th,td{border:1px solid #E3DACB;padding:6px 9px;text-align:left;vertical-align:top}
th{background:#EDE6DA;font-weight:600}
.badge{color:#fff;padding:2px 8px;border-radius:9px;font-size:11px;letter-spacing:.06em}
.headline{font-size:30px;font-weight:700;letter-spacing:.04em}
.muted{color:#75464F}
.note{background:#EDE6DA;border-left:3px solid #B69A68;padding:10px 14px;margin:14px 0}
</style></head><body>
<h1>MOST BLISKOŚCI</h1>
<p class="muted">design ${esc(report.designVersion)} · generator ${esc(report.generatorVersion)} · treść ${esc(report.contentVersion)}</p>
<p class="headline" style="color:${STATUS_COLOUR[report.automatedStatus]}">AUTOMATED QA: ${esc(report.automatedStatus)}</p>
<div class="note"><strong>AUTOMATED PASS nie oznacza PRINT PROOF APPROVED.</strong>
Walidacja maszynowa i przegląd wizualny przez człowieka to dwa osobne kroki. Human review: ${esc(report.humanReview)}.</div>
<h2>Etapy</h2><table><tr><th>Etap</th><th>Status</th><th>Szczegóły</th></tr>${rows}</table>
<h2>Błędy (${report.failures.length})</h2><table><tr><th>Waga</th><th>Etap</th><th>Karta</th><th>Opis</th></tr>${issueRows(report.failures)}</table>
<h2>Ostrzeżenia (${report.warnings.length})</h2><table><tr><th>Waga</th><th>Etap</th><th>Karta</th><th>Opis</th></tr>${issueRows(report.warnings)}</table>
<h2>Karty (${report.cards.length})</h2><table><tr><th>ID</th><th>Typ</th><th>Poziom</th><th>Status</th><th>Stopień / interlinia</th><th>Wierszy</th><th>Strategia</th><th>Gęstość</th><th>Uwagi</th></tr>${cardRows}</table>
</body></html>
`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

export interface OverflowRow {
  readonly cardId: string;
  readonly overflow: boolean;
  readonly overflowX: boolean;
  readonly overflowY: boolean;
  readonly lineCount: number;
  readonly maxLines: number;
  readonly fontSize: number;
  readonly minimumFontSize: number;
  readonly maxLineWidth: number;
  readonly availableWidth: number;
  readonly strategy: string;
}

export function writeOverflowHtml(file: string, rows: readonly OverflowRow[]): void {
  const failing = rows.filter((r) => r.overflow);
  const body = rows.map((r) => `<tr class="${r.overflow ? 'bad' : ''}">
    <td>${esc(r.cardId)}</td><td>${r.overflow}</td><td>${r.overflowX}</td><td>${r.overflowY}</td>
    <td>${r.lineCount}/${r.maxLines}</td><td>${r.fontSize}pt (min ${r.minimumFontSize}pt)</td>
    <td>${r.maxLineWidth}mm / ${r.availableWidth}mm</td><td>${esc(r.strategy)}</td></tr>`).join('');
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>MOST BLISKOSCI - overflow</title><style>
body{font:14px/1.5 ui-sans-serif,system-ui,sans-serif;margin:0;padding:32px;background:#F7F3EC;color:#211D1A}
table{border-collapse:collapse;width:100%;background:#FFFDF9;font-size:13px}
th,td{border:1px solid #E3DACB;padding:6px 9px;text-align:left}
th{background:#EDE6DA}
tr.bad td{background:#F6DEDB}
</style></head><body><h1>Overflow: ${failing.length} / ${rows.length}</h1>
<table><tr><th>ID</th><th>overflow</th><th>X</th><th>Y</th><th>wiersze</th><th>stopień</th><th>szerokość</th><th>strategia</th></tr>${body}</table>
</body></html>
`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}
