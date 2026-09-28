"use client";

import { useState } from "react";
import { eur, eurCorto, type PuntoMensual } from "@/lib/finanzas";

const SERIES = [
  { clave: "facturado", label: "Facturado", barra: "fill-ink/25", punto: "bg-ink/25" },
  { clave: "cobrado", label: "Cobrado", barra: "fill-brand-dark dark:fill-brand", punto: "bg-brand-dark dark:bg-brand" },
  { clave: "gastos", label: "Gastos", barra: "fill-amber-500/80", punto: "bg-amber-500/80" },
] as const;

/**
 * Barras agrupadas por mes (facturado · cobrado · gastos). SVG propio: tres
 * series y doce puntos no justifican una librería de gráficos.
 */
export function GraficoMensual({ puntos }: { puntos: PuntoMensual[] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(...puntos.flatMap((p) => [p.facturado, p.cobrado, p.gastos]), 1);
  // Escala "redonda" para que las líneas guía caigan en cifras legibles.
  const paso = escalon(max / 3);
  const tope = paso * Math.ceil(max / paso);
  const ancho = 100 / puntos.length;
  const alto = 160;
  const sel = activo != null ? puntos[activo] : null;

  return (
    <div className="px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink2">
        {SERIES.map((s) => (
          <span key={s.clave} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-sm ${s.punto}`} />
            {s.label}
            {sel ? <span className="font-medium tabular-nums text-ink">{eur(sel[s.clave])}</span> : null}
          </span>
        ))}
        {sel ? <span className="ml-auto capitalize text-ink3">{sel.etiqueta} {sel.mes.slice(0, 4)}</span> : null}
      </div>
      <div className="relative mt-5" style={{ height: alto }}>
        {[0, 1, 2, 3].map((i) => {
          const v = (tope / 3) * i;
          if (v > tope) return null;
          return (
            <div key={i} className="absolute inset-x-0 flex items-center" style={{ bottom: `${(v / tope) * 100}%` }}>
              <span className="w-10 shrink-0 -translate-y-1/2 pr-2 text-right text-[10px] tabular-nums text-ink3">{eurCorto(v)}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          );
        })}
        <svg className="absolute inset-y-0 left-10 right-0 h-full w-[calc(100%-2.5rem)] overflow-visible" viewBox={`0 0 100 ${alto}`} preserveAspectRatio="none" role="img" aria-label="Facturado, cobrado y gastos por mes">
          {puntos.map((p, i) => {
            const x0 = i * ancho;
            const hueco = ancho * 0.2;
            const barra = (ancho - hueco * 2) / 3;
            return (
              <g key={p.mes} onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)} onClick={() => setActivo(i)}>
                <rect x={x0} y={0} width={ancho} height={alto} className={activo === i ? "fill-mute" : "fill-transparent"} />
                {SERIES.map((s, j) => {
                  const h = (p[s.clave] / tope) * alto;
                  return <rect key={s.clave} x={x0 + hueco + j * barra} y={alto - h} width={barra * 0.9} height={h} className={s.barra} rx={0.4} />;
                })}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="ml-10 mt-1.5 flex">
        {puntos.map((p, i) => (
          <span key={p.mes} className={`flex-1 text-center text-[10px] capitalize ${activo === i ? "font-medium text-ink" : "text-ink3"}`}>
            {p.etiqueta}
          </span>
        ))}
      </div>
    </div>
  );
}

function escalon(n: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(n, 1)));
  const f = n / mag;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
}
