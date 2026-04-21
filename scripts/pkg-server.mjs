#!/usr/bin/env node
/**
 * Package the bundled server into a single-file binary targeting the
 * current host platform and drop it into
 * `apps/desktop/src-tauri/binaries/agbook-server-<rust-target-triple>`
 * so Tauri can pick it up as a sidecar via `externalBin`.
 *
 * Tauri mandates that sidecar binaries are suffixed with the Rust target
 * triple of the machine they are meant to run on. We infer the host's
 * triple from `rustc -vV` when available, and fall back to a hand-written
 * mapping of (platform, arch) → triple for CI hosts without rustc yet.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'apps', 'server');
const bundlePath = path.join(serverDir, 'dist-bundle', 'server.cjs');
const binariesDir = path.join(repoRoot, 'apps', 'desktop', 'src-tauri', 'binaries');

if (!fs.existsSync(bundlePath)) {
  console.error(
    `[pkg-server] missing ${path.relative(repoRoot, bundlePath)}. ` +
      `Run \`npm -w @agbook/server run bundle\` first.`
  );
  process.exit(1);
}

function detectTargetTriple() {
  // Prefer rustc's own answer — guarantees we match what Tauri expects.
  try {
    const out = execSync('rustc -vV', { encoding: 'utf8' });
    const match = out.match(/host:\s*([\w\-\.]+)/);
    if (match) return match[1];
  } catch {
    // rustc isn't installed; fall through to manual mapping.
  }
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'darwin' && arch === 'arm64') return 'aarch64-apple-darwin';
  if (platform === 'darwin' && arch === 'x64') return 'x86_64-apple-darwin';
  if (platform === 'win32' && arch === 'x64') return 'x86_64-pc-windows-msvc';
  if (platform === 'win32' && arch === 'arm64') return 'aarch64-pc-windows-msvc';
  if (platform === 'linux' && arch === 'x64') return 'x86_64-unknown-linux-gnu';
  if (platform === 'linux' && arch === 'arm64') return 'aarch64-unknown-linux-gnu';
  throw new Error(`[pkg-server] unsupported host: ${platform}/${arch}`);
}

function pkgTargetFor(triple) {
  if (triple.includes('apple-darwin')) {
    return triple.startsWith('aarch64') ? 'node20-macos-arm64' : 'node20-macos-x64';
  }
  if (triple.includes('pc-windows')) {
    return triple.startsWith('aarch64') ? 'node20-win-arm64' : 'node20-win-x64';
  }
  if (triple.includes('unknown-linux')) {
    return triple.startsWith('aarch64') ? 'node20-linux-arm64' : 'node20-linux-x64';
  }
  throw new Error(`[pkg-server] cannot map ${triple} to a pkg target`);
}

const triple = detectTargetTriple();
const pkgTarget = pkgTargetFor(triple);
const binaryName = `agbook-server-${triple}${triple.includes('windows') ? '.exe' : ''}`;
const outputPath = path.join(binariesDir, binaryName);

if (!fs.existsSync(binariesDir)) fs.mkdirSync(binariesDir, { recursive: true });

// `better-sqlite3` ships a precompiled `.node` addon that is ABI-locked to a
// specific Node.js major version. The local `npm install` picks the prebuild
// matching the host Node (which is usually newer than pkg's bundled Node 20),
// so we explicitly re-fetch the Node 20 ABI prebuild before pkging. Without
// this the final binary dies at startup with NODE_MODULE_VERSION errors.
// Full version matching pkg's bundled Node runtime. pkg@6.x ships 20.x; any
// patch version inside the same major produces a compatible ABI addon.
const pkgNodeVersion = '20.18.0';
function mapArchForPrebuild(t) {
  if (t.startsWith('aarch64')) return 'arm64';
  if (t.startsWith('x86_64')) return 'x64';
  throw new Error(`[pkg-server] unsupported arch in ${t}`);
}
function mapPlatformForPrebuild(t) {
  if (t.includes('apple-darwin')) return 'darwin';
  if (t.includes('pc-windows')) return 'win32';
  if (t.includes('unknown-linux')) return 'linux';
  throw new Error(`[pkg-server] unsupported platform in ${t}`);
}
const prebuildArch = mapArchForPrebuild(triple);
const prebuildPlatform = mapPlatformForPrebuild(triple);
const prebuildBin = path.join(
  repoRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prebuild-install.cmd' : 'prebuild-install'
);
const bsqlDir = path.join(repoRoot, 'node_modules', 'better-sqlite3');

console.log(`[pkg-server] host triple       = ${triple}`);
console.log(`[pkg-server] pkg target        = ${pkgTarget}`);
console.log(`[pkg-server] prebuild runtime  = node ${pkgNodeVersion} (${prebuildPlatform}/${prebuildArch})`);
console.log(`[pkg-server] output binary     = ${path.relative(repoRoot, outputPath)}`);

const prebuildResult = spawnSync(
  prebuildBin,
  [
    '--runtime', 'node',
    '--target', pkgNodeVersion,
    '--arch', prebuildArch,
    '--platform', prebuildPlatform,
    '--force',
  ],
  { stdio: 'inherit', cwd: bsqlDir }
);

if (prebuildResult.status !== 0) {
  console.error('[pkg-server] prebuild-install failed — cannot get Node 20 ABI addon');
  process.exit(prebuildResult.status ?? 1);
}

const pkgBin = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'pkg.cmd' : 'pkg');

const result = spawnSync(
  pkgBin,
  [
    bundlePath,
    '--targets', pkgTarget,
    '--output', outputPath,
    '--compress', 'GZip',
    '--config', path.join(serverDir, 'package.json'),
  ],
  { stdio: 'inherit', cwd: repoRoot }
);

if (result.status !== 0) {
  console.error('[pkg-server] pkg failed');
  process.exit(result.status ?? 1);
}

// pkg on Windows produces a `.exe`; on other platforms we must ensure the
// output is executable so Tauri's Command::sidecar can spawn it directly.
if (!triple.includes('windows')) {
  try {
    fs.chmodSync(outputPath, 0o755);
  } catch (err) {
    console.warn('[pkg-server] could not chmod output:', err);
  }
}

// Restore the host-ABI `.node` addon so local `npm run dev` keeps working.
// We replaced it earlier with a Node 20 ABI prebuild so pkg could embed it,
// but the host Node is usually newer (e.g. v22 / v24 / v25) and would fail
// to load the Node 20 binary at runtime. Try the fast prebuild-install path
// first, then fall back to a from-source compile via `npm rebuild`.
const hostNodeVersion = process.versions.node;
const hostArch = process.arch === 'x64' ? 'x64' : process.arch === 'arm64' ? 'arm64' : process.arch;
const hostPlatform = process.platform === 'win32' ? 'win32' : process.platform;
console.log(`[pkg-server] restoring host addon (node ${hostNodeVersion}, ${hostPlatform}/${hostArch})`);

const tryPrebuild = spawnSync(
  prebuildBin,
  [
    '--runtime', 'node',
    '--target', hostNodeVersion,
    '--arch', hostArch,
    '--platform', hostPlatform,
    '--force',
  ],
  { stdio: 'inherit', cwd: bsqlDir }
);

if (tryPrebuild.status !== 0) {
  console.log('[pkg-server] no prebuilt for host node — rebuilding from source');
  const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const rebuild = spawnSync(npmBin, ['rebuild', 'better-sqlite3'], {
    stdio: 'inherit',
    cwd: repoRoot,
  });
  if (rebuild.status !== 0) {
    console.warn(
      '[pkg-server] WARNING: could not restore host-ABI better-sqlite3 addon. ' +
        'Run `npm rebuild better-sqlite3` manually before `npm run dev`.'
    );
  }
}

console.log(`[pkg-server] done: ${binaryName}`);
