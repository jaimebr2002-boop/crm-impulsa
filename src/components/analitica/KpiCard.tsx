import type { ReactNode } from "react";
import { IconTrendDown, IconTrendUp } from "@/components/Icons";
import { Sparkline } from "./Sparkline";

export function KpiCard({
  etiqueta,
  valor,
  variacion,
  serie,
  icono: Icono,
  nota,
}: {
  etiqueta: string;
  valor: string | number;
  /** Variación porcentual frente al periodo anterior. Omitir si no hay periodo anterior con el que comparar. */
  variacion?: number | null;
  /** Serie temporal para el sparkline (opcional). */
  serie?: number[];
  icono: (props: { className?: string }) => ReactNode;
  nota?: string;
}) {
  const tieneVariacion = variacion !== undefined && variacion !== null && Number.isFinite(variacion);
  const esPositiva = tieneVariacion && (variacion as number) >= 0;

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4 shadow-glass dark:shadow-glass-dark">
      <div className="flex items-start justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-light text-brand-dark">
          <Icono className="h-4 w-4" />
        </span>
        {tieneVariacion ? (
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              esPositiva
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
            }`}
          >
            {esPositiva ? <IconTrendUp className="h-3 w-3" /> : <IconTrendDown className="h-3 w-3" />}
            {Math.abs(variacion as number).toFixed(0)}%
          </span>
        ) : null}
      </div>

      <p className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">{valor}</p>
      <p className="mt-0.5 text-xs text-ink2">{etiqueta}</p>
      {nota ? <p className="mt-0.5 text-[10px] text-ink3">{nota}</p> : null}

      {serie && serie.length > 1 ? (
        <div className="mt-2 h-8 text-brand">
          <Sparkline valores={serie} className="h-full w-full" />
        </div>
      ) : null}
    </div>
  );
}
