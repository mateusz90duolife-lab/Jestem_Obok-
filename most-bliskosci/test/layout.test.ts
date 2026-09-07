import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDeck } from '../src/content/load.ts';
import { layoutCard, backCard, questionCard } from '../src/layout/index.ts';
import { cardGeometry, contains, column, snapBaseline } from '../src/layout/geometry.ts';
import { bridgeMark } from '../src/layout/bridgeMark.ts';
import { renderCard } from '../src/svg/render.ts';
import { checkSvg, MEASUREMENT_TOLERANCE_MM } from '../src/qa/svgQa.ts';
import { loadTokens, validateTokens, color, levelToken, style, spacing } from '../src/tokens.ts';
import type { CardLayout, LayoutNode } from '../src/types.ts';

const deck = loadDeck();
const geo = cardGeometry();
const layouts = new Map(deck.all.map((c) => [c.id, layoutCard(c)] as const));

describe('geometry', () => {
  test('matches the printed specification exactly', () => {
    assert.deepEqual(geo.trim, { x: 3, y: 3, width: 70, height: 100 });
    assert.deepEqual(geo.safe, { x: 8, y: 8, width: 60, height: 90 });
    assert.deepEqual(geo.full, { x: 0, y: 0, width: 76, height: 106 });
    assert.equal(geo.viewBox, '0 0 76 106');
    assert.equal(geo.bleedMm, 3);
    assert.equal(geo.cornerRadiusMm, 4);
  });

  test('safe area sits inside trim, trim inside the bleed artboard', () => {
    assert.ok(contains(geo.trim, geo.safe));
    assert.ok(contains(geo.full, geo.trim));
    assert.ok(contains(geo.safe, geo.content), 'the content column must stay inside the safe area');
  });

  test('the 12-column grid spans the content box', () => {
    const first = column(0);
    const last = column(11);
    assert.ok(Math.abs(first.x - geo.content.x) < 1e-9);
    assert.ok(Math.abs(last.x + last.width - (geo.content.x + geo.content.width)) < 1e-9);
    assert.equal(snapBaseline(15.4), 15);
  });

  test('token validation rejects a broken geometry', () => {
    const tokens = structuredClone(loadTokens()) as ReturnType<typeof loadTokens>;
    const broken = { ...tokens, geometry: { ...tokens.geometry, bleedMm: 5 } };
    assert.throws(() => validateTokens(broken), /full width/);
  });
});

describe('bridge mark', () => {
  test('is symmetric about its centre and leaves a gap', () => {
    const mark = bridgeMark({ cx: 38, cy: 50, width: 20, stroke: '#B69A68' });
    assert.equal(mark.nodes.length, 2);
    assert.ok(Math.abs(mark.box.x + mark.box.width / 2 - 38) < 1e-9, 'box must centre on cx');
    assert.ok(mark.gap > 0, 'the span must keep its centre gap');
    assert.ok(mark.rise > 0);
  });

  test('scales as one shape: rise and gap follow the span', () => {
    const small = bridgeMark({ cx: 38, cy: 50, width: 15, stroke: '#000' });
    const large = bridgeMark({ cx: 38, cy: 50, width: 40, stroke: '#000' });
    assert.ok(Math.abs(small.rise / small.width - large.rise / large.width) < 1e-9);
    assert.ok(Math.abs(small.gap / small.width - large.gap / large.width) < 1e-9);
  });

  test('emits identical geometry for identical input', () => {
    const a = bridgeMark({ cx: 38, cy: 50, width: 20, stroke: '#B69A68' });
    const b = bridgeMark({ cx: 38, cy: 50, width: 20, stroke: '#B69A68' });
    assert.deepEqual(a.nodes.map((n) => n.d), b.nodes.map((n) => n.d));
  });
});

