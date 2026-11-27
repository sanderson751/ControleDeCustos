import { screen, waitFor, within } from "@testing-library/react";
import type { UserRole } from "@/domain/entities/user";
import { buildCategoryCatalog } from "@/domain/rules/categoryRules";
import { notify } from "@/lib/notify";
import ImportPage from "@/pages/ImportPage";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import { listCostsByCompetenceRange } from "@/services/costService";
import { ImportPartialError, importCostEntries } from "@/services/importService";
import { makeCostEntry, makeProfile } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

vi.mock("@/providers/AuthProvider", () => ({ useSession: vi.fn() }));
vi.mock("@/providers/CategoriesProvider", () => ({ useCategories: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/services/costService", () => ({ listCostsByCompetenceRange: vi.fn() }));
vi.mock("@/services/importService", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  importCostEntries: vi.fn(),
}));

const mockedNotify = vi.mocked(notify);
const mockedImport = vi.mocked(importCostEntries);
const mockedExisting = vi.mocked(listCostsByCompetenceRange);
const CUSTOMS = [{ id: "pets1", name: "Pets", archived: false }];

const STATEMENT = [
  "Data;Histórico;Valor",
  "05/03/2026;UBER TRIP;-23,90",
  "06/03/2026;Salário;5.000,00",
  "07/04/2026;Padaria Sol;-12,50",
].join("\n");

function setup(role: UserRole = "standard") {
  vi.mocked(useSession).mockReturnValue({
    profile: makeProfile(role),
    firebaseUser: {} as never,
  });
  vi.mocked(useCategories).mockReturnValue({
    catalog: buildCategoryCatalog(CUSTOMS),
    customs: CUSTOMS,
    isLoading: false,
    error: null,
  });
  return renderWithRouter(<ImportPage />, { route: "/import", path: "/import" });
}

async function upload(
  user: ReturnType<typeof setup>["user"],
  content: string = STATEMENT,
  name = "extrato.csv",
) {
  await user.upload(
    screen.getByLabelText("Arquivo do extrato"),
    new File([content], name, { type: "text/csv" }),
  );
}

function rowOf(text: string) {
  return screen.getByRole("row", { name: new RegExp(text) });
}

describe("ImportPage", () => {
  beforeEach(() => {
    mockedExisting.mockResolvedValue([
      makeCostEntry({
        accountName: "Uber Trip",
        amount: 23.9,
        category: "transporte",
        createdAt: new Date(2026, 2, 5, 9),
      }),
      makeCostEntry({
        accountName: "PADARIA SOL",
        amount: 30,
        category: "lazer",
        createdAt: new Date(2026, 2, 20, 9),
      }),
    ]);
    mockedImport.mockResolvedValue(1);
  });

  it("detecta colunas e sinal, ignora creditos, marca duplicados e sugere pelo historico", async () => {
    const { user } = setup();
    await upload(user);

    expect(await screen.findByText("extrato.csv · CSV · 3 linhas lidas")).toBeInTheDocument();
    expect(screen.getByLabelText("Coluna de data")).toHaveValue("0");
    expect(screen.getByLabelText("Coluna de valor")).toHaveValue("2");
    expect(screen.getByLabelText("Gastos no arquivo")).toHaveValue("negativo");
    expect(mockedExisting).toHaveBeenCalledWith(
      "uid-standard",
      { year: 2026, month: 3 },
      { year: 2026, month: 4 },
    );

    await waitFor(() =>
      expect(within(rowOf("UBER TRIP")).getByText("Possível duplicado")).toBeInTheDocument(),
    );
    expect(within(rowOf("UBER TRIP")).getByRole("checkbox")).not.toBeChecked();
    expect(within(rowOf("Salário")).getByText("Crédito ignorado")).toBeInTheDocument();
    expect(within(rowOf("Salário")).getByRole("checkbox")).toBeDisabled();
    expect(within(rowOf("Padaria Sol")).getByRole("checkbox")).toBeChecked();
    expect(screen.getByLabelText("Categoria da linha 4: Padaria Sol")).toHaveValue("lazer");
    expect(screen.getByText(/1 selecionado · R\$\s12,50/)).toBeInTheDocument();
  });

  it("importa as linhas selecionadas com a categoria escolhida e abre Custos no mes mais recente", async () => {
    const { user } = setup();
    await upload(user);
    await screen.findByText("Possível duplicado");

    await user.selectOptions(screen.getByLabelText("Categoria da linha 4: Padaria Sol"), "pets1");
    await user.selectOptions(screen.getByLabelText("Frente"), "fixo");
    await user.click(screen.getByRole("button", { name: "Importar 1 lançamento" }));

    await waitFor(() =>
      expect(mockedImport).toHaveBeenCalledWith("uid-standard", [
        {
          accountName: "Padaria Sol",
          amount: 12.5,
          costType: "fixo",
          category: "pets1",
          description: "Importado de extrato.csv",
          installmentsTotal: 1,
          createdAtManual: new Date(2026, 3, 7, 12),
        },
      ]),
    );
    expect(mockedNotify).toHaveBeenCalledWith(
      "success",
      "1 lançamento importado com sucesso.",
    );
    expect(screen.getByTestId("location")).toHaveTextContent("/costs?mes=2026-04");
  });

  it("fatura de cartao: trocar o sinal torna as compras positivas selecionaveis", async () => {
    const { user } = setup();
    await upload(user);
    await screen.findByText("Possível duplicado");

    await user.selectOptions(screen.getByLabelText("Gastos no arquivo"), "positivo");

    expect(within(rowOf("Salário")).getByRole("checkbox")).toBeChecked();
    expect(within(rowOf("Padaria Sol")).getByText("Crédito ignorado")).toBeInTheDocument();
  });

  it("permite marcar duplicados e desmarcar todas", async () => {
    const { user } = setup();
    await upload(user);
    await screen.findByText("Possível duplicado");

    await user.click(screen.getByRole("button", { name: "Marcar todas" }));
    expect(screen.getByRole("button", { name: "Importar 2 lançamentos" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Desmarcar todas" }));
    expect(screen.getByRole("button", { name: "Importar 0 lançamentos" })).toBeDisabled();
  });

  it("regressao: falha parcial marca as ja gravadas e preserva as escolhas do usuario", async () => {
    mockedImport.mockRejectedValueOnce(new ImportPartialError(1, new Error("x")));
    const { user } = setup();
    await upload(user);
    await screen.findByText("Possível duplicado");
    await user.click(screen.getByRole("button", { name: "Marcar todas" }));
    await user.selectOptions(screen.getByLabelText("Categoria da linha 4: Padaria Sol"), "pets1");

    await user.click(screen.getByRole("button", { name: "Importar 2 lançamentos" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        "1 de 2 lançamentos foram importados. Os demais continuam selecionados para nova tentativa.",
      ),
    );
    await waitFor(() => expect(mockedExisting).toHaveBeenCalledTimes(2));
    expect(within(rowOf("UBER TRIP")).getByText("Importado")).toBeInTheDocument();
    expect(within(rowOf("UBER TRIP")).getByRole("checkbox")).toBeDisabled();
    expect(screen.getByLabelText("Categoria da linha 4: Padaria Sol")).toHaveValue("pets1");
    expect(within(rowOf("Padaria Sol")).getByRole("checkbox")).toBeChecked();
    expect(screen.getByTestId("location")).toHaveTextContent("/import");

    mockedImport.mockClear();
    await user.click(screen.getByRole("button", { name: "Importar 1 lançamento" }));
    await waitFor(() =>
      expect(mockedImport).toHaveBeenCalledWith("uid-standard", [
        expect.objectContaining({ accountName: "Padaria Sol", category: "pets1" }),
      ]),
    );
  });

  it("debito e credito em colunas separadas e linhas de saldo", async () => {
    const { user } = setup();
    await upload(
      user,
      [
        "Extrato de conta",
        "Data;Descrição;Docto;Crédito (R$);Débito (R$);Saldo (R$)",
        "05/03/2026;MERCADO;10;;80,00;920,00",
        "06/03/2026;SALARIO;11;5.000,00;;5.920,00",
        "06/03/2026;SALDO DO DIA;;;;5.920,00",
      ].join("\n"),
    );

    expect(await screen.findByLabelText("Formato do valor")).toHaveValue("split");
    expect(screen.getByLabelText("Coluna de débito")).toHaveValue("4");
    expect(screen.getByLabelText("Coluna de crédito")).toHaveValue("3");
    expect(screen.queryByLabelText("Gastos no arquivo")).not.toBeInTheDocument();
    expect(within(rowOf("MERCADO")).getByRole("checkbox")).toBeChecked();
    expect(within(rowOf("SALARIO")).getByText("Crédito ignorado")).toBeInTheDocument();
    expect(within(rowOf("SALDO DO DIA")).getByText("Saldo/total ignorado")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Formato do valor"), "single");
    expect(screen.getByLabelText("Coluna D/C (débito/crédito)")).toHaveValue("-1");
  });

  it("avisa quando nenhum credito foi identificado", async () => {
    const { user } = setup();
    await upload(user, ["Data;Histórico;Valor", "05/03/2026;Loja;-10,00"].join("\n"));

    expect(await screen.findByRole("note")).toHaveTextContent("Nenhum crédito foi identificado");
  });

  it("resposta atrasada de outro arquivo nao sobrescreve os existentes atuais", async () => {
    let resolveFirst: (entries: never[]) => void = () => undefined;
    mockedExisting
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce([]);
    const { user } = setup();

    await upload(user);
    await upload(
      user,
      ["Data;Histórico;Valor", "05/05/2026;UBER TRIP;-23,90"].join("\n"),
      "maio.csv",
    );
    await screen.findByText("maio.csv · CSV · 1 linha lida");
    resolveFirst([
      makeCostEntry({ accountName: "UBER TRIP", amount: 23.9, createdAt: new Date(2026, 4, 5) }),
    ] as never[]);

    await waitFor(() => expect(mockedExisting).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("Possível duplicado")).not.toBeInTheDocument();
  });

  it("erro total mostra mensagem amigavel", async () => {
    mockedImport.mockRejectedValueOnce(
      Object.assign(new Error("x"), { code: "permission-denied" }),
    );
    const { user } = setup();
    await upload(user);
    await screen.findByText("Possível duplicado");

    await user.click(screen.getByRole("button", { name: "Importar 1 lançamento" }));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith("error", expect.any(String)),
    );
  });

  it("avisa arquivo vazio, sem colunas reconheciveis ou grande demais", async () => {
    const { user } = setup();

    await upload(user, "\n\n");
    expect(mockedNotify).toHaveBeenCalledWith("warning", "O arquivo está vazio.");

    await upload(user, "Nome;Email\nAna;a@b.c");
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      expect.stringContaining("Não encontramos colunas de data e valor"),
    );

    await upload(user, "x".repeat(1024 * 1024 + 1));
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      "O arquivo deve ter no máximo 1 MB.",
    );
    expect(screen.queryByText("Pré-visualização")).not.toBeInTheDocument();
  });

  it("aviso quando nao e possivel verificar duplicados", async () => {
    mockedExisting.mockRejectedValueOnce(new Error("offline"));
    const { user } = setup();
    await upload(user);

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        expect.stringContaining("duplicados"),
      ),
    );
    expect(within(rowOf("UBER TRIP")).getByRole("checkbox")).toBeChecked();
  });

  it("guest nao acessa a importacao", () => {
    setup("guest");

    expect(
      screen.getByText("Você não possui permissão para importar lançamentos."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Arquivo do extrato")).not.toBeInTheDocument();
  });
});

describe("ImportPage - OFX", () => {
  const OFX = [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>",
    "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261107<TRNAMT>-12.50<MEMO>Padaria Sol</STMTTRN>",
    "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261108<TRNAMT>100.00<MEMO>Pix recebido</STMTTRN>",
    "</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>",
  ].join("\n");

  beforeEach(() => {
    mockedExisting.mockResolvedValue([]);
    mockedImport.mockResolvedValue(1);
  });

  it("le o OFX sem configuracao de colunas e importa as despesas", async () => {
    const { user } = setup();
    await user.upload(
      screen.getByLabelText("Arquivo do extrato"),
      new File([OFX], "extrato.ofx", { type: "application/x-ofx" }),
    );

    expect(await screen.findByText("extrato.ofx · OFX · 2 linhas lidas")).toBeInTheDocument();
    expect(screen.queryByLabelText("Coluna de data")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Formato do valor")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Gastos no arquivo")).toHaveValue("negativo");
    expect(within(rowOf("Pix recebido")).getByText("Crédito ignorado")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Importar 1 lançamento" }));
    await waitFor(() =>
      expect(mockedImport).toHaveBeenCalledWith("uid-standard", [
        expect.objectContaining({
          accountName: "Padaria Sol",
          amount: 12.5,
          description: "Importado de extrato.ofx",
          createdAtManual: new Date(2026, 10, 7, 12),
        }),
      ]),
    );
  });

  it("OFX sem transacoes avisa", async () => {
    const { user } = setup();
    await user.upload(
      screen.getByLabelText("Arquivo do extrato"),
      new File(["OFXHEADER:100\n<OFX><BANKTRANLIST></BANKTRANLIST></OFX>"], "vazio.ofx"),
    );

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        "Nenhuma transação encontrada no arquivo OFX.",
      ),
    );
  });
});

describe("ImportPage - OFX (regressoes da revisao)", () => {
  beforeEach(() => {
    mockedExisting.mockResolvedValue([]);
    mockedImport.mockResolvedValue(1);
  });

  it("OFX em uma linha so: selecao e categoria independentes por transacao", async () => {
    const oneLine =
      "<OFX><BANKTRANLIST>" +
      "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261101<TRNAMT>-1.00<FITID>a<MEMO>Um</STMTTRN>" +
      "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102<TRNAMT>-2.00<FITID>b<MEMO>Dois</STMTTRN>" +
      "</BANKTRANLIST></OFX>";
    const { user } = setup();
    await user.upload(screen.getByLabelText("Arquivo do extrato"), new File([oneLine], "x.ofx"));

    await screen.findByText("x.ofx · OFX · 2 linhas lidas");
    await user.click(within(rowOf("Um")).getByRole("checkbox"));

    expect(within(rowOf("Um")).getByRole("checkbox")).not.toBeChecked();
    expect(within(rowOf("Dois")).getByRole("checkbox")).toBeChecked();
    expect(screen.getByRole("button", { name: "Importar 1 lançamento" })).toBeEnabled();
  });

  it("arquivo .ofx com CSV dentro e lido como CSV", async () => {
    const { user } = setup();
    await user.upload(
      screen.getByLabelText("Arquivo do extrato"),
      new File(["Data;Histórico;Valor\n05/11/2026;Loja;-10,00"], "errado.ofx"),
    );

    expect(await screen.findByText("errado.ofx · CSV · 1 linha lida")).toBeInTheDocument();
    expect(screen.getByLabelText("Coluna de data")).toBeInTheDocument();
  });

  it("fatura com sinal invertido: ajusta e avisa; o sinal pode ser trocado", async () => {
    const inverted = `<OFX><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>58.40<MEMO>IFOOD</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110<TRNAMT>-1500.00<MEMO>Pagamento recebido</STMTTRN>
</BANKTRANLIST></CCSTMTRS></OFX>`;
    const { user } = setup();
    await user.upload(screen.getByLabelText("Arquivo do extrato"), new File([inverted], "fatura.ofx"));

    expect(await screen.findByLabelText("Gastos no arquivo")).toHaveValue("positivo");
    expect(mockedNotify).toHaveBeenCalledWith(
      "warning",
      expect.stringContaining("o sinal foi ajustado"),
    );
    expect(within(rowOf("Pagamento recebido")).getByText("Crédito ignorado")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Gastos no arquivo"), "negativo");
    expect(within(rowOf("IFOOD")).getByText("Crédito ignorado")).toBeInTheDocument();
  });

  it("avisa contas combinadas e transacoes repetidas", async () => {
    const text = `<OFX>
<STMTRS><BANKACCTFROM><ACCTID>1</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>-10.00<FITID>X<MEMO>Loja</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>-10.00<FITID>X<MEMO>Loja</STMTTRN>
</BANKTRANLIST></STMTRS>
<CCSTMTRS><CCACCTFROM><ACCTID>2</CCACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261106<TRNAMT>-5.00<FITID>Y<MEMO>Cafe</STMTTRN>
</BANKTRANLIST></CCSTMTRS></OFX>`;
    const { user } = setup();
    await user.upload(screen.getByLabelText("Arquivo do extrato"), new File([text], "duas.ofx"));

    await waitFor(() =>
      expect(mockedNotify).toHaveBeenCalledWith(
        "warning",
        expect.stringMatching(/2 contas ou cartões.*1 transação repetida foi ignorada/),
      ),
    );
  });
});
