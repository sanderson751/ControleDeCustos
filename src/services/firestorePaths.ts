import { collection, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Caminhos centralizados do Firestore (ver specs/<feature>/firestore-structure.md).
 *
 * users/{uid}
 * users/{uid}/settings/profile
 * users/{uid}/costEntries/{entryId}
 */
export const USERS_COLLECTION = "users";
export const SETTINGS_COLLECTION = "settings";
export const SETTINGS_PROFILE_DOC = "profile";
export const COST_ENTRIES_COLLECTION = "costEntries";

export const usersCollectionRef = () => collection(db, USERS_COLLECTION);

export const userDocRef = (uid: string) => doc(db, USERS_COLLECTION, uid);

export const userSettingsDocRef = (uid: string) =>
  doc(db, USERS_COLLECTION, uid, SETTINGS_COLLECTION, SETTINGS_PROFILE_DOC);

export const costEntriesCollectionRef = (uid: string) =>
  collection(db, USERS_COLLECTION, uid, COST_ENTRIES_COLLECTION);

export const costEntryDocRef = (uid: string, entryId: string) =>
  doc(db, USERS_COLLECTION, uid, COST_ENTRIES_COLLECTION, entryId);
