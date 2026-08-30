import { supabase } from "@/lib/supabase";
import type { Evento, EventoConLead, EventoInsert } from "@/lib/types";

const SELECT_CON_LEAD = "*, lead:leads(id, negocio, nombre_contacto, telefono), usuario:usuarios(id, nombre)";

export async function listarEventosPorLead(leadId: string): Promise<Evento[]> {
  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .eq("lead_id", leadId)
    .order("fecha_hora", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listarEventosPorRango(
  desdeIso: string,
  hastaIso: string,
  usuarioId?: string
): Promise<EventoConLead[]> {
  let query = supabase
    .from("eventos")
    .select(SELECT_CON_LEAD)
    .gte("fecha_hora", desdeIso)
    .lte("fecha_hora", hastaIso)
    .order("fecha_hora", { ascending: true });

  if (usuarioId) query = query.eq("usuario_id", usuarioId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventoConLead[];
}

/** Eventos vencidos: fecha pasada y aún no completados. */
export async function listarEventosVencidos(inicioHoyIso: string, usuarioId?: string): Promise<EventoConLead[]> {
  let query = supabase
    .from("eventos")
    .select(SELECT_CON_LEAD)
    .lt("fecha_hora", inicioHoyIso)
    .eq("completada", false)
    .order("fecha_hora", { ascending: true });

  if (usuarioId) query = query.eq("usuario_id", usuarioId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventoConLead[];
}

/** Eventos de hoy (pendientes o completados hoy). */
export async function listarEventosDeHoy(
  inicioHoyIso: string,
  finHoyIso: string,
  usuarioId?: string
): Promise<EventoConLead[]> {
  let query = supabase
    .from("eventos")
    .select(SELECT_CON_LEAD)
    .gte("fecha_hora", inicioHoyIso)
    .lte("fecha_hora", finHoyIso)
    .order("fecha_hora", { ascending: true });

  if (usuarioId) query = query.eq("usuario_id", usuarioId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EventoConLead[];
}

export async function crearEvento(payload: EventoInsert): Promise<Evento> {
  const { data, error } = await supabase.from("eventos").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function marcarEventoCompletado(id: string, completada: boolean): Promise<Evento> {
  const { data, error } = await supabase
    .from("eventos")
    .update({ completada })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
