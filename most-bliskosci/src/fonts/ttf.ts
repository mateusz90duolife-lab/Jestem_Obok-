/**
 * Minimal, dependency-free TrueType / OpenType metric reader.
 *
 * Why hand-rolled: this environment has no package registry access (npm returns
 * 403 through the egress proxy), so opentype.js / fontkit are unavailable.
 * Text measurement must not be estimated from character counts (spec 21), so we
 * read the real tables instead: head, hhea, hmtx, cmap, post/OS2 and kern.
 *
 * Scope: horizontal advance metrics + legacy `kern` pairs. That is exactly what
 * line breaking and width measurement need. Glyph outlines are not parsed.
 */

export interface FontMetrics {
  readonly unitsPerEm: number;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
  readonly capHeight: number | null;
  readonly xHeight: number | null;
  readonly numGlyphs: number;
  readonly isVariable: boolean;
  readonly familyName: string;
  readonly subfamilyName: string;
}

export interface ParsedFont {
  readonly metrics: FontMetrics;
  /** Unicode code point -> glyph id. */
  readonly cmap: ReadonlyMap<number, number>;
  /** Glyph id -> advance width in font units. */
  readonly advances: ReadonlyArray<number>;
  /** (leftGid << 16 | rightGid) -> kerning value in font units. */
  readonly kerning: ReadonlyMap<number, number>;
}

class Reader {
  private readonly b: Buffer;
  public pos: number;
  constructor(b: Buffer, pos = 0) { this.b = b; this.pos = pos; }
  u8(): number { const v = this.b.readUInt8(this.pos); this.pos += 1; return v; }
  u16(): number { const v = this.b.readUInt16BE(this.pos); this.pos += 2; return v; }
  i16(): number { const v = this.b.readInt16BE(this.pos); this.pos += 2; return v; }
  u32(): number { const v = this.b.readUInt32BE(this.pos); this.pos += 4; return v; }
  tag(): string { const v = this.b.subarray(this.pos, this.pos + 4).toString('latin1'); this.pos += 4; return v; }
  seek(p: number): void { this.pos = p; }
}

function readNameTable(buf: Buffer, off: number): { family: string; subfamily: string } {
  const r = new Reader(buf, off);
  r.u16(); // format
  const count = r.u16();
  const stringOffset = r.u16();
  let family = '';
  let subfamily = '';
  for (let i = 0; i < count; i++) {
    const platformId = r.u16();
    const encodingId = r.u16();
    r.u16(); // languageId
    const nameId = r.u16();
    const length = r.u16();
    const strOff = r.u16();
    if (nameId !== 1 && nameId !== 2) continue;
    const start = off + stringOffset + strOff;
    const raw = buf.subarray(start, start + length);
    const unicode = platformId === 0 || (platformId === 3 && (encodingId === 1 || encodingId === 10));
    const text = unicode ? raw.swap16().toString('utf16le') : raw.toString('latin1');
    if (nameId === 1 && !family) family = text;
    if (nameId === 2 && !subfamily) subfamily = text;
  }
  return { family, subfamily };
}

function readCmap(buf: Buffer, off: number): Map<number, number> {
  const map = new Map<number, number>();
  const r = new Reader(buf, off);
  r.u16(); // version
  const numTables = r.u16();
  let best = -1;
  let bestScore = -1;
  for (let i = 0; i < numTables; i++) {
    const platformId = r.u16();
    const encodingId = r.u16();
    const subOff = r.u32();
    // Prefer full-repertoire Unicode subtables.
    let score = -1;
    if (platformId === 3 && encodingId === 10) score = 5;
    else if (platformId === 0 && encodingId >= 4) score = 4;
    else if (platformId === 3 && encodingId === 1) score = 3;
    else if (platformId === 0) score = 2;
    if (score > bestScore) { bestScore = score; best = off + subOff; }
  }
  if (best < 0) return map;

  const s = new Reader(buf, best);
  const format = s.u16();
  if (format === 4) {
    s.u16(); // length
    s.u16(); // language
    const segX2 = s.u16();
    const seg = segX2 / 2;
    s.u16(); s.u16(); s.u16(); // searchRange, entrySelector, rangeShift
    const endCodes: number[] = [];
    for (let i = 0; i < seg; i++) endCodes.push(s.u16());
    s.u16(); // reservedPad
    const startCodes: number[] = [];
    for (let i = 0; i < seg; i++) startCodes.push(s.u16());
    const idDeltas: number[] = [];
    for (let i = 0; i < seg; i++) idDeltas.push(s.i16());
    const idRangeOffsetPos = s.pos;
    const idRangeOffsets: number[] = [];
    for (let i = 0; i < seg; i++) idRangeOffsets.push(s.u16());
    for (let i = 0; i < seg; i++) {
      const start = startCodes[i]!;
      const end = endCodes[i]!;
      if (start === 0xffff) continue;
      for (let c = start; c <= end && c !== 0x10000; c++) {
        let gid: number;
        const iro = idRangeOffsets[i]!;
        if (iro === 0) {
          gid = (c + idDeltas[i]!) & 0xffff;
        } else {
          const addr = idRangeOffsetPos + i * 2 + iro + (c - start) * 2;
          if (addr + 1 >= buf.length) continue;
          gid = buf.readUInt16BE(addr);
          if (gid !== 0) gid = (gid + idDeltas[i]!) & 0xffff;
        }
        if (gid !== 0) map.set(c, gid);
      }
    }
  } else if (format === 12) {
    s.u16(); // reserved
    s.u32(); // length
    s.u32(); // language
    const nGroups = s.u32();
    for (let i = 0; i < nGroups; i++) {
      const startChar = s.u32();
      const endChar = s.u32();
      const startGid = s.u32();
      for (let c = startChar; c <= endChar; c++) map.set(c, startGid + (c - startChar));
    }
  }
  return map;
}

