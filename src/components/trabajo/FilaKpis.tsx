import Link from "next/link";
import type { ReactNode } from "react";

export type KpiDato = { etiqueta: string; valor: ReactNode; nota?: string; href?: string; alerta?: boolean };

/** Franja de KPIs compacta (celdas separadas por una línea, no tarjetas sueltas). */
export function FilaKpis({ kpis, columnas = "md:grid-cols-3 xl:grid-cols-6" }: { kpis: KpiDato[]; columnas?: string }) {
  return (
    <section className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line ${columnas}`}>
      {kpis.map((k) => {
        const contenido = (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wider text-ink3">{k.etiqueta}</p>
            <p className="mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight text-ink">{k.valor}</p>
            {k.nota ? (
              <p className={`mt-0.5 truncate text-xs ${k.alerta ? "font-medium text-red-600 dark:text-red-400" : "text-ink3"}`}>{k.nota}</p>
            ) : null}
          </>
        );
        return k.href ? (
          <Link key={k.etiqueta} href={k.href} className="block bg-surface p-4 transition-colors hover:bg-mute/40">
            {contenido}
          </Link>
        ) : (
          <div key={k.etiqueta} className="bg-surface p-4">
            {contenido}
          </div>
        );
      })}
    </section>
  );
}
