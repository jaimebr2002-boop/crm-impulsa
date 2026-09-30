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

type ConsultaLeads = any;

function aplicarFiltros(query: ConsultaLeads, filtros: FiltrosLeads): ConsultaLeads {
  const termino = filtros.busqueda ? terminoBusquedaSeguro(filtros.busqueda) : "";
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
}

export const LEADS_POR_PAGINA = 50;

/** Una página de leads (los más recientes primero) y el total que cumple los
 * filtros. Con decenas de miles de leads la lista nunca los descarga todos. */
export async function listarLeadsPagina(
  filtros: FiltrosLeads = {},
  pagina = 0,
  tamano = LEADS_POR_PAGINA
): Promise<{ leads: Lead[]; total: number }> {
  const query = aplicarFiltros(supabase.from("leads").select("*", { count: "exact" }), filtros)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: true })
    .range(pagina * tamano, pagina * tamano + tamano - 1);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { leads: ((data ?? []) as Lead[]).map(conEstadoCanonico), total: count ?? 0 };
}

/** Valor total (€) de los leads que cumplen los filtros. Solo baja los que
 * tienen importe, que son pocos frente al total. */
export async function valorTotalLeads(filtros: FiltrosLeads = {}): Promise<number> {
  const filas = await traerTodo<{ valor: number | null }>((desde, hasta) =>
    aplicarFiltros(supabase.from("leads").select("valor").gt("valor", 0), filtros).order("id").range(desde, hasta)
  );
  return filas.reduce((total, f) => total + (Number(f.valor) || 0), 0);
}

/** Todos los leads que cumplen los filtros (solo para exportar a CSV). */
export async function listarLeads(filtros: FiltrosLeads = {}): Promise<Lead[]> {
  const leads = await traerTodo<Lead>((desde, hasta) =>
    aplicarFiltros(supabase.from("leads").select("*"), filtros)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(desde, hasta)
  );
  return leads.map(conEstadoCanonico);
}

/** Pipeline (tablero): hasta `porColumna` leads recientes por estado, más el
 * total real de cada uno. Evita descargar todo el CRM para pintar columnas. */
export async function listarLeadsTablero(
  filtros: FiltrosLeads,
  estados: string[],
  porColumna = 40
): Promise<{ leads: Lead[]; totales: Record<string, number> }> {
  const peticion = (extra: (q: ConsultaLeads) => ConsultaLeads) =>
    extra(aplicarFiltros(supabase.from("leads").select("*", { count: "exact" }), { ...filtros, estado: undefined }))
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(porColumna);
  const [porEstado, otros] = await Promise.all([
    Promise.all(estados.map((e) => peticion((q) => q.ilike("estado", e)))),
    peticion((q) => q.not("estado", "in", `(${estados.map((e) => `"${e}"`).join(",")})`)),
  ]);
  const vistos = new Set<string>();
  const leads: Lead[] = [];
  const totales: Record<string, number> = {};
  [...porEstado, otros].forEach((res, i) => {
    if (res.error) throw new Error(res.error.message);
    totales[i < estados.length ? estados[i] : "__otros__"] = res.count ?? 0;
    for (const l of (res.data ?? []) as Lead[]) {
      if (vistos.has(l.id)) continue;
      vistos.add(l.id);
      leads.push(conEstadoCanonico(l));
    }
  });
  return { leads, totales };
}

/** Teléfono y email de todos los leads (también archivados): lo único que
 * necesita el importador para avisar de duplicados. */
export async function listarContactosExistentes(): Promise<{ telefono: string | null; email: string | null }[]> {
  return traerTodo<{ telefono: string | null; email: string | null }>((desde, hasta) =>
    supabase.from("leads").select("telefono, email").or("telefono.not.is.null,email.not.is.null").order("id").range(desde, hasta)
  );
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

/** Primer seguimiento pendiente de cada lead indicado, indexado por lead_id. */
export async function obtenerProximosSeguimientos(leadIds: string[]): Promise<Record<string, string>> {
  const mapa: Record<string, string> = {};
  if (leadIds.length === 0) return mapa;
  const lotes: string[][] = [];
  for (let i = 0; i < leadIds.length; i += 100) lotes.push(leadIds.slice(i, i + 100));
  const respuestas = await Promise.all(
    lotes.map((lote) =>
      supabase
        .from("eventos")
        .select("lead_id, fecha_hora")
        .eq("completada", false)
        .in("lead_id", lote)
        .order("fecha_hora", { ascending: true })
        .limit(1000)
    )
  );
  const eventos: { lead_id: string; fecha_hora: string }[] = [];
  for (const r of respuestas) {
    if (r.error) throw new Error(r.error.message);
    eventos.push(...((r.data ?? []) as { lead_id: string; fecha_hora: string }[]));
  }
  eventos.sort((a, b) => a.fecha_hora.localeCompare(b.fecha_hora));
  for (const ev of eventos) if (!mapa[ev.lead_id]) mapa[ev.lead_id] = ev.fecha_hora;
  return mapa;
}
