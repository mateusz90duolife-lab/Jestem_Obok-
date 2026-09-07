import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadDeck } from '../src/content/load.ts';
import { layoutCard } from '../src/layout/index.ts';
import { renderCard } from '../src/svg/render.ts';
import { generate } from '../src/build/generate.ts';
import { computeBaseline, readBaseline } from '../scripts/update-baseline.ts';
import { CONTACT_COLUMNS, CONTACT_ROWS } from '../src/qa/sheets.ts';
import { resolveFonts } from '../src/fonts/registry.ts';

const deck = loadDeck();

describe('determinism', () => {
  test('the same input yields byte-identical SVG', () => {
    for (const card of deck.all) {
      const a = renderCard(layoutCard(card));
      const b = renderCard(layoutCard(card));
      assert.equal(a, b, card.id);
    }
  });

  test('output carries no timestamps or run-specific values', () => {
    for (const card of deck.all) {
      const svg = renderCard(layoutCard(card));
      assert.ok(!/\d{4}-\d{2}-\d{2}T\d{2}:/.test(svg), `${card.id} contains a timestamp`);
      assert.ok(!/\b(19|20)\d{2}-\d{2}-\d{2}\b/.test(svg), `${card.id} contains a date`);
      assert.ok(!/Math\.random|uuid|[0-9a-f]{8}-[0-9a-f]{4}/.test(svg), `${card.id} contains a random id`);
    }
  });

  test('a full regeneration reproduces the same files', () => {
    const first = generate();
    const second = generate();
    assert.equal(first.length, second.length);
    for (const [i, card] of first.entries()) {
      assert.equal(card.svgSha256, second[i]!.svgSha256, card.card.id);
      assert.equal(card.svgRelative, second[i]!.svgRelative);
    }
  });

  test('generating one card uses the same path as the full build', () => {
    const all = generate();
    const single = generate(['Q37']);
    assert.equal(single.length, 1);
    const fromAll = all.find((c) => c.card.id === 'Q37')!;
    assert.equal(single[0]!.svgSha256, fromAll.svgSha256);
    assert.equal(single[0]!.svg, fromAll.svg);
  });

  test('an unknown card id is rejected rather than silently ignored', () => {
    assert.throws(() => generate(['Q99']), /unknown card id/);
  });
});

describe('visual regression baseline', () => {
  const baseline = readBaseline();

  test('a baseline exists', () => {
    assert.ok(baseline, 'run: node scripts/update-baseline.ts');
  });

  test('no card has changed unintentionally', () => {
    assert.ok(baseline);
    const current = computeBaseline();
    const changed = Object.keys(current.cards).filter((id) => baseline.cards[id] !== current.cards[id]);
    assert.deepEqual(changed, [],
      `${changed.length} card(s) differ from the baseline. If the change is intended, run: node scripts/update-baseline.ts`);
  });

  test('the baseline covers all 78 artefacts and records its inputs', () => {
    assert.ok(baseline);
    assert.equal(Object.keys(baseline.cards).length, 78);
    assert.equal(baseline.contentVersion, deck.contentVersion);
    assert.equal(baseline.fontStatus, resolveFonts().status);
  });

  test('the baseline pins the font files, so a font swap shows up as a change', () => {
    assert.ok(baseline);
    const fonts = resolveFonts();
    for (const [key, face] of fonts.faces) {
      assert.equal(baseline.fontFiles[key], face.sha256, `font ${key} changed`);
    }
  });

  test('changing a colour changes the hash, so a token edit cannot slip through', () => {
    const layout = layoutCard(deck.questions[0]!);
    const before = createHash('sha256').update(renderCard(layout)).digest('hex');
    const [bg, ...rest] = layout.nodes;
    assert.ok(bg && bg.kind === 'rect');
    const tweaked = renderCard({ ...layout, nodes: [{ ...bg, fill: '#000000' }, ...rest] });
    assert.notEqual(createHash('sha256').update(tweaked).digest('hex'), before);
  });
});

describe('contact sheet invariants', () => {
  test('the grid is exactly 7 by 11', () => {
    assert.equal(CONTACT_COLUMNS, 7);
    assert.equal(CONTACT_ROWS, 11);
    assert.equal(CONTACT_COLUMNS * CONTACT_ROWS, 77);
  });

  test('deck order is Q01..Q60, then S01..S12, then B01..B05, with no back', () => {
    const ids = deck.fronts.map((c) => c.id);
    assert.equal(ids.length, 77);
    assert.equal(ids[0], 'Q01');
    assert.equal(ids[59], 'Q60');
    assert.equal(ids[60], 'S01');
    assert.equal(ids[71], 'S12');
    assert.equal(ids[72], 'B01');
    assert.equal(ids[76], 'B05');
    assert.ok(!ids.includes('BACK'), 'the back is not part of the contact sheet');
  });

  test('a missing card is detectable by count and by id', () => {
    const ids = deck.fronts.map((c) => c.id).filter((id) => id !== 'Q42');
    assert.equal(ids.length, 76);
    assert.notEqual(ids.length, 77, 'expected 77, actual 76 must not pass');
    const expected = deck.fronts.map((c) => c.id);
    const missing = expected.filter((id) => !ids.includes(id));
    assert.deepEqual(missing, ['Q42']);
  });

  test('a duplicated card is detectable', () => {
    const ids = deck.fronts.map((c) => c.id);
    ids[5] = ids[4]!;
    assert.notEqual(new Set(ids).size, ids.length);
  });
});
