import {
  aliasKey,
  isValidAccessKey,
  matchReceiptLine,
  nameSimilarity,
  parseMoney,
  parseReceiptText,
  receiptKeyOf,
} from "@/domain/rules/receiptParser";

const NOW = new Date(2026, 10, 27, 20);
/** Chave de acesso com DV (modulo 11) valido, modelo 65 (NFC-e). */
const ACCESS_KEY = "35261106057223000171650010000123451000123457";

/** Cupom NFC-e tipico de supermercado (texto como sai do OCR). */
const ASSAI = `ASSAI ATACADISTA
CNPJ: 06.057.223/0001-71 IE: 123456789
AV. BRASIL, 1000 - CENTRO - SAO PAULO - SP
DOCUMENTO AUXILIAR DA NOTA FISCAL DE CONSUMIDOR ELETRONICA
Codigo Descricao Qtde UN Vl Unit Vl Total
001 7896006716112 ARROZ TIPO 1 TIO JOAO 5KG 2 UN X 25,90 51,80
002 7891910000197 CAFE PILAO TRADICIONAL 500G 1 UN X 18,90 18,90
003 2000123000000 PATINHO MOIDO KG 1,234 KG X 39,90 49,24
004 7891000100103 LEITE INTEGRAL ITALAC 1L 12 UN X 4,79 57,48
QTD. TOTAL DE ITENS 4
VALOR TOTAL R$ 177,42
DESCONTO R$ 2,42
VALOR A PAGAR R$ 175,00
FORMA DE PAGAMENTO VALOR PAGO
Cartao de Credito 175,00
Consulte pela Chave de Acesso em www.nfce.fazenda.sp.gov.br
3526 1106 0572 2300 0171 6500 1000 0123 4510 0012 3457
NFC-e n 012345 Serie 001 Emissao 27/11/2026 18:32:10`;

/** Padaria com descricao quebrada em duas linhas e ruido de OCR nos numeros. */
const PADARIA = `PADARIA PAO QUENTE LTDA
CNPJ 11.222.333/0001-44
Rua das Flores, 12
1 PAO FRANCES
0,450 KG x 16,9O 7,6l
2 7891000053508 LEITE CONDENSADO MOCA 395G 1 UN x 7,49 7,49 F1
3 REFRIGERANTE GUARANA ANTARCTICA 2L 2 UN * 9,99 = 19,98
TOTAL R$ 35,08
Data: 26/11/26 07:15`;

describe("parseMoney", () => {
  it.each([
    ["25,90", 25.9],
    ["1.234,56", 1234.56],
    ["16,9O", 16.9],
    ["7,6l", 7.61],
    ["1 234,56", 1234.56],
    ["S9,90", 59.9],
    ["39,900", 39.9],
  ])("%s => %d", (raw, expected) => {
    expect(parseMoney(raw)).toBe(expected);
  });

  it("recusa texto", () => {
    expect(parseMoney("abc")).toBeNull();
  });
});

