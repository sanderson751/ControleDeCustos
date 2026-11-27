/**
 * Copia os arquivos do OCR (Tesseract.js) para public/ocr/<versao>/, servidos
 * pelo proprio Hosting (sem CDN de terceiros) com cache longo: a versao no
 * caminho troca quando os pacotes mudam. Roda antes de dev, build e test:e2e.
 *
 * - worker.min.js (tesseract.js)
 * - motor WASM com modelo LSTM nas variantes que o Tesseract escolhe pelo
 *   aparelho (padrao, SIMD e relaxed SIMD)
 * - dados do portugues (por.traineddata.gz, versao best_int: ~1,4 MB)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const packages = ["tesseract.js", "tesseract.js-core", "@tesseract.js-data/por"];
// Mesma regra do vite.config.ts (__OCR_VERSION__).
const version = packages.map((name) => require(`${name}/package.json`).version).join("-");
const root = join(import.meta.dirname, "..", "public", "ocr");
const target = join(root, version);
const [tesseract, core, portuguese] = packages.map((name) => dirname(require.resolve(`${name}/package.json`)));

const files = [
  [join(tesseract, "dist", "worker.min.js"), "worker.min.js"],
  [join(core, "tesseract-core-lstm.wasm.js"), "tesseract-core-lstm.wasm.js"],
  [join(core, "tesseract-core-simd-lstm.wasm.js"), "tesseract-core-simd-lstm.wasm.js"],
  [join(core, "tesseract-core-relaxedsimd-lstm.wasm.js"), "tesseract-core-relaxedsimd-lstm.wasm.js"],
  [join(portuguese, "4.0.0_best_int", "por.traineddata.gz"), "por.traineddata.gz"],
];

mkdirSync(target, { recursive: true });

// Remove versoes antigas e arquivos soltos da estrutura anterior.
for (const entry of readdirSync(root)) {
  if (entry !== version) rmSync(join(root, entry), { recursive: true, force: true });
}

for (const [source, name] of files) {
  const destination = join(target, name);
  const upToDate =
    existsSync(destination) &&
    statSync(destination).size === statSync(source).size &&
    statSync(destination).mtimeMs >= statSync(source).mtimeMs;

  if (!upToDate) {
    copyFileSync(source, destination);
  }
}

console.log(`[ocr] ${files.length} arquivos em public/ocr/${version}`);