describe('card layout', () => {
  test('no card reports a layout failure', () => {
    for (const [id, layout] of layouts) {
      assert.deepEqual(layout.failures, [], `${id} failures`);
    }
  });

  test('no question overflows', () => {
    for (const [id, layout] of layouts) {
      for (const t of layout.textLayouts) {
        assert.equal(t.overflow, false, `${id} overflow`);
        assert.equal(t.overflowX, false, `${id} overflowX`);
        assert.equal(t.overflowY, false, `${id} overflowY`);
      }
    }
  });

  test('every non-decorative element stays inside the safe area', () => {
    for (const [id, layout] of layouts) {
      for (const node of layout.nodes) {
        if (node.decorative) continue;
        const b = node.box;
        const inflated = { x: b.x - MEASUREMENT_TOLERANCE_MM, y: b.y - MEASUREMENT_TOLERANCE_MM, width: b.width + 2 * MEASUREMENT_TOLERANCE_MM, height: b.height + 2 * MEASUREMENT_TOLERANCE_MM };
        assert.ok(contains(geo.safe, inflated), `${id}: ${node.role} at ${JSON.stringify(b)} leaves the safe area`);
      }
    }
  });

  test('the declared background matches the background actually drawn', () => {
    // Pixel QA classifies ink by distance from layout.background, so a drift
    // between the metadata and the drawn rect would silently break that check.
    for (const [id, layout] of layouts) {
      const bg = layout.nodes[0]!;
      assert.equal(bg.kind === 'rect' ? bg.fill : null, layout.background, `${id} background`);
    }
  });

  test('backgrounds are full bleed and cover the whole artboard', () => {
    for (const [id, layout] of layouts) {
      const bg = layout.nodes[0]!;
      assert.equal(bg.kind, 'rect');
      assert.equal(bg.role, 'background');
      assert.equal(bg.decorative, true, `${id} background must be exempt from safe-area checks`);
      assert.deepEqual(bg.kind === 'rect' ? bg.rect : null, geo.full);
    }
  });

  test('question cards share one frame: header and footer never move', () => {
    const questions = deck.questions.map((q) => layouts.get(q.id)!);
    const baselineOf = (l: CardLayout, role: string): number => {
      const node = l.nodes.find((n) => n.role === role);
      assert.ok(node && node.kind === 'text', `${l.cardId} is missing ${role}`);
      return node.kind === 'text' ? node.baseline : NaN;
    };
    const xOf = (l: CardLayout, role: string): number => {
      const node = l.nodes.find((n) => n.role === role);
      return node && node.kind === 'text' ? node.x : NaN;
    };
    for (const l of questions) {
      assert.equal(baselineOf(l, 'header-number'), spacing('headerNumberBaselineMm'), `${l.cardId} header number`);
      assert.equal(baselineOf(l, 'header-level'), spacing('headerLevelBaselineMm'), `${l.cardId} header level`);
      assert.equal(baselineOf(l, 'footer-number'), spacing('footerNumberBaselineMm'), `${l.cardId} footer`);
      assert.equal(xOf(l, 'header-number'), geo.content.x);
      assert.equal(xOf(l, 'header-level'), geo.content.x);
    }
  });

  test('the question block is centred between header and footer whatever its height', () => {
    const top = spacing('questionBlockTopMm');
    const bottom = spacing('questionBlockBottomMm');
    for (const q of deck.questions) {
      const l = layouts.get(q.id)!;
      const lines = l.nodes.filter((n) => n.role.startsWith('question-line-'));
      assert.ok(lines.length > 0);
      const first = lines[0]!.box;
      const last = lines[lines.length - 1]!.box;
      const slackTop = first.y - top;
      const slackBottom = bottom - (last.y + last.height);
      assert.ok(slackTop > 0 && slackBottom > 0, `${q.id} block leaves its band`);
      assert.ok(Math.abs(slackTop - slackBottom) < 2.5, `${q.id} block is off centre by ${Math.abs(slackTop - slackBottom)}mm`);
    }
  });

  test('question cards carry no logo, so nothing outranks the question', () => {
    for (const q of deck.questions) {
      const roles = layouts.get(q.id)!.nodes.map((n) => n.role);
      assert.ok(!roles.some((r) => r.startsWith('logo')), `${q.id} must not carry the logo`);
    }
  });

  test('the question is the largest type on its card', () => {
    for (const q of deck.questions) {
      const texts = layouts.get(q.id)!.nodes.filter((n): n is Extract<LayoutNode, { kind: 'text' }> => n.kind === 'text');
      const questionSize = texts.find((n) => n.role === 'question-line-1')!.style.sizePt;
      for (const t of texts) {
        if (t.role.startsWith('question-line-')) continue;
        assert.ok(t.style.sizePt < questionSize, `${q.id}: ${t.role} at ${t.style.sizePt}pt rivals the question at ${questionSize}pt`);
      }
    }
  });
});

