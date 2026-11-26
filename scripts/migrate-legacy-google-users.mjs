#!/usr/bin/env node
/**
 * Migracao unica: usuarios Google criados na versao Next.js (NextAuth).
 *
 * Contexto
 * - Na versao antiga, o login Google era feito pelo NextAuth. O documento
 *   users/{uid} (e seus custos) usava como uid o "sub" da conta Google, e NAO
 *   existia usuario correspondente no Firebase Authentication.
 * - Agora o login Google e feito pelo Firebase Auth, que geraria um uid novo
 *   (os custos antigos ficariam "orfaos").
 *
 * O que o script faz
 * - Lista users/* com provider == "google" que nao possuem usuario no Firebase Auth.
 * - Importa cada um no Firebase Auth com uid = id do documento e provedor
 *   google.com vinculado ao mesmo "sub". No proximo login com Google o Firebase
 *   reconhece a conta e devolve o MESMO uid — os dados continuam acessiveis.
 *
 * Uso (credenciais de service account via .env: FIREBASE_PROJECT_ID,
 * FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY — ou GOOGLE_APPLICATION_CREDENTIALS):
 *   npm run migrate:legacy-google-users            # simulacao (nao altera nada)
 *   npm run migrate:legacy-google-users -- --apply # executa a importacao
 */
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const shouldApply = process.argv.includes("--apply");

function buildCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  return applicationDefault();
}

const app = initializeApp({
  credential: buildCredential(),
  projectId:
    process.env.FIREBASE_PROJECT_ID ?? process.env.VITE_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

async function authUserExists(lookup) {
  try {
    await lookup();
    return true;
  } catch (error) {
    if (error?.code === "auth/user-not-found") {
      return false;
    }
    throw error;
  }
}

async function main() {
  const snapshot = await db
    .collection("users")
    .where("provider", "==", "google")
    .get();

  const toImport = [];
  const conflicts = [];

  for (const document of snapshot.docs) {
    const data = document.data();
    const uid = document.id;
    const email = typeof data.email === "string" ? data.email.trim() : "";

    if (await authUserExists(() => auth.getUser(uid))) {
      continue;
    }

    if (email && (await authUserExists(() => auth.getUserByEmail(email)))) {
      conflicts.push({ uid, email });
      continue;
    }

    toImport.push({
      uid,
      email: email || undefined,
      emailVerified: Boolean(email),
      displayName: data.displayName || undefined,
      photoURL: data.photoURL || undefined,
      providerData: [
        {
          uid,
          providerId: "google.com",
          email: email || undefined,
          displayName: data.displayName || undefined,
          photoURL: data.photoURL || undefined,
        },
      ],
    });
  }

  console.log(`Documentos Google encontrados: ${snapshot.size}`);
  console.log(`A importar no Firebase Auth: ${toImport.length}`);
  for (const user of toImport) {
    console.log(`  - ${user.uid} (${user.email ?? "sem email"})`);
  }

  if (conflicts.length) {
    console.log(
      `\nConflitos (email ja usado por outra conta no Firebase Auth) — resolva manualmente:`,
    );
    for (const conflict of conflicts) {
      console.log(`  - ${conflict.uid} (${conflict.email})`);
    }
  }

  if (!shouldApply) {
    console.log("\nSimulacao concluida. Rode com --apply para importar.");
    return;
  }

  for (let start = 0; start < toImport.length; start += 1000) {
    const batch = toImport.slice(start, start + 1000);
    const result = await auth.importUsers(batch);
    console.log(
      `Lote ${start / 1000 + 1}: ${result.successCount} importados, ${result.failureCount} falhas.`,
    );
    for (const failure of result.errors) {
      console.error(
        `  falha em ${batch[failure.index].uid}: ${failure.error.message}`,
      );
    }
  }
}

main().catch((error) => {
  console.error("Falha na migracao:", error);
  process.exitCode = 1;
});
