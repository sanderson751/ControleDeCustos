import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { StatTile } from "@/components/shared/StatTile";

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
