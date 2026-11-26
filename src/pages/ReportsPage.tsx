import {
  ChevronDownIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FilterIcon,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CostTotalsGrid } from "@/components/costs/CostTotalsGrid";
import { CostTypeBadge } from "@/components/costs/CostTypeBadge";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { SegmentedControl } from "@/components/shared/SegmentedControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
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
import {
  type CategoryFilter,
  COST_CATEGORIES,
  COST_CATEGORY_LABELS,
  type CostEntry,
  type CostFilter,
} from "@/domain/entities/cost";
import { calculateTotals } from "@/domain/rules/costRules";
import { formatCurrencyBRL } from "@/lib/currency";
import {
  formatCompetence,
  formatDateBR,
  getCurrentMonthRange,
  parseDateRange,
} from "@/lib/dates";
import { friendlyFirestoreErrorMessage } from "@/lib/errors";
import { notify } from "@/lib/notify";
import { exportCsv, exportPdf } from "@/lib/reportExport";
import { useSession } from "@/providers/AuthProvider";
import {
  listCostsForReport,
  type ReportsFilter,
} from "@/services/reportService";

const FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "fixo", label: "Fixo" },
  { value: "variavel", label: "Variável" },
] as const;

type ExportType = "csv" | "pdf";

export default function ReportsPage() {
  const { profile } = useSession();
  const userId = profile.userId;
  const defaultRange = useMemo(() => getCurrentMonthRange(), []);
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [costType, setCostType] = useState<CostFilter>("todos");
  const [category, setCategory] = useState<CategoryFilter>("todas");
  const [appliedFilter, setAppliedFilter] = useState<ReportsFilter>({
    ...defaultRange,
    costType: "todos",
  });
  const [entries, setEntries] = useState<CostEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exportingType, setExportingType] = useState<ExportType | null>(null);

  const totals = useMemo(() => calculateTotals(entries), [entries]);

  const loadReport = useCallback(
    async (filter: ReportsFilter) => {
      setIsLoading(true);

      try {
        setEntries(await listCostsForReport(userId, filter));
        setAppliedFilter(filter);
      } catch (loadError) {
        notify(
          "error",
          friendlyFirestoreErrorMessage(
            loadError,
            "Não foi possível carregar o relatório com os filtros selecionados.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadReport({ ...defaultRange, costType: "todos" });
  }, [defaultRange, loadReport]);

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!startDate || !endDate) {
      notify(
        "warning",
        "Informe o período inicial e final para filtrar o relatório.",
      );
      return;
    }

    if (!parseDateRange(startDate, endDate)) {
      notify("warning", "A data inicial não pode ser maior que a data final.");
      return;
    }

    await loadReport({ startDate, endDate, costType, category });
  }

  async function handleExport(type: ExportType) {
    if (entries.length === 0) {
      notify(
        "warning",
        `Não há lançamentos para exportar no formato ${type.toUpperCase()}.`,
      );
      return;
    }

    setExportingType(type);

    try {
      if (type === "csv") {
        exportCsv(entries, appliedFilter.startDate, appliedFilter.endDate);
      } else {
        await exportPdf(entries, appliedFilter.startDate, appliedFilter.endDate);
      }
      notify(
        "success",
        `Relatório exportado em ${type.toUpperCase()} com sucesso.`,
      );
    } catch {
      notify(
        "error",
        `Falha ao exportar ${type.toUpperCase()}. Tente novamente.`,
      );
    } finally {
      setExportingType(null);
    }
  }

  return (
    <section className="space-y-10" data-testid="reports-page-screen">
      <PageHeader
        eyebrow="Análise"
        title="Relatórios de lançamentos"
        description="Filtre por período de criação e frente, e exporte em CSV ou PDF."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <LoadingButton
                variant="outline"
                isLoading={exportingType !== null}
                loadingText="Exportando..."
                disabled={isLoading}
              >
                Exportar
                <ChevronDownIcon aria-hidden="true" />
              </LoadingButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void handleExport("csv")}>
                <FileSpreadsheetIcon aria-hidden="true" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void handleExport("pdf")}>
                <FileTextIcon aria-hidden="true" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilterIcon className="size-5" aria-hidden="true" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleFilterSubmit}
            className="grid gap-5 md:grid-cols-2 md:items-end xl:grid-cols-[1fr_1fr_auto_12rem_auto]"
            aria-label="Filtros do relatório"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="report-start-date">Data inicial</Label>
              <Input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-end-date">Data final</Label>
              <Input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm leading-none font-medium">Frente</p>
              <SegmentedControl
                ariaLabel="Frente do relatório"
                value={costType}
                options={FILTER_OPTIONS}
                onChange={setCostType}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-category">Categoria</Label>
              <NativeSelect
                id="report-category"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as CategoryFilter)
                }
              >
                <NativeSelectOption value="todas">Todas</NativeSelectOption>
                {COST_CATEGORIES.map((option) => (
                  <NativeSelectOption key={option} value={option}>
                    {COST_CATEGORY_LABELS[option]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Filtrando..."
              disabled={exportingType !== null}
            >
              Aplicar filtros
            </LoadingButton>
          </form>
        </CardContent>
      </Card>

      <CostTotalsGrid
        totals={totals}
        isLoading={isLoading}
        labels={{
          total: "Total geral",
          fixedTotal: "Total fixo",
          variableTotal: "Total variável",
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>Lançamentos</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-muted-foreground" aria-live="polite">
              Carregando relatório...
            </p>
          ) : entries.length === 0 ? (
            <p className="py-6 text-muted-foreground">
              Nenhum lançamento encontrado para os filtros selecionados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Frente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Competência</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {entry.accountName}
                    </TableCell>
                    <TableCell>{COST_CATEGORY_LABELS[entry.category]}</TableCell>
                    <TableCell>
                      <CostTypeBadge costType={entry.costType} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrencyBRL(entry.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateBR(entry.createdAt)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCompetence(
                        entry.competenceMonth,
                        entry.competenceYear,
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {entry.installmentsTotal}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
