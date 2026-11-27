import {
  type ColumnMapping,
  MAX_IMPORT_ROWS,
} from "@/domain/entities/statementImport";
import {
  buildCategoryCatalog,
  DEFAULT_CATALOG,
} from "@/domain/rules/categoryRules";
import {
  buildCategoryHistory,
  buildImportRows,
  competenceRangeOf,
  detectColumns,
  detectDecimalSeparator,
  detectDelimiter,
  detectExpenseSign,
  findDuplicateLines,
  isInformativeDescription,
  parseCsv,
  parseNature,
  parseStatement,
  parseStatementAmount,
  parseStatementDate,
  suggestCategory,
  toAccountName,
  toImportInput,
  truncateText,
} from "@/domain/rules/statementImport";
import { makeCostEntry } from "@/test/factories";

const NOW = new Date(2026, 10, 26, 12);
const noon = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12);
const BOM = String.fromCharCode(0xfeff);

/** Processa um CSV de ponta a ponta como a tela faz. */
function importCsv(csv: string) {
  const { table, lineNumbers } = parseStatement(csv);
  const mapping = detectColumns(table, NOW);
  if (!mapping) return null;
  const sign = detectExpenseSign(table, mapping);
  const { rows } = buildImportRows(table, mapping, sign, { lineNumbers, now: NOW });
  return { mapping, sign, rows };
}

const summary = (rows: ReturnType<typeof buildImportRows>["rows"]) =>
  rows.map((row) => [row.line, row.description, row.amount, row.status]);

describe("parseStatement", () => {
  it("detecta separador pela moda das linhas (titulo antes do cabecalho nao decide)", () => {
    expect(detectDelimiter("Data;Historico;Valor")).toBe(";");
    expect(detectDelimiter("date,description,amount")).toBe(",");
    expect(detectDelimiter("Data\tValor\tDescricao")).toBe("\t");
    expect(detectDelimiter('"a,b";c')).toBe(";");
    expect(
      detectDelimiter("Extrato da conta; agencia 1\ndata,descricao,valor\n05/03/2026,Uber,-1.00\n06/03/2026,Pix,2.00"),
    ).toBe(",");
  });

  it("trata aspas, aspas escapadas, quebra em aspas, CRLF, BOM e linhas vazias com a linha fisica", () => {
    const text = `${BOM}Data;Descrição;Valor\r\n05/03/2026;"Loja ""Boa"";SP";-10,00\r\n\r\n06/03/2026;"Linha\nquebrada";-5,00\r\n07/03/2026;Fim;-1,00`;

    expect(parseStatement(text)).toEqual({
      table: [
        ["Data", "Descrição", "Valor"],
        ["05/03/2026", 'Loja "Boa";SP', "-10,00"],
        ["06/03/2026", "Linha\nquebrada", "-5,00"],
        ["07/03/2026", "Fim", "-1,00"],
      ],
      lineNumbers: [1, 2, 4, 6],
    });
  });

  it("regressao: aspas soltas no meio do campo nao engolem as linhas seguintes", () => {
    expect(
      parseCsv('05/03/2026;TV 50" LOJA;-1.999,00\n06/03/2026;UBER;-10,00'),
    ).toEqual([
      ["05/03/2026", 'TV 50" LOJA', "-1.999,00"],
      ["06/03/2026", "UBER", "-10,00"],
    ]);
  });
});

