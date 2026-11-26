import { act, render, screen } from "@testing-library/react";
import type { CustomCategory } from "@/domain/entities/category";
import { notify } from "@/lib/notify";
import {
  CategoriesProvider,
  useCategories,
} from "@/providers/CategoriesProvider";
import { subscribeToCategories } from "@/services/categoryService";

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/categoryService", () => ({
  subscribeToCategories: vi.fn(),
}));

const mockedSubscribe = vi.mocked(subscribeToCategories);

function Probe() {
  const { catalog, isLoading, error } = useCategories();
  return (
    <output data-testid="probe">
      {isLoading
        ? "carregando"
        : catalog.options.map((option) => option.label).join(",")}
      {error ? `|${error}` : ""}
    </output>
  );
}

describe("CategoriesProvider", () => {
  it("sem provider expoe apenas o catalogo padrao", () => {
    render(<Probe />);
    expect(screen.getByTestId("probe")).toHaveTextContent(
      "Moradia,Alimentação,Transporte,Saúde,Educação,Lazer,Outros",
    );
  });

  it("carrega as personalizadas em tempo real e cancela a assinatura ao desmontar", () => {
    const unsubscribe = vi.fn();
    let push: (items: CustomCategory[]) => void = () => undefined;
    mockedSubscribe.mockImplementation((_uid, onData) => {
      push = onData;
      return unsubscribe;
    });

    const { unmount } = render(
      <CategoriesProvider userId="uid-1">
        <Probe />
      </CategoriesProvider>,
    );

    expect(mockedSubscribe).toHaveBeenCalledWith(
      "uid-1",
      expect.any(Function),
      expect.any(Function),
    );
    expect(screen.getByTestId("probe")).toHaveTextContent("carregando");

    act(() => push([{ id: "p1", name: "Pets", archived: false }]));
    expect(screen.getByTestId("probe")).toHaveTextContent("Outros,Pets");

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("em falha mantem o catalogo padrao e avisa", () => {
    mockedSubscribe.mockImplementation((_uid, _onData, onError) => {
      onError(Object.assign(new Error("x"), { code: "permission-denied" }));
      return () => undefined;
    });

    render(
      <CategoriesProvider userId="uid-1">
        <Probe />
      </CategoriesProvider>,
    );

    expect(screen.getByTestId("probe")).toHaveTextContent("Moradia");
    expect(notify).toHaveBeenCalledWith("warning", expect.any(String));
  });

  it("enquanto carrega, ids desconhecidos usam rotulo provisorio", () => {
    mockedSubscribe.mockImplementation(() => () => undefined);
    function LabelProbe() {
      return <span data-testid="label">{useCategories().catalog.labelOf("pets1")}</span>;
    }

    render(
      <CategoriesProvider userId="uid-1">
        <LabelProbe />
      </CategoriesProvider>,
    );

    expect(screen.getByTestId("label")).toHaveTextContent("—");
  });
});
