import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Exibe o caminho atual para asserts de navegacao. */
export function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {location.pathname}
      {location.search}
    </output>
  );
}

type RenderRouteOptions = {
  /** Caminho inicial, ex.: "/costs/abc/edit" */
  route?: string;
  /** Padrao da rota que renderiza o elemento, ex.: "/costs/:costId/edit" */
  path?: string;
};

/** Renderiza um elemento dentro de router em memoria + providers de UI. */
export function renderWithRouter(
  ui: ReactElement,
  { route = "/", path = "*" }: RenderRouteOptions = {},
) {
  const user = userEvent.setup();

  const result = render(
    <TooltipProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
          <Route
            path="*"
            element={<p data-testid="other-route">outra rota</p>}
          />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </TooltipProvider>,
  );

  return { user, ...result };
}
