import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { StatTile } from "@/components/shared/StatTile";
import { describeDraftOrigin } from "@/components/budgets/budgetPresentation";
import { CompetencePicker } from "@/components/shared/CompetencePicker";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("SegmentedControl", () => {
  it("marca a opcao ativa e emite a selecao", async () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        ariaLabel="Filtro"
        value="a"
        options={[
          { value: "a", label: "Opcao A" },
          { value: "b", label: "Opcao B" },
        ]}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole("group", { name: "Filtro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Opcao A" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(screen.getByRole("button", { name: "Opcao B" }));
    expect(onChange).toHaveBeenCalledWith("b");
  });
});

describe("LoadingButton", () => {
  it("fica desabilitado e com aria-busy durante carregamento", () => {
    render(
      <LoadingButton isLoading loadingText="Salvando...">
        Salvar
      </LoadingButton>,
    );

    const button = screen.getByRole("button", { name: "Salvando..." });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renderiza o conteudo normal fora do carregamento", () => {
    render(<LoadingButton>Salvar</LoadingButton>);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });
});

describe("StatTile", () => {
  it("exibe rotulo, valor e dica com tom cromatico", () => {
    render(
      <StatTile tone="iris" label="Total" value="R$ 10,00" hint="no mês" />,
    );

    const tile = screen.getByText("Total").closest("article");
    expect(tile).toHaveClass("bg-iris");
    expect(screen.getByText("R$ 10,00")).toBeInTheDocument();
    expect(screen.getByText("no mês")).toBeInTheDocument();
  });
});

describe("CompetencePicker", () => {
  function renderPicker(competence: { year: number; month: number }) {
    const onChange = vi.fn();
    render(
      <TooltipProvider>
        <CompetencePicker
          competence={competence}
          isCurrent={false}
          onChange={onChange}
        />
      </TooltipProvider>,
    );
    return onChange;
  }

  it("navega entre meses e volta ao mes atual", async () => {
    const onChange = renderPicker({ year: 2026, month: 1 });

    await userEvent.click(screen.getByRole("button", { name: "Mês anterior" }));
    expect(onChange).toHaveBeenLastCalledWith({ year: 2025, month: 12 });

    await userEvent.click(screen.getByRole("button", { name: "Mês atual" }));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("competence-label")).toHaveTextContent(
      "janeiro de 2026",
    );
  });

  it("desabilita a navegacao fora da faixa suportada", () => {
    renderPicker({ year: 2000, month: 1 });
    expect(screen.getByRole("button", { name: "Mês anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Próximo mês" })).toBeEnabled();
  });
});

describe("describeDraftOrigin", () => {
  const competence = { year: 2026, month: 6 };
  const active = {
    id: "2026-01-lazer",
    category: "lazer" as const,
    year: 2026,
    month: 1,
    limit: 300,
  };
  const future = [{ ...active, id: "2026-09-lazer", month: 9, limit: 500 }];

  it("modo 'so este mes'", () => {
    expect(
      describeDraftOrigin({ mode: "mensal", value: 400, active: null, future: [], competence }),
    ).toBe("Somente neste mês");
    expect(
      describeDraftOrigin({ mode: "mensal", value: 400, active, future: [], competence }),
    ).toBe("Somente neste mês (recorrente: R$ 300,00)");
    expect(
      describeDraftOrigin({ mode: "mensal", value: null, active, future: [], competence }),
    ).toBe("Recorrente (R$ 300,00): não é possível remover só neste mês");
    expect(
      describeDraftOrigin({ mode: "mensal", value: null, active: null, future: [], competence }),
    ).toBe("");
  });

  it("modo 'este mes em diante' descreve o efeito da gravacao", () => {
    expect(
      describeDraftOrigin({ mode: "recorrente", value: 300, active, future: [], competence }),
    ).toBe("Recorrente desde jan/2026");
    expect(
      describeDraftOrigin({ mode: "recorrente", value: 350, active, future: [], competence }),
    ).toBe("Recorrente a partir de jun/2026");
    expect(
      describeDraftOrigin({ mode: "recorrente", value: 300, active, future, competence }),
    ).toBe("Recorrente a partir de jun/2026 · substitui as alterações a partir de set/2026");
    expect(
      describeDraftOrigin({ mode: "recorrente", value: null, active, future: [], competence }),
    ).toBe("Recorrência encerrada a partir de jun/2026");
    expect(
      describeDraftOrigin({ mode: "recorrente", value: null, active: null, future, competence }),
    ).toBe("Remove as alterações a partir de set/2026");
    expect(
      describeDraftOrigin({ mode: "recorrente", value: null, active: null, future: [], competence }),
    ).toBe("");
  });
});
