import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Absolute path to the most-bliskosci project root (parent of src/). */
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const outputDir = path.join(projectRoot, 'output');
export const dataDir = path.join(projectRoot, 'src', 'data');
