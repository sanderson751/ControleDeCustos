import {
  decodeStatementFile,
  readFileAsArrayBuffer,
} from "@/lib/statementFile";

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe("decodeStatementFile", () => {
  it("le UTF-8 e remove o BOM", () => {
    const buffer = new Uint8Array([
      0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Histórico"),
    ]).buffer;
    expect(decodeStatementFile(buffer)).toBe("Histórico");
  });

  it("usa Windows-1252 quando o arquivo nao e UTF-8 valido", () => {
    // "Saúde" em Windows-1252 (ú = 0xFA).
    expect(decodeStatementFile(bytes(0x53, 0x61, 0xfa, 0x64, 0x65))).toBe("Saúde");
  });
});

describe("readFileAsArrayBuffer", () => {
  it("usa File.arrayBuffer ou FileReader como alternativa", async () => {
    const blob = new Blob(["abc"]);
    expect(new Uint8Array(await readFileAsArrayBuffer(blob))).toEqual(
      new Uint8Array([97, 98, 99]),
    );

    const legacy = new Blob(["xy"]);
    Object.defineProperty(legacy, "arrayBuffer", { value: undefined });
    expect(new Uint8Array(await readFileAsArrayBuffer(legacy))).toEqual(
      new Uint8Array([120, 121]),
    );
  });
});
