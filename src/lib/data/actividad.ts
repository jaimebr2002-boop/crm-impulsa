import { supabase } from "@/lib/supabase";
import type { Actividad } from "@/lib/types";

export type FiltroActividad = {
  limite?: number;
  /** Solo actividad anterior a esta fecha (paginación "cargar más"). */
  antesDe?: string;
  entidades?: string[];
  entidadId?: string;
  cuentaId?: string;
  proyectoId?: string;
  /** Actividad de una marca: la propia marca y la de sus proyectos. */
  marca?: { id: string; proyectoIds: string[] };
  /** Actividad de una factura: la propia factura y sus cobros. */
  facturaId?: string;
};

export async function listarActividad(filtro: FiltroActividad = {}): Promise<Actividad[]> {
  let q = supabase
    .from("actividad")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtro.limite ?? 30);
  if (filtro.antesDe) q = q.lt("created_at", filtro.antesDe);
  if (filtro.entidades?.length) q = q.in("entidad", filtro.entidades);
  if (filtro.entidadId) q = q.eq("entidad_id", filtro.entidadId);
  if (filtro.cuentaId) q = q.eq("cuenta_id", filtro.cuentaId);
  // Actividad de un proyecto: la suya y la de sus tareas (columna proyecto_id, 0009).
  if (filtro.proyectoId) q = q.eq("proyecto_id", filtro.proyectoId);
  if (filtro.marca) {
    const partes = [`and(entidad.eq.marca,entidad_id.eq.${filtro.marca.id})`];
    if (filtro.marca.proyectoIds.length) partes.push(`proyecto_id.in.(${filtro.marca.proyectoIds.join(",")})`);
    q = q.or(partes.join(","));
  }
  if (filtro.facturaId) {
    q = q.or(`and(entidad.eq.factura,entidad_id.eq.${filtro.facturaId}),datos->>factura_id.eq.${filtro.facturaId}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Actividad[];
}
