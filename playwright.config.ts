import { defineConfig } from "@playwright/test";

/**
 * Testes E2E contra os emuladores do Firebase (Auth + Firestore).
 * Rode com `npm run test:e2e` (sobe os emuladores e executa os testes).
 *
 * - Usa o Chrome instalado na maquina (sem download de navegadores);
 *   em outra maquina/CI: `npx playwright install chromium` e PW_CHANNEL="".
 * - O app sobe em modo dev com VITE_USE_EMULATORS=true e projeto demo
 *   (variaveis de processo tem prioridade sobre o .env.local).
 */
const PORT = 5180;
const channel = process.env.PW_CHANNEL ?? "chrome";

export default defineConfig({
  testDir: "./tests/e2e",
  // Um navegador por vez: os testes compartilham os emuladores.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: channel || undefined,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_USE_EMULATORS: "true",
      VITE_FIREBASE_API_KEY: "demo-api-key",
      VITE_FIREBASE_AUTH_DOMAIN: "demo-controle-de-custos.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID: "demo-controle-de-custos",
      VITE_FIREBASE_STORAGE_BUCKET: "demo-controle-de-custos.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID: "0",
      VITE_FIREBASE_APP_ID: "demo-app",
    },
  },
});
