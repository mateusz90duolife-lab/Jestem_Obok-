import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadDeck, expectedLevel, fileStem, slug } from '../src/content/load.ts';
import { validateContent, normalise, similarity } from '../src/content/validate.ts';
import { levelToken } from '../src/tokens.ts';

const deck = loadDeck();

describe('deck inventory', () => {
  test('holds exactly 60 questions, 12 situations and 5 bridges', () => {
    assert.equal(deck.questions.length, 60);
    assert.equal(deck.situations.length, 12);
    assert.equal(deck.bridges.length, 5);
    assert.equal(deck.fronts.length, 77);
    assert.equal(deck.all.length, 78, 'fronts plus one back');
  });

  test('card ids are unique', () => {
    const ids = deck.all.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('question, situation and bridge ids are sequential with no gaps', () => {
    assert.deepEqual(deck.questions.map((q) => q.id), Array.from({ length: 60 }, (_, i) => `Q${String(i + 1).padStart(2, '0')}`));
    assert.deepEqual(deck.situations.map((s) => s.id), Array.from({ length: 12 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`));
    assert.deepEqual(deck.bridges.map((b) => b.id), Array.from({ length: 5 }, (_, i) => `B${String(i + 1).padStart(2, '0')}`));
  });

  test('every question sits in the level its position implies', () => {
    for (const q of deck.questions) {
      assert.equal(q.level, expectedLevel(q.number), `${q.id} level`);
    }
    assert.equal(deck.questions.find((q) => q.id === 'Q13')?.level, '02');
    assert.notEqual(deck.questions.find((q) => q.id === 'Q13')?.level, '01');
  });

  test('every level resolves to a distinct colour, darkening with depth', () => {
    const colours = (['01', '02', '03', '04', '05'] as const).map((l) => levelToken(l));
    assert.equal(new Set(colours.map((c) => c.color)).size, 5);
    const luminance = colours.map((c) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.color.slice(i, i + 2), 16));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    });
    for (let i = 1; i < luminance.length; i++) {
      assert.ok(luminance[i]! < luminance[i - 1]!, `level ${i + 1} must be darker than level ${i}`);
    }
  });

  test('bridges cover all five levels once each', () => {
    assert.deepEqual(deck.bridges.map((b) => b.level), ['01', '02', '03', '04', '05']);
  });
});

describe('content validation', () => {
  test('passes with no failures', () => {
    const report = validateContent(deck);
    const failures = report.issues.filter((i) => i.severity === 'FAIL');
    assert.deepEqual(failures.map((f) => f.message), [], 'no content failures');
    assert.ok(report.ok);
  });

  test('no question is an exact duplicate of another', () => {
    const seen = new Set<string>();
    for (const q of deck.questions) {
      const key = normalise(q.text);
      assert.ok(!seen.has(key), `${q.id} duplicates an earlier question`);
      seen.add(key);
    }
  });

  test('no placeholder text anywhere', () => {
    const all = [
      ...deck.questions.map((q) => q.text),
      ...deck.situations.flatMap((s) => [s.title, ...s.instruction, s.footer]),
      ...deck.bridges.map((b) => b.caption),
    ];
    for (const text of all) {
      assert.doesNotMatch(text, /TODO|TBD|FIXME|lorem|placeholder|\{\{|<[a-z_]+>/i, text);
      assert.ok(text.trim().length > 0);
    }
  });

  test('detects an injected exact duplicate', () => {
    const broken = { ...deck, questions: [...deck.questions.slice(0, 59), { ...deck.questions[58]!, id: 'Q60', number: 60, level: '05' as const }] };
    const report = validateContent({ ...broken, fronts: [...broken.questions, ...deck.situations, ...deck.bridges], all: [...broken.questions, ...deck.situations, ...deck.bridges, { type: 'back', id: 'BACK' }] });
    assert.ok(!report.ok, 'a duplicate question must fail validation');
    assert.ok(report.exactDuplicates.length > 0);
  });

  test('detects a missing card', () => {
    const short = { ...deck, questions: deck.questions.slice(0, 59) };
    const report = validateContent({ ...short, fronts: [...short.questions, ...deck.situations, ...deck.bridges], all: [...short.questions, ...deck.situations, ...deck.bridges, { type: 'back', id: 'BACK' }] });
    assert.ok(!report.ok);
    assert.ok(report.issues.some((i) => i.message.includes('expected 60 questions, found 59')));
    assert.ok(report.issues.some((i) => i.message.includes('missing Q60')));
  });

  test('similarity is symmetric and bounded', () => {
    assert.equal(similarity('Co lubisz', 'Co lubisz'), 1);
    assert.equal(similarity('Co lubisz', 'Zupełnie inne zdanie tutaj'), 0);
    assert.equal(similarity('a b c', 'b c d'), similarity('b c d', 'a b c'));
  });
});

describe('file naming', () => {
  test('stems are ASCII-safe and carry no Polish diacritics', () => {
    for (const card of deck.all) {
      const stem = fileStem(card);
      assert.match(stem, /^[A-Za-z0-9-]+$/, `${card.id} -> ${stem}`);
    }
  });

  test('level slugs transliterate correctly', () => {
    assert.equal(fileStem(deck.questions[24]!), 'Q25-otworz-sie');
    assert.equal(fileStem(deck.questions[36]!), 'Q37-zbliz-sie');
    assert.equal(slug('OTWÓRZ SIĘ'), 'otworz-sie');
    assert.equal(slug('ZBLIŻ SIĘ'), 'zbliz-sie');
    assert.equal(slug('Zażółć gęślą jaźń'), 'zazolc-gesla-jazn');
  });
});
