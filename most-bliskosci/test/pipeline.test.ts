import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { projectRoot, outputDir } from '../src/paths.ts';
import { loadDeck } from '../src/content/load.ts';
import { fileStem } from '../src/content/load.ts';
import { readPngInfo } from '../src/qa/png.ts';

const execFileAsync = promisify(execFile);
const deck = loadDeck();
const hasOutput = fs.existsSync(path.join(outputDir, 'manifest.json'));

/**
 * These assert the artefacts of the most recent `npm run build`. They are not
 * skipped when the output is absent: an unbuilt tree is a failure to report,
 * not a reason to pass.
 */
describe('build artefacts', () => {
  test('a build has been run', () => {
    assert.ok(hasOutput, 'output/manifest.json is missing — run: npm run build');
  });

  test('every card has an SVG and a PNG on disk, named without diacritics', () => {
    assert.ok(hasOutput);
    for (const card of deck.all) {
      const stem = fileStem(card);
      const isBack = card.type === 'back';
      const svg = path.join(outputDir, isBack ? 'back' : 'front', `${stem}.svg`);
      const png = path.join(outputDir, 'png', isBack ? 'back' : 'front', `${stem}.png`);
      assert.ok(fs.existsSync(svg), `missing ${svg}`);
      assert.ok(fs.existsSync(png), `missing ${png}`);
      assert.ok(fs.statSync(png).size > 0, `${png} is empty`);
      assert.match(stem, /^[A-Za-z0-9-]+$/);
    }
  });

  test('77 front SVG, 77 front PNG, 1 back of each', () => {
    assert.ok(hasOutput);
    assert.equal(fs.readdirSync(path.join(outputDir, 'front')).filter((f) => f.endsWith('.svg')).length, 77);
    assert.equal(fs.readdirSync(path.join(outputDir, 'png', 'front')).filter((f) => f.endsWith('.png')).length, 77);
    assert.equal(fs.readdirSync(path.join(outputDir, 'back')).filter((f) => f.endsWith('.svg')).length, 1);
    assert.equal(fs.readdirSync(path.join(outputDir, 'png', 'back')).filter((f) => f.endsWith('.png')).length, 1);
  });

  test('every PNG is a valid image at 898x1252', () => {
    assert.ok(hasOutput);
    for (const dir of ['front', 'back']) {
      for (const f of fs.readdirSync(path.join(outputDir, 'png', dir))) {
        const info = readPngInfo(path.join(outputDir, 'png', dir, f));
        assert.equal(info.width, 898, f);
        assert.equal(info.height, 1252, f);
      }
    }
  });

  test('the required final artefacts all exist', () => {
    assert.ok(hasOutput);
    for (const rel of [
      'manifest.json',
      'contact-sheet/all-77-cards.png',
      'proof/index.html',
      'proof/extremes/extremes.png',
      'qa/report.json', 'qa/report.html',
      'qa/overflow-report.json', 'qa/overflow-report.html',
      'qa/content-revisions.json',
      'qa/content-stats.json', 'qa/design-stats.json',
      'print/print-spec.json',
    ]) {
      assert.ok(fs.existsSync(path.join(outputDir, rel)), `missing output/${rel}`);
    }
  });

  test('the contact sheet is a valid PNG sized for a 7x11 grid', () => {
    assert.ok(hasOutput);
    const info = readPngInfo(path.join(outputDir, 'contact-sheet', 'all-77-cards.png'));
    assert.equal(info.width, 1178);
    assert.equal(info.height, 2759);
  });

  test('the manifest agrees with the files on disk', () => {
    assert.ok(hasOutput);
    const manifest = JSON.parse(fs.readFileSync(path.join(outputDir, 'manifest.json'), 'utf8')) as {
      totalCards: number; questions: number; situations: number; bridges: number;
      cards: Array<{ id: string; svg: string; png: string; svgSha256: string; pngSha256: string | null }>;
    };
    assert.equal(manifest.totalCards, 77);
    assert.equal(manifest.questions, 60);
    assert.equal(manifest.situations, 12);
    assert.equal(manifest.bridges, 5);
    assert.equal(manifest.cards.length, 78, 'the manifest lists the back as well');
    for (const entry of manifest.cards) {
      assert.ok(fs.existsSync(path.join(outputDir, entry.svg)), entry.svg);
      assert.ok(fs.existsSync(path.join(outputDir, entry.png)), entry.png);
      assert.match(entry.svgSha256, /^[0-9a-f]{64}$/);
      assert.match(entry.pngSha256 ?? '', /^[0-9a-f]{64}$/);
    }
    const ids = manifest.cards.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('the QA report reports zero overflow and zero safe-area violations', () => {
    assert.ok(hasOutput);
    const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'qa', 'report.json'), 'utf8')) as {
      automatedStatus: string; humanReview: string; counts: Record<string, number>;
      failures: unknown[]; cards: Array<{ status: string }>; stages: Array<{ name: string; status: string }>;
    };
    assert.equal(report.counts.overflow, 0);
    assert.equal(report.counts.safeAreaViolations, 0);
    assert.equal(report.counts.png, 78);
    assert.deepEqual(report.failures, []);
    assert.equal(report.automatedStatus, 'PASS');
    assert.equal(report.humanReview, 'REQUIRED', 'machine validation must never claim human sign-off');
    assert.ok(!report.stages.some((s) => s.status === 'BLOCKED'), 'no stage may be blocked in a passing build');
    assert.ok(!report.cards.some((c) => c.status === 'FAIL'));
  });

  test('the CARD / MASTER print variant is exported at 70x100mm', () => {
    assert.ok(hasOutput);
    const dir = path.join(outputDir, 'print', 'master-70x100');
    assert.equal(fs.readdirSync(path.join(dir, 'front')).length, 77);
    const svg = fs.readFileSync(path.join(dir, 'front', 'Q01-poznaj.svg'), 'utf8');
    assert.match(svg, /width="70mm"/);
    assert.match(svg, /viewBox="3 3 70 100"/);
  });

  test('no debug artefact escaped into the production output', () => {
    assert.ok(hasOutput);
    for (const dir of ['front', 'back']) {
      for (const f of fs.readdirSync(path.join(outputDir, dir))) {
        assert.ok(!fs.readFileSync(path.join(outputDir, dir, f), 'utf8').includes('id="debug"'), f);
      }
    }
  });
});

