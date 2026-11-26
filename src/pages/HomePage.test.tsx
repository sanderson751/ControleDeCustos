import { screen } from "@testing-library/react";
import HomePage from "@/pages/HomePage";
import { useSession } from "@/providers/AuthProvider";
import { listMonthCosts } from "@/services/costService";
import { makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/services/costService", () => ({ listMonthCosts: vi.fn() }));

const mockedUseSession = vi.mocked(useSession);
const mockedList = vi.mocked(listMonthCosts);

describe("HomePage", () => {
  it("exibe indicadores separados para total, fixos e variaveis", async () => {
    mockedUseSession.mockReturnValue({
      profile: makeProfile("standard", { displayName: "Maria Souza" }),
      firebaseUser: {} as never,
    });
    mockedList.mockResolvedValue([
      makeCostEntry({ amount: 1000, costType: "fixo" }),
      makeCostEntry({ amount: 250, costType: "variavel" }),
    ]);

    renderWithRouter(<HomePage />);

    expect(await screen.findByText("R$ 1.250,00")).toBeInTheDocument();
    expect(screen.getByText("Total de custos")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 250,00")).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos considerados: 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Registrar custo/ })).toHaveAttribute(
      "href",
      "/costs",
    );
  });

  it("guest ve atalho somente leitura e aviso em caso de falha", async () => {
    mockedUseSession.mockReturnValue({
      profile: makeProfile("guest"),
      firebaseUser: {} as never,
    });
    mockedList.mockRejectedValue(new Error("offline"));

    renderWithRouter(<HomePage />);

    expect(
      await screen.findByText(
        "Não foi possível carregar os custos do mês corrente.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver custos/ })).toBeInTheDocument();
  });
});
