import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { waitForPendingWrites } from "firebase/firestore";
import { auth, clearLocalCache, db, googleProvider } from "@/lib/firebase";
import { ensureUserProfile, markUserLogout } from "@/services/userService";

export function subscribeToAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function loginWithEmailAndPassword(
  email: string,
  password: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  return credential.user;
}

export async function registerWithEmailAndPassword(
  name: string,
  email: string,
  password: string,
): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  const displayName = name.trim();

  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  // Garante que o perfil no Firestore receba o nome informado no cadastro.
  await ensureUserProfile(credential.user);

  return credential.user;
}

/** Envia o link de confirmacao do e-mail (contas de e-mail e senha). */
export async function sendVerificationEmail(): Promise<void> {
  if (!auth.currentUser) throw new Error("Sessão encerrada.");
  await sendEmailVerification(auth.currentUser);
}

/**
 * Confere se o e-mail ja foi confirmado e renova o token, para as regras do
 * Firestore enxergarem a confirmacao sem precisar sair e entrar de novo.
 */
export async function refreshEmailVerification(): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;
  await user.reload();
  if (!user.emailVerified) return false;
  await user.getIdToken(true);
  return true;
}

export async function loginWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

/** Espera ate `ms` pelo registro de saida (sem sinal, a gravacao nunca confirma). */
const LOGOUT_MARK_TIMEOUT_MS = 3000;
const PENDING_WRITES_TIMEOUT_MS = 1500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ha gravacoes ainda nao confirmadas pelo servidor (feitas sem sinal)? Sair
 * agora apagaria essas alteracoes junto com o cache local.
 */
export async function hasUnsyncedChanges(timeoutMs = PENDING_WRITES_TIMEOUT_MS): Promise<boolean> {
  try {
    return await Promise.race([
      waitForPendingWrites(db).then(() => false),
      delay(timeoutMs).then(() => true),
    ]);
  } catch {
    return false;
  }
}

/**
 * Sai da conta: registra a saida (sem travar quando nao ha sinal), apaga o
 * cache local do aparelho e encerra a sessao (o AuthProvider recarrega no login).
 */
export async function logout(): Promise<void> {
  const currentUser = auth.currentUser;

  if (currentUser) {
    // Registrar logout nao deve impedir a saida.
    await Promise.race([markUserLogout(currentUser.uid).catch(() => undefined), delay(LOGOUT_MARK_TIMEOUT_MS)]);
  }

  // Dados do usuario nao ficam no aparelho depois de sair.
  await clearLocalCache().catch(() => undefined);
  await signOut(auth);
}