describe("parseStatementDate", () => {
  it.each([
    ["05/03/2026", noon(2026, 3, 5)],
    ["5/3/26", noon(2026, 3, 5)],
    ["05-03-2026", noon(2026, 3, 5)],
    ["05.03.2026", noon(2026, 3, 5)],
    ["2026-03-05", noon(2026, 3, 5)],
    ["2026-03-05T10:00:00", noon(2026, 3, 5)],
    ["05/03/2026 14:32", noon(2026, 3, 5)],
    ["05/03/2026 14:32:10", noon(2026, 3, 5)],
    ["2027-01-10", noon(2027, 1, 10)],
  ])("aceita %s", (raw, expected) => {
    expect(parseStatementDate(raw, NOW)).toEqual(expected);
  });

  it.each([
    "31/02/2026",
    "2026/03/05",
    "texto",
    "",
    "05/13/2026",
    "01/01/1999",
    "05/03/99",
    "01/01/2028",
  ])("recusa %s (inclusive anos futuros como 99 => 2099)", (raw) => {
    expect(parseStatementDate(raw, NOW)).toBeNull();
  });
});

describe("parseStatementAmount", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["-45,90", -45.9],
    ["R$ 10,00", 10],
    ["-R$ 1.000,00", -1000],
    ["1234.56", 1234.56],
    ["1,234.56", 1234.56],
    ["1.234", 1234],
    ["1,234", 1234],
    ["0.500", 0.5],
    ["12.5", 12.5],
    ["(12,00)", -12],
    ["R$ (12,00)", -12],
    ["12,00-", -12],
    ["45,90 D", -45.9],
    ["45,90 C", 45.9],
    ["D 12,00", -12],
    [`${String.fromCharCode(0x2212)}45,90`, -45.9],
    ["+7,10", 7.1],
    ["0,00", 0],
  ])("%s => %d", (raw, expected) => {
    expect(parseStatementAmount(raw)).toBe(expected);
  });

  it.each(["", "abc", "12a", "--1"])("recusa %s", (raw) => {
    expect(parseStatementAmount(raw)).toBeNull();
  });

  it("usa o separador decimal da coluna quando informado", () => {
    expect(detectDecimalSeparator(["-23.90", "1.5", "1,234"])).toBe(".");
    expect(detectDecimalSeparator(["-23,90", "1.000,00"])).toBe(",");
    expect(detectDecimalSeparator(["1.234"])).toBeUndefined();
    expect(parseStatementAmount("1,234", ",")).toBe(1.23);
    expect(parseStatementAmount("1.234", ".")).toBe(1.23);
    expect(parseStatementAmount("1,234.50", ".")).toBe(1234.5);
    expect(parseStatementAmount("1.234.567", ",")).toBe(1234567);
    expect(parseStatementAmount("1,2,3", ",")).toBeNull();
  });

  it("le a natureza do lancamento", () => {
    expect(parseNature("D")).toBe(-1);
    expect(parseNature("Débito")).toBe(-1);
    expect(parseNature("saída")).toBe(-1);
    expect(parseNature("C")).toBe(1);
    expect(parseNature("Crédito")).toBe(1);
    expect(parseNature("x")).toBeNull();
  });
});

describe("detectColumns", () => {
  it("pelo cabecalho, sem acento/caixa e em qualquer ordem", () => {
    expect(
      detectColumns(
        [
          ["Valor (R$)", "Histórico", "Data Lançamento"],
          ["-10,00", "Mercado", "05/03/2026"],
        ],
        NOW,
      ),
    ).toEqual({
      headerRow: 0,
      date: 2,
      description: 1,
      amount: { kind: "single", column: 0, nature: null },
    });
  });

  it("sem cabecalho, pelo conteudo (ignora numero de documento)", () => {
    expect(
      detectColumns(
        [
          ["05/03/2026", "123", "Supermercado Central", "-10,00"],
          ["06/03/2026", "124", "Posto Shell Avenida", "-200,00"],
        ],
        NOW,
      ),
    ).toEqual({
      headerRow: null,
      date: 0,
      description: 2,
      amount: { kind: "single", column: 3, nature: null },
    });
  });

  it("cabecalho desconhecido cai na inferencia pelo conteudo", () => {
    expect(
      detectColumns(
        [
          ["Quando", "O que", "Quanto"],
          ["05/03/2026", "Padaria", "-10,00"],
        ],
        NOW,
      ),
    ).toMatchObject({ headerRow: 0, date: 0, description: 1 });
  });

  it("null quando nao ha data ou valor identificaveis", () => {
    expect(detectColumns([], NOW)).toBeNull();
    expect(detectColumns([["Nome", "Email"], ["Ana", "a@b.c"]], NOW)).toBeNull();
    expect(detectColumns([["05/03/2026", "123", "456"]], NOW)).toBeNull();
  });
});

