const BOM = String.fromCharCode(0xfeff);

/**
 * Texto do arquivo de extrato: UTF-8 quando valido; senao Windows-1252
 * (exportacoes antigas de bancos brasileiros). Remove o BOM.
 */
export function decodeStatementFile(buffer: ArrayBuffer): string {
  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder("windows-1252").decode(buffer);
  }

  return text.startsWith(BOM) ? text.slice(1) : text;
}

/** Le o arquivo selecionado (File.arrayBuffer nem sempre existe em ambientes antigos). */
export function readFileAsArrayBuffer(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}
