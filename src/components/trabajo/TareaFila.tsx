"use client";

import Link from "next/link";
import type { TareaConRelaciones } from "@/lib/types";
import { FechaLimite, PrioridadIcono } from "./Insignias";

/** Casilla redonda de completar (estilo Things/Linear). */
export function CasillaTarea({ completada, onToggle, etiqueta }: { completada: boolean; onToggle: () => void; etiqueta: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      role="checkbox"
      aria-checked={completada}
      aria-label={completada ? `Reabrir «${etiqueta}»` : `Completar «${etiqueta}»`}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
        completada ? "border-emerald-500 bg-emerald-500 text-white" : "border-ink3 hover:border-brand-dark hover:bg-brand/20"
      }`}
    >
      {completada ? (
        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-current" strokeWidth={2}>
          <path d="m2.5 6.2 2.3 2.3 4.7-4.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </button>
  );
}

export function TareaFila({
  tarea,
  onToggle,
  onAbrir,
  mostrarProyecto = true,
}: {
  tarea: TareaConRelaciones;
  onToggle: (t: TareaConRelaciones) => void;
  onAbrir?: (t: TareaConRelaciones) => void;
  mostrarProyecto?: boolean;
}) {
  const completada = tarea.estado === "completada";
  return (
    <div
      className={`group flex items-start gap-3 px-3 py-2.5 ${onAbrir ? "cursor-pointer hover:bg-mute/50" : ""}`}
      onClick={() => onAbrir?.(tarea)}
    >
      <span className="pt-0.5">
        <CasillaTarea completada={completada} onToggle={() => onToggle(tarea)} etiqueta={tarea.titulo} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm leading-snug ${completada ? "text-ink3 line-through" : "text-ink"}`}>{tarea.titulo}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
          {tarea.estado === "en_progreso" ? <span className="text-xs font-medium text-blue-600 dark:text-blue-400">En progreso</span> : null}
          {tarea.estado === "esperando" ? <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Esperando</span> : null}
          {mostrarProyecto && tarea.proyecto ? (
            <Link
              href={`/proyectos/${tarea.proyecto.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-xs text-ink3 hover:text-ink hover:underline"
            >
              {tarea.proyecto.nombre}
            </Link>
          ) : null}
          {tarea.lead ? (
            <Link
              href={`/leads/${tarea.lead.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-xs text-ink3 hover:text-ink hover:underline"
            >
              Lead · {tarea.lead.negocio || tarea.lead.nombre_contacto}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <PrioridadIcono prioridad={tarea.prioridad} />
        <FechaLimite fecha={tarea.fecha_limite} completada={completada} />
      </div>
    </div>
  );
}
