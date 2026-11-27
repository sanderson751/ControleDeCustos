import { FileUpIcon, UploadIcon } from "lucide-react";
import {
  type ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CategoryOption } from "@/domain/entities/category";
import {
  COST_TYPE_LABELS,
  type CostCategory,
  type CostEntry,
  type CostType,
} from "@/domain/entities/cost";
import {
  type AmountColumns,
  type ColumnMapping,
  type ExpenseSign,
  HEADER_SEARCH_ROWS,
  type ImportRow,
  type ImportSelection,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  type ParsedStatement,
} from "@/domain/entities/statementImport";
import { selectableCategories } from "@/domain/rules/categoryRules";
import { canMutateCosts } from "@/domain/rules/permissions";
import {
  buildCategoryHistory,
  buildImportRows,
  competenceRangeOf,
  detectColumns,
  detectExpenseSign,
  findDuplicateLines,
  parseStatement,
  suggestCategory,
  toImportInput,
} from "@/domain/rules/statementImport";
import { formatCurrencyBRL } from "@/lib/currency";
import { formatDateBR } from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import {
  decodeStatementFile,
  readFileAsArrayBuffer,
} from "@/lib/statementFile";
import { useSession } from "@/providers/AuthProvider";
import { useCategories } from "@/providers/CategoriesProvider";
import { ROUTES, withCompetence } from "@/routes/navigation";
import { listCostsByCompetenceRange } from "@/services/costService";
import { ImportPartialError, importCostEntries } from "@/services/importService";

type LoadedFile = ParsedStatement & { name: string };

const SIGN_LABELS: Record<ExpenseSign, string> = {
  negativo: "Valores negativos (extrato de conta)",
  positivo: "Valores positivos (fatura de cartão)",
};

const NO_COLUMN = -1;

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function isReady(row: ImportRow): row is ImportSelection["row"] {
  return row.status === "ok" && row.date !== null && row.amount !== null;
}

function rowLabel(row: ImportRow) {
  return `linha ${row.line}: ${row.description || "sem descrição"}`;
}

type RowItemProps = {
  row: ImportRow;
  checked: boolean;
  category: CostCategory;
  isDuplicate: boolean;
  isImported: boolean;
  disabled: boolean;
  categoryOptions: readonly CategoryOption[];
  onToggle: (line: number, checked: boolean) => void;
  onCategory: (line: number, category: CostCategory) => void;
};

