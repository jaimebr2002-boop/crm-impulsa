import type { EstadoProyecto, EstadoTarea, Prioridad } from "@/lib/types";
import {
  ESTADO_PROYECTO_LABEL,
  ESTADO_PROYECTO_PUNTO,
  ESTADO_TAREA_LABEL,
  ESTADO_TAREA_PUNTO,
  PRIORIDAD_LABEL,
} from "@/lib/trabajo";
import { diasHasta, formatYMDRelativa } from "@/lib/dates";

export function EstadoProyectoInsignia({ estado }: { estado: EstadoProyecto }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink2">
      <span className={`h-2 w-2 rounded-full ${ESTADO_PROYECTO_PUNTO[estado]}`} />
      {ESTADO_PROYECTO_LABEL[estado]}
    </span>
  );
}

export function EstadoTareaInsignia({ estado }: { estado: EstadoTarea }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-ink2">
      <span className={`h-2 w-2 rounded-full ${ESTADO_TAREA_PUNTO[estado]}`} />
      {ESTADO_TAREA_LABEL[estado]}
    </span>
  );
}

/** Barras de señal (estilo Linear). "Normal" y "baja" no muestran nada
 * para no añadir ruido a las listas. */
export function PrioridadIcono({ prioridad, conTexto = false }: { prioridad: Prioridad; conTexto?: boolean }) {
  if (prioridad === "urgente") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400" title="Urgente">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-red-500 text-[9px] font-bold text-white">!</span>
        {conTexto ? PRIORIDAD_LABEL[prioridad] : null}
      </span>
    );
  }
  if (prioridad === "alta") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400" title="Alta">
        <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 fill-current">
          <rect x="1" y="7" width="2.2" height="4" rx="0.6" />
          <rect x="4.9" y="4" width="2.2" height="7" rx="0.6" />
          <rect x="8.8" y="1" width="2.2" height="10" rx="0.6" />
        </svg>
        {conTexto ? PRIORIDAD_LABEL[prioridad] : null}
      </span>
    );
  }
  return conTexto ? <span className="text-xs text-ink3">{PRIORIDAD_LABEL[prioridad]}</span> : null;
}

/** Fecha límite o de entrega con color según urgencia. */
export function FechaLimite({ fecha, completada = false }: { fecha: string | null; completada?: boolean }) {
  if (!fecha) return null;
  const dias = diasHasta(fecha);
  const tono = completada
    ? "text-ink3"
    : dias < 0
      ? "text-red-600 dark:text-red-400"
      : dias <= 1
        ? "text-amber-700 dark:text-amber-400"
        : "text-ink2";
  return (
    <span className={`whitespace-nowrap text-xs font-medium ${tono}`} title={fecha}>
      {!completada && dias < 0 ? `Vencida · ${formatYMDRelativa(fecha)}` : formatYMDRelativa(fecha)}
    </span>
  );
}
