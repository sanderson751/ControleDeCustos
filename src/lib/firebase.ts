import { getApp, getApps, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  clearIndexedDbPersistence,
  connectFirestoreEmulator,
  type Firestore,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  terminate,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (import.meta.env.DEV && !firebaseConfig.apiKey) {
  console.warn(
    "[firebase] Variaveis VITE_FIREBASE_* ausentes. Copie .env.example para .env.local e preencha.",
  );
}

export const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
auth.languageCode = "pt-BR";

/**
 * Cache persistente (IndexedDB) compartilhado entre abas: o app abre os dados
 * ja vistos sem sinal (modo mercado) e as gravacoes feitas offline ficam na
 * fila mesmo se a pagina for fechada, sincronizando quando a conexao volta.
 * Sem IndexedDB (navegacao privada antiga) o SDK cai para o cache em memoria.
 */
function createFirestore(): Firestore {
  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    // Ja inicializado (recarga do modulo em dev).
    return getFirestore(firebaseApp);
  }
}

export const db = createFirestore();

/**
 * Testes E2E (npm run test:e2e): Auth e Firestore nos emuladores locais.
 * Nunca ativo em producao (variavel ausente no build de deploy).
 */
if (import.meta.env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/**
 * Ao sair da conta: apaga o cache local (dados do usuario no IndexedDB, num
 * aparelho que pode ser compartilhado). A instancia encerrada nao volta: o
 * app e recarregado no login quando a sessao termina (AuthProvider), nesta
 * e nas outras abas (que tambem sao encerradas pela exclusao do cache).
 */
export async function clearLocalCache(): Promise<void> {
  await terminate(db);
  await clearIndexedDbPersistence(db);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
