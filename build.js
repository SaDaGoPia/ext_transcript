import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'src';
const DIST = 'dist';

async function copyStaticFiles() {
  const staticEntries = [
    'manifest.json',
    'icons',
    'background',
    'popup',
    'lib',
    'offscreen/offscreen.html',
  ];
  for (const entry of staticEntries) {
    await cp(path.join(SRC, entry), path.join(DIST, entry), { recursive: true });
  }
}

async function bundleOffscreenScript() {
  await build({
    entryPoints: [path.join(SRC, 'offscreen/offscreen.js')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: path.join(DIST, 'offscreen/offscreen.bundle.js'),
  });
}

async function copyOnnxWasm() {
  const ortDistDir = path.join('node_modules', 'onnxruntime-web', 'dist');
  const destDir = path.join(DIST, 'offscreen', 'ort-wasm');
  await mkdir(destDir, { recursive: true });
  const wasmFiles = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd.wasm', 'ort-wasm.wasm'];
  for (const file of wasmFiles) {
    await cp(path.join(ortDistDir, file), path.join(destDir, file));
  }
}

async function rewriteOffscreenHtmlScriptTag() {
  const htmlPath = path.join(DIST, 'offscreen/offscreen.html');
  let html = await readFile(htmlPath, 'utf8');
  html = html.replace('offscreen.js', 'offscreen.bundle.js');
  await writeFile(htmlPath, html);
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await copyStaticFiles();
  await bundleOffscreenScript();
  await copyOnnxWasm();
  await rewriteOffscreenHtmlScriptTag();
  console.log('Build complete: dist/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
