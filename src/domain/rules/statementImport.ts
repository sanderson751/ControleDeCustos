import type { CategoryCatalog } from "@/domain/entities/category";
import type {
  Competence,
  CostCategory,
  CostEntry,
  CostType,
  NewCostInput,
} from "@/domain/entities/cost";
import {
  FALLBACK_CATEGORY,
  MAX_DESCRIPTION_LENGTH,
} from "@/domain/entities/cost";
import {
  type AmountColumns,
  type ColumnMapping,
  type DecimalSeparator,
  type ExpenseSign,
  HEADER_SEARCH_ROWS,
  type ImportRow,
  type ImportSelection,
  MAX_ACCOUNT_NAME_LENGTH,
  MAX_IMPORT_ROWS,
  type ParsedStatement,
  type StatementTable,
} from "@/domain/entities/statementImport";
import { normalizeSearchText } from "@/domain/rules/costRules";

const BOM = String.fromCharCode(0xfeff);
const NBSP = String.fromCharCode(0xa0);
const UNICODE_MINUS = String.fromCharCode(0x2212);

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const DELIMITERS = [";", ",", "\t"] as const;
const DELIMITER_SAMPLE_LINES = 20;

function countOutsideQuotes(line: string, delimiter: string): number {
  let inQuotes = false;
  let count = 0;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      count += 1;
    }
  }

  return count;
}

