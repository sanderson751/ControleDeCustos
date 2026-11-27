import {
  HistoryIcon,
  MinusIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { goalGuidance } from "@/components/goals/goalPresentation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  GOAL_STATUS_LABELS,
  type GoalStatus,
  type GoalSummary,
} from "@/domain/entities/savingsGoal";
import { formatCurrencyBRL } from "@/lib/currency";

const STATUS_VARIANT: Record<GoalStatus, "secondary" | "destructive" | "default"> = {
  "em-andamento": "secondary",
  concluida: "default",
  atrasada: "destructive",
};

type Props = {
  summary: GoalSummary;
  canEdit: boolean;
  disabled?: boolean;
  onDeposit: () => void;
  onWithdraw: () => void;
  onHistory: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function GoalCard({
  summary,
  canEdit,
  disabled,
  onDeposit,
  onWithdraw,
  onHistory,
  onEdit,
  onDelete,
}: Props) {
  const { goal, saved, remaining, percent, status } = summary;

  return (
    <Card data-testid={`goal-card-${goal.id}`} aria-label={`Meta ${goal.name}`} role="region">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <CardTitle className="text-xl">{goal.name}</CardTitle>
        <Badge variant={STATUS_VARIANT[status]}>{GOAL_STATUS_LABELS[status]}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <span className="text-2xl font-semibold text-foreground tabular-nums">
              {formatCurrencyBRL(saved)}
            </span>{" "}
            de {formatCurrencyBRL(goal.targetAmount)}
          </p>
          <Progress value={percent} aria-label={`${goal.name}: ${percent}% do alvo`} />
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            <span>{`${percent}%`}</span>
            <span>{remaining > 0 ? `Falta ${formatCurrencyBRL(remaining)}` : "Alvo atingido"}</span>
          </div>
        </div>
        <p className="text-sm">{goalGuidance(summary)}</p>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <Button size="sm" onClick={onDeposit} disabled={disabled}>
                <PlusIcon aria-hidden="true" />
                Depositar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onWithdraw}
                disabled={disabled || saved <= 0}
              >
                <MinusIcon aria-hidden="true" />
                Retirar
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onHistory} aria-label={`Histórico de ${goal.name}`}>
            <HistoryIcon aria-hidden="true" />
            Histórico
          </Button>
          {canEdit && (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onEdit}
                disabled={disabled}
                aria-label={`Editar ${goal.name}`}
              >
                <PencilIcon />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={onDelete}
                disabled={disabled}
                aria-label={`Excluir ${goal.name}`}
              >
                <Trash2Icon />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
