import { supabase } from "@/lib/supabase";
import type {
  Lead,
  Proyecto,
  ProyectoConRelaciones,
  ProyectoEnlace,
  ProyectoInsert,
  ProyectoUpdate,
} from "@/lib/types";
import { traerTodo } from "./paginar";

// Ojo: "proyectos!proyecto_padre_id" devolvería los HIJOS (array); embeber por
// la columna FK devuelve el padre.
const SELECT =
  "*, cuenta:cuentas(id, nombre, tipo), marca:marcas(id, nombre), padre:proyecto_padre_id(id, nombre)";

export async function listarProyectos({ archivados = false }: { archivados?: boolean } = {}): Promise<ProyectoConRelaciones[]> {
  return traerTodo<ProyectoConRelaciones>((desde, hasta) =>
    supabase
      .from("proyectos")
      .select(SELECT)
      .eq("archivado", archivados)
      .order("updated_at", { ascending: false })
      .order("id")
      .range(desde, hasta)
  );
}

export async function obtenerProyecto(id: string): Promise<ProyectoConRelaciones | null> {
  const { data, error } = await supabase.from("proyectos").select(SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProyectoConRelaciones | null;
}

export async function listarSubproyectos(padreId: string): Promise<ProyectoConRelaciones[]> {
  const { data, error } = await supabase
    .from("proyectos")
    .select(SELECT)
    .eq("proyecto_padre_id", padreId)
    .eq("archivado", false)
    .order("fecha_entrega", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as ProyectoConRelaciones[];
}

export async function listarProyectosDeLead(leadId: string): Promise<Pick<Proyecto, "id" | "nombre" | "estado">[]> {
  const { data, error } = await supabase.from("proyectos").select("id, nombre, estado").eq("lead_id", leadId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function crearProyecto(payload: ProyectoInsert): Promise<ProyectoConRelaciones> {
  const { data, error } = await supabase.from("proyectos").insert(payload).select(SELECT).single();
  if (error) throw new Error(error.message);
  return data as ProyectoConRelaciones;
}

export async function actualizarProyecto(id: string, payload: ProyectoUpdate): Promise<ProyectoConRelaciones> {
  const { data, error } = await supabase.from("proyectos").update(payload).eq("id", id).select(SELECT).single();
  if (error) throw new Error(error.message);
  return data as ProyectoConRelaciones;
}

export async function eliminarProyecto(id: string): Promise<void> {
  const { data, error } = await supabase.from("proyectos").delete().eq("id", id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No tienes permiso para eliminar este proyecto.");
}

// ---------- Enlaces ----------

export async function listarEnlaces(proyectoId: string): Promise<ProyectoEnlace[]> {
  const { data, error } = await supabase
    .from("proyecto_enlaces")
    .select("*")
    .eq("proyecto_id", proyectoId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function crearEnlace(payload: { proyecto_id: string; titulo: string; url: string }): Promise<ProyectoEnlace> {
  const { data, error } = await supabase.from("proyecto_enlaces").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function eliminarEnlace(id: string): Promise<void> {
  const { error } = await supabase.from("proyecto_enlaces").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Lead ganado → proyecto ----------

/** Crea (o reutiliza) la cuenta de cliente directo del lead y un proyecto
 * enlazado a ambos. El lead y su historial no se tocan. */
export async function convertirLeadEnProyecto(
  lead: Pick<Lead, "id" | "negocio" | "nombre_contacto" | "email" | "telefono" | "valor" | "asignado_a">,
  opciones: { nombre: string; tipo: ProyectoInsert["tipo"]; fecha_entrega: string | null }
): Promise<ProyectoConRelaciones> {
  const { data: existente, error: errCuenta } = await supabase
    .from("cuentas")
    .select("id")
    .eq("lead_id", lead.id)
    .maybeSingle();
  if (errCuenta) throw new Error(errCuenta.message);

  let cuentaId = existente?.id as string | undefined;
  if (!cuentaId) {
    const { data, error } = await supabase
      .from("cuentas")
      .insert({
        nombre: lead.negocio || lead.nombre_contacto || "Cliente",
        tipo: "cliente_directo",
        lead_id: lead.id,
        email: lead.email,
        telefono: lead.telefono,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    cuentaId = data.id;
  }

  return crearProyecto({
    nombre: opciones.nombre,
    tipo: opciones.tipo,
    fecha_entrega: opciones.fecha_entrega,
    cuenta_id: cuentaId,
    lead_id: lead.id,
    importe: lead.valor,
    estado: "pendiente",
  });
}
