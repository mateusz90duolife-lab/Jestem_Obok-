import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { projectRoot } from '../paths.ts';
import { resolveFonts } from '../fonts/registry.ts';

const execFileAsync = promisify(execFile);

export const DPI = 300;
export const MM_PER_INCH = 25.4;

export function mmToPx(mm: number, dpi = DPI): number {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

// headless_shell is preferred: its viewport equals --window-size exactly, while
// full Chromium in headless mode still reserves ~87px of window chrome, which
// silently shrinks the rendered page inside a correctly-sized screenshot.
const CANDIDATE_BROWSERS = [
  process.env.CHROMIUM_PATH,
  '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/opt/pw-browsers/chromium/chrome-linux/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
].filter((p): p is string => typeof p === 'string' && p.length > 0);

let browserPath: string | null | undefined;

export function findBrowser(): string | null {
  if (browserPath !== undefined) return browserPath;
  browserPath = CANDIDATE_BROWSERS.find((p) => fs.existsSync(p)) ?? null;
  return browserPath;
}

/**
 * Build a fontconfig root that sees only this project's fonts.
 *
 * Without it the renderer could fall back to any face installed on the machine,
 * which would make output depend on the host - and could quietly paper over a
 * missing font that the font QA is supposed to catch.
 */
export function ensureFontconfig(): string {
  const dir = path.join(projectRoot, '.fontconfig');
  const cache = path.join(dir, 'cache');
  fs.mkdirSync(cache, { recursive: true });
  const fontDir = resolveFonts().directory;
  const conf = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <dir>${fontDir}</dir>
  <cachedir>${cache}</cachedir>
  <match target="font"><edit name="embeddedbitmap" mode="assign"><bool>false</bool></edit></match>
  <match target="font"><edit name="hinting" mode="assign"><bool>true</bool></edit></match>
  <match target="font"><edit name="hintstyle" mode="assign"><const>hintslight</const></edit></match>
</fontconfig>
`;
  const file = path.join(dir, 'fonts.conf');
  fs.writeFileSync(file, conf);
  return file;
}

export interface RenderJob {
  /** Complete HTML document to rasterise. */
  readonly html: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly outPath: string;
}

export class RendererUnavailableError extends Error {}

/** Rasterise one HTML page to PNG at exact pixel dimensions. */
export async function renderHtmlToPng(job: RenderJob): Promise<void> {
  const browser = findBrowser();
  if (!browser) {
    throw new RendererUnavailableError(
      'no Chromium binary found; set CHROMIUM_PATH to enable PNG rendering',
    );
  }
  const fontconfig = ensureFontconfig();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-render-'));
  const htmlPath = path.join(tmp, 'page.html');
  fs.writeFileSync(htmlPath, job.html);
  fs.mkdirSync(path.dirname(job.outPath), { recursive: true });
  try {
    const isShell = browser.includes('headless_shell');
    await execFileAsync(browser, [
      ...(isShell ? [] : ['--headless']),
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--force-color-profile=srgb',
      '--disable-lcd-text',
      '--virtual-time-budget=4000',
      `--window-size=${job.widthPx},${job.heightPx}`,
      `--screenshot=${job.outPath}`,
      `file://${htmlPath}`,
    ], {
      env: { ...process.env, FONTCONFIG_FILE: fontconfig, HOME: tmp },
      maxBuffer: 16 * 1024 * 1024,
      timeout: 120_000,
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  if (!fs.existsSync(job.outPath)) {
    throw new Error(`renderer produced no file for ${job.outPath}`);
  }
}

/** Wrap an SVG string in a page sized to exactly the requested pixels. */
export function svgPage(svg: string, widthPx: number, heightPx: number, background = '#FFFFFF'): string {
  const body = svg.replace(/^<\?xml[^>]*\?>\s*/, '');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:${background};}
svg{display:block;width:${widthPx}px;height:${heightPx}px;}
</style></head><body>${body}</body></html>`;
}

/**
 * Run jobs with bounded concurrency so a full deck render cannot swamp the
 * machine. One Chromium process per page, at most `limit` at a time.
 */
export async function renderAll(
  jobs: readonly RenderJob[],
  limit = Math.max(1, Math.min(4, os.cpus().length - 1)),
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  let index = 0;
  let done = 0;
  const workers = Array.from({ length: Math.min(limit, jobs.length) }, async () => {
    for (;;) {
      const i = index++;
      if (i >= jobs.length) return;
      await renderHtmlToPng(jobs[i]!);
      done++;
      onProgress?.(done, jobs.length);
    }
  });
  await Promise.all(workers);
}
