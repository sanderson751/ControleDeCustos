import {
  isOfx,
  OFX_TABLE_HEADER,
  ofxDateToLocalDay,
  parseOfx,
} from "@/domain/rules/ofxParser";
import {
  buildImportRows,
  detectColumns,
} from "@/domain/rules/statementImport";

const NOW = new Date(2026, 10, 27, 12);

const SGML = [
  "OFXHEADER:100",
  "DATA:OFXSGML",
  "VERSION:102",
  "CHARSET:1252",
  "",
  "<OFX>",
  "<BANKMSGSRSV1><STMTTRNRS><STMTRS>",
  "<BANKACCTFROM><BANKID>0341<ACCTID>12345</BANKACCTFROM>",
  "<BANKTRANLIST>",
  "<STMTTRN>",
  "<TRNTYPE>DEBIT",
  "<DTPOSTED>20261105120000[-3:BRT]",
  "<TRNAMT>-23.90",
  "<FITID>0001",
  "<MEMO>UBER *TRIP",
  "</STMTTRN>",
  "<STMTTRN>",
  "<TRNTYPE>CREDIT",
  "<DTPOSTED>20261106",
  "<TRNAMT>5000.00",
  "<FITID>0002",
  "<NAME>SALARIO",
  "<MEMO>EMPRESA &amp; CIA",
  "</STMTTRN>",
  "<STMTTRN>",
  "<TRNTYPE>DEBIT",
  "<DTPOSTED>20261107",
  "<TRNAMT>-1.234,56",
  "<FITID>0003",
  "<NAME>Farm&#225;cia",
  "</STMTTRN>",
  "</BANKTRANLIST>",
  "</STMTRS></STMTTRNRS></BANKMSGSRSV1>",
  "</OFX>",
].join("\r\n");

const row = (rows: ReturnType<typeof buildImportRows>["rows"]) =>
  rows.map((item) => [item.line, item.description, item.amount, item.status]);

function importRows(text: string) {
  const parsed = parseOfx(text);
  const mapping = detectColumns(parsed.table, NOW)!;
  return buildImportRows(parsed.table, mapping, parsed.expenseSign, {
    lineNumbers: parsed.lineNumbers,
    now: NOW,
  }).rows;
}

describe("isOfx", () => {
  it("decide pelo conteudo (cabecalho SGML/XML, <OFX> ou <STMTTRN>)", () => {
    expect(isOfx(SGML)).toBe(true);
    expect(isOfx('<?xml version="1.0"?>\n<?OFX OFXHEADER="200"?>\n<OFX>')).toBe(true);
    expect(isOfx("<STMTTRN><TRNAMT>-1.00")).toBe(true);
    // Regressao: .ofx com CSV dentro e lido como CSV.
    expect(isOfx("Data;Valor\n01/01/2026;-1,00")).toBe(false);
  });
});

