/// <reference types="vitest/config" />
import { createRequire } from "node:module";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const require = createRequire(import.meta.url);
/** Versao dos arquivos do OCR (mesma regra de scripts/copy-ocr-assets.mjs): caminho /ocr/<versao>/. */
const ocrVersion = ["tesseract.js", "tesseract.js-core", "@tesseract.js-data/por"]
  .map((name) => (require(`${name}/package.json`) as { version: string }).version)
  .join("-");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __OCR_VERSION__: JSON.stringify(ocrVersion),
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  // tesseract.js e importado sob demanda (foto da comanda): pre-otimizar evita
  // que o servidor de dev recarregue a pagina na primeira leitura.
  optimizeDeps: {
    include: ["tesseract.js"],
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // O SDK do Firebase (Auth + Firestore) sozinho ocupa ~580 kB minificado.
    chunkSizeWarningLimit: 650,
    rolldownOptions: {
      output: {
        // Separa SDKs pesados em chunks de vendor com cache independente.
        codeSplitting: {
          groups: [
            {
              name: "vendor-firebase",
              test: /node_modules[\\/](@firebase|firebase)[\\/]/,
            },
            {
              name: "vendor-react",
              test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
            },
            {
              name: "vendor-ui",
              test: /node_modules[\\/](radix-ui|@radix-ui|lucide-react|sonner)[\\/]/,
            },
          ],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // Testes das regras do Firestore rodam a parte (npm run test:rules, emulador).
    include: ["src/**/*.test.{ts,tsx}"],
    // Testes de interacao com user-event (digitacao) podem passar de 5s sob carga.
    testTimeout: 15000,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/components/ui/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
    },
  },
});
