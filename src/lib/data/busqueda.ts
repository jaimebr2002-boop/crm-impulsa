import { supabase } from "@/lib/supabase";
import { terminoBusquedaSeguro } from "./paginar";
import { eur } from "@/lib/finanzas";
import { formatYMDCorta } from "@/lib/dates";
import { categoriasQueCoinciden, CATEGORIA_DOCUMENTO_LABEL } from "@/lib/documentos";
import type { CategoriaDocumento } from "@/lib/types";

export type ResultadoBusqueda = {
  tipo: "proyecto" | "cuenta" | "marca" | "tarea" | "lead" | "factura" | "gasto" | "suscripcion" | "documento";
  id: string;
  titulo: string;
  subtitulo?: string;
  href: string;
};

/** Búsqueda global para la command palette. Cada tabla aporta hasta 6
 * resultados; RLS se encarga de que un comercial solo vea lo suyo (y nada
 * de finanzas ni documentos, que son solo admin).
 *
 * Dos rondas de consultas pequeñas (nunca se descargan listas enteras):
 *  1. coincidencias directas por nombre en cada tabla;
 *  2. lo relacionado con lo encontrado: proyectos de la marca, tareas de esos
 *     proyectos y facturas de la cuenta o con líneas que coinciden
 *     ("Segurma" → cuenta, marca, proyectos, tareas, facturas y documentos). */