describe("parseOfx", () => {
  it("SGML 1.x: data local, descricao de NAME/MEMO, entidades, valor e linha do arquivo", () => {
    expect(parseOfx(SGML)).toEqual({
      table: [
        OFX_TABLE_HEADER,
        ["2026-11-05", "UBER *TRIP", "-23.90"],
        ["2026-11-06", "SALARIO - EMPRESA & CIA", "5000.00"],
        ["2026-11-07", "Farmácia", "-1.234,56"],
      ],
      lineNumbers: [1, 10, 17, 25],
      expenseSign: "negativo",
      accounts: 1,
      duplicatesSkipped: 0,
    });
  });

  it("integra com a importacao (colunas, sinal, linhas e valor com virgula)", () => {
    expect(row(importRows(SGML))).toEqual([
      [10, "UBER *TRIP", 23.9, "ok"],
      [17, "SALARIO - EMPRESA & CIA", 5000, "credito"],
      [25, "Farmácia", 1234.56, "ok"],
    ]);
  });

  it("XML 2.x formatado, com valor em outra linha e PAYEE/NAME", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN>
  <TRNTYPE>DEBIT</TRNTYPE>
  <DTPOSTED>20261110</DTPOSTED>
  <TRNAMT>-89.90</TRNAMT>
  <MEMO>
    Netflix
  </MEMO>
</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTUSER>20261111</DTUSER><TRNAMT>-10</TRNAMT><PAYEE><NAME>Padaria</NAME></PAYEE></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

    expect(parseOfx(xml).table.slice(1)).toEqual([
      ["2026-11-10", "Netflix", "-89.90"],
      ["2026-11-11", "Padaria", "-10.00"],
    ]);
  });

  it("regressao: OFX em uma linha so (ou com fim de linha \\r) gera identificadores unicos", () => {
    const oneLine =
      "<OFX><BANKTRANLIST>" +
      "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261101<TRNAMT>-1.00<FITID>a<MEMO>Um</STMTTRN>" +
      "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102<TRNAMT>-2.00<FITID>b<MEMO>Dois</STMTTRN>" +
      "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261103<TRNAMT>-3.00<FITID>c<MEMO>Tres</STMTTRN>" +
      "</BANKTRANLIST></OFX>";

    expect(parseOfx(oneLine).lineNumbers).toEqual([1, 2, 3, 4]);
    expect(new Set(importRows(oneLine).map((item) => item.line)).size).toBe(3);

    const crOnly = oneLine.replace(/<STMTTRN>/g, "\r<STMTTRN>");
    expect(parseOfx(crOnly).lineNumbers).toEqual([1, 2, 3, 4]);
  });

  it("regressao: fatura com compras positivas (emissor que inverte) sugere sinal positivo", () => {
    const inverted = `<OFX><CCSTMTRS><CCACCTFROM><ACCTID>9</CCACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>58.40<MEMO>IFOOD</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261106<TRNAMT>23.90<MEMO>UBER</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261110<TRNAMT>-1500.00<MEMO>Pagamento recebido</STMTTRN>
</BANKTRANLIST></CCSTMTRS></OFX>`;
    const parsed = parseOfx(inverted);

    expect(parsed.expenseSign).toBe("positivo");
    expect(row(importRows(inverted)).map((item) => item[3])).toEqual(["ok", "ok", "credito"]);
  });

  it("varias contas, FITID repetido e entidade invalida", () => {
    const text = `<OFX>
<STMTRS><BANKACCTFROM><ACCTID>1</BANKACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>-10.00<FITID>X1<MEMO>Loja &#99999999; A</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>-10.00<FITID>X1<MEMO>Loja A</STMTTRN>
</BANKTRANLIST></STMTRS>
<CCSTMTRS><CCACCTFROM><ACCTID>2</CCACCTFROM><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261106<TRNAMT>-5.00<FITID>Y1<MEMO>Cafe</STMTTRN>
</BANKTRANLIST></CCSTMTRS></OFX>`;
    const parsed = parseOfx(text);

    expect(parsed.accounts).toBe(2);
    expect(parsed.duplicatesSkipped).toBe(1);
    expect(parsed.table.slice(1).map((cells) => cells[1])).toEqual(["Loja &#99999999; A", "Cafe"]);
  });

  it("regressao: TRNAMT com ponto e decimal pela especificacao ('-1.500' = R$ 1,50)", () => {
    const text = "<OFX><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105<TRNAMT>-1.500<MEMO>Bala</STMTTRN></OFX>";
    expect(row(importRows(text))).toEqual([[2, "Bala", 1.5, "ok"]]);
  });

  it("sem transacoes devolve tabela vazia", () => {
    expect(parseOfx("<OFX><BANKTRANLIST></BANKTRANLIST></OFX>")).toMatchObject({
      table: [],
      lineNumbers: [],
    });
  });
});

describe("ofxDateToLocalDay", () => {
  it("sem hora ou sem fuso usa a data informada", () => {
    expect(ofxDateToLocalDay("20261105")).toBe("2026-11-05");
    expect(ofxDateToLocalDay("20261105120000")).toBe("2026-11-05");
  });

  it("com fuso converte o instante para o dia local", () => {
    const instant = new Date(Date.UTC(2026, 10, 5, 2, 0, 0));
    const expected = `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, "0")}-${String(instant.getDate()).padStart(2, "0")}`;

    expect(ofxDateToLocalDay("20261105020000[0:GMT]")).toBe(expected);
    expect(ofxDateToLocalDay("20261105230000.000[-3:BRT]")).toBe(
      (() => {
        const brt = new Date(Date.UTC(2026, 10, 6, 2, 0, 0));
        return `${brt.getFullYear()}-${String(brt.getMonth() + 1).padStart(2, "0")}-${String(brt.getDate()).padStart(2, "0")}`;
      })(),
    );
  });

  it("valor invalido volta como veio (a tela marca data invalida)", () => {
    expect(ofxDateToLocalDay("ontem")).toBe("ontem");
  });
});
