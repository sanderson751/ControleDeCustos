import type { User } from "firebase/auth";
import {
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import {
  DEFAULT_UI_PREFERENCES,
  type UserProfile,
  type UserRole,
} from "@/domain/entities/user";
import { db } from "@/lib/firebase";
import { toUserProfile } from "@/services/converters";
import {
  userDocRef,
  userSettingsDocRef,
  usersCollectionRef,
} from "@/services/firestorePaths";

/** Papel atribuido a todo usuario novo. Admins sao promovidos por outro admin (ou console). */
export const DEFAULT_ROLE_FOR_NEW_USER: UserRole = "standard";

function resolveProvider(user: User): string {
  return user.providerData[0]?.providerId ?? "password";
}

function normalizeEmail(email: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Garante o documento users/{uid} apos o login.
 * - Usuario novo: cria perfil com papel padrao + settings/profile com preferencias padrao.
 * - Usuario existente: atualiza dados de login sem tocar em `role` e `createdAt`.
 * Usa transacao para ser seguro contra chamadas concorrentes (cadastro + listener de auth).
 */
export async function ensureUserProfile(user: User): Promise<void> {
  const userRef = userDocRef(user.uid);
  const settingsRef = userSettingsDocRef(user.uid);
  const email = user.email ?? "";

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(userRef);

    const loginFields = {
      uid: user.uid,
      email,
      emailNormalized: normalizeEmail(user.email),
      photoURL: user.photoURL ?? "",
      provider: resolveProvider(user),
      status: "online",
      updatedAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    };

    if (!snapshot.exists()) {
      transaction.set(userRef, {
        ...loginFields,
        displayName: user.displayName?.trim() || email,
        role: DEFAULT_ROLE_FOR_NEW_USER,
        createdAt: serverTimestamp(),
      });
      transaction.set(settingsRef, {
        userId: user.uid,
        currency: "BRL",
        locale: "pt-BR",
        ui: DEFAULT_UI_PREFERENCES,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const displayName = user.displayName?.trim();
    transaction.update(userRef, {
      ...loginFields,
      ...(displayName ? { displayName } : {}),
    });
  });
}

/** Escuta o perfil do usuario em tempo real (papel alterado por admin reflete na hora). */
export function subscribeToUserProfile(
  userId: string,
  onData: (profile: UserProfile | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    userDocRef(userId),
    (snapshot) => {
      onData(
        snapshot.exists() ? toUserProfile(snapshot.id, snapshot.data()) : null,
      );
    },
    onError,
  );
}

export async function markUserLogout(userId: string): Promise<void> {
  await updateDoc(userDocRef(userId), {
    status: "offline",
    lastLogoutAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Lista todos os usuarios (somente admin — garantido pelas regras do Firestore). */
export async function listUsers(): Promise<UserProfile[]> {
  const snapshot = await getDocs(usersCollectionRef());

  return snapshot.docs
    .map((docSnapshot) => toUserProfile(docSnapshot.id, docSnapshot.data()))
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, "pt-BR"),
    );
}

/** Atualiza nome e papel de outro usuario (somente admin). */
export async function updateUserByAdmin(
  userId: string,
  updates: { displayName: string; role: UserRole },
): Promise<void> {
  await updateDoc(userDocRef(userId), {
    displayName: updates.displayName.trim(),
    role: updates.role,
    updatedAt: serverTimestamp(),
  });
}

/** Atualiza o proprio nome (sem alterar o papel). */
export async function updateOwnDisplayName(
  userId: string,
  displayName: string,
): Promise<void> {
  await updateDoc(userDocRef(userId), {
    displayName: displayName.trim(),
    updatedAt: serverTimestamp(),
  });
}
