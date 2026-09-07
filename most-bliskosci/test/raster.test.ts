import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDeck } from '../src/content/load.ts';
import { layoutCard } from '../src/layout/index.ts';
import { renderCard } from '../src/svg/render.ts';
import { findBrowser, renderHtmlToPng, svgPage, mmToPx } from '../src/render/chromium.ts';
import { decodePng, encodePng, readPngInfo, isPng, hexToRgb } from '../src/qa/png.ts';
import { pixelQa } from '../src/qa/pixel.ts';
import { cardGeometry } from '../src/layout/geometry.ts';
import { MEASUREMENT_TOLERANCE_MM } from '../src/qa/svgQa.ts';

const deck = loadDeck();
const WIDTH_PX = mmToPx(76);
const HEIGHT_PX = mmToPx(106);

describe('raster geometry', () => {
  test('300 DPI maps the bleed artboard onto 898x1252 px', () => {
    assert.equal(WIDTH_PX, 898);
    assert.equal(HEIGHT_PX, 1252);
  });
});

describe('PNG codec', () => {
  test('round-trips an image through the encoder and decoder', () => {
    const w = 9;
    const h = 7;
    const rgba = Buffer.alloc(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      rgba[i * 4] = (i * 7) % 256;
      rgba[i * 4 + 1] = (i * 13) % 256;
      rgba[i * 4 + 2] = (i * 29) % 256;
      rgba[i * 4 + 3] = 255;
    }
    const png = encodePng(w, h, rgba);
    assert.ok(isPng(png));
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-png-')), 'a.png');
    fs.writeFileSync(file, png);
    const decoded = decodePng(file);
    assert.equal(decoded.width, w);
    assert.equal(decoded.height, h);
    assert.deepEqual(decoded.pixels, rgba);
    assert.deepEqual(readPngInfo(file), { width: w, height: h, bitDepth: 8, colorType: 6, interlace: 0 });
  });

  test('rejects a file that is not a PNG', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mb-png-')), 'a.png');
    fs.writeFileSync(file, Buffer.from('definitely not a png at all, not even close'));
    assert.throws(() => readPngInfo(file), /not a PNG/);
  });

  test('parses hex colours', () => {
    assert.deepEqual(hexToRgb('#43202A'), [67, 32, 42]);
    assert.deepEqual(hexToRgb('#F7F3EC'), [247, 243, 236]);
  });
});

describe('rendering', () => {
  const browser = findBrowser();
  let dir = '';
  const rendered = new Map<string, string>();

  before(async () => {
    assert.ok(browser, 'PNG rendering is BLOCKED: no Chromium binary found. Set CHROMIUM_PATH.');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mb-raster-'));
    for (const id of ['Q07', 'S01', 'BACK']) {
      const card = deck.all.find((c) => c.id === id)!;
      const layout = layoutCard(card);
      const out = path.join(dir, `${id}.png`);
      await renderHtmlToPng({
        html: svgPage(renderCard(layout), WIDTH_PX, HEIGHT_PX, layout.background),
        widthPx: WIDTH_PX, heightPx: HEIGHT_PX, outPath: out,
      });
      rendered.set(id, out);
    }
  });

  test('produces a valid PNG at exactly the expected size', () => {
    for (const [id, file] of rendered) {
      assert.ok(fs.existsSync(file), id);
      assert.ok(fs.statSync(file).size > 0, `${id} is empty`);
      const info = readPngInfo(file);
      assert.equal(info.width, WIDTH_PX, id);
      assert.equal(info.height, HEIGHT_PX, id);
    }
  });

  test('ink stays inside the safe area on light and dark cards alike', () => {
    for (const [id, file] of rendered) {
      const layout = layoutCard(deck.all.find((c) => c.id === id)!);
      const result = pixelQa(id, file, layout.background);
      assert.deepEqual(result.violations, [], id);
      assert.ok(result.inkBox !== null, `${id} rendered no ink at all`);
      assert.ok(result.inkPixels > 1000, `${id} rendered suspiciously little ink`);
    }
  });

  test('rendered ink matches where the engine said it would land', () => {
    const geo = cardGeometry();
    const id = 'Q07';
    const layout = layoutCard(deck.all.find((c) => c.id === id)!);
    const result = pixelQa(id, rendered.get(id)!, layout.background);
    const predicted = layout.nodes.filter((nd) => !nd.decorative);
    const left = Math.min(...predicted.map((nd) => nd.box.x));
    const right = Math.max(...predicted.map((nd) => nd.box.x + nd.box.width));
    const tolerancePx = mmToPx(MEASUREMENT_TOLERANCE_MM + 0.6);
    assert.ok(result.inkBox);
    assert.ok(Math.abs(result.inkBox.x - mmToPx(left)) < tolerancePx,
      `ink starts at ${result.inkBox.x}px, engine predicted ${mmToPx(left)}px`);
    assert.ok(result.inkBox.x + result.inkBox.width <= mmToPx(right) + tolerancePx,
      `ink ends past the engine's prediction`);
    assert.ok(mmToPx(geo.safe.x) <= result.inkBox.x + tolerancePx);
  });

  test('rendering is deterministic: the same SVG rasterises identically', async () => {
    const layout = layoutCard(deck.questions[0]!);
    const a = path.join(dir, 'det-a.png');
    const b = path.join(dir, 'det-b.png');
    const html = svgPage(renderCard(layout), WIDTH_PX, HEIGHT_PX, layout.background);
    await renderHtmlToPng({ html, widthPx: WIDTH_PX, heightPx: HEIGHT_PX, outPath: a });
    await renderHtmlToPng({ html, widthPx: WIDTH_PX, heightPx: HEIGHT_PX, outPath: b });
    assert.deepEqual(fs.readFileSync(a), fs.readFileSync(b));
  });

  test('pixel QA catches ink that crosses the safe area', async () => {
    const layout = layoutCard(deck.questions[0]!);
    const rogue = renderCard(layout).replace('</svg>',
      '<rect x="3.5" y="3.5" width="3" height="3" fill="#211D1A"/></svg>');
    const out = path.join(dir, 'rogue.png');
    await renderHtmlToPng({
      html: svgPage(rogue, WIDTH_PX, HEIGHT_PX, layout.background),
      widthPx: WIDTH_PX, heightPx: HEIGHT_PX, outPath: out,
    });
    const result = pixelQa('FIXTURE', out, layout.background);
    assert.ok(result.violations.length > 0, 'a mark in the bleed must be detected');
    assert.ok(result.issues.every((i) => i.severity === 'FAIL'));
  });
});