describe("parseReceiptText", () => {
  it("cupom de supermercado: itens, total a pagar, data, loja, CNPJ e chave", () => {
    const receipt = parseReceiptText(ASSAI, NOW);

    expect(receipt.store).toBe("ASSAI ATACADISTA");
    expect(receipt.cnpj).toBe("06057223000171");
    expect(receipt.total).toBe(175);
    expect(receipt.date).toEqual(new Date(2026, 10, 27, 12));
    expect(receipt.accessKey).toBe(ACCESS_KEY);
    expect(receipt.items).toEqual([
      { rawName: "ARROZ TIPO 1 TIO JOAO 5KG", quantity: 2, unit: "UN", unitPrice: 25.9, lineTotal: 51.8 },
      { rawName: "CAFE PILAO TRADICIONAL 500G", quantity: 1, unit: "UN", unitPrice: 18.9, lineTotal: 18.9 },
      { rawName: "PATINHO MOIDO KG", quantity: 1.234, unit: "KG", unitPrice: 39.9, lineTotal: 49.24 },
      { rawName: "LEITE INTEGRAL ITALAC 1L", quantity: 12, unit: "UN", unitPrice: 4.79, lineTotal: 57.48 },
    ]);
    expect(receipt.itemsSum).toBe(177.42);
    // Desconto de 1,4%: dentro da tolerancia.
    expect(receipt.totalNeedsReview).toBe(false);
  });

  it("padaria: linha quebrada, ruido de OCR, codigo de tributacao e '='", () => {
    const receipt = parseReceiptText(PADARIA, NOW);

    expect(receipt.store).toBe("PADARIA PAO QUENTE LTDA");
    expect(receipt.total).toBe(35.08);
    expect(receipt.date).toEqual(new Date(2026, 10, 26, 12));
    expect(receipt.accessKey).toBeNull();
    expect(receipt.items.map((item) => [item.rawName, item.quantity, item.unitPrice, item.lineTotal])).toEqual([
      ["PAO FRANCES", 0.45, 16.9, 7.61],
      ["LEITE CONDENSADO MOCA 395G", 1, 7.49, 7.49],
      ["REFRIGERANTE GUARANA ANTARCTICA 2L", 2, 9.99, 19.98],
    ]);
  });

  it("'RS'/'R5' lidos no lugar de R$ nao viram digito do valor", () => {
    const receipt = parseReceiptText("MERCADO X\n1 ARROZ 5KG 1 UN X RS 25,90 RS 25,90\nTOTAL R5 25,90", NOW);
    expect(receipt.items[0]).toMatchObject({ unitPrice: 25.9, lineTotal: 25.9 });
    expect(receipt.total).toBe(25.9);
  });

  it("preco unitario com 3 casas, sem X e CF-e SAT com tributo entre parenteses", () => {
    const receipt = parseReceiptText(
      [
        "MERCADO X",
        "001 2000123 PATINHO MOIDO 1,234 KG X 39,900 49,24",
        "002 7891000 LEITE INTEGRAL 1L 2 UN 4,79 9,58",
        "003 7896006 ARROZ 5KG 1 UN X 25,90 (4,66) 25,90",
        "TOTAL R$ 84,72",
      ].join("\n"),
      NOW,
    );
    expect(receipt.items.map((item) => [item.rawName, item.quantity, item.unitPrice, item.lineTotal])).toEqual([
      ["PATINHO MOIDO", 1.234, 39.9, 49.24],
      ["LEITE INTEGRAL 1L", 2, 4.79, 9.58],
      ["ARROZ 5KG", 1, 25.9, 25.9],
    ]);
    expect(receipt.totalNeedsReview).toBe(false);
  });

  it("desconto do item reduz o item; item cancelado sai da lista", () => {
    const receipt = parseReceiptText(
      [
        "MERCADO X",
        "001 7896006 ARROZ 5KG 1 UN X 25,90 25,90",
        "DESC. ITEM -2,00",
        "002 7891000 FEIJAO 1KG 1 UN X 8,99 8,99",
        "ITEM 002 CANCELADO",
        "003 7891001 OLEO SOJA 900ML 1 UN X 7,50 7,50",
        "VALOR A PAGAR R$ 31,40",
      ].join("\n"),
      NOW,
    );
    expect(receipt.items.map((item) => [item.rawName, item.unitPrice, item.lineTotal])).toEqual([
      ["ARROZ 5KG", 23.9, 23.9],
      ["OLEO SOJA 900ML", 7.5, 7.5],
    ]);
    expect(receipt.itemsSum).toBe(31.4);
  });

  it("total: VAL0R A PAGAR (OCR), total menos desconto e valor pago com troco", () => {
    expect(parseReceiptText("VAL0R A PAGAR R$ 50,00", NOW).total).toBe(50);
    expect(parseReceiptText("TOTAL R$ 60,00\nDESCONTO R$ 5,00", NOW).total).toBe(55);
    // Com troco, "valor pago" e o dinheiro entregue, nao a compra.
    expect(parseReceiptText("VALOR PAGO R$ 100,00\nTROCO R$ 20,00", NOW).total).toBeNull();
    expect(parseReceiptText("VALOR PAGO R$ 80,00", NOW).total).toBe(80);
  });

  it("loja ignora saudacao; data prefere a de emissao", () => {
    const receipt = parseReceiptText(
      "*** BEM-VINDO ***\nSUPERMERCADO BOM PRECO\nPROMOCAO VALIDA ATE 10/11/2026\nEmissao: 26/11/2026 10:00",
      NOW,
    );
    expect(receipt.store).toBe("SUPERMERCADO BOM PRECO");
    expect(receipt.date).toEqual(new Date(2026, 10, 26, 12));
  });

  it("valores sem linha de item antes nao pegam nome de rodape", () => {
    const receipt = parseReceiptText("MERCADO X\nOBRIGADO PELA PREFERENCIA\n1 UN X 5,00 5,00", NOW);
    expect(receipt.items).toEqual([]);
  });

  it("sem total legivel ou com divergencia grande pede conferencia", () => {
    expect(parseReceiptText("MERCADO X\n1 ARROZ 1 UN X 10,00 10,00", NOW)).toMatchObject({
      total: null,
      totalNeedsReview: true,
    });
    expect(
      parseReceiptText("MERCADO X\n1 ARROZ 1 UN X 10,00 10,00\nTOTAL R$ 50,00", NOW).totalNeedsReview,
    ).toBe(true);
  });

  it("texto sem cupom nao inventa dados", () => {
    expect(parseReceiptText("foto borrada\n???", NOW)).toMatchObject({
      total: null,
      items: [],
      date: null,
      accessKey: null,
      cnpj: null,
    });
  });

  it("sequencia de 44 digitos com DV invalido nao e chave de acesso", () => {
    expect(parseReceiptText(ACCESS_KEY.slice(0, 43) + "0", NOW).accessKey).toBeNull();
  });
});

