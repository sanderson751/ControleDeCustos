import { lazy, type ReactNode, Suspense } from "react";
import { FullPageLoader } from "@/components/shared/FullPageState";

/** Paginas carregadas sob demanda (code splitting por rota). */
export const LoginPage = lazy(() => import("@/pages/LoginPage"));
export const HomePage = lazy(() => import("@/pages/HomePage"));
export const CostsPage = lazy(() => import("@/pages/CostsPage"));
export const CostEditPage = lazy(() => import("@/pages/CostEditPage"));
export const BudgetsPage = lazy(() => import("@/pages/BudgetsPage"));
export const EvolutionPage = lazy(() => import("@/pages/EvolutionPage"));
export const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));
export const ImportPage = lazy(() => import("@/pages/ImportPage"));
export const RecurringPage = lazy(() => import("@/pages/RecurringPage"));
export const GoalsPage = lazy(() => import("@/pages/GoalsPage"));
export const GroceryPage = lazy(() => import("@/pages/GroceryPage"));
export const GroceryListPage = lazy(() => import("@/pages/GroceryListPage"));
export const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
export const UserProfilesPage = lazy(() => import("@/pages/UserProfilesPage"));

export function FullPageSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={<FullPageLoader />}>{children}</Suspense>;
}

export function PageSuspense({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="eyebrow text-muted-foreground" aria-live="polite">
          Carregando...
        </p>
      }
    >
      {children}
    </Suspense>
  );
}
