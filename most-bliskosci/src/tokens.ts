import fs from 'node:fs';
import path from 'node:path';
import { projectRoot } from './paths.ts';
import type { LevelId, TextStyle, FamilyRole } from './types.ts';

export interface LevelToken {
  readonly name: string;
  readonly displayName?: string;
  readonly color: string;
  readonly order: number;
}

export interface Tokens {
  readonly designVersion: string;
  readonly color: {
    readonly core: Record<string, { value: string; role: string }>;
    readonly levels: Record<LevelId, LevelToken>;
  };
  readonly typography: {
    readonly families: Record<FamilyRole, { spec: string; stack: string[] }>;
    readonly styles: Record<string, {
      family: FamilyRole; weight: number; sizePt: number; trackingEm: number; lineHeightPt: number;
    }>;
  };
  readonly geometry: {
    readonly trim: { width: number; height: number };
    readonly bleedMm: number;
    readonly full: { width: number; height: number };
    readonly cornerRadiusMm: number;
    readonly safeInsetFromTrimMm: number;
    readonly grid: { baselineMm: number; columns: number; gutterMm: number };
  };
  readonly spacing: Record<string, number>;
  readonly bridgeMark: Record<string, number>;
  readonly autofit: {
    readonly preferredFontSizePt: number;
    readonly minimumFontSizePt: number;
    readonly preferredLineHeightPt: number;
    readonly minimumLineHeightPt: number;
    readonly maximumLines: number;
    readonly maxRepairIterations: number;
  };
}

let cache: Tokens | null = null;

export function loadTokens(): Tokens {
  if (cache) return cache;
  const raw = fs.readFileSync(path.join(projectRoot, 'design-tokens.json'), 'utf8');
  const t = JSON.parse(raw) as Tokens;
  validateTokens(t);
  cache = t;
  return t;
}

const HEX = /^#[0-9A-F]{6}$/;

export function validateTokens(t: Tokens): void {
  const problems: string[] = [];
  for (const [k, v] of Object.entries(t.color.core)) {
    if (!HEX.test(v.value)) problems.push(`core colour ${k} is not an uppercase 6-digit hex: ${v.value}`);
  }
  const orders = new Set<number>();
  for (const id of ['01', '02', '03', '04', '05'] as LevelId[]) {
    const lvl = t.color.levels[id];
    if (!lvl) { problems.push(`missing level ${id}`); continue; }
    if (!HEX.test(lvl.color)) problems.push(`level ${id} colour is not hex: ${lvl.color}`);
    if (orders.has(lvl.order)) problems.push(`duplicate level order ${lvl.order}`);
    orders.add(lvl.order);
  }
  const g = t.geometry;
  if (g.full.width !== g.trim.width + 2 * g.bleedMm) problems.push('full width != trim + 2*bleed');
  if (g.full.height !== g.trim.height + 2 * g.bleedMm) problems.push('full height != trim + 2*bleed');
  if (t.autofit.minimumFontSizePt > t.autofit.preferredFontSizePt) problems.push('minimum font size exceeds preferred');
  if (t.autofit.minimumLineHeightPt > t.autofit.preferredLineHeightPt) problems.push('minimum line height exceeds preferred');
  if (problems.length) throw new Error(`design-tokens.json is invalid:\n  - ${problems.join('\n  - ')}`);
}

export function color(name: string): string {
  const c = loadTokens().color.core[name];
  if (!c) throw new Error(`unknown core colour token '${name}'`);
  return c.value;
}

export function levelToken(id: LevelId): LevelToken {
  const l = loadTokens().color.levels[id];
  if (!l) throw new Error(`unknown level '${id}'`);
  return l;
}

/** Level label as it is set on the card (with Polish diacritics). */
export function levelLabel(id: LevelId): string {
  const l = levelToken(id);
  return l.displayName ?? l.name;
}

export function style(name: string, overrides: Partial<TextStyle> = {}): TextStyle {
  const s = loadTokens().typography.styles[name];
  if (!s) throw new Error(`unknown typography style '${name}'`);
  return { ...s, ...overrides };
}

export function spacing(name: string): number {
  const v = loadTokens().spacing[name];
  if (v === undefined) throw new Error(`unknown spacing token '${name}'`);
  return v;
}

export function bridgeToken(name: string): number {
  const v = loadTokens().bridgeMark[name];
  if (v === undefined) throw new Error(`unknown bridgeMark token '${name}'`);
  return v;
}
