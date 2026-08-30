"use client";

import { useState } from "react";

export type BarraDato = { etiqueta: string; valor: number };

export function BarChart({ datos, formatoEtiqueta }: { datos: BarraDato[]; formatoEtiqueta?: (etiqueta: string) => string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(...datos.map((d) => d.valor), 1);

  if (datos.length === 0) {
    return <p className="py-8 text-center text-sm text-ink3">Sin datos en este periodo.</p>;
  }

  const mostrarEtiquetas = datos.length <= 14;

  return (
    <div>
      <div className="flex h-40 items-end gap-1">
        {datos.map((d, i) => {
          const alturaPct = Math.max((d.valor / max) * 100, d.valor > 0 ? 4 : 1);
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
            >
              {activo === i ? (
                <div className="glass-strong absolute -top-9 z-10 whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-medium text-ink shadow-glass">
                  {formatoEtiqueta ? formatoEtiqueta(d.etiqueta) : d.etiqueta}: {d.valor}
                </div>
              ) : null}
              <div
                className={`w-full rounded-t-md transition-all duration-300 ${
                  activo === i ? "bg-brand-dark" : "bg-brand/70"
                }`}
                style={{ height: `${alturaPct}%`, minHeight: "3px" }}
              />
            </div>
          );
        })}
      </div>
      {mostrarEtiquetas ? (
        <div className="mt-2 flex gap-1">
          {datos.map((d, i) => (
            <div key={i} className="flex-1 truncate text-center text-[10px] text-ink3">
              {formatoEtiqueta ? formatoEtiqueta(d.etiqueta) : d.etiqueta}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