/**
 * Separador com a contagem mais consistente nas primeiras linhas: titulos
 * antes do cabecalho (sem separador) nao decidem. ";" vence empates.
 */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .slice(0, DELIMITER_SAMPLE_LINES);
  let best: string = DELIMITERS[0];
  let bestScore = 0;

  for (const delimiter of DELIMITERS) {
    const frequency = new Map<number, number>();
    for (const line of lines) {
      const count = countOutsideQuotes(line, delimiter);
      if (count > 0) {
        frequency.set(count, (frequency.get(count) ?? 0) + 1);
      }
    }
    // Linhas que repetem a mesma quantidade de separadores (moda).
    const score = Math.max(0, ...frequency.values());
    if (score > bestScore) {
      best = delimiter;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Converte o texto CSV em linhas/celulas (RFC 4180 tolerante): aspas abrem
 * somente no inicio do campo (aspas soltas como 50" ficam literais), "" escapado,
 * quebras de linha dentro de aspas, CRLF e BOM. Linhas vazias sao descartadas,
 * preservando o numero da linha fisica de cada registro.
 */
export function parseStatement(text: string): ParsedStatement {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const delimiter = detectDelimiter(source);
  const table: StatementTable = [];
  const lineNumbers: number[] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let physicalLine = 1;
  let rowStartLine = 1;

  const pushCell = () => {
    row.push(cell.trim());
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    if (row.some((value) => value !== "")) {
      table.push(row);
      lineNumbers.push(rowStartLine);
    }
    row = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (char === "\n") {
      physicalLine += 1;
    }

    if (inQuotes) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"' && cell.trim() === "") {
      cell = "";
      inQuotes = true;
    } else if (char === delimiter) {
      pushCell();
    } else if (char === "\n") {
      pushRow();
      rowStartLine = physicalLine;
    } else if (char !== "\r") {
      cell += char;
    }
  }

  pushRow();
  return { table, lineNumbers };
}

export function parseCsv(text: string): StatementTable {
  return parseStatement(text).table;
}

// ---------------------------------------------------------------------------
// Data e valor
// ---------------------------------------------------------------------------

const MIN_STATEMENT_YEAR = 2000;

function buildDate(year: number, month: number, day: number, now: Date): Date | null {
  // Limite superior: evita lancamentos em anos futuros (ex.: "99" lido como 2099).
  if (year < MIN_STATEMENT_YEAR || year > now.getFullYear() + 1) {
    return null;
  }

  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

const TIME_SUFFIX = String.raw`(?:[T\s]+\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\S*)?`;
const BR_DATE = new RegExp(String.raw`^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})${TIME_SUFFIX}$`);
const ISO_DATE = new RegExp(String.raw`^(\d{4})-(\d{2})-(\d{2})${TIME_SUFFIX}$`);

/**
 * DD/MM/AAAA, DD/MM/AA, DD-MM-AAAA, DD.MM.AAAA ou AAAA-MM-DD, com hora opcional
 * => meio-dia local. Anos de 2000 ate o proximo ano.
 */
export function parseStatementDate(raw: string, now: Date = new Date()): Date | null {
  const value = raw.trim();
  const brazilian = BR_DATE.exec(value);

  if (brazilian) {
    const [, day, month, year] = brazilian;
    const fullYear = year.length === 2 ? 2000 + Number(year) : Number(year);
    return buildDate(fullYear, Number(month), Number(day), now);
  }

  const iso = ISO_DATE.exec(value);

  if (iso) {
    const [, year, month, day] = iso;
    return buildDate(Number(year), Number(month), Number(day), now);
  }

  return null;
}

/** Remove simbolos de moeda/espacos e trata sinais; null se nao for numero. */
function splitSign(raw: string): { digits: string; negative: boolean } | null {
  let value = raw
    .trim()
    .replaceAll(NBSP, " ")
    .replaceAll(UNICODE_MINUS, "-")
    .replace(/R\$/gi, "")
    .trim();
  let negative = false;

  if (/^[-+]\s*[-+]/.test(value)) {
    return null;
  }

  const toggle = () => {
    negative = true;
  };

  if (value.startsWith("-")) {
    toggle();
    value = value.slice(1).trim();
  }

  if (/^\(.*\)$/.test(value)) {
    toggle();
    value = value.slice(1, -1).trim().replace(/R\$/gi, "").trim();
  }

  const prefix = /^([DdCc])\s+/.exec(value);
  if (prefix) {
    if (prefix[1].toUpperCase() === "D") toggle();
    value = value.slice(prefix[0].length);
  }

  const suffix = /\s*([DdCc])$/.exec(value);
  if (suffix && /\d/.test(value.slice(0, suffix.index))) {
    if (suffix[1].toUpperCase() === "D") toggle();
    value = value.slice(0, suffix.index);
  }

  value = value.replace(/\s+/g, "");

  if (value.endsWith("-")) {
    toggle();
    value = value.slice(0, -1);
  }

  if (value.startsWith("-")) {
    toggle();
    value = value.slice(1);
  } else if (value.startsWith("+")) {
    value = value.slice(1);
  }

  return /^\d[\d.,]*$/.test(value) ? { digits: value, negative } : null;
}

/**
 * Separador decimal predominante: separador seguido de 1-2 digitos no fim do
 * valor ("12,50", "3.9"). Indefinido quando nao ha evidencia (ex.: so "1.234").
 */
export function detectDecimalSeparator(
  values: readonly string[],
): DecimalSeparator | undefined {
  let comma = 0;
  let dot = 0;

  for (const raw of values) {
    const parsed = splitSign(raw);
    const match = parsed && /([.,])\d{1,2}$/.exec(parsed.digits);
    if (match?.[1] === ",") comma += 1;
    if (match?.[1] === ".") dot += 1;
  }

  if (comma === dot) {
    return undefined;
  }

  return comma > dot ? "," : ".";
}

/**
 * Valor monetario de extrato: "1.234,56", "-45,90", "R$ 10,00", "1234.56",
 * "(12,00)", "12,00-", "D 12,00", sufixo "D"/"C" e menos Unicode. Com o
 * separador decimal da coluna informado, o outro separador e milhar.
 */
export function parseStatementAmount(
  raw: string,
  decimal?: DecimalSeparator,
): number | null {
  const parsed = splitSign(raw);

  if (!parsed) {
    return null;
  }

  const { digits, negative } = parsed;
  let normalized: string;

  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  const commas = digits.split(",").length - 1;
  const dots = digits.split(".").length - 1;

  if (commas && dots) {
    // Virgula e ponto juntos nao sao ambiguos: o ultimo separador e o decimal
    // (vale mesmo quando o restante da coluna usa o outro formato).
    normalized =
      lastComma > lastDot
        ? digits.replaceAll(".", "").replace(",", ".")
        : digits.replaceAll(",", "");
  } else if (decimal) {
    const thousands = decimal === "," ? "." : ",";
    const withoutThousands = digits.replaceAll(thousands, "");
    if (withoutThousands.split(decimal).length > 2) {
      return null;
    }
    normalized = withoutThousands.replace(decimal, ".");
  } else if (commas) {
    normalized =
      commas > 1 || /^[1-9]\d{0,2},\d{3}$/.test(digits)
        ? digits.replaceAll(",", "")
        : digits.replace(",", ".");
  } else if (dots > 1 || /^[1-9]\d{0,2}\.\d{3}$/.test(digits)) {
    // "1.234" sem outra evidencia: milhar ("0.500" continua decimal).
    normalized = digits.replaceAll(".", "");
  } else {
    normalized = digits;
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    return null;
  }

  const cents = Math.round(amount * 100) / 100;
  return negative && cents !== 0 ? -cents : cents;
}

/** Natureza do lancamento: -1 debito/saida, 1 credito/entrada, null desconhecida. */
export function parseNature(raw: string): -1 | 1 | null {
  const value = normalizeSearchText(raw);

  if (/^(d|deb|debito|saida|-)$/.test(value)) {
    return -1;
  }

  if (/^(c|cred|credito|entrada|\+)$/.test(value)) {
    return 1;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Colunas
// ---------------------------------------------------------------------------

const KEYWORDS = {
  date: ["data", "date", "dt"],
  description: [
    "descricao",
    "historico",
    "lancamento",
    "estabelecimento",
    "detalhe",
    "titulo",
    "title",
    "memo",
    "description",
    "nome",
  ],
  amount: ["valor", "montante", "quantia", "amount", "value", "vlr"],
  debit: ["debito", "debitos", "saida", "saidas"],
  credit: ["credito", "creditos", "entrada", "entradas"],
  nature: ["d/c", "c/d", "dc", "natureza", "debito/credito", "credito/debito"],
} as const;

/** Colunas que nunca sao o valor da transacao. */
const NOT_AMOUNT = ["saldo", "us$", "usd", "dolar", "cotacao", "doc", "parcela"];

function matchesKeyword(cell: string, keyword: string): boolean {
  return cell === keyword || cell.split(/[^a-z0-9/$]+/).includes(keyword) || cell.startsWith(keyword);
}

function findColumn(
  header: readonly string[],
  keywords: readonly string[],
  taken: ReadonlySet<number>,
  options: { exclude?: readonly string[]; prefer?: string } = {},
): number {
  let best = -1;
  let bestScore = 0;

  header.forEach((rawCell, index) => {
    const cell = normalizeSearchText(rawCell);

    if (taken.has(index) || options.exclude?.some((word) => cell.includes(word))) {
      return;
    }

    const keywordIndex = keywords.findIndex((keyword) => matchesKeyword(cell, keyword));
    if (keywordIndex === -1) {
      return;
    }

    // Correspondencia exata > preferida (ex.: "r$") > parcial; palavras-chave iniciais pesam mais.
    const score =
      (keywords.includes(cell) ? 30 : 0) +
      (options.prefer && cell.includes(options.prefer) ? 20 : 0) +
      (keywords.length - keywordIndex);

    if (score > bestScore) {
      best = index;
      bestScore = score;
    }
  });

  return best;
}

function mappingFromHeader(header: readonly string[], headerRow: number): ColumnMapping | null {
  const taken = new Set<number>();
  const nature = findColumn(header, KEYWORDS.nature, taken);
  if (nature !== -1) taken.add(nature);

  const date = findColumn(header, KEYWORDS.date, taken, { exclude: ["saldo"] });
  if (date === -1) return null;
  taken.add(date);

  const amount = findColumn(header, KEYWORDS.amount, taken, {
    exclude: NOT_AMOUNT,
    prefer: "r$",
  });
  let amountColumns: AmountColumns | null = null;

  if (amount !== -1) {
    taken.add(amount);
    amountColumns = { kind: "single", column: amount, nature: nature === -1 ? null : nature };
  } else {
    const debit = findColumn(header, KEYWORDS.debit, taken, { exclude: ["saldo"] });
    const credit = findColumn(header, KEYWORDS.credit, new Set([...taken, debit]), {
      exclude: ["saldo"],
    });
    if (debit !== -1 && credit !== -1) {
      taken.add(debit).add(credit);
      amountColumns = { kind: "split", debit, credit };
    }
  }

  if (!amountColumns) return null;

  const description = findColumn(header, KEYWORDS.description, taken);
  if (description === -1) return null;

  return { headerRow, date, description, amount: amountColumns };
}

const SAMPLE_SIZE = 20;

function ratio(rows: StatementTable, column: number, test: (raw: string) => boolean) {
  const sample = rows.slice(0, SAMPLE_SIZE);
  return sample.length
    ? sample.filter((row) => test(row[column] ?? "")).length / sample.length
    : 0;
}

/** Valor monetario (com casas decimais), nao numero de documento. */
function looksMonetary(raw: string): boolean {
  const parsed = splitSign(raw);
  return parsed !== null && /[.,]\d{1,2}$/.test(parsed.digits);
}

/** Arquivo sem cabecalho reconhecivel: infere pelo conteudo das linhas de dados. */
function inferByContent(table: StatementTable, now: Date): ColumnMapping | null {
  const start = table.findIndex((row) =>
    row.some((cell) => parseStatementDate(cell, now) !== null),
  );

  if (start === -1) {
    return null;
  }

  const headerRow = start > 0 ? start - 1 : null;
  const header = headerRow === null ? [] : table[headerRow].map(normalizeSearchText);
  const body = table.slice(start);
  const width = Math.max(...body.map((row) => row.length));
  const columns = Array.from({ length: width }, (_, index) => index);
  const excluded = (column: number) =>
    NOT_AMOUNT.some((word) => header[column]?.includes(word));

  const date = columns.find(
    (column) => ratio(body, column, (raw) => parseStatementDate(raw, now) !== null) >= 0.6,
  );
  if (date === undefined) return null;

  const amount = columns.find(
    (column) =>
      column !== date && !excluded(column) && ratio(body, column, looksMonetary) >= 0.6,
  );
  if (amount === undefined) return null;

  const textScore = (column: number) =>
    body
      .slice(0, SAMPLE_SIZE)
      .reduce(
        (sum, row) =>
          sum + (/[a-z]/i.test(row[column] ?? "") ? (row[column] ?? "").length : 0),
        0,
      );
  const description = columns
    .filter((column) => column !== date && column !== amount)
    .sort((left, right) => textScore(right) - textScore(left))[0];

  if (description === undefined || textScore(description) === 0) {
    return null;
  }

  return {
    headerRow,
    date,
    description,
    amount: { kind: "single", column: amount, nature: null },
  };
}

/**
 * Colunas de data, descricao e valor: cabecalho reconhecido nas primeiras
 * linhas (titulos antes dele sao pulados) ou inferencia pelo conteudo. Null
 * quando nao ha como identificar data e valor com seguranca.
 */
export function detectColumns(
  table: StatementTable,
  now: Date = new Date(),
): ColumnMapping | null {
  for (let index = 0; index < Math.min(HEADER_SEARCH_ROWS, table.length); index += 1) {
    const row = table[index];
    if (row.some((cell) => parseStatementDate(cell, now) !== null)) {
      break;
    }
    const mapping = mappingFromHeader(row, index);
    if (mapping) {
      return mapping;
    }
  }

  return inferByContent(table, now);
}

// ---------------------------------------------------------------------------
// Linhas
// ---------------------------------------------------------------------------

function bodyOf(table: StatementTable, mapping: ColumnMapping, lineNumbers?: readonly number[]) {
  const start = mapping.headerRow === null ? 0 : mapping.headerRow + 1;
  // A linha e o identificador da linha na tela (selecao, categoria, duplicados):
  // numeros repetidos ou faltando caem na posicao na tabela.
  const usable =
    lineNumbers &&
    lineNumbers.length === table.length &&
    new Set(lineNumbers).size === lineNumbers.length
      ? lineNumbers
      : undefined;
  return table.slice(start).map((cells, index) => ({
    cells,
    line: usable?.[start + index] ?? start + index + 1,
  }));
}

function amountColumnsOf(amount: AmountColumns): number[] {
  return amount.kind === "single" ? [amount.column] : [amount.debit, amount.credit];
}

/** Separador decimal das colunas de valor do arquivo. */
export function decimalSeparatorOf(
  table: StatementTable,
  mapping: ColumnMapping,
): DecimalSeparator | undefined {
  const columns = amountColumnsOf(mapping.amount);
  return detectDecimalSeparator(
    bodyOf(table, mapping).flatMap(({ cells }) => columns.map((column) => cells[column] ?? "")),
  );
}

/**
 * Valor com sinal do extrato (negativo = saida). Colunas separadas: debito
 * vira negativo e credito positivo; natureza D/C prevalece sobre o sinal.
 */
function signedAmount(
  cells: readonly string[],
  amount: AmountColumns,
  decimal: DecimalSeparator | undefined,
): number | null {
  if (amount.kind === "split") {
    const debit = parseStatementAmount(cells[amount.debit] ?? "", decimal);
    const credit = parseStatementAmount(cells[amount.credit] ?? "", decimal);
    if (debit) return -Math.abs(debit);
    if (credit) return Math.abs(credit);
    return debit === null && credit === null ? null : 0;
  }

  const value = parseStatementAmount(cells[amount.column] ?? "", decimal);
  const nature = amount.nature === null ? null : parseNature(cells[amount.nature] ?? "");
  return value !== null && nature !== null ? Math.abs(value) * nature : value;
}

/** Maioria dos valores negativa => despesas sao negativas (extrato de conta). */
export function detectExpenseSign(
  table: StatementTable,
  mapping: ColumnMapping,
): ExpenseSign {
  if (mapping.amount.kind === "split" || mapping.amount.nature !== null) {
    return "negativo";
  }

  const decimal = decimalSeparatorOf(table, mapping);
  let negatives = 0;
  let positives = 0;

  for (const { cells } of bodyOf(table, mapping)) {
    const amount = signedAmount(cells, mapping.amount, decimal);
    if (!amount) continue;
    if (amount < 0) negatives += 1;
    else positives += 1;
  }

  return negatives > positives ? "negativo" : "positivo";
}

/** Saldo, total e similares: informativos, nunca uma despesa. */
const INFORMATIVE_DESCRIPTION =
  /^(s ?a ?l ?d ?o|sdo|total|subtotal|saldo anterior|saldo do dia|saldo final)( |$|:)/;

export function isInformativeDescription(description: string): boolean {
  return INFORMATIVE_DESCRIPTION.test(normalizeSearchText(description));
}

export type ImportRowsResult = {
  rows: ImportRow[];
  /** Linhas alem do limite que nao foram consideradas. */
  truncated: number;
};

/** Linhas de importacao com status (ok, credito, informativa ou invalida). */
export function buildImportRows(
  table: StatementTable,
  mapping: ColumnMapping,
  sign: ExpenseSign,
  options: { lineNumbers?: readonly number[]; now?: Date } = {},
): ImportRowsResult {
  const body = bodyOf(table, mapping, options.lineNumbers);
  const decimal = decimalSeparatorOf(table, mapping);
  // Natureza (D/C) e colunas separadas ja trazem saida como negativo.
  const effectiveSign: ExpenseSign =
    mapping.amount.kind === "split" || mapping.amount.nature !== null ? "negativo" : sign;

  const rows = body.slice(0, MAX_IMPORT_ROWS).map<ImportRow>(({ cells, line }) => {
    const date = parseStatementDate(cells[mapping.date] ?? "", options.now);
    const signed = signedAmount(cells, mapping.amount, decimal);
    const description = (cells[mapping.description] ?? "").replace(/\s+/g, " ").trim();
    const amount = signed === null ? null : Math.abs(signed);
    const base = { line, date, description, amount };

    if (description && isInformativeDescription(description)) {
      return { ...base, status: "informativa" };
    }
    if (!date) {
      return { ...base, status: "invalida", reason: "Data inválida" };
    }
    if (signed === null) {
      return { ...base, status: "invalida", reason: "Valor inválido" };
    }
    if (!description) {
      return { ...base, status: "invalida", reason: "Descrição vazia" };
    }

    const isExpense = effectiveSign === "negativo" ? signed < 0 : signed > 0;
    return { ...base, status: isExpense ? "ok" : "credito" };
  });

  return { rows, truncated: Math.max(0, body.length - MAX_IMPORT_ROWS) };
}

/** Intervalo de competencias das linhas validas (para buscar lancamentos existentes). */
export function competenceRangeOf(
  rows: readonly ImportRow[],
): { from: Competence; to: Competence } | null {
  const dates = rows.flatMap((row) => (row.status === "ok" && row.date ? [row.date] : []));

  if (dates.length === 0) {
    return null;
  }

  const times = dates.map((date) => date.getTime());
  const min = new Date(Math.min(...times));
  const max = new Date(Math.max(...times));

  return {
    from: { year: min.getFullYear(), month: min.getMonth() + 1 },
    to: { year: max.getFullYear(), month: max.getMonth() + 1 },
  };
}

// ---------------------------------------------------------------------------
// Categoria sugerida e duplicados
// ---------------------------------------------------------------------------

/**
 * Corta sem partir caracteres (emoji) e sem passar de `max` unidades de
 * texto, o mesmo criterio de tamanho usado na validacao das regras.
 */
export function truncateText(text: string, max: number): string {
  let result = "";

  for (const char of text) {
    if (result.length + char.length > max) {
      break;
    }
    result += char;
  }

  return result;
}

/** Conta gravada a partir da descricao do extrato. */
export function toAccountName(description: string): string {
  return truncateText(description.trim(), MAX_ACCOUNT_NAME_LENGTH).trim();
}

const CATEGORY_KEYWORDS: ReadonlyArray<[CostCategory, readonly string[]]> = [
  [
    "transporte",
    ["uber", "99app", "99 pop", "cabify", "posto", "combustivel", "gasolina", "estacionamento", "pedagio", "sem parar", "metro", "onibus"],
  ],
  [
    "alimentacao",
    ["ifood", "rappi", "mercado", "supermercado", "padaria", "restaurante", "lanchonete", "acougue", "hortifruti", "pizzaria", "carrefour", "assai", "atacadao"],
  ],
  [
    "saude",
    ["farmacia", "drogaria", "drogasil", "droga raia", "hospital", "clinica", "laboratorio", "unimed", "dentista"],
  ],
  [
    "moradia",
    ["aluguel", "condominio", "energia", "enel", "cemig", "copel", "sabesp", "iptu", "internet"],
  ],
  [
    "educacao",
    ["escola", "colegio", "faculdade", "universidade", "curso", "udemy", "alura", "livraria"],
  ],
  [
    "lazer",
    ["netflix", "spotify", "cinema", "ingresso", "steam", "disney", "prime video", "hbo", "airbnb", "hotel"],
  ],
];

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Uma expressao por categoria, compilada uma unica vez (palavra inteira). */
const CATEGORY_PATTERNS: ReadonlyArray<[CostCategory, RegExp]> = CATEGORY_KEYWORDS.map(
  ([category, words]) => [
    category,
    new RegExp(`(^|[^a-z0-9])(${words.map(escapeRegExp).join("|")})([^a-z0-9]|$)`),
  ],
);

/** Categoria mais recente usada por descricao normalizada (lancamentos existentes). */
export function buildCategoryHistory(
  entries: readonly CostEntry[],
): Map<string, CostCategory> {
  const history = new Map<string, { category: CostCategory; time: number }>();

  for (const entry of entries) {
    const key = normalizeSearchText(entry.accountName);
    const time = entry.createdAt.getTime();
    const current = history.get(key);

    if (!current || time > current.time) {
      history.set(key, { category: entry.category, time });
    }
  }

  return new Map([...history].map(([key, value]) => [key, value.category]));
}

/** Historico (categoria ativa) > palavras-chave > Outros. */
export function suggestCategory(
  description: string,
  history: ReadonlyMap<string, CostCategory>,
  catalog: CategoryCatalog,
): CostCategory {
  const key = normalizeSearchText(toAccountName(description));
  const fromHistory = history.get(key);

  if (fromHistory && catalog.activeIds.includes(fromHistory)) {
    return fromHistory;
  }

  const match = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(key));
  return match ? match[0] : FALLBACK_CATEGORY;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function duplicateKey(date: Date, amount: number, accountName: string): string {
  return `${dayKey(date)}|${Math.round(amount * 100)}|${normalizeSearchText(accountName)}`;
}

/**
 * Linhas que repetem lancamentos existentes (mesmo dia, valor e conta).
 * Conta por multiplicidade: duas compras iguais no arquivo e uma existente
 * marcam somente uma como duplicada.
 */
export function findDuplicateLines(
  rows: readonly ImportRow[],
  existing: readonly CostEntry[],
): Set<number> {
  const remaining = new Map<string, number>();

  for (const entry of existing) {
    const key = duplicateKey(entry.createdAt, entry.amount, entry.accountName);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const duplicates = new Set<number>();

  for (const row of rows) {
    if (row.status !== "ok" || !row.date || row.amount === null) {
      continue;
    }

    const key = duplicateKey(row.date, row.amount, toAccountName(row.description));
    const count = remaining.get(key) ?? 0;

    if (count > 0) {
      duplicates.add(row.line);
      remaining.set(key, count - 1);
    }
  }

  return duplicates;
}

// ---------------------------------------------------------------------------
// Gravacao
// ---------------------------------------------------------------------------

export function toImportInput(
  selection: ImportSelection,
  options: { costType: CostType; fileName: string },
): NewCostInput {
  return {
    accountName: toAccountName(selection.row.description),
    amount: selection.row.amount,
    costType: options.costType,
    category: selection.category,
    description: truncateText(`Importado de ${options.fileName}`, MAX_DESCRIPTION_LENGTH),
    installmentsTotal: 1,
    createdAtManual: selection.row.date,
  };
}
