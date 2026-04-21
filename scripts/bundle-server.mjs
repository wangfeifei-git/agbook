#!/usr/bin/env node
/**
 * Bundle apps/server into a single CommonJS file that @yao-pkg/pkg can
 * consume. We keep the `better-sqlite3` native binding external so that
 * pkg can embed the prebuilt `.node` addon as an asset and load it from
 * its snapshot filesystem at runtime.
 */
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'apps', 'server');
const outDir = path.join(serverDir, 'dist-bundle');
const outFile = path.join(outDir, 'server.cjs');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [path.join(serverDir, 'src', 'index.ts')],
  outfile: outFile,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  legalComments: 'none',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
  // better-sqlite3 loads a native addon via the `bindings` package. We leave
  // both packages external so pkg can resolve and embed them. Every other
  // dependency gets inlined into the CJS bundle.
  external: ['better-sqlite3', 'bindings'],
  // The source uses `fileURLToPath(import.meta.url)` to derive __dirname;
  // when emitted as CJS that expression becomes empty and blows up at load
  // time. Rewrite it to a CJS-safe equivalent using the existing __filename.
  define: {
    'import.meta.url': '__import_meta_url__',
  },
  banner: {
    js: "const __import_meta_url__ = require('url').pathToFileURL(__filename).href;",
  },
});

// pkg expects the entry to describe itself as CommonJS; `.cjs` suffix is
// enough so we don't need a dedicated package.json override.
console.log(`[bundle-server] wrote ${path.relative(repoRoot, outFile)}`);
