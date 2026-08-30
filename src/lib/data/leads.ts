import { supabase } from "@/lib/supabase";
import type { Lead, LeadInsert, LeadUpdate } from "@/lib/types";

export type FiltrosLeads = {
  busqueda?: string;
  estado?: string;
  origen?: string;
  segmento?: string;
  canal?: string;
  asignadoA?: string; // "todos" | usuarioId
};

export async function listarLeads(filtros: FiltrosLeads = {}): Promise<Lead[]> {
  let query = supabase.from("leads").select("*").order("updated_at", { ascending: false });

  if (filtros.estado) query = query.eq("estado", filtros.estado);
  if (filtros.origen) query = query.eq("origen", filtros.origen);
  if (filtros.segmento) query = query.eq("segmento", filtros.segmento);
  if (filtros.canal) query = query.eq("canal", filtros.canal);
  if (filtros.asignadoA && filtros.asignadoA !== "todos") query = query.eq("asignado_a", filtros.asignadoA);

  if (filtros.busqueda && filtros.busqueda.trim()) {
    const termino = filtros.busqueda.trim();
    query = query.or(
      `negocio.ilike.%${termino}%,nombre_contacto.ilike.%${termino}%,telefono.ilike.%${termino}%`
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function obtenerLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function crearLead(payload: LeadInsert): Promise<Lead> {
  const { data, error } = await supabase.from("leads").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function actualizarLead(id: string, payload: LeadUpdate): Promise<Lead> {
  const { data, error } = await supabase.from("leads").update(payload).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