function readKern(buf: Buffer, off: number): Map<number, number> {
  const kern = new Map<number, number>();
  const r = new Reader(buf, off);
  const version = r.u16();
  if (version !== 0) return kern; // Apple-style `kern` v1 not used by these fonts.
  const nTables = r.u16();
  for (let t = 0; t < nTables; t++) {
    r.u16(); // subtable version
    const length = r.u16();
    const coverage = r.u16();
    const next = r.pos - 6 + length;
    const format = coverage >> 8;
    const horizontal = (coverage & 0x1) === 1;
    if (format === 0 && horizontal) {
      const nPairs = r.u16();
      r.u16(); r.u16(); r.u16();
      for (let p = 0; p < nPairs; p++) {
        const left = r.u16();
        const right = r.u16();
        const value = r.i16();
        kern.set((left << 16) | right, value);
      }
    }
    r.seek(next);
  }
  return kern;
}

export function parseFont(buf: Buffer): ParsedFont {
  const r = new Reader(buf);
  const sfnt = r.u32();
  if (sfnt === 0x74746366) throw new Error('TrueType Collections (.ttc) are not supported');
  if (sfnt !== 0x00010000 && sfnt !== 0x4f54544f) {
    throw new Error(`unrecognised sfnt version 0x${sfnt.toString(16)}`);
  }
  const numTables = r.u16();
  r.u16(); r.u16(); r.u16();
  const tables = new Map<string, { off: number; len: number }>();
  for (let i = 0; i < numTables; i++) {
    const tag = r.tag();
    r.u32(); // checksum
    const off = r.u32();
    const len = r.u32();
    tables.set(tag, { off, len });
  }
  const need = (tag: string): { off: number; len: number } => {
    const t = tables.get(tag);
    if (!t) throw new Error(`font is missing required table '${tag}'`);
    return t;
  };

  const head = new Reader(buf, need('head').off);
  head.seek(need('head').off + 18);
  const unitsPerEm = head.u16();

  const hheaOff = need('hhea').off;
  const hh = new Reader(buf, hheaOff + 4);
  const ascender = hh.i16();
  const descender = hh.i16();
  const lineGap = hh.i16();
  const hh2 = new Reader(buf, hheaOff + 34);
  const numberOfHMetrics = hh2.u16();

  const maxp = new Reader(buf, need('maxp').off + 4);
  const numGlyphs = maxp.u16();

  const hmtxOff = need('hmtx').off;
  const advances: number[] = new Array(numGlyphs).fill(0);
  let last = 0;
  for (let i = 0; i < numGlyphs; i++) {
    if (i < numberOfHMetrics) {
      last = buf.readUInt16BE(hmtxOff + i * 4);
    }
    advances[i] = last;
  }

  let capHeight: number | null = null;
  let xHeight: number | null = null;
  const os2 = tables.get('OS/2');
  if (os2) {
    const version = buf.readUInt16BE(os2.off);
    if (version >= 2 && os2.len >= 90) {
      xHeight = buf.readInt16BE(os2.off + 86);
      capHeight = buf.readInt16BE(os2.off + 88);
    }
  }

  const nameTable = tables.get('name');
  const names = nameTable ? readNameTable(buf, nameTable.off) : { family: '', subfamily: '' };
  const cmapTable = tables.get('cmap');
  const cmap = cmapTable ? readCmap(buf, cmapTable.off) : new Map<number, number>();
  const kernTable = tables.get('kern');
  const kerning = kernTable ? readKern(buf, kernTable.off) : new Map<number, number>();

  return {
    metrics: {
      unitsPerEm,
      ascender,
      descender,
      lineGap,
      capHeight,
      xHeight,
      numGlyphs,
      isVariable: tables.has('fvar'),
      familyName: names.family,
      subfamilyName: names.subfamily,
    },
    cmap,
    advances,
    kerning,
  };
}

