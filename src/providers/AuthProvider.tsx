import type { User } from "firebase/auth";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { UserProfile } from "@/domain/entities/user";
import { reloadToLogin } from "@/lib/appReload";
import { subscribeToAuthState } from "@/services/authService";
import {
  ensureUserProfile,
  subscribeToUserProfile,
} from "@/services/userService";

export type AuthStatus =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "error";

export type AuthContextValue = {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: UserProfile | null;
  error: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const INITIAL_STATE: AuthContextValue = {
  status: "loading",
  firebaseUser: null,
  profile: null,
  error: null,
};

const PROFILE_ERROR_MESSAGE =
  "Não foi possível carregar seu perfil. Verifique sua conexão e se as regras do Firestore foram publicadas.";

/**
 * Fonte unica da sessao: Firebase Auth (onAuthStateChanged) + perfil em
 * tempo real do Firestore (users/{uid}), de onde vem o papel (role).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthContextValue>(INITIAL_STATE);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let activeUid: string | null = null;
    let hadSession = false;

    const unsubscribeAuth = subscribeToAuthState((user) => {
      unsubscribeProfile?.();
      unsubscribeProfile = null;
      activeUid = user?.uid ?? null;

      if (!user) {
        // Fim da sessao (nesta ou em outra aba): o cache local foi apagado e o
        // Firestore encerrado; so uma pagina nova volta a funcionar.
        if (hadSession) {
          reloadToLogin();
        }
        setState({ ...INITIAL_STATE, status: "unauthenticated" });
        return;
      }

      hadSession = true;

      setState({ ...INITIAL_STATE, firebaseUser: user });

      void ensureUserProfile(user)
        .catch((error: unknown) => {
          console.error("Falha ao sincronizar perfil do usuario", error);
        })
        .finally(() => {
          // Usuario trocou (ou provider desmontou) enquanto sincronizava.
          if (activeUid !== user.uid) {
            return;
          }

          unsubscribeProfile = subscribeToUserProfile(
            user.uid,
            (profile) => {
              setState(
                profile
                  ? {
                      status: "authenticated",
                      firebaseUser: user,
                      profile,
                      error: null,
                    }
                  : {
                      status: "error",
                      firebaseUser: user,
                      profile: null,
                      error: PROFILE_ERROR_MESSAGE,
                    },
              );
            },
            () => {
              setState({
                status: "error",
                firebaseUser: user,
                profile: null,
                error: PROFILE_ERROR_MESSAGE,
              });
            },
          );
        });
    });

    return () => {
      activeUid = null;
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de <AuthProvider>.");
  }

  return context;
}

export type AuthenticatedSession = {
  firebaseUser: User;
  profile: UserProfile;
};

/** Uso exclusivo dentro de rotas protegidas (que garantem status "authenticated"). */
// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): AuthenticatedSession {
  const { firebaseUser, profile } = useAuth();

  return useMemo(() => {
    if (!firebaseUser || !profile) {
      throw new Error("useSession requer usuario autenticado.");
    }

    return { firebaseUser, profile };
  }, [firebaseUser, profile]);
}
