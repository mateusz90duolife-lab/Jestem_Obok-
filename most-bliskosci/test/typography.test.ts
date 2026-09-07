import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { measureText, wrapText, calculateLines, calculateHeight, calculateBoundingBox, layoutText, ptToMm } from '../src/fonts/measure.ts';
import { resolveFonts, getFace } from '../src/fonts/registry.ts';
import { parseFont, parseGposKerning } from '../src/fonts/ttf.ts';
import { autofit } from '../src/layout/autofit.ts';
import { style, loadTokens } from '../src/tokens.ts';
import fs from 'node:fs';

const question = style('question');
const POLISH = 'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ';

describe('font availability', () => {
  test('every declared face resolves to a real file on disk', () => {
    const fonts = resolveFonts(true);
    assert.deepEqual(fonts.missing, [], 'no font may be missing');
    assert.notEqual(fonts.status, 'MISSING');
    for (const face of fonts.faces.values()) {
      assert.ok(fs.existsSync(face.file), `${face.file} must exist`);
      assert.match(face.sha256, /^[0-9a-f]{64}$/);
    }
  });

  test('substitution is reported, never silent', () => {
    const fonts = resolveFonts(true);
    if (fonts.status === 'SUBSTITUTED') {
      assert.ok(fonts.substitutions.length > 0, 'substituted status must list what was substituted');
      assert.ok(typeof fonts.reason === 'string' && fonts.reason.length > 0, 'substitution must carry a reason');
      for (const s of fonts.substitutions) {
        assert.notEqual(s.specFamily, s.renderFamily);
      }
    } else {
      assert.equal(fonts.substitutions.length, 0);
    }
  });

  test('resolved faces expose only weights the font file actually contains', () => {
    for (const face of resolveFonts().faces.values()) {
      const parsed = parseFont(fs.readFileSync(face.file));
      const sub = parsed.metrics.subfamilyName.toLowerCase();
      const expected = face.renderWeight >= 600 ? /bold/ : /regular|italic|medium|book/;
      assert.match(sub, expected, `${face.file} subfamily '${sub}' vs render weight ${face.renderWeight}`);
    }
  });

  test('both families cover the Polish alphabet and typographic punctuation', () => {
    for (const face of resolveFonts().faces.values()) {
      for (const ch of `${POLISH}–—„”…·`) {
        assert.ok(face.font.cmap.has(ch.codePointAt(0)!), `${face.renderFamily} is missing '${ch}'`);
      }
    }
  });

  test('kerning pairs are read from the font, not assumed', () => {
    const face = getFace('ui', 400);
    assert.ok(face.kerning.size > 100, 'expected a populated kerning table');
    const gid = (c: string): number => face.font.cmap.get(c.codePointAt(0)!)!;
    assert.ok((face.kerning.get((gid('A') << 16) | gid('V')) ?? 0) < 0, 'AV must kern negative');
  });

  test('GPOS extraction returns nothing for a font without the table', () => {
    assert.equal(parseGposKerning(Buffer.alloc(64)).size, 0);
  });
});

describe('measurement', () => {
  test('width scales linearly with point size', () => {
    const a = measureText('Zażółć gęślą', { ...question, sizePt: 10 }).inkWidth;
    const b = measureText('Zażółć gęślą', { ...question, sizePt: 20 }).inkWidth;
    assert.ok(Math.abs(b - a * 2) < 1e-9, `${b} should be twice ${a}`);
  });

  test('tracking adds exactly one advance per character gap', () => {
    const text = 'BLISKO';
    const plain = measureText(text, { ...question, trackingEm: 0 }).inkWidth;
    const tracked = measureText(text, { ...question, trackingEm: 0.1 }).inkWidth;
    const expected = plain + 0.1 * ptToMm(question.sizePt) * (text.length - 1);
    assert.ok(Math.abs(tracked - expected) < 1e-9);
  });

  test('reports missing glyphs rather than measuring them as zero', () => {
    const m = measureText('ok \u{1F600} ok', question);
    assert.deepEqual(m.missingGlyphs, ['\u{1F600}']);
  });

  test('Polish diacritics measure wider than nothing and are all mapped', () => {
    for (const ch of POLISH) {
      assert.ok(measureText(ch, question).inkWidth > 0, ch);
      assert.deepEqual(measureText(ch, question).missingGlyphs, []);
    }
  });

  test('an empty string measures zero', () => {
    assert.equal(measureText('', question).inkWidth, 0);
    assert.deepEqual(wrapText('   ', 44, question).lines, []);
  });
});

