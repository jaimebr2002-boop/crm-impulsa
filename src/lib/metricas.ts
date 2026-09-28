import { diasHasta } from "./dates";
import { ESTADOS_PROYECTO_ACTIVOS } from "./trabajo";
import type { Proyecto } from "./types";

// Métricas derivadas SOLO de proyectos. Hasta la Fase 3 (Finanzas) no hay
// facturas ni cobros: por eso se habla de "valor de proyectos", nunca de
// "facturado" o "cobrado".

export type ResumenProyectos = {
  activos: number;
  entregados: number;
  total: number;
  /** Suma de importes de proyectos no cancelados. */
  valorProyectos: number;
  /** Suma de importes de proyectos activos (aún no entregados). */
  valorEnCurso: number;
  /** Último cambio en cualquiera de los proyectos (ISO) o null. */
  ultimoMovimiento: string | null;
};

type ProyectoMin = Pick<Proyecto, "estado" | "importe" | "updated_at">;

export function resumirProyectos(proyectos: ProyectoMin[]): ResumenProyectos {
  const r: ResumenProyectos = {
    activos: 0,
    entregados: 0,
    total: proyectos.length,
    valorProyectos: 0,
    valorEnCurso: 0,
    ultimoMovimiento: null,
  };
  for (const p of proyectos) {
    const importe = Number(p.importe) || 0;
    const activo = ESTADOS_PROYECTO_ACTIVOS.has(p.estado);
    if (activo) {
      r.activos++;
      r.valorEnCurso += importe;
    }
    if (p.estado === "entregado") r.entregados++;
    if (p.estado !== "cancelado") r.valorProyectos += importe;
    if (!r.ultimoMovimiento || p.updated_at > r.ultimoMovimiento) r.ultimoMovimiento = p.updated_at;
  }
  return r;
}

export type MotivoAtencion = { etiqueta: string; tono: "rojo" | "ambar" | "gris"; orden: number };

/** Por qué un proyecto activo necesita que lo mires, o null si va bien. */
export function motivoAtencion(p: Pick<Proyecto, "estado" | "fecha_entrega" | "prioridad">): MotivoAtencion | null {
  if (!ESTADOS_PROYECTO_ACTIVOS.has(p.estado)) return null;
  if (p.fecha_entrega) {
    const d = diasHasta(p.fecha_entrega);
    if (d < 0) return { etiqueta: `Vencido hace ${-d} d`, tono: "rojo", orden: 0 };
    if (d === 0) return { etiqueta: "Entrega hoy", tono: "rojo", orden: 1 };
    if (d <= 3) return { etiqueta: d === 1 ? "Entrega mañana" : `Entrega en ${d} d`, tono: "ambar", orden: 2 };
  }
  if (p.estado === "esperando") return { etiqueta: "Esperando", tono: "ambar", orden: 3 };
  if (p.estado === "revision") return { etiqueta: "En revisión", tono: "gris", orden: 4 };
  if (p.prioridad === "urgente") return { etiqueta: "Urgente", tono: "rojo", orden: 2 };
  return null;
}

export const TONO_ATENCION: Record<MotivoAtencion["tono"], string> = {
  rojo: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  ambar: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  gris: "border-line bg-mute text-ink2",
};