export async function buscarGlobal(texto: string): Promise<ResultadoBusqueda[]> {
  const t = terminoBusquedaSeguro(texto);
  if (t.length < 2) return [];
  const patron = `%${t}%`;

  const cats = categoriasQueCoinciden(t);
  const filtroDocs = [
    ...["nombre", "nombre_archivo", "cuenta_nombre", "marca_nombre", "proyecto_nombre", "factura_numero", "gasto_concepto"].map((c) => `${c}.ilike.${patron}`),
    ...(cats.length ? [`categoria.in.(${cats.join(",")})`] : []),
  ].join(",");

  const [proyectos, tareas, leads, cuentas, marcas, facturas, gastos, suscripciones, lineas, documentos] = await Promise.all([
    supabase
      .from("proyectos")
      .select("id, nombre, estado, cuenta:cuentas(nombre), marca:marcas(nombre)")
      .ilike("nombre", patron)
      .eq("archivado", false)
      .limit(6),
    supabase.from("tareas").select("id, titulo, estado, proyecto_id, proyecto:proyectos(nombre)").ilike("titulo", patron).limit(6),
    supabase
      .from("leads")
      .select("id, negocio, nombre_contacto, estado")
      .or(`negocio.ilike.${patron},nombre_contacto.ilike.${patron},telefono.ilike.${patron},email.ilike.${patron}`)
      .eq("archivado", false)
      .limit(6),
    supabase.from("cuentas").select("id, nombre, tipo").ilike("nombre", patron).limit(4),
    supabase.from("marcas").select("id, nombre, cuenta:cuentas(nombre)").ilike("nombre", patron).limit(4),
    supabase
      .from("facturas_estado")
      .select("id, numero, total, estado_cobro, cuenta:cuentas(nombre)")
      .ilike("numero", patron)
      .order("fecha_emision", { ascending: false })
      .limit(5),
    supabase
      .from("gastos")
      .select("id, concepto, importe, fecha, proveedor")
      .or(`concepto.ilike.${patron},proveedor.ilike.${patron}`)
      .order("fecha", { ascending: false })
      .limit(4),
    supabase.from("suscripciones").select("id, nombre, importe, periodicidad, activa").ilike("nombre", patron).limit(4),
    supabase.from("factura_lineas").select("factura_id").ilike("descripcion", patron).limit(20),
    supabase
      .from("documentos_contexto")
      .select("id, nombre, categoria, cuenta_nombre, proyecto_nombre, factura_numero, gasto_concepto")
      .or(filtroDocs)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  // Segunda ronda: lo relacionado con lo encontrado.
  const ids = (r: { data: { id: string }[] | null }) => (r.data ?? []).map((x) => x.id);
  const marcaIds = ids(marcas);
  const cuentaIds = ids(cuentas);
  const facturaIdsLineas = Array.from(new Set((lineas.data ?? []).map((l) => l.factura_id as string)));
  const [proyectosMarca, tareasProyecto, facturasRel] = await Promise.all([
    marcaIds.length
      ? supabase
          .from("proyectos")
          .select("id, nombre, estado, cuenta:cuentas(nombre), marca:marcas(nombre)")
          .in("marca_id", marcaIds)
          .eq("archivado", false)
          .order("updated_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as never[] }),
    ids(proyectos).length
      ? supabase
          .from("tareas")
          .select("id, titulo, estado, proyecto_id, proyecto:proyectos(nombre)")
          .in("proyecto_id", ids(proyectos))
          .neq("estado", "completada")
          .limit(6)
      : Promise.resolve({ data: [] as never[] }),
    facturaIdsLineas.length || cuentaIds.length
      ? supabase
          .from("facturas_estado")
          .select("id, numero, total, estado_cobro, cuenta:cuentas(nombre)")
          .or(
            [facturaIdsLineas.length ? `id.in.(${facturaIdsLineas.join(",")})` : null, cuentaIds.length ? `cuenta_id.in.(${cuentaIds.join(",")})` : null]
              .filter(Boolean)
              .join(",")
          )
          .neq("estado", "borrador")
          .order("fecha_emision", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const unir = <T extends { id: string }>(a: T[] | null, b: T[] | null, max: number) => {
    const vistos = new Set<string>();
    return [...(a ?? []), ...(b ?? [])].filter((x) => !vistos.has(x.id) && vistos.add(x.id)).slice(0, max);
  };

  const res: ResultadoBusqueda[] = [];
  type ConNombre = { nombre: string } | { nombre: string }[] | null;
  const nombreDe = (v: ConNombre) => (Array.isArray(v) ? v[0]?.nombre : v?.nombre);

  for (const p of unir(proyectos.data, proyectosMarca.data, 6)) {
    const marca = nombreDe(p.marca as ConNombre);
    const cuenta = nombreDe(p.cuenta as ConNombre);
    res.push({
      tipo: "proyecto",
      id: p.id,
      titulo: p.nombre,
      subtitulo: [cuenta, marca].filter(Boolean).join(" · "),
      href: `/proyectos/${p.id}`,
    });
  }
  for (const c of cuentas.data ?? []) {
    res.push({ tipo: "cuenta", id: c.id, titulo: c.nombre, subtitulo: c.tipo === "intermediario" ? "Intermediario" : "Cliente directo", href: `/cuentas/${c.id}` });
  }
  for (const m of marcas.data ?? []) {
    res.push({ tipo: "marca", id: m.id, titulo: m.nombre, subtitulo: nombreDe(m.cuenta as ConNombre), href: `/marcas/${m.id}` });
  }
  for (const ta of unir(tareas.data, tareasProyecto.data, 6)) {
    res.push({
      tipo: "tarea",
      id: ta.id,
      titulo: ta.titulo,
      subtitulo: [nombreDe(ta.proyecto as ConNombre), ta.estado === "completada" ? "Completada" : null].filter(Boolean).join(" · ") || undefined,
      href: ta.proyecto_id ? `/proyectos/${ta.proyecto_id}?tab=tareas` : `/tareas?vista=todas`,
    });
  }
  for (const l of leads.data ?? []) {
    res.push({
      tipo: "lead",
      id: l.id,
      titulo: l.negocio || l.nombre_contacto || "Lead",
      subtitulo: l.negocio && l.nombre_contacto ? l.nombre_contacto : undefined,
      href: `/leads/${l.id}`,
    });
  }
  for (const f of unir(facturas.data, facturasRel.data, 5)) {
    res.push({
      tipo: "factura",
      id: f.id,
      titulo: `Factura ${f.numero}`,
      subtitulo: [nombreDe(f.cuenta as ConNombre), eur(f.total)].filter(Boolean).join(" · "),
      href: `/finanzas/facturas/${f.id}`,
    });
  }
  for (const g of gastos.data ?? []) {
    res.push({
      tipo: "gasto",
      id: g.id,
      titulo: g.concepto,
      subtitulo: [eur(g.importe), formatYMDCorta(g.fecha), g.proveedor].filter(Boolean).join(" · "),
      href: `/finanzas/gastos?fecha=${g.fecha}`,
    });
  }
  for (const s of suscripciones.data ?? []) {
    res.push({
      tipo: "suscripcion",
      id: s.id,
      titulo: s.nombre,
      subtitulo: `${eur(s.importe)} · ${s.periodicidad}${s.activa ? "" : " · pausada"}`,
      href: "/finanzas/suscripciones",
    });
  }
  for (const d of documentos.data ?? []) {
    res.push({
      tipo: "documento",
      id: d.id,
      titulo: d.nombre,
      subtitulo:
        [
          CATEGORIA_DOCUMENTO_LABEL[d.categoria as CategoriaDocumento],
          d.factura_numero ? `Factura ${d.factura_numero}` : d.gasto_concepto ?? d.proyecto_nombre ?? d.cuenta_nombre,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      href: `/documentos?ver=${d.id}`,
    });
  }
  return res;
}
