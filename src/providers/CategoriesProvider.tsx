import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  type CategoryCatalog,
  type CustomCategory,
  PENDING_CATEGORY_LABEL,
} from "@/domain/entities/category";
import {
  buildCategoryCatalog,
  DEFAULT_CATALOG,
} from "@/domain/rules/categoryRules";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { subscribeToCategories } from "@/services/categoryService";

export type CategoriesContextValue = {
  catalog: CategoryCatalog;
  customs: CustomCategory[];
  isLoading: boolean;
  error: string | null;
};

/** Sem provider (testes, telas publicas): somente as categorias padrao. */
const DEFAULT_VALUE: CategoriesContextValue = {
  catalog: DEFAULT_CATALOG,
  customs: [],
  isLoading: false,
  error: null,
};

const CategoriesContext = createContext<CategoriesContextValue>(DEFAULT_VALUE);

/**
 * Catalogo de categorias (padrao + personalizadas) em tempo real para o
 * usuario autenticado. Em falha, mantem o catalogo padrao e avisa.
 */
export function CategoriesProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const [customs, setCustoms] = useState<CustomCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);

    return subscribeToCategories(
      userId,
      (categories) => {
        setCustoms(categories);
        setError(null);
        setIsLoading(false);
      },
      (subscriptionError) => {
        const message = friendlyFirestoreErrorMessage(
          subscriptionError,
          "Não foi possível carregar suas categorias personalizadas.",
        );
        setError(message);
        setIsLoading(false);
        notify("warning", message);
      },
    );
  }, [userId]);

  const value = useMemo<CategoriesContextValue>(
    () => ({
      catalog: buildCategoryCatalog(
        customs,
        isLoading || error ? PENDING_CATEGORY_LABEL : undefined,
      ),
      customs,
      isLoading,
      error,
    }),
    [customs, error, isLoading],
  );

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCategories(): CategoriesContextValue {
  return useContext(CategoriesContext);
}