/* ------------------------------------------------------------------ *
 * GPOS pair kerning
 *
 * These fonts ship no legacy `kern` table; their kerning lives in GPOS
 * lookup type 2 (pair adjustment). Measuring without it would drift from
 * what the renderer actually draws, so we read it. Only the horizontal
 * advance of the first glyph (xAdvance in value record 1) is extracted,
 * which is what line width depends on.
 * ------------------------------------------------------------------ */

function readCoverage(buf: Buffer, off: number): Map<number, number> {
  const idx = new Map<number, number>();
  const format = buf.readUInt16BE(off);
  if (format === 1) {
    const count = buf.readUInt16BE(off + 2);
    for (let i = 0; i < count; i++) idx.set(buf.readUInt16BE(off + 4 + i * 2), i);
  } else if (format === 2) {
    const rangeCount = buf.readUInt16BE(off + 2);
    for (let i = 0; i < rangeCount; i++) {
      const p = off + 4 + i * 6;
      const start = buf.readUInt16BE(p);
      const end = buf.readUInt16BE(p + 2);
      const startIndex = buf.readUInt16BE(p + 4);
      for (let g = start; g <= end; g++) idx.set(g, startIndex + (g - start));
    }
  }
  return idx;
}

function readClassDef(buf: Buffer, off: number): Map<number, number> {
  const cls = new Map<number, number>();
  const format = buf.readUInt16BE(off);
  if (format === 1) {
    const startGlyph = buf.readUInt16BE(off + 2);
    const count = buf.readUInt16BE(off + 4);
    for (let i = 0; i < count; i++) cls.set(startGlyph + i, buf.readUInt16BE(off + 6 + i * 2));
  } else if (format === 2) {
    const rangeCount = buf.readUInt16BE(off + 2);
    for (let i = 0; i < rangeCount; i++) {
      const p = off + 4 + i * 6;
      const start = buf.readUInt16BE(p);
      const end = buf.readUInt16BE(p + 2);
      const value = buf.readUInt16BE(p + 4);
      for (let g = start; g <= end; g++) cls.set(g, value);
    }
  }
  return cls;
}

/** Number of bytes a value record occupies for the given format mask. */
function valueRecordSize(format: number): number {
  let n = 0;
  for (let bit = 0; bit < 16; bit++) if (format & (1 << bit)) n += 2;
  return n;
}

/** xAdvance is bit 0x0004 of the value format. */
function readXAdvance(buf: Buffer, off: number, format: number): number {
  if ((format & 0x0004) === 0) return 0;
  let p = off;
  if (format & 0x0001) p += 2; // xPlacement
  if (format & 0x0002) p += 2; // yPlacement
  return buf.readInt16BE(p);
}

