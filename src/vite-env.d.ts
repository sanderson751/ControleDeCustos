/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "true" conecta Auth/Firestore aos emuladores (testes E2E). */
  readonly VITE_USE_EMULATORS?: string;
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versao dos arquivos do OCR em /ocr/<versao>/ (definida no vite.config.ts). */
declare const __OCR_VERSION__: string;