describe('CLI', () => {
  test('build with a blocked renderer reports BLOCKED and exits non-zero', async () => {
    // Redirected to a scratch tree so exercising the CLI cannot disturb the
    // committed output the tests above assert on.
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-cli-'));
    const result = await execFileAsync(process.execPath, ['src/cli.ts', 'build', '--skip-render'], {
      cwd: projectRoot, maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, MB_OUTPUT_DIR: scratch },
    }).then(
      (r) => ({ code: 0, stdout: r.stdout }),
      (e: { code?: number; stdout?: string }) => ({ code: e.code ?? 1, stdout: e.stdout ?? '' }),
    );
    assert.notEqual(result.code, 0, 'a build that could not verify PNGs must not exit 0');
    assert.match(result.stdout, /STATUS: FAIL/);
    assert.match(result.stdout, /Pixel QA:\s+BLOCKED/);
    fs.rmSync(scratch, { recursive: true, force: true });
  });

  test('validate passes on the committed content', async () => {
    const { stdout } = await execFileAsync(process.execPath, ['src/cli.ts', 'validate'], {
      cwd: projectRoot, maxBuffer: 8 * 1024 * 1024,
    });
    assert.match(stdout, /VALIDATE: PASS/);
  });

  test('inspect reports the measurements for one card', async () => {
    const { stdout } = await execFileAsync(process.execPath, ['src/cli.ts', 'inspect', 'Q37'], {
      cwd: projectRoot, maxBuffer: 8 * 1024 * 1024,
    });
    assert.match(stdout, /CARD {2}Q37/);
    assert.match(stdout, /FIT {3}16pt \/ 21pt/);
    assert.match(stdout, /overflow=false/);
  });
});
