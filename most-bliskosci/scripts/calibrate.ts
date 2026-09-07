/**
 * Measurement calibration.
 *
 * The layout engine measures text from font metrics; the renderer draws it with
 * HarfBuzz. This script measures the same strings both ways and reports the
 * disagreement, which is what justifies the tolerance used by the safe-area
 * check in src/qa/svgQa.ts.
 *
 *   node scripts/calibrate.ts
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { measureText } from '../src/fonts/measure.ts';
import { resolveFonts, getFace } from '../src/fonts/registry.ts';
import { style } from '../src/tokens.ts';
import { findBrowser, ensureFontconfig } from '../src/render/chromium.ts';
import type { TextStyle } from '../src/types.ts';

const execFileAsync = promisify(execFile);
const PX_PER_MM = 96 / 25.4;

const SAMPLES: Array<{ text: string; styleName: string }> = [
  { text: 'Kiedy ostatnio poczułeś, że', styleName: 'question' },
  { text: 'Zażółć gęślą jaźń — pchnąć w tę łódź jeża', styleName: 'question' },
  { text: 'najbezpieczniej', styleName: 'question' },
  { text: 'WYBIERZ NAS', styleName: 'level' },
  { text: 'OTWÓRZ SIĘ', styleName: 'level' },
  { text: 'MOST', styleName: 'brandPrimary' },
  { text: 'BLISKOŚCI', styleName: 'brandSecondary' },
  { text: '60 SEKUND CISZY', styleName: 'situationTitle' },
  { text: 'Patrzcie sobie w oczy.', styleName: 'instruction' },
  { text: '01', styleName: 'number' },
];

export interface CalibrationRow {
  readonly text: string;
  readonly styleName: string;
  readonly enginesMm: number;
  readonly rendererMm: number;
  readonly deltaMm: number;
  readonly deltaPercent: number;
}

export async function calibrate(): Promise<{ rows: CalibrationRow[]; worstMm: number; worstPercent: number }> {
  const browser = findBrowser();
  if (!browser) throw new Error('no renderer available; cannot calibrate');
  const fonts = resolveFonts();

  const cases = SAMPLES.map((s) => {
    const st: TextStyle = style(s.styleName);
    return {
      ...s,
      family: fonts.renderFamilies[st.family],
      weight: weightOf(st),
      sizePx: st.sizePt * PX_PER_MM * (25.4 / 72),
      trackingPx: st.trackingEm * st.sizePt * PX_PER_MM * (25.4 / 72),
      style: st,
    };
  });

  const payload = cases.map((c) => ({
    text: c.text, family: c.family, weight: c.weight, sizePx: c.sizePx, trackingPx: c.trackingPx,
  }));

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>span{white-space:pre}</style></head>
<body><div id="out"></div><script>
const cases = ${JSON.stringify(payload)};
const res = cases.map(c => {
  const s = document.createElement('span');
  s.style.fontFamily = "'" + c.family + "'";
  s.style.fontWeight = c.weight;
  s.style.fontSize = c.sizePx + 'px';
  s.style.letterSpacing = c.trackingPx + 'px';
  s.textContent = c.text;
  document.body.appendChild(s);
  return s.getBoundingClientRect().width;
});
document.getElementById('out').textContent = JSON.stringify(res);
</script></body></html>`;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cal-'));
  const file = path.join(tmp, 'cal.html');
  fs.writeFileSync(file, html);
  const isShell = browser.includes('headless_shell');
  try {
    const { stdout } = await execFileAsync(browser, [
      ...(isShell ? [] : ['--headless']),
      '--no-sandbox', '--disable-gpu', '--virtual-time-budget=3000', '--dump-dom', `file://${file}`,
    ], { env: { ...process.env, FONTCONFIG_FILE: ensureFontconfig(), HOME: tmp }, maxBuffer: 8 * 1024 * 1024 });
    const match = /\[[\d.,\s]*\]/.exec(stdout);
    if (!match) throw new Error('renderer returned no measurements');
    const widths = JSON.parse(match[0]) as number[];

    const rows: CalibrationRow[] = cases.map((c, i) => {
      const enginesMm = measureText(c.text, c.style).width;
      const rendererMm = (widths[i] ?? 0) / PX_PER_MM;
      const deltaMm = enginesMm - rendererMm;
      return {
        text: c.text, styleName: c.styleName,
        enginesMm: r3(enginesMm), rendererMm: r3(rendererMm),
        deltaMm: r3(deltaMm),
        deltaPercent: r3(rendererMm === 0 ? 0 : (Math.abs(deltaMm) / rendererMm) * 100),
      };
    });
    return {
      rows,
      worstMm: r3(Math.max(...rows.map((r) => Math.abs(r.deltaMm)))),
      worstPercent: r3(Math.max(...rows.map((r) => r.deltaPercent))),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function weightOf(st: TextStyle): number {
  return getFace(st.family, st.weight, st.italic === true).renderWeight;
}

function r3(n: number): number { return Math.round(n * 1000) / 1000; }

if (import.meta.filename === process.argv[1]) {
  const result = await calibrate();
  process.stdout.write('text'.padEnd(44) + 'style'.padEnd(16) + 'engine'.padStart(9) + 'renderer'.padStart(10) + 'delta'.padStart(9) + '   delta%\n');
  for (const r of result.rows) {
    process.stdout.write(
      JSON.stringify(r.text).slice(0, 43).padEnd(44) + r.styleName.padEnd(16) +
      String(r.enginesMm).padStart(9) + String(r.rendererMm).padStart(10) +
      String(r.deltaMm).padStart(9) + `   ${r.deltaPercent}%\n`,
    );
  }
  process.stdout.write(`\nworst absolute delta: ${result.worstMm}mm (${result.worstPercent}%)\n`);
  process.stdout.write('safe-area tolerance in src/qa/svgQa.ts must stay at or above the worst absolute delta.\n');
}
