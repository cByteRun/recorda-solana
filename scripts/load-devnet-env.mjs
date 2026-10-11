import { loadEnvFile } from 'node:process';
import { resolve } from 'node:path';

// Explicit shell values win; .env.local wins over .env. No shell evaluation.
export function loadDevnetEnv(directory = process.cwd()) {
  for (const filename of ['.env.local', '.env']) {
    try { loadEnvFile(resolve(directory, filename)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}