describe('design invariants', () => {
  test('backgrounds follow the specified tokens', () => {
    for (const q of deck.questions) assert.equal(layouts.get(q.id)!.background, color('ivory100'));
    for (const s of deck.situations) assert.equal(layouts.get(s.id)!.background, color('wineDark'));
    for (const b of deck.bridges) assert.equal(layouts.get(b.id)!.background, color('ivory100'));
    assert.equal(layouts.get('BACK')!.background, color('wineDark'));
  });

  test('the bridge mark is always champagne', () => {
    for (const layout of layouts.values()) {
      for (const node of layout.nodes) {
        if (!node.role.startsWith('bridge-mark')) continue;
        assert.equal(node.kind === 'path' ? node.stroke : null, color('champagne'), `${layout.cardId} mark colour`);
      }
    }
  });

  test('question text is set in ink, and the level label in its level colour', () => {
    for (const q of deck.questions) {
      const nodes = layouts.get(q.id)!.nodes.filter((n): n is Extract<LayoutNode, { kind: 'text' }> => n.kind === 'text');
      for (const n of nodes.filter((n) => n.role.startsWith('question-line-'))) {
        assert.equal(n.fill, color('ink'));
      }
      assert.equal(nodes.find((n) => n.role === 'header-level')!.fill, levelToken(q.level).color);
    }
  });

  test('no gradients, no filters, no shadows reach the artwork', () => {
    for (const layout of layouts.values()) {
      const svg = renderCard(layout);
      for (const banned of ['<linearGradient', '<radialGradient', '<filter', 'feGaussianBlur', 'drop-shadow', 'opacity=']) {
        assert.ok(!svg.includes(banned), `${layout.cardId} contains ${banned}`);
      }
    }
  });

  test('the back takes no arguments and cannot leak a level or number', () => {
    const back = backCard();
    assert.equal(back.level, undefined);
    assert.equal(backCard.length, 0, 'back must be parameterless by construction');
    const svg = renderCard(back);
    for (const level of ['POZNAJ', 'ODKRYJ', 'OTWÓRZ SIĘ', 'ZBLIŻ SIĘ', 'WYBIERZ NAS']) {
      assert.ok(!svg.includes(level), `the back must not mention ${level}`);
    }
    assert.ok(!/>\s*\d{2}\s*</.test(svg), 'the back must show no card number');
    assert.deepEqual(renderCard(backCard()), svg, 'one back for the whole deck');
  });

  test('situation cards read differently from question cards', () => {
    const s = layouts.get('S01')!;
    const q = layouts.get('Q01')!;
    assert.notEqual(s.background, q.background);
    assert.ok(s.nodes.some((n) => n.role === 'header-label'));
    assert.ok(s.nodes.some((n) => n.role === 'footer-label'));
    assert.ok(q.nodes.some((n) => n.role === 'footer-number'));
  });
});

describe('safe-area detection', () => {
  test('flags an element deliberately placed outside the safe area', () => {
    const base = layouts.get('Q01')!;
    const rogue: LayoutNode = {
      kind: 'rect', role: 'rogue-fixture',
      rect: { x: 4, y: 4, width: 10, height: 10 },
      fill: '#000000',
      box: { x: 4, y: 4, width: 10, height: 10 },
    };
    const broken: CardLayout = { ...base, nodes: [...base.nodes, rogue] };
    const result = checkSvg('FIXTURE', renderCard(broken), broken);
    assert.ok(result.safeAreaViolations.length > 0, 'a rogue element must be caught');
    assert.ok(result.safeAreaViolations.some((v) => v.includes('rogue-fixture')));
    assert.ok(result.issues.some((i) => i.severity === 'FAIL'));
  });

  test('flags an element outside the trim box as well', () => {
    const base = layouts.get('Q01')!;
    const rogue: LayoutNode = {
      kind: 'rect', role: 'bleed-fixture',
      rect: { x: 0.5, y: 0.5, width: 2, height: 2 }, fill: '#000000',
      box: { x: 0.5, y: 0.5, width: 2, height: 2 },
    };
    const broken: CardLayout = { ...base, nodes: [...base.nodes, rogue] };
    const result = checkSvg('FIXTURE', renderCard(broken), broken);
    assert.ok(result.safeAreaViolations.some((v) => v.includes('trim box')));
  });

  test('a decorative full-bleed element is not a violation', () => {
    const result = checkSvg('Q01', renderCard(layouts.get('Q01')!), layouts.get('Q01')!);
    assert.deepEqual(result.safeAreaViolations, []);
  });
});
