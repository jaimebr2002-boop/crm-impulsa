import { supabase } from "@/lib/supabase";
import { aYMD, formatHora } from "@/lib/dates";
import type { Cuenta, Evento, FacturaConCuenta, Lead, Proyecto, Suscripcion, TareaConRelaciones } from "@/lib/types";
import { aCentimos, eur, renovacionesEntre } from "@/lib/finanzas";
import { traerTodo } from "./paginar";
import { contextoDeProyecto } from "@/lib/trabajo";

// Capa de lectura del calendario unificado. NO guarda nada: combina en un
// solo tipo lo que ya vive en eventos (seguimientos CRM, reuniones, eventos),
// tareas (con fecha límite), proyectos (entregas) y finanzas (vencimientos de
// facturas y renovaciones de suscripciones; solo admin por RLS).

export type TipoItemCalendario = "seguimiento" | "reunion" | "evento" | "tarea" | "entrega" | "factura" | "renovacion";

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
  factura: {
    label: "Vencimiento de factura",
    punto: "bg-emerald-500",
    chip: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200",
  },
  renovacion: {
    label: "Renovación",
    punto: "bg-orange-400",
    chip: "bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200",
  },
};

/** Filtros visibles: reuniones y eventos manuales van juntos. */
export type FiltroCalendario = "crm" | "eventos" | "tareas" | "proyectos" | "facturas" | "renovaciones";
export const FILTRO_DE_TIPO: Record<TipoItemCalendario, FiltroCalendario> = {
  seguimiento: "crm",
  reunion: "eventos",
  evento: "eventos",
  tarea: "tareas",
  entrega: "proyectos",
  factura: "facturas",
  renovacion: "renovaciones",
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

  const [eventos, tareas, proyectos, facturas, suscripciones] = await Promise.all([
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
    // Finanzas: RLS devuelve vacío a quien no es admin.
    traerTodo<FacturaConCuenta>((a, b) =>
      supabase
        .from("facturas_estado")
        .select("*, cuenta:cuentas(id, nombre)")
        .eq("estado", "emitida")
        .gte("fecha_vencimiento", desdeYMD)
        .lt("fecha_vencimiento", hastaYMD)
        .order("id")
        .range(a, b)
        .returns<FacturaConCuenta[]>()
    ),
    traerTodo<Suscripcion>((a, b) => supabase.from("suscripciones").select("*").eq("activa", true).order("id").range(a, b)),
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

  for (const f of facturas) {
    if (!f.fecha_vencimiento) continue;
    const cobrada = aCentimos(f.pendiente) <= 0;
    items.push({
      clave: `f-${f.id}`,
      tipo: "factura",
      titulo: `Factura ${f.numero}`,
      subtitulo: [f.cuenta?.nombre, cobrada ? "cobrada" : `${eur(f.pendiente)} pendiente`].filter(Boolean).join(" · "),
      dia: f.fecha_vencimiento,
      hora: null,
      completado: cobrada,
      href: `/finanzas/facturas/${f.id}`,
    });
  }
  for (const s of suscripciones) {
    for (const dia of renovacionesEntre(s, desdeYMD, hastaYMD)) {
      items.push({
        clave: `r-${s.id}-${dia}`,
        tipo: "renovacion",
        titulo: s.nombre,
        subtitulo: `Renovación · ${eur(s.importe)}`,
        dia,
        hora: null,
        completado: false,
        href: "/finanzas/suscripciones",
      });
    }
  }

  // Primero lo de día completo (entregas, tareas…), después por hora.
  const ordenTipo: Record<TipoItemCalendario, number> = {
    entrega: 0,
    factura: 0,
    renovacion: 0,
    tarea: 1,
    seguimiento: 2,
    reunion: 2,
    evento: 2,
  };
  return items.sort(
    (a, b) => a.dia.localeCompare(b.dia) || ordenTipo[a.tipo] - ordenTipo[b.tipo] || (a.hora ?? "").localeCompare(b.hora ?? "")
  );
}
