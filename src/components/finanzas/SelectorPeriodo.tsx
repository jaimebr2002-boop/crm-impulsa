"use client";

import { moverPeriodo, periodoQueContiene, type Periodo, type TipoPeriodo } from "@/lib/finanzas";
import { Segmentado } from "../ui/Cabecera";
import { IconChevron } from "../Icons";

export function SelectorPeriodo({ periodo, onChange }: { periodo: Periodo; onChange: (p: Periodo) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmentado
        opciones={[
          { id: "mes", label: "Mes" },
          { id: "trimestre", label: "Trimestre" },
          { id: "anio", label: "Año" },
        ]}
        valor={periodo.tipo}
        onChange={(t: TipoPeriodo) => onChange(periodoQueContiene(t))}
      />
      <div className="flex items-center">
        <button onClick={() => onChange(moverPeriodo(periodo, -1))} aria-label="Periodo anterior" className="rounded-lg p-1.5 text-ink2 hover:bg-mute">
          <IconChevron className="h-4 w-4 rotate-180" />
        </button>
        <span className="min-w-[8.5rem] text-center text-sm font-semibold text-ink">{periodo.etiqueta}</span>
        <button onClick={() => onChange(moverPeriodo(periodo, 1))} aria-label="Periodo siguiente" className="rounded-lg p-1.5 text-ink2 hover:bg-mute">
          <IconChevron className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** Barras horizontales proporcionales (categorías, cuentas…): etiqueta, barra e importe. */
export function BarrasImporte({
  filas,
  formato,
  vacio = "Sin datos en este periodo.",
}: {
  filas: { clave: string; etiqueta: string; importe: number; href?: string }[];
  formato: (n: number) => string;
  vacio?: string;
}) {
  if (filas.length === 0) return <p className="px-4 py-6 text-center text-sm text-ink3">{vacio}</p>;
  const max = Math.max(...filas.map((f) => f.importe), 0.01);
  return (
    <ul className="flex flex-col gap-2.5 px-4 py-3">
      {filas.map((f) => (
        <li key={f.clave} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-ink2" title={f.etiqueta}>
            {f.href ? (
              <a href={f.href} className="hover:text-ink hover:underline">
                {f.etiqueta}
              </a>
            ) : (
              f.etiqueta
            )}
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-mute">
            <span className="block h-full rounded-full bg-ink/70" style={{ width: `${Math.max((f.importe / max) * 100, 2)}%` }} />
          </span>
          <span className="text-right font-medium tabular-nums text-ink">{formato(f.importe)}</span>
        </li>
      ))}
    </ul>
  );
}
