// Semántica de color de la interfaz. El verde de marca (#AAFF00) es acento de
// marca (botón principal, selección activa), NO significa "éxito".
//
//   neutro    → pendiente, sin empezar, borrador
//   info      → en curso, contactado (azul)
//   revision  → pendiente de revisión/aprobación (violeta)
//   atencion  → esperando, parcial, requiere acción (ámbar)
//   exito     → completado, ganado, cobrado, entregado (verde)
//   peligro   → vencido, error (rojo)
//   inactivo  → perdido, cancelado, archivado (gris tenue)

export type Tono = "neutro" | "info" | "revision" | "atencion" | "exito" | "peligro" | "inactivo";

/** Chip/insignia: borde + fondo tenue + texto, con variante oscura diseñada. */
export const TONO_CHIP: Record<Tono, string> = {
  neutro: "border-line bg-mute text-ink2",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  revision: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300",
  atencion: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  exito: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  peligro: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  inactivo: "border-line bg-canvas text-ink3",
};

/** Punto de estado (listas densas, columnas de Kanban). */
export const TONO_PUNTO: Record<Tono, string> = {
  neutro: "bg-ink3",
  info: "bg-blue-500",
  revision: "bg-violet-500",
  atencion: "bg-amber-500",
  exito: "bg-emerald-500",
  peligro: "bg-red-500",
  inactivo: "bg-line",
};

/** Texto de alerta (fechas vencidas, importes pendientes críticos). */
export const TONO_TEXTO: Record<Tono, string> = {
  neutro: "text-ink2",
  info: "text-blue-700 dark:text-blue-300",
  revision: "text-violet-700 dark:text-violet-300",
  atencion: "text-amber-700 dark:text-amber-400",
  exito: "text-emerald-700 dark:text-emerald-400",
  peligro: "text-red-600 dark:text-red-400",
  inactivo: "text-ink3",
};

// ---------- Glosario: estado guardado → tono ----------

export const TONO_LEAD: Record<string, Tono> = {
  pendiente: "neutro",
  contactado: "info",
  "no contesta": "atencion",
  respondido: "info",
  interesado: "info",
  reunión: "revision",
  cerrado: "exito", // se muestra "Ganado"
  descartado: "inactivo", // se muestra "Perdido"
};

export const TONO_PROYECTO: Record<string, Tono> = {
  pendiente: "neutro",
  preparado: "neutro",
  en_progreso: "info",
  esperando: "atencion",
  revision: "revision",
  entregado: "exito",
  cancelado: "inactivo",
};

export const TONO_TAREA: Record<string, Tono> = {
  pendiente: "neutro",
  en_progreso: "info",
  esperando: "atencion",
  completada: "exito",
};

export const TONO_COBRO: Record<string, Tono> = {
  borrador: "neutro",
  pendiente: "info",
  parcial: "atencion",
  cobrada: "exito",
  vencida: "peligro",
  cancelada: "inactivo",
};