describe("layouts reais de bancos", () => {
  it("debito e credito em colunas separadas, com titulo antes do cabecalho (Bradesco/Santander)", () => {
    const result = importCsv(
      [
        "Extrato de: Agência 1234 Conta 56789-0",
        "Data;Descrição;Docto;Situação;Crédito (R$);Débito (R$);Saldo (R$)",
        "05/03/2026;UBER TRIP;123;;;23,90;976,10",
        "06/03/2026;SALARIO;124;;5.000,00;;5.976,10",
        "07/03/2026;MERCADO;125;;;1.200,00;4.776,10",
        "07/03/2026;SALDO DO DIA;;;;;4.776,10",
      ].join("\n"),
    );

    expect(result?.mapping).toEqual({
      headerRow: 1,
      date: 0,
      description: 1,
      amount: { kind: "split", debit: 5, credit: 4 },
    });
    expect(summary(result!.rows)).toEqual([
      [3, "UBER TRIP", 23.9, "ok"],
      [4, "SALARIO", 5000, "credito"],
      [5, "MERCADO", 1200, "ok"],
      [6, "SALDO DO DIA", null, "informativa"],
    ]);
  });

  it("coluna D/C separada com valores sempre positivos", () => {
    const result = importCsv(
      [
        "Data;Histórico;Valor;D/C",
        "05/03/2026;UBER TRIP;23,90;D",
        "06/03/2026;SALARIO;100,00;C",
      ].join("\n"),
    );

    expect(result?.mapping.amount).toEqual({ kind: "single", column: 2, nature: 3 });
    expect(summary(result!.rows)).toEqual([
      [2, "UBER TRIP", 23.9, "ok"],
      [3, "SALARIO", 100, "credito"],
    ]);
  });

  it("linhas de saldo (Itau/BB) sao informativas mesmo com valor negativo", () => {
    const result = importCsv(
      [
        "data;lançamento;ag./origem;valor (R$);saldos (R$)",
        "01/03/2026;SALDO ANTERIOR;;-150,00;",
        "05/03/2026;UBER TRIP;;-23,90;",
        "05/03/2026;S A L D O;;-173,90;",
      ].join("\n"),
    );

    expect(result?.mapping.amount).toEqual({ kind: "single", column: 3, nature: null });
    expect(summary(result!.rows).map((row) => row[3])).toEqual([
      "informativa",
      "ok",
      "informativa",
    ]);
    expect(isInformativeDescription("Saldo do dia")).toBe(true);
    expect(isInformativeDescription("Saldão da loja")).toBe(false);
  });

  it("fatura C6: usa o valor em R$ e nao a coluna em US$", () => {
    const result = importCsv(
      [
        "Data de Compra;Nome no Cartão;Final do Cartão;Categoria;Descrição;Parcela;Valor (em US$);Cotação (em R$);Valor (em R$)",
        "05/03/2026;ANA;1234;Lazer;STEAM;Única;10,00;5,10;51,00",
        "06/03/2026;ANA;1234;Mercado;PADARIA;Única;0,00;0,00;12,50",
        "07/03/2026;ANA;1234;;Estorno;Única;0,00;0,00;-5,00",
      ].join("\n"),
    );

    expect(result?.mapping).toMatchObject({
      date: 0,
      description: 4,
      amount: { kind: "single", column: 8 },
    });
    expect(result?.sign).toBe("positivo");
    expect(summary(result!.rows)).toEqual([
      [2, "STEAM", 51, "ok"],
      [3, "PADARIA", 12.5, "ok"],
      [4, "Estorno", 5, "credito"],
    ]);
  });

  it("Nubank fatura (date,title,amount) com decimal ponto", () => {
    const result = importCsv(
      ["date,title,amount", "2026-03-05,Uber *Trip,23.9", "2026-03-06,Pagamento recebido,-1000.00"].join("\n"),
    );

    expect(result?.mapping).toMatchObject({ date: 0, description: 1 });
    expect(summary(result!.rows)).toEqual([
      [2, "Uber *Trip", 23.9, "ok"],
      [3, "Pagamento recebido", 1000, "credito"],
    ]);
  });

  it("Inter: data com hora", () => {
    const result = importCsv(
      ["Data Lançamento;Descrição;Valor", "05/03/2026 14:32;Pix enviado;-50,00"].join("\n"),
    );
    expect(summary(result!.rows)).toEqual([[2, "Pix enviado", 50, "ok"]]);
  });
});