describe("isValidAccessKey", () => {
  it("confere tamanho, modelo e digito verificador", () => {
    expect(isValidAccessKey(ACCESS_KEY)).toBe(true);
    expect(isValidAccessKey("1".repeat(44))).toBe(false);
    expect(isValidAccessKey(ACCESS_KEY.slice(1))).toBe(false);
  });
});

describe("associacao a produtos", () => {
  const candidates = [
    { id: "arroz", normalizedName: "arroz 5kg", aliases: [] },
    { id: "cafe", normalizedName: "cafe pilao 500g", aliases: [] },
    { id: "leite", normalizedName: "leite integral", aliases: [aliasKey("LEITE INTEGRAL ITALAC 1L")] },
    { id: "carne", normalizedName: "patinho moido", aliases: [] },
    { id: "agua", normalizedName: "agua mineral", aliases: [] },
  ];

  it("alias aprendido vence; similaridade por palavras ignora marca e medidas", () => {
    expect(matchReceiptLine("LEITE INTEGRAL ITALAC 1L", candidates)).toEqual({ id: "leite", score: 1 });
    // Espacos lidos de forma diferente nao quebram o apelido.
    expect(matchReceiptLine("LEITE INTEGRAL ITALAC1L", candidates)).toEqual({ id: "leite", score: 1 });
    expect(matchReceiptLine("ARROZ TIPO 1 TIO JOAO 5KG", candidates)?.id).toBe("arroz");
    expect(matchReceiptLine("CAFE PILAO TRADICIONAL 500G", candidates)?.id).toBe("cafe");
    expect(matchReceiptLine("PATINHO MOIDO KG", candidates)?.id).toBe("carne");
    expect(matchReceiptLine("DETERGENTE YPE 500ML", candidates)).toBeNull();
  });

  it("nao associa produtos diferentes com a mesma primeira palavra", () => {
    expect(matchReceiptLine("LEITE CONDENSADO MOCA 395G", candidates)).toBeNull();
    expect(matchReceiptLine("AGUA SANITARIA QBOA 2L", candidates)).toBeNull();
    // Produto generico no comeco do nome lido x palavra no meio de outro produto.
    expect(matchReceiptLine("BISCOITO DE ARROZ 100G", candidates)).toBeNull();
  });

  it("similaridade alta exige todas as palavras do catalogo", () => {
    expect(nameSimilarity("CAFE PILAO TRAD", "Café Pilão")).toBeGreaterThanOrEqual(0.9);
    expect(nameSimilarity("ARROZ TIPO 1 TIO JOAO 5KG", "arroz 5kg")).toBeGreaterThanOrEqual(0.6);
    expect(nameSimilarity("ARROZ TIPO 1 TIO JOAO 5KG", "arroz 5kg")).toBeLessThan(0.9);
    expect(nameSimilarity("Arroz", "Feijão")).toBe(0);
  });
});

describe("receiptKeyOf", () => {
  it("usa a chave da NFC-e (DV valido) ou hash de emissor + dia + total", () => {
    expect(receiptKeyOf({ accessKey: ACCESS_KEY, store: "x", date: null, total: 1 })).toBe(ACCESS_KEY);
    expect(
      receiptKeyOf({ accessKey: null, store: "Padaria Pão Quente", date: new Date(2026, 10, 26, 12), total: 35.08 }),
    ).toBe("h-padariapaoquente-20261126-3508");
    expect(
      receiptKeyOf({
        accessKey: "1".repeat(44),
        cnpj: "11222333000144",
        store: "Outro nome",
        date: new Date(2026, 10, 26, 12),
        total: 35.08,
      }),
    ).toBe("h-11222333000144-20261126-3508");
  });

  it("sem data ou sem total nao ha chave", () => {
    expect(receiptKeyOf({ accessKey: null, store: "Padaria", date: null, total: 35.08 })).toBeNull();
    expect(receiptKeyOf({ accessKey: null, store: "Padaria", date: new Date(2026, 10, 26), total: 0 })).toBeNull();
  });
});
