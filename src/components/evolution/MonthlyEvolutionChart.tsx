import { TriangleAlertIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import {
  describePoint,
  formatAxisValue,
  formatMonthTick,
} from "@/components/evolution/evolutionFormat";
import { formatCompetenceLong } from "@/domain/rules/competence";
import {
  buildAxisTicks,
  type MonthlyPoint,
} from "@/domain/rules/evolutionRules";
import { formatCurrencyBRL } from "@/lib/currency";
import { cn } from "@/lib/utils";

const PLOT_HEIGHT = 240;
const MARGIN = { top: 28, right: 16, bottom: 40, left: 76 };
const MAX_BAR_WIDTH = 24;
const BAR_RADIUS = 4;
const DEFAULT_WIDTH = 640;
const MIN_TICK_BAND = 28;
const MIN_LAST_LABEL_BAND = 76;
const TOOLTIP_HALF_WIDTH = 104;

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const update = () => {
      if (element.clientWidth > 0) {
        setWidth(element.clientWidth);
      }
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/** Coluna com topo arredondado (4px) e base reta, crescendo da linha de base. */
function columnPath(x: number, top: number, width: number, baseline: number) {
  const height = baseline - top;
  const radius = Math.min(BAR_RADIUS, height, width / 2);

  return [
    `M ${x} ${baseline}`,
    `L ${x} ${top + radius}`,
    `Q ${x} ${top} ${x + radius} ${top}`,
    `L ${x + width - radius} ${top}`,
    `Q ${x + width} ${top} ${x + width} ${top + radius}`,
    `L ${x + width} ${baseline}`,
    "Z",
  ].join(" ");
}

type MonthlyEvolutionChartProps = {
  points: readonly MonthlyPoint[];
  showBudget: boolean;
  /** Recarregando: mantem o quadro anterior com opacidade reduzida. */
  isRefreshing?: boolean;
};

/**
 * Gasto mensal (colunas) x orcamento efetivo (linha) em um unico eixo (R$).
 * Hover/foco por coluna com tooltip; rotulo direto apenas no ultimo mes.
 */
export function MonthlyEvolutionChart({
  points,
  showBudget,
  isRefreshing = false,
}: MonthlyEvolutionChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  // Hover e foco independentes: sair do mouse nao fecha o tooltip do foco.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const activeIndex = hoverIndex ?? focusIndex;

  const plotWidth = Math.max(width - MARGIN.left - MARGIN.right, 120);
  const svgWidth = MARGIN.left + plotWidth + MARGIN.right;
  const height = PLOT_HEIGHT + MARGIN.top + MARGIN.bottom;
  const baseline = MARGIN.top + PLOT_HEIGHT;
  const maxValue = Math.max(
    0,
    ...points.map((point) =>
      Math.max(point.spent, showBudget ? (point.budget ?? 0) : 0),
    ),
  );
  const ticks = buildAxisTicks(maxValue);
  const axisMax = ticks.at(-1) ?? 1;
  const tickStep = ticks.length > 1 ? ticks[1] - ticks[0] : 1;
  const band = plotWidth / Math.max(points.length, 1);
  const barWidth = Math.min(MAX_BAR_WIDTH, band * 0.6);
  const xCenter = (index: number) => MARGIN.left + band * (index + 0.5);
  const yOf = (value: number) => baseline - (value / axisMax) * PLOT_HEIGHT;
  // Faixas estreitas: rotulos de mes alternados (sempre o primeiro, janeiro e o ultimo).
  const labelEvery = band < MIN_TICK_BAND ? 2 : 1;
  // Rotulo direto do ultimo mes so quando cabe na propria faixa (sem invadir a anterior).
  const showLastLabel = band >= MIN_LAST_LABEL_BAND;

  // Segmentos da linha de orcamento (interrompidos em meses sem orcamento).
  const budgetSegments: string[] = [];
  if (showBudget) {
    let current: string[] = [];
    points.forEach((point, index) => {
      if (point.budget === null) {
        if (current.length) budgetSegments.push(current.join(" "));
        current = [];
        return;
      }
      current.push(
        `${current.length ? "L" : "M"} ${xCenter(index)} ${yOf(point.budget)}`,
      );
    });
    if (current.length) budgetSegments.push(current.join(" "));
  }

  const lastIndex = points.length - 1;
  const last = points[lastIndex];
  const active = activeIndex !== null ? points[activeIndex] : null;
  const tooltipLeft =
    activeIndex !== null
      ? Math.min(
          Math.max(xCenter(activeIndex), Math.min(TOOLTIP_HALF_WIDTH, svgWidth / 2)),
          Math.max(svgWidth - TOOLTIP_HALF_WIDTH, svgWidth / 2),
        )
      : 0;

  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full overflow-x-auto transition-opacity duration-200",
        isRefreshing && "opacity-60",
      )}
    >
      <svg
        width={svgWidth}
        height={height}
        role="group"
        aria-label="Gasto mensal e orçamento por mês"
        className="block overflow-visible"
      >
        {/* Grade e eixo Y: linhas finas, solidas e recessivas */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={yOf(tick)}
              y2={yOf(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={yOf(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px] tabular-nums"
            >
              {formatAxisValue(tick, axisMax, tickStep)}
            </text>
          </g>
        ))}

        {/* Destaque da coluna ativa */}
        {activeIndex !== null && (
          <rect
            x={MARGIN.left + band * activeIndex}
            y={MARGIN.top}
            width={band}
            height={PLOT_HEIGHT}
            className="fill-muted"
            opacity={0.5}
          />
        )}

        {/* Colunas de gasto (ate 24px, topo arredondado, base reta) */}
        {points.map((point, index) =>
          point.spent > 0 ? (
            <path
              key={`bar-${index}`}
              d={columnPath(
                xCenter(index) - barWidth / 2,
                yOf(point.spent),
                barWidth,
                baseline,
              )}
              className="fill-chart-spent"
              data-testid="evolution-bar"
            />
          ) : null,
        )}

        {/* Linha de orcamento (2px) com marcadores r=4 e anel de 2px na cor da superficie */}
        {budgetSegments.map((segment) => (
          <path
            key={segment}
            d={segment}
            fill="none"
            className="stroke-chart-budget"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {showBudget &&
          points.map((point, index) =>
            point.budget !== null ? (
              <circle
                key={`dot-${index}`}
                cx={xCenter(index)}
                cy={yOf(point.budget)}
                r={4}
                className="fill-chart-budget stroke-card"
                strokeWidth={2}
              />
            ) : null,
          )}

        {/* Linha de base e rotulos do eixo X */}
        <line
          x1={MARGIN.left}
          x2={MARGIN.left + plotWidth}
          y1={baseline}
          y2={baseline}
          className="stroke-border"
          strokeWidth={1}
        />
        {points.map((point, index) => {
          const showYear = index === 0 || point.competence.month === 1;
          const showTick =
            labelEvery === 1 ||
            showYear ||
            index === lastIndex ||
            (index % labelEvery === 0 && index !== lastIndex - 1);
          if (!showTick) {
            return null;
          }
          return (
            <text
              key={`tick-${index}`}
              x={xCenter(index)}
              y={baseline + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {formatMonthTick(point)}
              {showYear && (
                <tspan x={xCenter(index)} dy={14}>
                  {point.competence.year}
                </tspan>
              )}
            </text>
          );
        })}

        {/* Rotulo direto seletivo: somente o ultimo mes */}
        {last && last.spent > 0 && showLastLabel && (
          <text
            x={xCenter(lastIndex)}
            y={
              yOf(
                Math.max(last.spent, showBudget ? (last.budget ?? 0) : 0),
              ) - 12
            }
            textAnchor="middle"
            className="fill-foreground text-[12px] font-medium tabular-nums"
            data-testid="evolution-last-label"
          >
            {formatCurrencyBRL(last.spent)}
          </text>
        )}

        {/* Alvos de hover/foco: a faixa inteira do mes (maior que a marca) */}
        {points.map((point, index) => (
          <rect
            key={`hit-${index}`}
            x={MARGIN.left + band * index}
            y={MARGIN.top}
            width={band}
            height={PLOT_HEIGHT}
            fill="transparent"
            role="img"
            tabIndex={0}
            aria-label={describePoint(point)}
            className="cursor-default outline-none focus-visible:stroke-ring"
            strokeWidth={2}
            onMouseEnter={() => setHoverIndex(index)}
            onMouseLeave={() => setHoverIndex(null)}
            onFocus={() => setFocusIndex(index)}
            onBlur={() => setFocusIndex(null)}
          />
        ))}
      </svg>

      {active && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 w-52 -translate-x-1/2 rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
          style={{ left: tooltipLeft }}
        >
          <p className="mb-2 text-xs text-muted-foreground first-letter:uppercase">
            {formatCompetenceLong(active.competence)}
          </p>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-chart-spent" aria-hidden="true" />
            <span className="font-semibold tabular-nums">
              {formatCurrencyBRL(active.spent)}
            </span>
            <span className="text-xs text-muted-foreground">gasto</span>
          </div>
          {showBudget && active.budget !== null && (
            <>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-0.5 w-2.5 rounded bg-chart-budget" aria-hidden="true" />
                <span className="font-semibold tabular-nums">
                  {formatCurrencyBRL(active.budget)}
                </span>
                <span className="text-xs text-muted-foreground">orçamento</span>
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs">
                {active.isOverBudget ? (
                  <>
                    <TriangleAlertIcon className="size-3.5" aria-hidden="true" />
                    Acima do orçamento em{" "}
                    {formatCurrencyBRL(active.spent - active.budget)}
                  </>
                ) : (
                  <>Restam {formatCurrencyBRL(active.budget - active.spent)}</>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
