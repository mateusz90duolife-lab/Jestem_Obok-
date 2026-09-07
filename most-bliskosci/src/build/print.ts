import fs from 'node:fs';
import path from 'node:path';
import { loadTokens } from '../tokens.ts';
import { cardGeometry } from '../layout/geometry.ts';
import { outputDir } from '../paths.ts';
import { n } from '../svg/builder.ts';
import type { GeneratedCard } from './generate.ts';

/**
 * PRINT / EXPORT
 *
 * CARD / MASTER (70x100mm) and PRINT / BLEED (76x106mm) are two exports of the
 * same component, not two components. The generator always lays out on the
 * bleed artboard; the master is that artboard cropped to the trim box, so no
 * position, measure or type size differs between them.
 *
 * output/front + output/back are the bleed variant. This stage writes the trim
 * variant beside them and records the print specification.
 */
export interface PrintExportResult {
  readonly masterDir: string;
  readonly written: number;
  readonly specFile: string;
}

export function exportPrint(cards: readonly GeneratedCard[]): PrintExportResult {
  const tokens = loadTokens();
  const geo = cardGeometry();
  const root = path.join(outputDir, 'print');
  const masterDir = path.join(root, 'master-70x100');
  fs.mkdirSync(path.join(masterDir, 'front'), { recursive: true });
  fs.mkdirSync(path.join(masterDir, 'back'), { recursive: true });

  let written = 0;
  for (const c of cards) {
    const master = toTrimVariant(c.svg, geo.trim.x, geo.trim.y, geo.trim.width, geo.trim.height);
    const target = path.join(masterDir, c.svgRelative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, master);
    written++;
  }

  const specFile = path.join(root, 'print-spec.json');
  fs.writeFileSync(specFile, `${JSON.stringify({
    deck: 'MOST BLISKOŚCI',
    variants: {
      'CARD / MASTER': {
        directory: 'print/master-70x100',
        widthMm: tokens.geometry.trim.width,
        heightMm: tokens.geometry.trim.height,
        note: 'Trim-only export. Same layout, cropped to the trim box.',
      },
      'PRINT / BLEED': {
        directory: 'front + back',
        widthMm: tokens.geometry.full.width,
        heightMm: tokens.geometry.full.height,
        note: 'The artboard the generator lays out on. Supply this to the printer.',
      },
    },
    trimMm: tokens.geometry.trim,
    bleedMm: tokens.geometry.bleedMm,
    fullMm: tokens.geometry.full,
    safeAreaMm: {
      width: geo.safe.width, height: geo.safe.height,
      insetFromTrimMm: tokens.geometry.safeInsetFromTrimMm,
    },
    cornerRadiusMm: tokens.geometry.cornerRadiusMm,
    cornerNote: 'Corner rounding is a die-cut specification, not artwork. The background is full-bleed, so no corner is drawn in the SVG.',
    raster: { dpi: 300, widthPx: 898, heightPx: 1252 },
    colour: {
      workingSpace: 'sRGB',
      deliverable: 'RGB',
      cmyk: 'This pipeline does NOT perform colour separation. Final CMYK conversion happens during print-prep against the printer\'s ICC profile. Treat the RGB values in design-tokens.json as the appearance target, not as CMYK.',
    },
    fonts: 'Live text, not outlined. Supply the font files with the artwork, or outline the text during print-prep, per the printer\'s requirement.',
  }, null, 2)}\n`);

  return { masterDir, written, specFile };
}

/**
 * Crop the bleed artboard to the trim box.
 *
 * Only the root element's width, height and viewBox change: every coordinate in
 * the document stays exactly where the layout engine put it.
 */
export function toTrimVariant(svg: string, x: number, y: number, width: number, height: number): string {
  return svg
    .replace(/(\bwidth=")[\d.]+mm(")/, `$1${n(width)}mm$2`)
    .replace(/(\bheight=")[\d.]+mm(")/, `$1${n(height)}mm$2`)
    .replace(/(\bviewBox=")[^"]+(")/, `$1${n(x)} ${n(y)} ${n(width)} ${n(height)}$2`)
    .replace('<!-- trim ', '<!-- CARD / MASTER export, cropped to trim | ');
}
