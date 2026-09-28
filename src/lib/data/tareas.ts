import { supabase } from "@/lib/supabase";
import type { TareaConRelaciones, TareaInsert, TareaUpdate } from "@/lib/types";
import { traerTodo } from "./paginar";

const SELECT = "*, proyecto:proyectos(id, nombre), lead:leads(id, negocio, nombre_contacto)";

/** Tareas abiertas + completadas en los últimos `diasCompletadas` días (el
 * archivo histórico completo no hace falta en el día a día). */
export async function listarTareas(
  filtro: { proyectoId?: string; leadId?: string; diasCompletadas?: number } = {}
): Promise<TareaConRelaciones[]> {
  const dias = filtro.diasCompletadas ?? 30;
  const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
  return traerTodo<TareaConRelaciones>((a, b) => {
    let q = supabase
      .from("tareas")
      .select(SELECT)
      .or(`estado.neq.completada,completada_en.gte.${desde}`)
      .order("created_at", { ascending: false })
      .order("id")
      .range(a, b);
    if (filtro.proyectoId) q = q.eq("proyecto_id", filtro.proyectoId);
    if (filtro.leadId) q = q.eq("lead_id", filtro.leadId);
    return q;
  });
}

export async function crearTarea(payload: TareaInsert): Promise<TareaConRelaciones> {
  const { data, error } = await supabase.from("tareas").insert(payload).select(SELECT).single();
  if (error) throw new Error(error.message);
  return data as TareaConRelaciones;
}

export async function actualizarTarea(id: string, payload: TareaUpdate): Promise<TareaConRelaciones> {
  const { data, error } = await supabase.from("tareas").update(payload).eq("id", id).select(SELECT).single();
  if (error) throw new Error(error.message);
  return data as TareaConRelaciones;
}

export async function eliminarTarea(id: string): Promise<void> {
  const { data, error } = await supabase.from("tareas").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No tienes permiso para eliminar esta tarea.");
}