const TABLE = [
  ["Data", "Histórico", "Valor"],
  ["05/03/2026", "UBER   TRIP", "-23,90"],
  ["06/03/2026", "Salário", "5.000,00"],
  ["07/03/2026", "Padaria Sol", "-12,50"],
  ["xx", "Linha ruim", "-1,00"],
  ["08/03/2026", "Sem valor", "abc"],
  ["09/03/2026", "", "-3,00"],
  ["10/04/2026", "Farmácia", "0,00"],
];
const MAPPING: ColumnMapping = {
  headerRow: 0,
  date: 0,
  description: 1,
  amount: { kind: "single", column: 2, nature: null },
};
const NO_HEADER: ColumnMapping = { ...MAPPING, headerRow: null };

describe("linhas de importacao", () => {
  it("sugere o sinal pela maioria dos valores", () => {
    expect(detectExpenseSign(TABLE, MAPPING)).toBe("negativo");
    expect(detectExpenseSign([["01/01/2026", "Compra", "10,00"]], NO_HEADER)).toBe(
      "positivo",
    );
  });

  it("classifica ok, credito (sinal oposto/zero) e invalida com motivo", () => {
    const { rows, truncated } = buildImportRows(TABLE, MAPPING, "negativo", { now: NOW });

    expect(truncated).toBe(0);
    expect(rows.map((row) => [row.line, row.status, row.reason])).toEqual([
      [2, "ok", undefined],
      [3, "credito", undefined],
      [4, "ok", undefined],
      [5, "invalida", "Data inválida"],
      [6, "invalida", "Valor inválido"],
      [7, "invalida", "Descrição vazia"],
      [8, "credito", undefined],
    ]);
    expect(rows[0]).toMatchObject({
      description: "UBER TRIP",
      amount: 23.9,
      date: noon(2026, 3, 5),
    });
  });

  it("fatura de cartao: positivos sao gastos", () => {
    const { rows } = buildImportRows(TABLE, MAPPING, "positivo", { now: NOW });
    expect(rows.filter((row) => row.status === "ok").map((row) => row.line)).toEqual([3]);
  });

  it("limita a quantidade de linhas e informa as excedentes", () => {
    const big = Array.from({ length: MAX_IMPORT_ROWS + 3 }, () => [
      "05/03/2026",
      "Item",
      "-1,00",
    ]);
    const { rows, truncated } = buildImportRows(big, NO_HEADER, "negativo", { now: NOW });

    expect(rows).toHaveLength(MAX_IMPORT_ROWS);
    expect(truncated).toBe(3);
  });

  it("intervalo de competencias considera apenas linhas validas", () => {
    const { rows } = buildImportRows(TABLE, MAPPING, "negativo", { now: NOW });
    expect(competenceRangeOf(rows)).toEqual({
      from: { year: 2026, month: 3 },
      to: { year: 2026, month: 3 },
    });
    expect(competenceRangeOf([])).toBeNull();
  });
});

