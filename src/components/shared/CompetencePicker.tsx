import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Competence } from "@/domain/entities/cost";
import {
  formatCompetenceLong,
  getCurrentCompetence,
  isFirstCompetence,
  isLastCompetence,
  shiftCompetence,
} from "@/domain/rules/competence";

type CompetencePickerProps = {
  competence: Competence;
  isCurrent: boolean;
  onChange: (competence: Competence) => void;
};

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Navegacao entre meses de competencia (anterior / proximo / mes atual). */
export function CompetencePicker({
  competence,
  isCurrent,
  onChange,
}: CompetencePickerProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Competência"
    >
      <IconButton
        label="Mês anterior"
        disabled={isFirstCompetence(competence)}
        onClick={() => onChange(shiftCompetence(competence, -1))}
      >
        <ChevronLeftIcon />
      </IconButton>
      <p
        className="min-w-44 text-center text-sm font-medium first-letter:uppercase"
        aria-live="polite"
        data-testid="competence-label"
      >
        {formatCompetenceLong(competence)}
      </p>
      <IconButton
        label="Próximo mês"
        disabled={isLastCompetence(competence)}
        onClick={() => onChange(shiftCompetence(competence, 1))}
      >
        <ChevronRightIcon />
      </IconButton>
      {!isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(getCurrentCompetence())}
        >
          Mês atual
        </Button>
      )}
    </div>
  );
}
