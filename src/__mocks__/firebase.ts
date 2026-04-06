/**
 * Mock do firebase para testes
 */

// Mock Firestore
export const db = {
  __mock: true,
}

export const initializeApp = jest.fn()
export const getAuth = jest.fn(() => ({
  currentUser: null,
}))
export const setPersistence = jest.fn()
export const browserLocalPersistence = {}

// Firebase Auth mocks
export const signInWithEmailAndPassword = jest.fn()
export const createUserWithEmailAndPassword = jest.fn()
export const signOut = jest.fn()
export const onAuthStateChanged = jest.fn()

// Firebase Firestore mocks
export const collection = jest.fn()
export const doc = jest.fn()
export const getDoc = jest.fn()
export const getDocs = jest.fn()
export const setDoc = jest.fn()
export const updateDoc = jest.fn()
export const query = jest.fn()
export const where = jest.fn()
export const orderBy = jest.fn()
export const limit = jest.fn()
export const serverTimestamp = jest.fn(() => ({
  __timestamp: true,
}))
export const signInWithPopup = jest.fn()