/** Linha memoizada: marcar uma linha nao re-renderiza as outras 499. */
const ImportRowItem = memo(function ImportRowItem({
  row,
  checked,
  category,
  isDuplicate,
  isImported,
  disabled,
  categoryOptions,
  onToggle,
  onCategory,
}: RowItemProps) {
  const selectable = isReady(row) && !isImported;

  return (
    <TableRow
      data-state={checked ? "selected" : undefined}
      className={selectable ? undefined : "text-muted-foreground"}
    >
      <TableCell>
        <Checkbox
          aria-label={`Importar ${rowLabel(row)}`}
          checked={checked}
          disabled={!selectable || disabled}
          onCheckedChange={(value) => onToggle(row.line, value === true)}
        />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {row.date ? formatDateBR(row.date) : "—"}
      </TableCell>
      <TableCell className="max-w-80 truncate" title={row.description}>
        {row.description || "—"}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">
        {row.amount === null ? "—" : formatCurrencyBRL(row.amount)}
      </TableCell>
      <TableCell>
        {selectable ? (
          <NativeSelect
            aria-label={`Categoria da ${rowLabel(row)}`}
            size="sm"
            value={category}
            onChange={(event) => onCategory(row.line, event.target.value)}
            disabled={disabled}
          >
            {categoryOptions.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        {isImported && <Badge variant="secondary">Importado</Badge>}
        {row.status === "credito" && <Badge variant="secondary">Crédito ignorado</Badge>}
        {row.status === "informativa" && (
          <Badge variant="secondary">Saldo/total ignorado</Badge>
        )}
        {row.status === "invalida" && (
          <Badge variant="outline">{`Linha inválida: ${row.reason}`}</Badge>
        )}
        {!isImported && isReady(row) && isDuplicate && (
          <Badge variant="outline">Possível duplicado</Badge>
        )}
      </TableCell>
    </TableRow>
  );
});

export default function ImportPage() {
  const { profile } = useSession();
  const userId = profile.userId;
  const canImport = canMutateCosts(profile.role);
  const navigate = useNavigate();
  const categories = useCategories();
  const { catalog } = categories;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [sign, setSign] = useState<ExpenseSign>("negativo");
  const [costType, setCostType] = useState<CostType>("variavel");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [chosenCategory, setChosenCategory] = useState<Record<number, CostCategory>>({});
  const [importedLines, setImportedLines] = useState<ReadonlySet<number>>(new Set());
  const [existing, setExisting] = useState<CostEntry[]>([]);
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const { rows, truncated } = useMemo(
    () =>
      file && mapping
        ? buildImportRows(file.table, mapping, sign, { lineNumbers: file.lineNumbers })
        : { rows: [], truncated: 0 },
    [file, mapping, sign],
  );

  const range = useMemo(() => competenceRangeOf(rows), [rows]);
  const fromYear = range?.from.year ?? 0;
  const fromMonth = range?.from.month ?? 0;
  const toYear = range?.to.year ?? 0;
  const toMonth = range?.to.month ?? 0;

  // Lancamentos existentes no periodo do arquivo: duplicados e historico de categorias.
  useEffect(() => {
    if (!fromYear) {
      setExisting([]);
      return;
    }

    let isActive = true;
    setIsCheckingExisting(true);

    listCostsByCompetenceRange(
      userId,
      { year: fromYear, month: fromMonth },
      { year: toYear, month: toMonth },
    )
      .then((entries) => {
        if (isActive) {
          setExisting(entries);
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setExisting([]);
          notify(
            "warning",
            friendlyFirestoreErrorMessage(
              error,
              "Não foi possível verificar lançamentos já existentes. Confira duplicados antes de importar.",
            ),
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsCheckingExisting(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [fromMonth, fromYear, reloadToken, toMonth, toYear, userId]);

  const duplicates = useMemo(() => findDuplicateLines(rows, existing), [rows, existing]);
  const suggestions = useMemo(() => {
    const history = buildCategoryHistory(existing);
    return new Map(
      rows.map((row) => [row.line, suggestCategory(row.description, history, catalog)]),
    );
  }, [catalog, existing, rows]);
  const categoryOptions = useMemo(() => selectableCategories(catalog), [catalog]);

  const isSelected = useCallback(
    (row: ImportRow) =>
      isReady(row) &&
      !importedLines.has(row.line) &&
      (selected[row.line] ?? !duplicates.has(row.line)),
    [duplicates, importedLines, selected],
  );
  // Escolha arquivada em outra aba deixa de valer: volta para a sugestao.
  const categoryOf = useCallback(
    (row: ImportRow): CostCategory => {
      const chosen = chosenCategory[row.line];
      return chosen && catalog.activeIds.includes(chosen)
        ? chosen
        : (suggestions.get(row.line) ?? "outros");
    },
    [catalog.activeIds, chosenCategory, suggestions],
  );

  const readyRows = useMemo(
    () => rows.filter((row) => isReady(row) && !importedLines.has(row.line)),
    [importedLines, rows],
  );
  const selection = useMemo<ImportSelection[]>(
    () =>
      rows
        .filter(isSelected)
        .map((row) => ({ row: row as ImportSelection["row"], category: categoryOf(row) })),
    [categoryOf, isSelected, rows],
  );
  const selectedTotal = selection.reduce((sum, item) => sum + item.row.amount, 0);
  const ignoredCount = rows.filter((row) => !isReady(row)).length;
  const hasCredits = rows.some((row) => row.status === "credito");

  const handleToggle = useCallback((line: number, checked: boolean) => {
    setSelected((current) => ({ ...current, [line]: checked }));
  }, []);
  const handleCategory = useCallback((line: number, category: CostCategory) => {
    setChosenCategory((current) => ({ ...current, [line]: category }));
  }, []);

  const header = file && mapping?.headerRow != null ? file.table[mapping.headerRow] : null;
  const columnCount = file ? Math.max(...file.table.map((row) => row.length)) : 0;
  const columnOptions = Array.from({ length: columnCount }, (_, index) => ({
    value: index,
    label: header?.[index] ? `${header[index]} (coluna ${index + 1})` : `Coluna ${index + 1}`,
  }));
  const headerOptions = file
    ? file.table.slice(0, HEADER_SEARCH_ROWS).map((cells, index) => ({
        value: index,
        label: `Linha ${file.lineNumbers[index]}: ${cells.join(" | ").slice(0, 60)}`,
      }))
    : [];

  function resetChoices() {
    setSelected({});
    setChosenCategory({});
    setImportedLines(new Set());
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";

    if (!picked) {
      return;
    }

    if (picked.size > MAX_IMPORT_FILE_BYTES) {
      notify("warning", "O arquivo deve ter no máximo 1 MB.");
      return;
    }

    setIsReading(true);

    try {
      const parsed = parseStatement(
        decodeStatementFile(await readFileAsArrayBuffer(picked)),
      );

      if (parsed.table.length === 0) {
        notify("warning", "O arquivo está vazio.");
        return;
      }

      const detected = detectColumns(parsed.table);

      if (!detected) {
        notify(
          "warning",
          "Não encontramos colunas de data e valor neste arquivo. Verifique se é o CSV do extrato ou da fatura.",
        );
        return;
      }

      setFile({ ...parsed, name: picked.name });
      setMapping(detected);
      setSign(detectExpenseSign(parsed.table, detected));
      resetChoices();
    } catch {
      notify("error", "Não foi possível ler o arquivo selecionado.");
    } finally {
      setIsReading(false);
    }
  }

  function updateMapping(patch: Partial<ColumnMapping>) {
    setMapping((current) => (current ? { ...current, ...patch } : current));
    resetChoices();
  }

  function updateAmount(amount: AmountColumns) {
    updateMapping({ amount });
  }

  function setAll(value: boolean) {
    setSelected(Object.fromEntries(readyRows.map((row) => [row.line, value])));
  }

  async function handleImport() {
    if (!file) {
      return;
    }

    if (selection.length === 0) {
      notify("warning", "Selecione ao menos um lançamento para importar.");
      return;
    }

    if (categories.isLoading || categories.error) {
      notify("warning", "Aguarde o carregamento das suas categorias para importar.");
      return;
    }

    setIsImporting(true);

    try {
      const imported = await importCostEntries(
        userId,
        selection.map((item) => toImportInput(item, { costType, fileName: file.name })),
      );
      const latest = selection.reduce((max, item) =>
        item.row.date > max.row.date ? item : max,
      ).row.date;

      notify(
        "success",
        `${plural(imported, "lançamento importado", "lançamentos importados")} com sucesso.`,
      );
      navigate(
        withCompetence(ROUTES.costs, {
          year: latest.getFullYear(),
          month: latest.getMonth() + 1,
        }),
      );
    } catch (error) {
      if (error instanceof ImportPartialError) {
        // Os lotes preservam a ordem: as primeiras `imported` linhas ja foram gravadas.
        const done = selection.slice(0, error.imported).map((item) => item.row.line);
        setImportedLines((current) => new Set([...current, ...done]));
        notify(
          "warning",
          `${error.imported} de ${selection.length} lançamentos foram importados. Os demais continuam selecionados para nova tentativa.`,
        );
        setReloadToken((token) => token + 1);
      } else {
        notify(
          "error",
          friendlyFirestoreErrorMessage(error, "Falha ao importar os lançamentos."),
        );
      }
    } finally {
      setIsImporting(false);
    }
  }

  if (!canImport) {
    return (
      <section className="space-y-6">
        <PageHeader eyebrow="Lançamentos" title="Importar extrato" />
        <Alert>
          <AlertDescription>
            Você não possui permissão para importar lançamentos.
          </AlertDescription>
        </Alert>
      </section>
    );
  }

  const amount = mapping?.amount;

  return (
    <section className="space-y-10" data-testid="import-page-screen">
      <PageHeader
        eyebrow="Lançamentos"
        title="Importar extrato"
        description="Envie o CSV do extrato da conta ou da fatura do cartão, revise as categorias e importe os gastos de uma vez. O arquivo é lido apenas no seu navegador."
      />

      <Card>
        <CardHeader>
          <CardTitle>Arquivo</CardTitle>
          <CardDescription>
            {file
              ? `${file.name} · ${plural(rows.length, "linha lida", "linhas lidas")}`
              : "Formato CSV (separado por ponto e vírgula, vírgula ou tabulação), até 1 MB."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            id="statement-file"
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            aria-label="Arquivo do extrato"
            onChange={(event) => void handleFileChange(event)}
          />
          <LoadingButton
            type="button"
            variant={file ? "outline" : "default"}
            isLoading={isReading}
            loadingText="Lendo arquivo..."
            icon={<FileUpIcon aria-hidden="true" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
          >
            {file ? "Trocar arquivo" : "Selecionar arquivo"}
          </LoadingButton>
          {truncated > 0 && (
            <p className="mt-3 text-sm text-muted-foreground" role="status">
              {`Somente as primeiras ${MAX_IMPORT_ROWS} linhas foram consideradas (${truncated} ignoradas). Divida o arquivo para importar o restante.`}
            </p>
          )}
        </CardContent>
      </Card>

      {file && mapping && amount && (
        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>
              Confira as colunas detectadas e o que representa um gasto no arquivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="header-row">Linha do cabeçalho</Label>
              <NativeSelect
                id="header-row"
                value={String(mapping.headerRow ?? NO_COLUMN)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  updateMapping({ headerRow: value === NO_COLUMN ? null : value });
                }}
                disabled={isImporting}
              >
                <NativeSelectOption value={NO_COLUMN}>Sem cabeçalho</NativeSelectOption>
                {headerOptions.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {(
              [
                ["date", "Coluna de data"],
                ["description", "Coluna de descrição"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`column-${key}`}>{label}</Label>
                <NativeSelect
                  id={`column-${key}`}
                  value={String(mapping[key])}
                  onChange={(event) => updateMapping({ [key]: Number(event.target.value) })}
                  disabled={isImporting}
                >
                  {columnOptions.map((option) => (
                    <NativeSelectOption key={option.value} value={option.value}>
                      {option.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            ))}
            <div className="space-y-2">
              <Label htmlFor="amount-format">Formato do valor</Label>
              <NativeSelect
                id="amount-format"
                value={amount.kind}
                onChange={(event) =>
                  updateAmount(
                    event.target.value === "split"
                      ? { kind: "split", debit: 0, credit: Math.min(1, columnCount - 1) }
                      : { kind: "single", column: 0, nature: null },
                  )
                }
                disabled={isImporting}
              >
                <NativeSelectOption value="single">Uma coluna de valor</NativeSelectOption>
                <NativeSelectOption value="split">
                  Colunas separadas de débito e crédito
                </NativeSelectOption>
              </NativeSelect>
            </div>
            {amount.kind === "single" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="column-amount">Coluna de valor</Label>
                  <NativeSelect
                    id="column-amount"
                    value={String(amount.column)}
                    onChange={(event) =>
                      updateAmount({ ...amount, column: Number(event.target.value) })
                    }
                    disabled={isImporting}
                  >
                    {columnOptions.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="column-nature">Coluna D/C (débito/crédito)</Label>
                  <NativeSelect
                    id="column-nature"
                    value={String(amount.nature ?? NO_COLUMN)}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      updateAmount({ ...amount, nature: value === NO_COLUMN ? null : value });
                    }}
                    disabled={isImporting}
                  >
                    <NativeSelectOption value={NO_COLUMN}>Nenhuma (usar o sinal)</NativeSelectOption>
                    {columnOptions.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                {amount.nature === null && (
                  <div className="space-y-2">
                    <Label htmlFor="expense-sign">Gastos no arquivo</Label>
                    <NativeSelect
                      id="expense-sign"
                      value={sign}
                      onChange={(event) => {
                        setSign(event.target.value as ExpenseSign);
                        resetChoices();
                      }}
                      disabled={isImporting}
                    >
                      {(Object.keys(SIGN_LABELS) as ExpenseSign[]).map((value) => (
                        <NativeSelectOption key={value} value={value}>
                          {SIGN_LABELS[value]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                )}
              </>
            ) : (
              (
                [
                  ["debit", "Coluna de débito"],
                  ["credit", "Coluna de crédito"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={`column-${key}`}>{label}</Label>
                  <NativeSelect
                    id={`column-${key}`}
                    value={String(amount[key])}
                    onChange={(event) =>
                      updateAmount({ ...amount, [key]: Number(event.target.value) })
                    }
                    disabled={isImporting}
                  >
                    {columnOptions.map((option) => (
                      <NativeSelectOption key={option.value} value={option.value}>
                        {option.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
              ))
            )}
            <div className="space-y-2">
              <Label htmlFor="import-cost-type">Frente</Label>
              <NativeSelect
                id="import-cost-type"
                value={costType}
                onChange={(event) => setCostType(event.target.value as CostType)}
                disabled={isImporting}
              >
                {(Object.keys(COST_TYPE_LABELS) as CostType[]).map((value) => (
                  <NativeSelectOption key={value} value={value}>
                    {COST_TYPE_LABELS[value]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {readyRows.length > 0 && !hasCredits && (
              <p className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3" role="note">
                Nenhum crédito foi identificado. Se o arquivo também traz entradas (salário,
                estornos), confira a coluna D/C, o formato do valor ou o sinal dos gastos.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {file && mapping && (
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Pré-visualização</CardTitle>
              <CardDescription aria-live="polite">
                {`${plural(selection.length, "selecionado", "selecionados")} · ${formatCurrencyBRL(selectedTotal)}`}
                {ignoredCount > 0 && ` · ${plural(ignoredCount, "linha ignorada", "linhas ignoradas")}`}
                {importedLines.size > 0 && ` · ${plural(importedLines.size, "já importada", "já importadas")}`}
                {isCheckingExisting && " · verificando duplicados..."}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAll(true)}
                disabled={isImporting || readyRows.length === 0}
              >
                Marcar todas
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAll(false)}
                disabled={isImporting || readyRows.length === 0}
              >
                Desmarcar todas
              </Button>
              <LoadingButton
                type="button"
                size="sm"
                isLoading={isImporting}
                loadingText="Importando..."
                icon={<UploadIcon aria-hidden="true" />}
                onClick={() => void handleImport()}
                disabled={selection.length === 0 || isCheckingExisting}
              >
                {`Importar ${plural(selection.length, "lançamento", "lançamentos")}`}
              </LoadingButton>
            </div>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="py-6 text-muted-foreground">
                Nenhuma linha de lançamento encontrada com essas colunas.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <span className="sr-only">Importar</span>
                    </TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <ImportRowItem
                      key={row.line}
                      row={row}
                      checked={isSelected(row)}
                      category={categoryOf(row)}
                      isDuplicate={duplicates.has(row.line)}
                      isImported={importedLines.has(row.line)}
                      disabled={isImporting}
                      categoryOptions={categoryOptions}
                      onToggle={handleToggle}
                      onCategory={handleCategory}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
