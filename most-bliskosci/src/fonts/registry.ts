import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseFont, parseGposKerning, type ParsedFont } from './ttf.ts';
import type { FamilyRole } from '../types.ts';
import { projectRoot } from '../paths.ts';

export type FontStatus = 'EXACT' | 'SUBSTITUTED' | 'MISSING';

export interface ResolvedFace {
  readonly role: FamilyRole;
  /** Face key as written in the contract: '400', '500', '600', '400i'. */
  readonly key: string;
  /** Family name emitted into the SVG. */
  readonly renderFamily: string;
  /** Weight emitted into the SVG (an actually-present weight, never synthesised). */
  readonly renderWeight: number;
  readonly italic: boolean;
  readonly file: string;
  readonly sha256: string;
  readonly font: ParsedFont;
  readonly kerning: ReadonlyMap<number, number>;
  readonly substituted: boolean;
  readonly lossy: boolean;
  readonly note?: string;
}

export interface FontResolution {
  readonly status: FontStatus;
  readonly specFamilies: Record<FamilyRole, string>;
  readonly renderFamilies: Record<FamilyRole, string>;
  readonly faces: ReadonlyMap<string, ResolvedFace>;
  readonly substitutions: ReadonlyArray<{
    readonly role: FamilyRole;
    readonly specFamily: string;
    readonly specFace: string;
    readonly renderFamily: string;
    readonly renderWeight: number;
    readonly lossy: boolean;
    readonly note?: string;
  }>;
  readonly missing: readonly string[];
  readonly directory: string;
  readonly reason?: string;
}

interface FaceSpec { file: string; renderWeight?: number; lossy?: boolean; note?: string }
interface FamilySpec { family: string; licence?: string; faces: Record<string, FaceSpec> }
interface FontsConfig {
  directory: string;
  required: Record<FamilyRole, FamilySpec>;
  substitution: { allowed: boolean; reason: string } & Record<string, unknown>;
}

export function faceKey(role: FamilyRole, weight: number, italic = false): string {
  return `${role}:${weight}${italic ? 'i' : ''}`;
}

function contractKey(weight: number, italic: boolean): string {
  return `${weight}${italic ? 'i' : ''}`;
}

let cached: FontResolution | null = null;

/**
 * Resolve every declared face to a real file on disk.
 *
 * Order: the specified family first; only if a specified face is absent does the
 * declared substitution profile apply, and then the result is flagged loudly.
 * A face that resolves to neither is reported as MISSING - never substituted by
 * a system default.
 */
export function resolveFonts(force = false): FontResolution {
  if (cached && !force) return cached;

  const cfgPath = path.join(projectRoot, 'fonts.config.json');
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as FontsConfig;
  const dir = path.join(projectRoot, cfg.directory);

  const faces = new Map<string, ResolvedFace>();
  const substitutions: FontResolution['substitutions'] = [];
  const missing: string[] = [];
  const renderFamilies: Record<string, string> = {};
  const specFamilies: Record<string, string> = {};
  let anySubstituted = false;

  const roles: FamilyRole[] = ['display', 'ui'];
  for (const role of roles) {
    const required = cfg.required[role];
    specFamilies[role] = required.family;
    const subFamily = cfg.substitution[role] as FamilySpec | undefined;
    let roleRenderFamily = required.family;

    for (const [key, spec] of Object.entries(required.faces)) {
      const italic = key.endsWith('i');
      const weight = parseInt(key, 10);
      const exactPath = path.join(dir, spec.file);

      if (fs.existsSync(exactPath)) {
        faces.set(faceKey(role, weight, italic), buildFace({
          role, key, renderFamily: required.family, renderWeight: weight, italic,
          file: exactPath, substituted: false, lossy: false,
        }));
        continue;
      }

      const subSpec = cfg.substitution.allowed && subFamily ? subFamily.faces[key] : undefined;
      if (subSpec) {
        const subPath = path.join(dir, subSpec.file);
        if (fs.existsSync(subPath)) {
          anySubstituted = true;
          roleRenderFamily = subFamily!.family;
          faces.set(faceKey(role, weight, italic), buildFace({
            role, key, renderFamily: subFamily!.family,
            renderWeight: subSpec.renderWeight ?? weight, italic,
            file: subPath, substituted: true, lossy: subSpec.lossy === true, note: subSpec.note,
          }));
          (substitutions as Array<FontResolution['substitutions'][number]>).push({
            role, specFamily: required.family, specFace: contractKey(weight, italic),
            renderFamily: subFamily!.family, renderWeight: subSpec.renderWeight ?? weight,
            lossy: subSpec.lossy === true, note: subSpec.note,
          });
          continue;
        }
      }
      missing.push(`${required.family} ${key} (expected ${path.relative(projectRoot, exactPath)})`);
    }
    renderFamilies[role] = roleRenderFamily;
  }

  const status: FontStatus = missing.length > 0 ? 'MISSING' : anySubstituted ? 'SUBSTITUTED' : 'EXACT';

  cached = {
    status,
    specFamilies: specFamilies as Record<FamilyRole, string>,
    renderFamilies: renderFamilies as Record<FamilyRole, string>,
    faces,
    substitutions,
    missing,
    directory: dir,
    reason: anySubstituted ? cfg.substitution.reason : undefined,
  };
  return cached;
}

function buildFace(args: {
  role: FamilyRole; key: string; renderFamily: string; renderWeight: number; italic: boolean;
  file: string; substituted: boolean; lossy: boolean; note?: string;
}): ResolvedFace {
  const buf = fs.readFileSync(args.file);
  const font = parseFont(buf);
  const gpos = parseGposKerning(buf);
  const merged = new Map<number, number>(font.kerning);
  for (const [k, v] of gpos) if (!merged.has(k)) merged.set(k, v);
  return {
    role: args.role,
    key: args.key,
    renderFamily: args.renderFamily,
    renderWeight: args.renderWeight,
    italic: args.italic,
    file: args.file,
    sha256: createHash('sha256').update(buf).digest('hex'),
    font,
    kerning: merged,
    substituted: args.substituted,
    lossy: args.lossy,
    note: args.note,
  };
}

export function getFace(role: FamilyRole, weight: number, italic = false): ResolvedFace {
  const res = resolveFonts();
  const face = res.faces.get(faceKey(role, weight, italic));
  if (!face) {
    throw new Error(
      `font face not available: ${res.specFamilies[role]} ${weight}${italic ? ' italic' : ''}. ` +
      `Missing: ${res.missing.join('; ') || '(none reported)'}`,
    );
  }
  return face;
}
