import type {
  ExpenseSign,
  ParsedStatement,
} from "@/domain/entities/statementImport";

/** Cabecalho da tabela gerada a partir do OFX (reconhecido por detectColumns). */
export const OFX_TABLE_HEADER = ["Data", "Descrição", "Valor"];

export type ParsedOfx = ParsedStatement & {
  /** Sinal das despesas inferido pelo TRNTYPE (alguns emissores invertem). */
  expenseSign: ExpenseSign;
  /** Contas/cartoes no arquivo (> 1: transacoes combinadas). */
  accounts: number;
  /** Transacoes ignoradas por FITID repetido. */
  duplicatesSkipped: number;
};

/**
 * Conteudo OFX/QFX (Open Financial Exchange): SGML (1.x) ou XML (2.x).
 * Decidido pelo conteudo — um .ofx com CSV dentro volta para o leitor de CSV.
 */
export function isOfx(text: string): boolean {
  const head = text.slice(0, 4000);
  return /^\s*OFXHEADER\s*:/i.test(text) || /<\?OFX\b/i.test(head) || /<OFX>/i.test(head) || /<STMTTRN>/i.test(head);
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const MAX_CODE_POINT = 0x10ffff;

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const point =
        code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      // Entidade fora do Unicode fica como texto (nao derruba o arquivo inteiro).
      return Number.isInteger(point) && point >= 0 && point <= MAX_CODE_POINT
        ? String.fromCodePoint(point)
        : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

/**
 * Valor de uma tag: SGML (sem fechamento) ou XML (com fechamento, inclusive
 * com o valor em outra linha quando o arquivo e formatado).
 */
function tagValue(block: string, tag: string): string {
  const match = new RegExp(`<${tag}>([^<]*)`, "i").exec(block);
  return match ? decodeEntities(match[1]).replace(/\s+/g, " ").trim() : "";
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * DTPOSTED "AAAAMMDD[HHMMSS[.XXX]][[+-H[.M]:TZ]]" => dia local "AAAA-MM-DD".
 * Com hora e fuso, converte o instante para o fuso do navegador (ex.:
 * "...020000[0:GMT]" e dia anterior em Brasilia); sem fuso, usa a data informada.
 */
export function ofxDateToLocalDay(raw: string): string {
  const value = raw.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2})?(?:\.\d+)?)?\s*(?:\[([+-]?\d+(?:\.\d+)?)(?::[^\]]*)?\])?/.exec(
    value,
  );

  if (!match) {
    return value;
  }

  const [, year, month, day, hour, minute, second, offset] = match;

  if (hour === undefined || offset === undefined) {
    return `${year}-${month}-${day}`;
  }

  const utc =
    Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second ?? 0)) -
    Number(offset) * 60 * 60 * 1000;
  const local = new Date(utc);
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`;
}

/** TRNAMT usa ponto decimal pela especificacao: "-1.500" e R$ 1,50, nao 1.500. */
function normalizeAmount(raw: string): string {
  return /^[+-]?\d*\.?\d+$/.test(raw) ? Number(raw).toFixed(2) : raw;
}

/** Descricao: NAME (ou PAYEE/NAME) e MEMO; bancos brasileiros costumam usar so um. */
function descriptionOf(block: string): string {
  const name = tagValue(block, "NAME");
  const memo = tagValue(block, "MEMO");

  if (!name) return memo;
  if (!memo || name.toLowerCase().includes(memo.toLowerCase())) return name;
  if (memo.toLowerCase().includes(name.toLowerCase())) return memo;
  return `${name} - ${memo}`;
}

/** Tipos que representam saida de dinheiro (compra, debito, tarifa...). */
const DEBIT_TYPES = new Set(["DEBIT", "PAYMENT", "POS", "ATM", "CHECK", "FEE", "SRVCHG", "DIRECTDEBIT", "CASH"]);

/**
 * Converte as transacoes (<STMTTRN>) em uma tabela Data | Descricao | Valor,
 * reaproveitando o fluxo de importacao de CSV. Cada transacao recebe a linha
 * em que comeca no arquivo; em arquivos de uma linha so (XML minificado) usa a
 * ordem da transacao, para que cada linha tenha um identificador unico.
 */
export function parseOfx(text: string): ParsedOfx {
  const table: string[][] = [OFX_TABLE_HEADER];
  const physicalLines: number[] = [1];
  const seenIds = new Set<string>();
  const pattern = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi;
  let duplicatesSkipped = 0;
  let debitPositive = 0;
  let debitNegative = 0;
  // Contagem incremental de linhas (\r\n, \n ou \r isolado): O(n) no arquivo.
  let line = 1;
  let scanned = 0;

  const advanceTo = (index: number) => {
    for (; scanned < index; scanned += 1) {
      const char = text.charCodeAt(scanned);
      if (char === 10 || (char === 13 && text.charCodeAt(scanned + 1) !== 10)) {
        line += 1;
      }
    }
  };

  for (const match of text.matchAll(pattern)) {
    const block = match[1];
    const date = tagValue(block, "DTPOSTED") || tagValue(block, "DTUSER");
    const amount = normalizeAmount(tagValue(block, "TRNAMT"));
    const description = descriptionOf(block);
    const fitId = tagValue(block, "FITID");

    advanceTo(match.index ?? 0);

    if (!date && !amount && !description) {
      continue;
    }

    if (fitId) {
      if (seenIds.has(fitId)) {
        duplicatesSkipped += 1;
        continue;
      }
      seenIds.add(fitId);
    }

    const type = tagValue(block, "TRNTYPE").toUpperCase();
    const numeric = Number(amount.replace(/\./g, "").replace(",", "."));
    if (DEBIT_TYPES.has(type) && Number.isFinite(numeric) && numeric !== 0) {
      if (numeric > 0) debitPositive += 1;
      else debitNegative += 1;
    }

    table.push([date ? ofxDateToLocalDay(date) : "", description, amount]);
    physicalLines.push(line);
  }

  const unique = new Set(physicalLines).size === physicalLines.length;
  const lineNumbers = unique ? physicalLines : physicalLines.map((_, index) => index + 1);
  const accounts = (text.match(/<(BANKACCTFROM|CCACCTFROM)>/gi) ?? []).length;

  return {
    table: table.length > 1 ? table : [],
    lineNumbers: table.length > 1 ? lineNumbers : [],
    // Padrao OFX: debito negativo. Emissores que invertem tem debitos positivos.
    expenseSign: debitPositive > debitNegative ? "positivo" : "negativo",
    accounts,
    duplicatesSkipped,
  };
}
