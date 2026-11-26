import { defineConfig } from "vitest/config";

/**
 * Testes das regras do Firestore contra o emulador local.
 * Execucao: npm run test:rules (sobe o emulador via firebase emulators:exec).
 */
export default defineConfig({
  test: {
    include: ["tests/rules/**/*.test.ts"],
    globals: true,
    environment: "node",
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
