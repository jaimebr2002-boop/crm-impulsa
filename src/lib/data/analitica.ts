import { supabase } from "@/lib/supabase";
import type { Interaccion } from "@/lib/types";
import { traerTodo } from "./paginar";
import { estadoCanonico } from "@/lib/constants";

export type FiltroAnalitica = {
  desdeIso: string;
  hastaIso: string;
  /** Solo tiene efecto para usuarios admin: filtra por un comercial concreto. */
  usuarioId?: string;
};

export type EventoAnalitica = {
  id: string;
  lead_id: string;
  usuario_id: string | null;
  completada: boolean;
  created_at: string;
  fecha_hora: string;
};

// Resultados de llamada que consideramos "sin respuesta" — el resto de
// valores de RESULTADOS_LLAMADA se tratan como llamada contestada. No es un
// campo booleano explícito del esquema, es una interpretación del texto
// libre de `resultado`.
const RESULTADOS_SIN_RESPUESTA = new Set(["No contesta", "Buzón de voz", "Número erróneo"]);

export function llamadaContestada(i: Pick<Interaccion, "canal" | "resultado">): boolean {
  if (i.canal !== "llamada") return false;
  if (!i.resultado) return false;
  return !RESULTADOS_SIN_RESPUESTA.has(i.resultado);
}

/** Leads activos agrupados por estado (calculado en la base de datos: no se
 * descargan los leads). Un comercial solo cuenta los suyos por RLS. */
export type ResumenEstado = { estado: string; n: number; valor: number; sinValor: number };

export async function obtenerResumenPipeline(usuarioId?: string): Promise<ResumenEstado[]> {
  const { data, error } = await supabase.rpc("resumen_pipeline_leads", { p_usuario: usuarioId ?? null });
  if (error) throw new Error(error.message);
  const porEstado = new Map<string, ResumenEstado>();
  for (const f of (data ?? []) as { estado: string; n: number; valor: number | string; sin_valor: number }[]) {
    const estado = estadoCanonico(f.estado);
    const previo = porEstado.get(estado) ?? { estado, n: 0, valor: 0, sinValor: 0 };
    previo.n += Number(f.n);
    previo.valor += Number(f.valor) || 0;
    previo.sinValor += Number(f.sin_valor);
    porEstado.set(estado, previo);
  }
  return Array.from(porEstado.values());
}

/** Leads creados en un periodo, agrupados por día, estado, origen y responsable. */
export type GrupoLeads = { dia: string; estado: string; origen: string | null; asignado_a: string | null; n: number; valor: number; conValor: number };

export async function obtenerResumenLeadsPeriodo(filtro: FiltroAnalitica): Promise<GrupoLeads[]> {
  const { data, error } = await supabase.rpc("resumen_leads_periodo", {
    p_desde: filtro.desdeIso,
    p_hasta: filtro.hastaIso,
    p_usuario: filtro.usuarioId ?? null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { dia: string; estado: string; origen: string | null; asignado_a: string | null; n: number; valor: number | string; con_valor: number }[]).map((f) => ({
    dia: f.dia,
    estado: estadoCanonico(f.estado),
    origen: f.origen,
    asignado_a: f.asignado_a,
    n: Number(f.n),
    valor: Number(f.valor) || 0,
    conValor: Number(f.con_valor),
  }));
}

/** Suma de una magnitud sobre los grupos que cumplen el filtro. */
export function sumarGrupos<T extends { n: number }>(grupos: T[], campo: (g: T) => number = (g) => g.n, donde: (g: T) => boolean = () => true): number {
  return grupos.reduce((t, g) => (donde(g) ? t + campo(g) : t), 0);
}

export async function obtenerInteraccionesPeriodo(filtro: FiltroAnalitica): Promise<Interaccion[]> {
  return traerTodo<Interaccion>((desde, hasta) => {
    let query = supabase
      .from("interacciones")
      .select("*")
      .gte("fecha", filtro.desdeIso)
      .lte("fecha", filtro.hastaIso)
      .order("id")
      .range(desde, hasta);
    if (filtro.usuarioId) query = query.eq("usuario_id", filtro.usuarioId);
    return query;
  });
}

export async function obtenerEventosPeriodo(filtro: FiltroAnalitica): Promise<EventoAnalitica[]> {
  return traerTodo<EventoAnalitica>((desde, hasta) => {
    let query = supabase
      .from("eventos")
      .select("id, lead_id, usuario_id, completada, created_at, fecha_hora")
      .gte("created_at", filtro.desdeIso)
      .lte("created_at", filtro.hastaIso)
      .order("id")
      .range(desde, hasta);
    if (filtro.usuarioId) query = query.eq("usuario_id", filtro.usuarioId);
    return query;
  });
}

export function agruparPorDia<T>(filas: T[], obtenerFecha: (fila: T) => string, desde: Date, hasta: Date) {
  const porDia = new Map<string, number>();
  const cursor = new Date(desde);
  cursor.setHours(0, 0, 0, 0);
  const fin = new Date(hasta);
  while (cursor <= fin) {
    porDia.set(cursor.toISOString().slice(0, 10), 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const fila of filas) {
    const clave = obtenerFecha(fila).slice(0, 10);
    if (porDia.has(clave)) porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
  }
  return Array.from(porDia.entries()).map(([fecha, valor]) => ({ fecha, valor }));
}

export function contarPor<T>(filas: T[], obtenerClave: (fila: T) => string | null): Record<string, number> {
  const conteo: Record<string, number> = {};
  for (const fila of filas) {
    const clave = obtenerClave(fila);
    if (!clave) continue;
    conteo[clave] = (conteo[clave] ?? 0) + 1;
  }
  return conteo;
}

/** Igual que agruparPorDia, pero sobre grupos ya contados en la base de datos. */
export function serieDesdeGrupos(grupos: GrupoLeads[], desde: Date, hasta: Date) {
  const porDia = new Map<string, number>();
  const cursor = new Date(desde);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= hasta) {
    porDia.set(cursor.toISOString().slice(0, 10), 0);
    cursor.setDate(cursor.getDate() + 1);
  }
  for (const g of grupos) if (porDia.has(g.dia)) porDia.set(g.dia, (porDia.get(g.dia) ?? 0) + g.n);
  return Array.from(porDia.entries()).map(([fecha, valor]) => ({ fecha, valor }));
}
