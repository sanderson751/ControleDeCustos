import {
  formatCurrencyBRL,
  maskCurrencyInput,
  parseMaskedCurrencyToNumber,
  toMaskedCurrencyFromNumber,
} from "@/lib/currency";

describe("currency", () => {
  it("formata em BRL com espaco comum", () => {
    expect(formatCurrencyBRL(1250)).toBe("R$ 1.250,00");
    expect(formatCurrencyBRL(0.5)).toBe("R$ 0,50");
  });

  it("aplica mascara a partir dos digitos digitados", () => {
    expect(maskCurrencyInput("12345")).toBe("R$ 123,45");
    expect(maskCurrencyInput("R$ 1a2b3")).toBe("R$ 1,23");
    expect(maskCurrencyInput("abc")).toBe("");
  });

  it("converte valor mascarado em numero", () => {
    expect(parseMaskedCurrencyToNumber("R$ 1.234,56")).toBe(1234.56);
    expect(parseMaskedCurrencyToNumber("")).toBeNaN();
  });

  it("gera mascara a partir de numero positivo", () => {
    expect(toMaskedCurrencyFromNumber(99.9)).toBe("R$ 99,90");
    expect(toMaskedCurrencyFromNumber(0)).toBe("");
    expect(toMaskedCurrencyFromNumber(Number.NaN)).toBe("");
  });
});
