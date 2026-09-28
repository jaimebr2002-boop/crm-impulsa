import { supabase } from "@/lib/supabase";
import type { Actividad } from "@/lib/types";

export async function listarActividad(
  filtro: { limite?: number; entidad?: string; entidadId?: string; proyectoId?: string } = {}
): Promise<Actividad[]> {
  let q = supabase
    .from("actividad")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(filtro.limite ?? 30);
  if (filtro.entidad) q = q.eq("entidad", filtro.entidad);
  if (filtro.entidadId) q = q.eq("entidad_id", filtro.entidadId);
  // Actividad de un proyecto: la suya y la de sus tareas (datos.proyecto_id).
  if (filtro.proyectoId) {
    q = q.or(`entidad_id.eq.${filtro.proyectoId},datos->>proyecto_id.eq.${filtro.proyectoId}`);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Actividad[];
}