describe('line breaking', () => {
  test('never exceeds the column when the text is breakable', () => {
    const w = wrapText('Kiedy ostatnio poczułeś, że naprawdę jesteśmy blisko?', 44, question);
    for (const width of w.widths) assert.ok(width <= 44 + 1e-6, `${width}mm exceeds 44mm`);
    assert.equal(w.hardOverflow, false);
  });

  test('a single unbreakable word wider than the column is flagged, not broken', () => {
    const long = 'niedoprzepuszczalnosciowoscizacjonalizowanym';
    const w = wrapText(long, 20, question);
    assert.equal(w.lines.length, 1);
    assert.equal(w.lines[0], long, 'the word must survive intact');
    assert.equal(w.hardOverflow, true);
  });

  test('a one-letter Polish word never ends a line', () => {
    const cases = [
      'Powiedz mi o tym co dzisiaj czujesz w środku swojego serca teraz',
      'Czy chcesz porozmawiać ze mną o tym w wolnej chwili dzisiaj wieczorem',
      'Zostań tu i pobądź z nami jeszcze przez chwilę w tej ciszy',
    ];
    for (const text of cases) {
      const w = wrapText(text, 44, question);
      for (const line of w.lines.slice(0, -1)) {
        const last = line.split(' ').at(-1)!;
        assert.ok(last.length > 1, `line "${line}" ends with the orphan "${last}"`);
      }
    }
  });

  test('breaking is deterministic', () => {
    const text = 'Co chciałbyś, żebyśmy zawsze chronili w naszej relacji?';
    const first = wrapText(text, 44, question).lines;
    for (let i = 0; i < 5; i++) assert.deepEqual(wrapText(text, 44, question).lines, first);
  });

  test('helper functions agree with each other', () => {
    const text = 'Za co jesteś mi wdzięczny, a rzadko to mówisz?';
    const w = wrapText(text, 44, question);
    assert.equal(calculateLines(text, 44, question), w.lines.length);
    const box = calculateBoundingBox(text, 44, question);
    assert.equal(box.lineCount, w.lines.length);
    assert.equal(box.height, calculateHeight(w.lines.length, question.lineHeightPt));
    assert.ok(Math.abs(box.width - w.maxLineWidth) < 1e-9);
  });
});

describe('auto-fit', () => {
  const base = { baseStyle: question, preferredMeasureMm: 44, maxMeasureMm: 50, availableHeightMm: 54, contentWidthMm: 54 };
  const limits = loadTokens().autofit;

  test('a normal question fits at the preferred setting', () => {
    const r = autofit({ ...base, text: 'Jaki mały gest zawsze poprawia Ci humor?' });
    assert.ok(r.resolved);
    assert.equal(r.outcome.fontSize, limits.preferredFontSizePt);
    assert.equal(r.outcome.lineHeight, limits.preferredLineHeightPt);
  });

  test('never returns more than the maximum number of lines when resolved', () => {
    const r = autofit({ ...base, text: 'Czego oczekujesz ode mnie w takich chwilach, kiedy jest nam naprawdę trudno?' });
    if (r.resolved) assert.ok(r.outcome.lineCount <= limits.maximumLines);
  });

  test('an over-long question exhausts the repair loop and reports failure', () => {
    const tooLong = 'To jest celowo bardzo długie pytanie testowe, które nie ma prawa zmieścić się w sześciu wierszach na tej karcie, ponieważ zawiera zdecydowanie za dużo słów i powinno zostać zgłoszone jako błąd zamiast po cichu przyciete';
    const r = autofit({ ...base, text: tooLong });
    assert.equal(r.resolved, false, 'must not claim to have fitted');
    assert.ok(r.attempts.length <= limits.maxRepairIterations, 'repair loop must be bounded');
    assert.equal(r.attempts.length, 10, 'all ten strategies must be tried before giving up');
    assert.ok(r.chosen.reasons.length > 0, 'failure must carry a reason');
    assert.equal(r.outcome.score, 0);
  });

  test('never goes below the minimum font size or leading', () => {
    const tooLong = 'Bardzo długie pytanie, które wymusza każdą możliwą strategię naprawy i i tak się nie zmieści, mimo wszystkich prób dopasowania rozmiaru pisma oraz interlinii do tej karty';
    const r = autofit({ ...base, text: tooLong });
    for (const attempt of r.attempts) {
      assert.ok(attempt.style.sizePt >= limits.minimumFontSizePt, `${attempt.style.sizePt}pt is below the floor`);
      assert.ok(attempt.style.lineHeightPt >= limits.minimumLineHeightPt, `${attempt.style.lineHeightPt}pt leading is below the floor`);
    }
  });

  test('text is never clipped: every word survives every attempt', () => {
    const text = 'Czego potrzebujesz ode mnie po naprawdę trudnym i długim dniu w pracy?';
    const r = autofit({ ...base, text });
    for (const attempt of r.attempts) {
      assert.equal(attempt.lines.join(' '), text, 'wrapping must preserve the text exactly');
    }
  });

  test('is deterministic across repeated runs', () => {
    const text = 'O czym najtrudniej jest Ci ze mną rozmawiać?';
    const first = autofit({ ...base, text }).outcome;
    for (let i = 0; i < 5; i++) assert.deepEqual(autofit({ ...base, text }).outcome, first);
  });

  test('the chosen candidate is the highest-scoring valid one', () => {
    const r = autofit({ ...base, text: 'Kiedy najbardziej potrzebujesz, żebym po prostu był?' });
    const valid = r.attempts.filter((a) => a.valid);
    assert.ok(valid.length > 0);
    assert.equal(r.chosen.score, Math.max(...valid.map((a) => a.score)));
  });
});

describe('TextLayoutResult contract', () => {
  test('exposes every field the specification requires', () => {
    const result = layoutText('Jaki mały gest zawsze poprawia Ci humor?', question, 44, 54, 16);
    for (const key of ['lines', 'lineCount', 'maxLineWidth', 'totalHeight', 'availableWidth', 'availableHeight',
      'overflowX', 'overflowY', 'overflow', 'fontSize', 'lineHeight', 'scaleFactor', 'remainingWidth', 'remainingHeight']) {
      assert.ok(key in result, `missing field ${key}`);
    }
    assert.equal(result.overflow, result.overflowX || result.overflowY);
    assert.equal(result.remainingWidth, Math.round((44 - result.maxLineWidth) * 1e4) / 1e4);
    assert.equal(result.scaleFactor, 1);
  });

  test('reports overflow when the column is too narrow', () => {
    const result = layoutText('nieprzepuszczalnosciowoscia', question, 8, 54, 16);
    assert.equal(result.overflowX, true);
    assert.equal(result.overflow, true);
  });
});
