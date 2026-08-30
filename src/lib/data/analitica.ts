import { supabase } from "@/lib/supabase";
import type { Interaccion, Lead } from "@/lib/types";

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

export async function obtenerLeadsPeriodo(filtro: FiltroAnalitica): Promise<Lead[]> {
  let query = supabase
    .from("leads")
    .select("*")
    .gte("created_at", filtro.desdeIso)
    .lte("created_at", filtro.hastaIso);
  if (filtro.usuarioId) query = query.eq("asignado_a", filtro.usuarioId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Snapshot actual del pipeline: todos los leads visibles (RLS ya limita a
 * un comercial a los suyos), sin filtrar por fecha de creación — un funnel
 * representa dónde está todo el mundo ahora, no quién entró en el periodo. */
export async function obtenerLeadsActuales(usuarioId?: string): Promise<Lead[]> {
  let query = supabase.from("leads").select("*");
  if (usuarioId) query = query.eq("asignado_a", usuarioId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function obtenerInteraccionesPeriodo(filtro: FiltroAnalitica): Promise<Interaccion[]> {
  let query = supabase
    .from("interacciones")
    .select("*")
    .gte("fecha", filtro.desdeIso)
    .lte("fecha", filtro.hastaIso);
  if (filtro.usuarioId) query = query.eq("usuario_id", filtro.usuarioId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function obtenerEventosPeriodo(filtro: FiltroAnalitica): Promise<EventoAnalitica[]> {
  let query = supabase
    .from("eventos")
    .select("id, lead_id, usuario_id, completada, created_at, fecha_hora")
    .gte("created_at", filtro.desdeIso)
    .lte("created_at", filtro.hastaIso);
  if (filtro.usuarioId) query = query.eq("usuario_id", filtro.usuarioId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
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
