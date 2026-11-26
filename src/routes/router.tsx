import { Navigate, type RouteObject } from "react-router";
import { AppShell } from "@/components/layout/AppShell";
import {
  ProtectedRoute,
  PublicOnlyRoute,
  RequireRole,
} from "@/routes/guards";
import {
  BudgetsPage,
  CostEditPage,
  CostsPage,
  FullPageSuspense,
  HomePage,
  LoginPage,
  PageSuspense,
  ReportsPage,
  UserProfilesPage,
} from "@/routes/lazyPages";
import { ROUTES } from "@/routes/navigation";

export const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: ROUTES.login,
        element: (
          <FullPageSuspense>
            <LoginPage />
          </FullPageSuspense>
        ),
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            path: ROUTES.home,
            element: (
              <PageSuspense>
                <HomePage />
              </PageSuspense>
            ),
          },
          {
            path: ROUTES.costs,
            element: (
              <PageSuspense>
                <CostsPage />
              </PageSuspense>
            ),
          },
          {
            path: "/costs/:costId/edit",
            element: (
              <PageSuspense>
                <CostEditPage />
              </PageSuspense>
            ),
          },
          {
            path: ROUTES.budgets,
            element: (
              <PageSuspense>
                <BudgetsPage />
              </PageSuspense>
            ),
          },
          {
            path: ROUTES.reports,
            element: (
              <PageSuspense>
                <ReportsPage />
              </PageSuspense>
            ),
          },
          {
            path: ROUTES.userProfiles,
            element: (
              <RequireRole roles={["admin"]}>
                <PageSuspense>
                  <UserProfilesPage />
                </PageSuspense>
              </RequireRole>
            ),
          },
        ],
      },
    ],
  },
  { path: "/", element: <Navigate to={ROUTES.home} replace /> },
  { path: "*", element: <Navigate to={ROUTES.home} replace /> },
];
