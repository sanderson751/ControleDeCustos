import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import {
  FullPageLoader,
  FullPageMessage,
} from "@/components/shared/FullPageState";
import { Button } from "@/components/ui/button";
import type { UserRole } from "@/domain/entities/user";
import { useAuth } from "@/providers/AuthProvider";
import { ROUTES } from "@/routes/navigation";
import { logout } from "@/services/authService";

type LocationState = { from?: string } | null;

/** Exige sessao autenticada; caso contrario redireciona ao login guardando a origem. */
export function ProtectedRoute() {
  const { status, error } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <FullPageLoader label="Carregando sua sessão" />;
  }

  if (status === "error") {
    return (
      <FullPageMessage
        title="Algo deu errado"
        description={error ?? undefined}
        action={
          <Button variant="outline" onClick={() => void logout()}>
            Voltar ao login
          </Button>
        }
      />
    );
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to={ROUTES.login}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}

/** Rotas publicas (login): usuario autenticado volta para a origem ou /home. */
export function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading" && location.pathname !== ROUTES.login) {
    return <FullPageLoader />;
  }

  if (status === "authenticated") {
    const from = (location.state as LocationState)?.from;
    return <Navigate to={from || ROUTES.home} replace />;
  }

  return <Outlet />;
}

/** Restringe a rota a determinados papeis (ex.: gestao de usuarios = admin). */
export function RequireRole({
  roles,
  children,
}: {
  roles: readonly UserRole[];
  children: ReactNode;
}) {
  const { profile } = useAuth();

  if (!profile || !roles.includes(profile.role)) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return <>{children}</>;
}
