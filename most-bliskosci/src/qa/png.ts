import fs from 'node:fs';
import zlib from 'node:zlib';

/**
 * Dependency-free PNG reader.
 *
 * There is no image library available in this environment (the npm registry is
 * blocked), and pixel-level QA must not be faked, so the decoder is written out.
 * It handles the subset Chromium emits: 8-bit truecolour with or without alpha,
 * non-interlaced, which covers every artefact this pipeline produces.
 */

export interface PngInfo {
  readonly width: number;
  readonly height: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly interlace: number;
}

export interface PngImage extends PngInfo {
  /** RGBA, 4 bytes per pixel, row-major. */
  readonly pixels: Buffer;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf.subarray(0, 8).equals(SIGNATURE);
}

/** Read the header only. Cheap enough to run over every artefact. */
export function readPngInfo(file: string): PngInfo {
  const fd = fs.openSync(file, 'r');
  try {
    const head = Buffer.alloc(33);
    const read = fs.readSync(fd, head, 0, 33, 0);
    if (read < 33 || !isPng(head)) throw new Error(`${file} is not a PNG`);
    if (head.subarray(12, 16).toString('latin1') !== 'IHDR') throw new Error(`${file} has no IHDR chunk`);
    return {
      width: head.readUInt32BE(16),
      height: head.readUInt32BE(20),
      bitDepth: head.readUInt8(24),
      colorType: head.readUInt8(25),
      interlace: head.readUInt8(28),
    };
  } finally {
    fs.closeSync(fd);
  }
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(file: string): PngImage {
  const buf = fs.readFileSync(file);
  if (!isPng(buf)) throw new Error(`${file} is not a PNG`);
  let offset = 8;
  let info: PngInfo | null = null;
  const idat: Buffer[] = [];
  let palette: Buffer | null = null;
  let trns: Buffer | null = null;

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('latin1');
    const data = buf.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      info = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data.readUInt8(8),
        colorType: data.readUInt8(9),
        interlace: data.readUInt8(12),
      };
    } else if (type === 'PLTE') palette = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (!info) throw new Error(`${file} has no IHDR chunk`);
  if (info.interlace !== 0) throw new Error(`${file} is interlaced; not supported`);
  if (info.bitDepth !== 8) throw new Error(`${file} has bit depth ${info.bitDepth}; only 8 is supported`);

  const channels = info.colorType === 2 ? 3 : info.colorType === 6 ? 4 : info.colorType === 3 ? 1 : info.colorType === 0 ? 1 : info.colorType === 4 ? 2 : 0;
  if (channels === 0) throw new Error(`${file} has unsupported colour type ${info.colorType}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = info.width * channels;
  const out = Buffer.alloc(info.width * info.height * 4);
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);

  let src = 0;
  for (let y = 0; y < info.height; y++) {
    const filter = raw[src++]!;
    raw.copy(line, 0, src, src + stride);
    src += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      const x = line[i]!;
      switch (filter) {
        case 0: break;
        case 1: line[i] = (x + a) & 0xff; break;
        case 2: line[i] = (x + b) & 0xff; break;
        case 3: line[i] = (x + ((a + b) >> 1)) & 0xff; break;
        case 4: line[i] = (x + paeth(a, b, c)) & 0xff; break;
        default: throw new Error(`unknown PNG filter ${filter} on row ${y}`);
      }
    }
    for (let x = 0; x < info.width; x++) {
      const o = (y * info.width + x) * 4;
      const p = x * channels;
      if (info.colorType === 2) {
        out[o] = line[p]!; out[o + 1] = line[p + 1]!; out[o + 2] = line[p + 2]!; out[o + 3] = 255;
      } else if (info.colorType === 6) {
        out[o] = line[p]!; out[o + 1] = line[p + 1]!; out[o + 2] = line[p + 2]!; out[o + 3] = line[p + 3]!;
      } else if (info.colorType === 0) {
        out[o] = out[o + 1] = out[o + 2] = line[p]!; out[o + 3] = 255;
      } else if (info.colorType === 4) {
        out[o] = out[o + 1] = out[o + 2] = line[p]!; out[o + 3] = line[p + 1]!;
      } else if (info.colorType === 3 && palette) {
        const idx = line[p]!;
        out[o] = palette[idx * 3]!; out[o + 1] = palette[idx * 3 + 1]!; out[o + 2] = palette[idx * 3 + 2]!;
        out[o + 3] = trns && idx < trns.length ? trns[idx]! : 255;
      }
    }
    line.copy(prev);
  }
  return { ...info, pixels: out };
}

/** Minimal PNG writer (8-bit RGBA, single IDAT) for composited sheets. */
export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunks: Buffer[] = [SIGNATURE];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);
  chunks.push(chunk('IHDR', ihdr));
  chunks.push(chunk('IDAT', zlib.deflateSync(raw, { level: 9 })));
  chunks.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(chunks);
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)) >>> 0, 8 + data.length);
  return out;
}

let crcTable: Int32Array | null = null;
function crc32(buf: Buffer): number {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c;
    }
  }
  let crc = -1;
  for (const byte of buf) crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return crc ^ -1;
}

export function pixelAt(img: PngImage, x: number, y: number): [number, number, number, number] {
  const o = (y * img.width + x) * 4;
  return [img.pixels[o]!, img.pixels[o + 1]!, img.pixels[o + 2]!, img.pixels[o + 3]!];
}

export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