describe("sugestao de categoria", () => {
  const catalog = buildCategoryCatalog([
    { id: "pets1", name: "Pets", archived: false },
    { id: "old1", name: "Antiga", archived: true },
  ]);

  it("prioriza o historico mais recente com a mesma conta (sem acento/caixa)", () => {
    const history = buildCategoryHistory([
      makeCostEntry({ accountName: "PADARIA SOL", category: "lazer", createdAt: noon(2026, 1, 1) }),
      makeCostEntry({ accountName: "Padaria Sol", category: "pets1", createdAt: noon(2026, 3, 1) }),
    ]);

    expect(suggestCategory("padaria  sol", history, catalog)).toBe("pets1");
  });

  it("ignora historico com categoria arquivada e usa palavras-chave", () => {
    const history = buildCategoryHistory([
      makeCostEntry({ accountName: "Uber Trip", category: "old1" }),
    ]);

    expect(suggestCategory("UBER TRIP", history, catalog)).toBe("transporte");
  });

  it.each([
    ["IFOOD *RESTAURANTE", "alimentacao"],
    ["Drogaria São Paulo", "saude"],
    ["NETFLIX.COM", "lazer"],
    ["Pgto Condomínio", "moradia"],
    ["Mensalidade Faculdade", "educacao"],
    ["Posto Shell", "transporte"],
    ["Transferência Pix", "outros"],
    ["Supermarketing digital", "outros"],
  ])("%s => %s", (description, expected) => {
    expect(suggestCategory(description, new Map(), DEFAULT_CATALOG)).toBe(expected);
  });
});

describe("duplicados", () => {
  it("mesmo dia, valor e conta; respeita a multiplicidade", () => {
    const existing = [
      makeCostEntry({ accountName: "Uber Trip", amount: 23.9, createdAt: new Date(2026, 2, 5, 8) }),
    ];
    const rows = buildImportRows(
      [
        ["05/03/2026", "UBER TRIP", "-23,90"],
        ["05/03/2026", "UBER TRIP", "-23,90"],
        ["06/03/2026", "UBER TRIP", "-23,90"],
        ["05/03/2026", "UBER TRIP", "-23,91"],
      ],
      NO_HEADER,
      "negativo",
      { now: NOW },
    ).rows;

    expect([...findDuplicateLines(rows, existing)]).toEqual([1]);
  });
});

describe("toImportInput", () => {
  it("monta o lancamento com conta limitada, 1 parcela e origem na descricao", () => {
    const row = {
      line: 2,
      date: noon(2026, 3, 5),
      description: "x".repeat(250),
      amount: 23.9,
      status: "ok" as const,
    };

    expect(
      toImportInput({ row, category: "transporte" }, { costType: "variavel", fileName: "extrato.csv" }),
    ).toEqual({
      accountName: "x".repeat(200),
      amount: 23.9,
      costType: "variavel",
      category: "transporte",
      description: "Importado de extrato.csv",
      installmentsTotal: 1,
      createdAtManual: noon(2026, 3, 5),
    });
    expect(toAccountName("  abc  ")).toBe("abc");
  });

  it("corta texto sem partir emoji", () => {
    const emoji = String.fromCodePoint(0x1f600);
    const text = "a".repeat(199) + emoji;

    expect(truncateText(text, 200)).toBe("a".repeat(199));
    expect(truncateText("a".repeat(198) + emoji, 200)).toHaveLength(200);
  });
});

describe("regressao: valor com virgula e ponto em coluna de outro formato", () => {
  it("o ultimo separador decide, mesmo com decimal da coluna informado", () => {
    expect(parseStatementAmount("-1.234,56", ".")).toBe(-1234.56);
    expect(parseStatementAmount("1,234.56", ",")).toBe(1234.56);
  });
});
