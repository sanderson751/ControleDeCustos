import {
  addDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import type { CustomCategory } from "@/domain/entities/category";
import { toCustomCategory } from "@/services/converters";
import {
  categoriesCollectionRef,
  categoryDocRef,
} from "@/services/firestorePaths";

/** Categorias personalizadas do usuario em tempo real. */
export function subscribeToCategories(
  userId: string,
  onData: (categories: CustomCategory[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    categoriesCollectionRef(userId),
    (snapshot) => {
      onData(
        snapshot.docs.map((docSnapshot) =>
          toCustomCategory(docSnapshot.id, docSnapshot.data()),
        ),
      );
    },
    onError,
  );
}

/** Cria categoria ativa; o nome ja deve estar validado (validateCategoryName). */
export async function createCategory(
  userId: string,
  name: string,
): Promise<string> {
  const ref = await addDoc(categoriesCollectionRef(userId), {
    userId,
    name,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return ref.id;
}

export async function renameCategory(
  userId: string,
  categoryId: string,
  name: string,
): Promise<void> {
  await updateDoc(categoryDocRef(userId, categoryId), {
    name,
    updatedAt: serverTimestamp(),
  });
}

export async function setCategoryArchived(
  userId: string,
  categoryId: string,
  archived: boolean,
): Promise<void> {
  await updateDoc(categoryDocRef(userId, categoryId), {
    archived,
    updatedAt: serverTimestamp(),
  });
}
