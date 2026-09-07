import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calibrate } from '../scripts/calibrate.ts';
import { findBrowser } from '../src/render/chromium.ts';
import { MEASUREMENT_TOLERANCE_MM } from '../src/qa/svgQa.ts';

/**
 * The layout engine and the renderer measure text by different routes. If they
 * ever drift apart, every geometric guarantee in this pipeline weakens, so the
 * agreement is asserted rather than assumed.
 */
describe('engine / renderer agreement', () => {
  test('a renderer is available to calibrate against', () => {
    assert.ok(findBrowser(), 'PNG rendering and calibration are BLOCKED: no Chromium binary found');
  });

  test('measured width agrees with rendered width within the safe-area tolerance', async () => {
    const result = await calibrate();
    assert.ok(result.rows.length >= 10, 'expected a full sample set');
    for (const row of result.rows) {
      assert.ok(
        Math.abs(row.deltaMm) < MEASUREMENT_TOLERANCE_MM,
        `"${row.text}" (${row.styleName}): engine ${row.enginesMm}mm vs renderer ${row.rendererMm}mm, delta ${row.deltaMm}mm exceeds the ${MEASUREMENT_TOLERANCE_MM}mm tolerance`,
      );
    }
    assert.ok(result.worstMm < MEASUREMENT_TOLERANCE_MM);
    assert.ok(result.worstPercent < 1, `worst relative error ${result.worstPercent}% should stay below 1%`);
  });

  test('the tolerance is a margin over the measured error, not a cover for it', async () => {
    const result = await calibrate();
    assert.ok(
      MEASUREMENT_TOLERANCE_MM >= result.worstMm * 2,
      `tolerance ${MEASUREMENT_TOLERANCE_MM}mm should keep headroom over the measured ${result.worstMm}mm`,
    );
  });

  test('Polish diacritics measure correctly, not as fallback glyphs', async () => {
    const result = await calibrate();
    const polish = result.rows.find((r) => r.text.includes('Zażółć'));
    assert.ok(polish, 'the diacritic sample must be measured');
    assert.ok(Math.abs(polish.deltaMm) < MEASUREMENT_TOLERANCE_MM,
      `diacritics drift by ${polish.deltaMm}mm, which suggests a fallback font`);
  });
});
