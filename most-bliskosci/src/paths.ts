import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the most-bliskosci project root (parent of src/). */
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Generated artefacts live here. MB_OUTPUT_DIR redirects the whole pipeline to
 * another tree, which lets a test exercise the real CLI without touching the
 * committed output.
 */
export const outputDir = process.env.MB_OUTPUT_DIR
  ? path.resolve(process.env.MB_OUTPUT_DIR)
  : path.join(projectRoot, 'output');
export const dataDir = path.join(projectRoot, 'src', 'data');
