import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
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

export async function loginWithGoogle(): Promise<User> {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function logout(): Promise<void> {
  const currentUser = auth.currentUser;

  if (currentUser) {
    // Registrar logout nao deve impedir a saida.
    await markUserLogout(currentUser.uid).catch(() => undefined);
  }

  await signOut(auth);
}
