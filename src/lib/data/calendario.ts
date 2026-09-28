import { supabase } from "@/lib/supabase";
import { aYMD, formatHora } from "@/lib/dates";
import type { Cuenta, Evento, Lead, Proyecto, TareaConRelaciones } from "@/lib/types";
import { traerTodo } from "./paginar";
import { contextoDeProyecto } from "@/lib/trabajo";

// Capa de lectura del calendario unificado. NO guarda nada: combina en un
// solo tipo lo que ya vive en eventos (seguimientos CRM, reuniones, eventos),
// tareas (con fecha límite) y proyectos (entregas).

export type TipoItemCalendario = "seguimiento" | "reunion" | "evento" | "tarea" | "entrega";

export type EventoCalendario = Evento & {
  lead: Pick<Lead, "id" | "negocio" | "nombre_contacto"> | null;
  proyecto: Pick<Proyecto, "id" | "nombre"> | null;
  cuenta: Pick<Cuenta, "id" | "nombre"> | null;
};

export type ItemCalendario = {
  clave: string;
  tipo: TipoItemCalendario;
  titulo: string;
  subtitulo: string | null;
  /** Día local YYYY-MM-DD. */
  dia: string;
  /** "10:30" o null si es de día completo (tareas y entregas). */
  hora: string | null;
  completado: boolean;
  href: string | null;
  evento?: EventoCalendario;
  tarea?: TareaConRelaciones;
};

export const TIPO_ITEM: Record<TipoItemCalendario, { label: string; punto: string; chip: string }> = {
  seguimiento: {
    label: "Seguimiento CRM",
    punto: "bg-sky-500",
    chip: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-200",
  },
  reunion: {
    label: "Reunión",
    punto: "bg-pink-500",
    chip: "bg-pink-50 text-pink-800 dark:bg-pink-500/15 dark:text-pink-200",
  },
  evento: {
    label: "Evento",
    punto: "bg-slate-500",
    chip: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
  },
  tarea: {
    label: "Tarea",
    punto: "bg-amber-500",
    chip: "bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  },
  entrega: {
    label: "Entrega de proyecto",
    punto: "bg-violet-500",
    chip: "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200",
  },
};

/** Filtros visibles: reuniones y eventos manuales van juntos. */
export type FiltroCalendario = "crm" | "eventos" | "tareas" | "proyectos";
export const FILTRO_DE_TIPO: Record<TipoItemCalendario, FiltroCalendario> = {
  seguimiento: "crm",
  reunion: "eventos",
  evento: "eventos",
  tarea: "tareas",
  entrega: "proyectos",
};

const SELECT_TAREA =
  "*, proyecto:proyectos(id, nombre, cuenta_id, marca_id, cuenta:cuentas(id, nombre), marca:marcas(id, nombre)), lead:leads(id, negocio, nombre_contacto)";

type EntregaFila = Pick<Proyecto, "id" | "nombre" | "estado" | "fecha_entrega" | "responsable_id"> & {
  cuenta: { nombre: string } | null;
  marca: { nombre: string } | null;
};

export async function obtenerItemsCalendario(
  desde: Date,
  hasta: Date,
  opciones: { soloDe?: string } = {}
): Promise<ItemCalendario[]> {
  const desdeYMD = aYMD(desde);
  const hastaYMD = aYMD(hasta);

  const [eventos, tareas, proyectos] = await Promise.all([
    traerTodo<EventoCalendario>((a, b) =>
      supabase
        .from("eventos")
        .select("*, lead:leads(id, negocio, nombre_contacto), proyecto:proyectos(id, nombre), cuenta:cuentas(id, nombre)")
        .gte("fecha_hora", desde.toISOString())
        .lt("fecha_hora", hasta.toISOString())
        .order("fecha_hora")
        .order("id")
        .range(a, b)
    ),
    traerTodo<TareaConRelaciones>((a, b) =>
      supabase.from("tareas").select(SELECT_TAREA).gte("fecha_limite", desdeYMD).lt("fecha_limite", hastaYMD).order("id").range(a, b)
    ),
    // RLS: a un comercial esta consulta le devuelve vacío (proyectos es solo admin).
    traerTodo<EntregaFila>((a, b) =>
      supabase
        .from("proyectos")
        .select("id, nombre, estado, fecha_entrega, responsable_id, cuenta:cuentas(nombre), marca:marcas(nombre)")
        .eq("archivado", false)
        .neq("estado", "cancelado")
        .gte("fecha_entrega", desdeYMD)
        .lt("fecha_entrega", hastaYMD)
        .order("id")
        .range(a, b)
        .returns<EntregaFila[]>()
    ),
  ]);

  const mio = (usuarioId: string | null) => !opciones.soloDe || !usuarioId || usuarioId === opciones.soloDe;
  const items: ItemCalendario[] = [];

  for (const e of eventos) {
    if (!mio(e.usuario_id)) continue;
    const tipo = e.tipo ?? "seguimiento";
    const contexto =
      tipo === "seguimiento"
        ? e.lead?.negocio || e.lead?.nombre_contacto || null
        : [e.cuenta?.nombre, e.proyecto?.nombre].filter(Boolean).join(" · ") || null;
    items.push({
      clave: `e-${e.id}`,
      tipo,
      titulo: e.titulo,
      subtitulo: contexto,
      dia: aYMD(new Date(e.fecha_hora)),
      hora: formatHora(e.fecha_hora),
      completado: e.completada,
      href: tipo === "seguimiento" && e.lead_id ? `/leads/${e.lead_id}` : null,
      evento: e,
    });
  }
  for (const t of tareas) {
    if (!mio(t.responsable_id) || !t.fecha_limite) continue;
    items.push({
      clave: `t-${t.id}`,
      tipo: "tarea",
      titulo: t.titulo,
      subtitulo: t.proyecto ? contextoDeProyecto(t.proyecto) : null,
      dia: t.fecha_limite,
      hora: null,
      completado: t.estado === "completada",
      href: null,
      tarea: t,
    });
  }
  for (const p of proyectos) {
    if (!mio(p.responsable_id) || !p.fecha_entrega) continue;
    items.push({
      clave: `p-${p.id}`,
      tipo: "entrega",
      titulo: p.nombre,
      subtitulo: [p.cuenta?.nombre, p.marca?.nombre].filter(Boolean).join(" · ") || null,
      dia: p.fecha_entrega,
      hora: null,
      completado: p.estado === "entregado",
      href: `/proyectos/${p.id}`,
    });
  }

  // Primero lo de día completo (entregas, tareas), después por hora.
  const ordenTipo: Record<TipoItemCalendario, number> = { entrega: 0, tarea: 1, seguimiento: 2, reunion: 2, evento: 2 };
  return items.sort(
    (a, b) => a.dia.localeCompare(b.dia) || ordenTipo[a.tipo] - ordenTipo[b.tipo] || (a.hora ?? "").localeCompare(b.hora ?? "")
  );
}
