import { supabase } from "@/lib/supabase";
import type { Lead, LeadInsert, LeadUpdate } from "@/lib/types";
import { terminoBusquedaSeguro, traerTodo } from "./paginar";
import { conEstadoCanonico } from "@/lib/constants";

export type FiltrosLeads = {
  busqueda?: string;
  estado?: string;
  origen?: string;
  segmento?: string;
  canal?: string;
  asignadoA?: string; // "todos" | usuarioId
  /** Por defecto solo se listan leads activos; true lista solo los archivados. */
  archivados?: boolean;
  /** Ignora el filtro de archivado (p. ej. para detectar duplicados al importar). */
  incluirArchivados?: boolean;
};

export async function listarLeads(filtros: FiltrosLeads = {}): Promise<Lead[]> {
  const termino = filtros.busqueda ? terminoBusquedaSeguro(filtros.busqueda) : "";

  const leads = await traerTodo<Lead>((desde, hasta) => {
    let query = supabase
      .from("leads")
      .select("*")
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(desde, hasta);

    if (!filtros.incluirArchivados) query = query.eq("archivado", !!filtros.archivados);
    // ilike (sin comodines): encuentra también el estado guardado como "Contactado".
    if (filtros.estado) query = query.ilike("estado", filtros.estado);
    if (filtros.origen) query = query.eq("origen", filtros.origen);
    if (filtros.segmento) query = query.eq("segmento", filtros.segmento);
    if (filtros.canal) query = query.eq("canal", filtros.canal);
    if (filtros.asignadoA && filtros.asignadoA !== "todos") query = query.eq("asignado_a", filtros.asignadoA);

    if (termino) {
      query = query.or(
        ["negocio", "nombre_contacto", "telefono", "email", "instagram", "ciudad"]
          .map((campo) => `${campo}.ilike.%${termino}%`)
          .join(",")
      );
    }
    return query;
  });
  return leads.map(conEstadoCanonico);
}

export async function obtenerLead(id: string): Promise<Lead | null> {
  const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? conEstadoCanonico(data) : null;
}

export async function crearLead(payload: LeadInsert): Promise<Lead> {
  const { data, error } = await supabase.from("leads").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function actualizarLead(id: string, payload: LeadUpdate): Promise<Lead> {
  const { data, error } = await supabase.from("leads").update(payload).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return conEstadoCanonico(data);
}

/** Actualiza varios leads a la vez. RLS descarta en silencio los que el
 * usuario no puede tocar, así que se devuelven solo los realmente cambiados. */
export async function actualizarLeads(ids: string[], payload: LeadUpdate): Promise<Lead[]> {
  if (ids.length === 0) return [];
  const actualizados: Lead[] = [];
  // Lotes pequeños para no superar el tamaño de URL con el filtro `in`.
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error } = await supabase.from("leads").update(payload).in("id", lote).select("*");
    if (error) throw new Error(error.message);
    actualizados.push(...(data ?? []).map(conEstadoCanonico));
  }
  return actualizados;
}

/** Borrado definitivo (solo admin, lo exige la política RLS `leads_delete`).
 * Sus interacciones y eventos se borran en cascada. */
export async function eliminarLeads(ids: string[]): Promise<number> {
  let borrados = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const lote = ids.slice(i, i + 100);
    const { data, error } = await supabase.from("leads").delete().in("id", lote).select("id");
    if (error) throw new Error(error.message);
    borrados += data?.length ?? 0;
  }
  return borrados;
}

/** Primer seguimiento pendiente de cada lead visible, indexado por lead_id. */
export async function obtenerProximosSeguimientos(): Promise<Record<string, string>> {
  const eventos = await traerTodo<{ lead_id: string; fecha_hora: string }>((desde, hasta) =>
    supabase
      .from("eventos")
      .select("lead_id, fecha_hora")
      .eq("completada", false)
      .order("fecha_hora", { ascending: true })
      .order("id", { ascending: true })
      .range(desde, hasta)
  );
  const mapa: Record<string, string> = {};
  for (const ev of eventos) {
    if (!mapa[ev.lead_id]) mapa[ev.lead_id] = ev.fecha_hora;
  }
  return mapa;
}
