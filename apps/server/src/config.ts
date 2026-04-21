import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');

// In packaged/desktop mode Tauri injects AGBOOK_DATA_DIR pointing at the
// per-user OS app-data directory (e.g. ~/Library/Application Support/agbook).
// In local dev we fall back to <repo>/data so existing workflows keep working.
export const DATA_DIR = process.env.AGBOOK_DATA_DIR
  ? path.resolve(process.env.AGBOOK_DATA_DIR)
  : path.join(ROOT_DIR, 'data');

export const DB_FILE = path.join(DATA_DIR, 'agbook.sqlite');
export const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
export const PORT = Number(process.env.AGBOOK_PORT || 8787);
export const HOST = process.env.AGBOOK_HOST || '127.0.0.1';

export function ensureDirs() {
  for (const dir of [DATA_DIR, PROJECTS_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}
