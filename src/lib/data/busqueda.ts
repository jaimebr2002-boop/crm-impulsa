import { supabase } from "@/lib/supabase";
import { terminoBusquedaSeguro } from "./paginar";
import { eur } from "@/lib/finanzas";
import { formatYMDCorta } from "@/lib/dates";

export type ResultadoBusqueda = {
  tipo: "proyecto" | "cuenta" | "marca" | "tarea" | "lead" | "factura" | "gasto" | "suscripcion";
  id: string;
  titulo: string;
  subtitulo?: string;
  href: string;
};

/** Búsqueda global para la command palette. Cada tabla aporta hasta 6
 * resultados; RLS se encarga de que un comercial solo vea lo suyo (y nada
 * de finanzas, que es solo admin). */
export async function buscarGlobal(texto: string): Promise<ResultadoBusqueda[]> {
  const t = terminoBusquedaSeguro(texto);
  if (t.length < 2) return [];
  const patron = `%${t}%`;

  const [proyectos, tareas, leads, cuentas, marcas, facturas, gastos, suscripciones] = await Promise.all([
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
  ]);

  const res: ResultadoBusqueda[] = [];
  type ConNombre = { nombre: string } | { nombre: string }[] | null;
  const nombreDe = (v: ConNombre) => (Array.isArray(v) ? v[0]?.nombre : v?.nombre);

  for (const p of proyectos.data ?? []) {
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
  for (const ta of tareas.data ?? []) {
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
  for (const f of facturas.data ?? []) {
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
  return res;
}
