import { fireEvent, render, screen, within } from "@testing-library/react";
import { EvolutionTable } from "@/components/evolution/EvolutionTable";
import {
  formatAxisValue,
  formatMonthTick,
} from "@/components/evolution/evolutionFormat";
import { MonthlyEvolutionChart } from "@/components/evolution/MonthlyEvolutionChart";
import type { MonthlyPoint } from "@/domain/rules/evolutionRules";

const point = (
  month: number,
  spent: number,
  budget: number | null = null,
): MonthlyPoint => ({
  competence: { year: 2026, month },
  spent,
  budget,
  isOverBudget: budget !== null && spent >= budget,
});

const points = [point(9, 800, 1000), point(10, 0, 1000), point(11, 1200, 1000)];

describe("MonthlyEvolutionChart", () => {
  it("desenha uma coluna por mes com gasto e rotula apenas o ultimo mes", () => {
    render(<MonthlyEvolutionChart points={points} showBudget />);

    expect(screen.getAllByTestId("evolution-bar")).toHaveLength(2);
    expect(screen.getByTestId("evolution-last-label")).toHaveTextContent(
      "R$ 1.200,00",
    );
    expect(screen.getByText("set")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
  });

  it("cada mes e focavel com descricao acessivel e tooltip no foco", () => {
    render(<MonthlyEvolutionChart points={points} showBudget />);

    const november = screen.getByRole("img", {
      name: "novembro de 2026: gasto R$ 1.200,00, orçamento R$ 1.000,00, acima do orçamento",
    });
    fireEvent.focus(november);

    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText("R$ 1.200,00")).toBeInTheDocument();
    expect(within(tooltip).getByText(/Acima do orçamento em/)).toHaveTextContent(
      "R$ 200,00",
    );

    fireEvent.blur(november);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("tooltip no hover mostra quanto resta do orcamento", () => {
    render(<MonthlyEvolutionChart points={points} showBudget />);

    fireEvent.mouseEnter(screen.getAllByRole("img")[0]);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Restam R$ 200,00");
  });

  it("sem orcamento nao desenha a linha nem os marcadores", () => {
    const { container } = render(
      <MonthlyEvolutionChart points={points} showBudget={false} />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(0);
    fireEvent.focus(screen.getAllByRole("img")[0]);
    expect(screen.getByRole("tooltip")).not.toHaveTextContent("orçamento");
  });

  it("indica recarregamento mantendo o quadro anterior", () => {
    const { container } = render(
      <MonthlyEvolutionChart points={points} showBudget isRefreshing />,
    );
    expect(container.firstChild).toHaveClass("opacity-60");
  });
});

describe("EvolutionTable", () => {
  it("lista mes, gasto, orcamento e situacao", () => {
    render(<EvolutionTable points={points} showBudget />);

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(4);
    expect(rows[3]).toHaveTextContent("novembro de 2026");
    expect(rows[3]).toHaveTextContent("Acima do orçamento");
    expect(rows[1]).toHaveTextContent("Dentro do orçamento");
  });

  it("omite colunas de orcamento com filtro de frente", () => {
    render(<EvolutionTable points={points} showBudget={false} />);
    expect(screen.queryByText("Orçamento")).not.toBeInTheDocument();
  });
});

describe("evolutionFormat", () => {
  it("formata o eixo inteiro abaixo de 10 mil e compacto acima", () => {
    expect(formatAxisValue(2500, 8000)).toBe("R$ 2.500");
    expect(formatAxisValue(2.5, 10, 2.5)).toBe("R$ 2,50");
    expect(formatAxisValue(20000, 40000)).toBe("R$ 20 mil");
    expect(formatMonthTick(point(3, 1))).toBe("mar");
  });
});

describe("regressoes da revisao de QA", () => {
  function setWidth(width: number) {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("D2: valores pequenos usam eixo minimo de R$ 10 com centavos e sem ticks duplicados", () => {
    render(<MonthlyEvolutionChart points={[point(11, 9.9)]} showBudget={false} />);

    for (const label of ["R$ 0,00", "R$ 2,50", "R$ 5,00", "R$ 7,50", "R$ 10,00"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("D4: rotulo do ultimo mes so aparece quando cabe na faixa", () => {
    setWidth(400);
    const twelve = Array.from({ length: 12 }, (_, index) => point(index + 1, 100 * (index + 1)));
    render(<MonthlyEvolutionChart points={twelve} showBudget={false} />);

    expect(screen.queryByTestId("evolution-last-label")).not.toBeInTheDocument();
    // O valor continua acessivel pelo rotulo do alvo de foco.
    expect(screen.getByRole("img", { name: /dezembro de 2026: gasto R\$ 1\.200,00/ })).toBeInTheDocument();
  });

  it("D5: faixas estreitas alternam os rotulos de mes mantendo o primeiro e o ultimo", () => {
    setWidth(400);
    const twelve = Array.from({ length: 12 }, (_, index) => point(index + 1, 10));
    render(<MonthlyEvolutionChart points={twelve} showBudget={false} />);

    expect(screen.getByText("jan")).toBeInTheDocument();
    expect(screen.getByText("dez")).toBeInTheDocument();
    expect(screen.queryByText("fev")).not.toBeInTheDocument();
    expect(screen.getByText("mar")).toBeInTheDocument();
  });

  it("D6: sair com o mouse nao fecha o tooltip do mes focado pelo teclado", () => {
    render(<MonthlyEvolutionChart points={points} showBudget />);
    const [september, october] = screen.getAllByRole("img");

    fireEvent.focus(september);
    fireEvent.mouseEnter(october);
    fireEvent.mouseLeave(october);

    expect(screen.getByRole("tooltip")).toHaveTextContent("setembro de 2026");
  });
});