function collectPairPos(buf: Buffer, subOff: number, out: Map<number, number>): void {
  const format = buf.readUInt16BE(subOff);
  const coverageOff = subOff + buf.readUInt16BE(subOff + 2);
  const valueFormat1 = buf.readUInt16BE(subOff + 4);
  const valueFormat2 = buf.readUInt16BE(subOff + 6);
  const size1 = valueRecordSize(valueFormat1);
  const size2 = valueRecordSize(valueFormat2);

  if (format === 1) {
    const pairSetCount = buf.readUInt16BE(subOff + 8);
    const coverage = readCoverage(buf, coverageOff);
    const byIndex = new Map<number, number>();
    for (const [gid, i] of coverage) byIndex.set(i, gid);
    for (let i = 0; i < pairSetCount; i++) {
      const left = byIndex.get(i);
      if (left === undefined) continue;
      const pairSetOff = subOff + buf.readUInt16BE(subOff + 10 + i * 2);
      const pairValueCount = buf.readUInt16BE(pairSetOff);
      const recSize = 2 + size1 + size2;
      for (let j = 0; j < pairValueCount; j++) {
        const rec = pairSetOff + 2 + j * recSize;
        const right = buf.readUInt16BE(rec);
        const adj = readXAdvance(buf, rec + 2, valueFormat1);
        if (adj !== 0) out.set((left << 16) | right, adj);
      }
    }
  } else if (format === 2) {
    const classDef1Off = subOff + buf.readUInt16BE(subOff + 8);
    const classDef2Off = subOff + buf.readUInt16BE(subOff + 10);
    const class1Count = buf.readUInt16BE(subOff + 12);
    const class2Count = buf.readUInt16BE(subOff + 14);
    const coverage = readCoverage(buf, coverageOff);
    const cd1 = readClassDef(buf, classDef1Off);
    const cd2 = readClassDef(buf, classDef2Off);
    const recSize = size1 + size2;
    const base = subOff + 16;

    // class -> glyphs, restricted to the coverage table for class 1.
    const class1Glyphs = new Map<number, number[]>();
    for (const gid of coverage.keys()) {
      const c = cd1.get(gid) ?? 0;
      const list = class1Glyphs.get(c);
      if (list) list.push(gid); else class1Glyphs.set(c, [gid]);
    }
    const class2Glyphs = new Map<number, number[]>();
    for (const [gid, c] of cd2) {
      const list = class2Glyphs.get(c);
      if (list) list.push(gid); else class2Glyphs.set(c, [gid]);
    }

    for (let c1 = 0; c1 < class1Count; c1++) {
      const lefts = class1Glyphs.get(c1);
      if (!lefts || lefts.length === 0) continue;
      for (let c2 = 0; c2 < class2Count; c2++) {
        const rec = base + (c1 * class2Count + c2) * recSize;
        const adj = readXAdvance(buf, rec, valueFormat1);
        if (adj === 0) continue;
        const rights = class2Glyphs.get(c2);
        if (!rights) continue;
        for (const l of lefts) for (const rg of rights) out.set((l << 16) | rg, adj);
      }
    }
  }
}

/**
 * Extract pair kerning from GPOS. Returns an empty map when the font has no
 * GPOS table or no `kern` feature.
 */
export function parseGposKerning(buf: Buffer): Map<number, number> {
  const out = new Map<number, number>();
  const r = new Reader(buf);
  const sfnt = r.u32();
  if (sfnt !== 0x00010000 && sfnt !== 0x4f54544f) return out;
  const numTables = r.u16();
  r.u16(); r.u16(); r.u16();
  let gpos = -1;
  for (let i = 0; i < numTables; i++) {
    const tag = r.tag();
    r.u32();
    const off = r.u32();
    r.u32();
    if (tag === 'GPOS') gpos = off;
  }
  if (gpos < 0) return out;

  const featureListOff = gpos + buf.readUInt16BE(gpos + 6);
  const lookupListOff = gpos + buf.readUInt16BE(gpos + 8);

  // Collect lookup indices referenced by any `kern` feature.
  const wanted = new Set<number>();
  const featureCount = buf.readUInt16BE(featureListOff);
  for (let i = 0; i < featureCount; i++) {
    const rec = featureListOff + 2 + i * 6;
    const tag = buf.subarray(rec, rec + 4).toString('latin1');
    if (tag !== 'kern') continue;
    const featureOff = featureListOff + buf.readUInt16BE(rec + 4);
    const lookupCount = buf.readUInt16BE(featureOff + 2);
    for (let j = 0; j < lookupCount; j++) wanted.add(buf.readUInt16BE(featureOff + 4 + j * 2));
  }
  if (wanted.size === 0) return out;

  const lookupCount = buf.readUInt16BE(lookupListOff);
  for (const li of wanted) {
    if (li >= lookupCount) continue;
    const lookupOff = lookupListOff + buf.readUInt16BE(lookupListOff + 2 + li * 2);
    const lookupType = buf.readUInt16BE(lookupOff);
    const subTableCount = buf.readUInt16BE(lookupOff + 4);
    for (let s = 0; s < subTableCount; s++) {
      let subOff = lookupOff + buf.readUInt16BE(lookupOff + 6 + s * 2);
      let type = lookupType;
      if (type === 9) {
        // Extension positioning: hop to the real subtable.
        type = buf.readUInt16BE(subOff + 2);
        subOff = subOff + buf.readUInt32BE(subOff + 4);
      }
      if (type === 2) collectPairPos(buf, subOff, out);
    }
  }
  return out;
}
