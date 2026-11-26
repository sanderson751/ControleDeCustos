import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCompetenceLong } from "@/domain/rules/competence";
import type { MonthlyPoint } from "@/domain/rules/evolutionRules";
import { formatCurrencyBRL } from "@/lib/currency";

/** Visao em tabela: os mesmos dados do grafico, sem depender de hover ou cor. */
export function EvolutionTable({
  points,
  showBudget,
}: {
  points: readonly MonthlyPoint[];
  showBudget: boolean;
}) {
  return (
    <Table aria-label="Evolução mensal em tabela">
      <TableHeader>
        <TableRow>
          <TableHead>Mês</TableHead>
          <TableHead className="text-right">Gasto</TableHead>
          {showBudget && <TableHead className="text-right">Orçamento</TableHead>}
          {showBudget && <TableHead>Situação</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((point) => (
          <TableRow key={`${point.competence.year}-${point.competence.month}`}>
            <TableCell className="first-letter:uppercase">
              {formatCompetenceLong(point.competence)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatCurrencyBRL(point.spent)}
            </TableCell>
            {showBudget && (
              <TableCell className="text-right tabular-nums">
                {point.budget !== null ? formatCurrencyBRL(point.budget) : "—"}
              </TableCell>
            )}
            {showBudget && (
              <TableCell>
                {point.budget === null
                  ? "Sem orçamento"
                  : point.isOverBudget
                    ? "Acima do orçamento"
                    : "Dentro do orçamento"}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
