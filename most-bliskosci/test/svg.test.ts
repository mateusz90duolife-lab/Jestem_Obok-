import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDeck } from '../src/content/load.ts';
import { layoutCard } from '../src/layout/index.ts';
import { renderCard } from '../src/svg/render.ts';
import { checkSvg } from '../src/qa/svgQa.ts';
import { toTrimVariant } from '../src/build/print.ts';
import { esc, n } from '../src/svg/builder.ts';

const deck = loadDeck();
const svgs = new Map(deck.all.map((c) => [c.id, renderCard(layoutCard(c))] as const));

describe('SVG structure', () => {
  test('every card declares the bleed artboard', () => {
    for (const [id, svg] of svgs) {
      assert.match(svg, /width="76mm"/, id);
      assert.match(svg, /height="106mm"/, id);
      assert.match(svg, /viewBox="0 0 76 106"/, id);
    }
  });

  test('is well-formed enough to parse: tags balance and entities are escaped', () => {
    for (const [id, svg] of svgs) {
      assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), id);
      assert.ok(svg.trimEnd().endsWith('</svg>'), id);
      const open = (svg.match(/<svg\b/g) ?? []).length;
      const close = (svg.match(/<\/svg>/g) ?? []).length;
      assert.equal(open, close, `${id} svg tags`);
      for (const tag of ['text', 'title', 'desc']) {
        assert.equal((svg.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length,
          (svg.match(new RegExp(`</${tag}>`, 'g')) ?? []).length, `${id} ${tag} tags`);
      }
      // No raw & outside an entity.
      assert.ok(!/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(svg), `${id} has an unescaped ampersand`);
    }
  });

  test('carries no external or scripted resources', () => {
    for (const [id, svg] of svgs) {
      for (const banned of ['<script', '<image', 'xlink:href', '@import', 'foreignObject', 'http://', 'https://']) {
        if (banned === 'http://' || banned === 'https://') {
          const hits = [...svg.matchAll(/https?:\/\/[^"'\s]+/g)].map((m) => m[0]);
          for (const hit of hits) assert.ok(hit.startsWith('http://www.w3.org/2000/svg'), `${id} references ${hit}`);
          continue;
        }
        assert.ok(!svg.includes(banned), `${id} contains ${banned}`);
      }
    }
  });

  test('never ships a debug overlay', () => {
    for (const [id, svg] of svgs) assert.ok(!svg.includes('id="debug"'), id);
  });

  test('the debug variant does carry an overlay, and is separate', () => {
    const debug = renderCard(layoutCard(deck.questions[0]!), { debug: true });
    assert.ok(debug.includes('id="debug"'));
    assert.ok(debug.includes('DEBUG OVERLAY'));
    assert.notEqual(debug, svgs.get('Q01'));
  });

  test('passes the full SVG QA with no issues', () => {
    for (const card of deck.all) {
      const layout = layoutCard(card);
      const result = checkSvg(card.id, renderCard(layout), layout);
      assert.deepEqual(result.issues.map((i) => i.message), [], card.id);
      assert.equal(result.widthMm, 76);
      assert.equal(result.heightMm, 106);
      assert.equal(result.viewBox, '0 0 76 106');
    }
  });

  test('QA rejects wrong dimensions', () => {
    const layout = layoutCard(deck.questions[0]!);
    const broken = renderCard(layout).replace('width="76mm"', 'width="80mm"');
    const result = checkSvg('Q01', broken, layout);
    assert.ok(result.issues.some((i) => i.message.includes('SVG width is 80mm')));
  });

  test('QA rejects an injected remote reference', () => {
    const layout = layoutCard(deck.questions[0]!);
    const broken = renderCard(layout).replace('</svg>', '<image href="https://example.com/a.png"/></svg>');
    const result = checkSvg('Q01', broken, layout);
    assert.ok(result.issues.some((i) => i.message.includes('raster <image>')));
    assert.ok(result.issues.some((i) => i.message.includes('remote URL')));
  });
});

describe('print variants', () => {
  test('CARD / MASTER is the same layout cropped to trim', () => {
    const bleed = svgs.get('Q01')!;
    const master = toTrimVariant(bleed, 3, 3, 70, 100);
    assert.match(master, /width="70mm"/);
    assert.match(master, /height="100mm"/);
    assert.match(master, /viewBox="3 3 70 100"/);
    // Everything from the first drawing element onwards must be byte-identical:
    // only the root element's box changes, never a coordinate inside it.
    const drawing = (s: string): string => s.slice(s.indexOf('<rect id="background"'));
    assert.equal(drawing(master), drawing(bleed), 'no coordinate may change between variants');
    assert.ok(master.includes('CARD / MASTER export, cropped to trim'), 'the variant must say what it is');
  });
});

describe('SVG builder', () => {
  test('escapes the characters that would break the document', () => {
    assert.equal(esc('a & b < c > d "e"'), 'a &amp; b &lt; c &gt; d &quot;e&quot;');
  });

  test('formats numbers deterministically and never emits negative zero', () => {
    assert.equal(n(1.23456), '1.235');
    assert.equal(n(-0.0001), '0');
    assert.equal(n(38), '38');
  });
});
