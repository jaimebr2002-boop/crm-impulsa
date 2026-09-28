import { supabase } from "@/lib/supabase";
import type {
  Cobro,
  CobroConFactura,
  EstadoFactura,
  FacturaConCuenta,
  FacturaLineaConProyecto,
  Gasto,
  LineaBorrador,
  MetodoCobro,
  ProyectoFacturacion,
  Suscripcion,
  TipoProyecto,
} from "@/lib/types";
import { traerTodo } from "./paginar";

// Todas las lecturas de facturas van a la vista facturas_estado (cobrado,
// pendiente y estado ya calculados en BD). RLS: solo admin.

const SELECT_FACTURA = "*, cuenta:cuentas(id, nombre)";

export async function listarFacturas(filtro: { cuentaId?: string; ids?: string[] } = {}): Promise<FacturaConCuenta[]> {
  return traerTodo<FacturaConCuenta>((a, b) => {
    let q = supabase
      .from("facturas_estado")
      .select(SELECT_FACTURA)
      .order("fecha_emision", { ascending: false })
      .order("created_at", { ascending: false })
      .range(a, b);
    if (filtro.cuentaId) q = q.eq("cuenta_id", filtro.cuentaId);
    if (filtro.ids) q = q.in("id", filtro.ids.length ? filtro.ids : ["00000000-0000-0000-0000-000000000000"]);
    return q.returns<FacturaConCuenta[]>();
  });
}

export async function obtenerFactura(id: string): Promise<{
  factura: FacturaConCuenta | null;
  lineas: FacturaLineaConProyecto[];
  cobros: Cobro[];
}> {
  const [f, l, c] = await Promise.all([
    supabase.from("facturas_estado").select(SELECT_FACTURA).eq("id", id).maybeSingle(),
    supabase.from("factura_lineas").select("*, proyecto:proyectos(id, nombre)").eq("factura_id", id).order("orden"),
    supabase.from("cobros").select("*").eq("factura_id", id).order("fecha").order("created_at"),
  ]);
  const error = f.error ?? l.error ?? c.error;
  if (error) throw new Error(error.message);
  return {
    factura: f.data as FacturaConCuenta | null,
    lineas: (l.data ?? []) as FacturaLineaConProyecto[],
    cobros: (c.data ?? []) as Cobro[],
  };
}

export type CabeceraFactura = {
  cuenta_id: string;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  iva_pct: number;
  irpf_pct: number;
  notas: string | null;
  numero: string | null;
  estado: "borrador" | "emitida";
};

/** Crea (id null) o actualiza una factura con todas sus líneas, en una transacción. */
export async function guardarFactura(id: string | null, cabecera: CabeceraFactura, lineas: LineaBorrador[]): Promise<string> {
  const { data, error } = await supabase.rpc("guardar_factura", { p_id: id, p_factura: cabecera, p_lineas: lineas });
  if (error) throw new Error(traducirError(error.message));
  return data as string;
}

export async function cambiarEstadoFactura(id: string, estado: EstadoFactura): Promise<void> {
  const { error } = await supabase.from("facturas").update({ estado }).eq("id", id);
  if (error) throw new Error(traducirError(error.message));
}

export async function marcarFacturaEnviada(id: string): Promise<void> {
  const { error } = await supabase.from("facturas").update({ enviada_en: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function eliminarFactura(id: string): Promise<void> {
  const { data, error } = await supabase.from("facturas").delete().eq("id", id).select("id");
  if (error) throw new Error(traducirError(error.message));
  if (!data?.length) throw new Error("No se ha podido eliminar la factura.");
}

// ---------- Cobros ----------

export async function registrarCobro(payload: {
  factura_id: string;
  fecha: string;
  importe: number;
  metodo: MetodoCobro;
  referencia?: string | null;
  notas?: string | null;
}): Promise<Cobro> {
  const { data, error } = await supabase.from("cobros").insert(payload).select("*").single();
  if (error) throw new Error(traducirError(error.message));
  return data;
}

export async function eliminarCobro(id: string): Promise<void> {
  const { error } = await supabase.from("cobros").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listarCobros(filtro: { desde?: string; hasta?: string } = {}): Promise<CobroConFactura[]> {
  return traerTodo<CobroConFactura>((a, b) => {
    let q = supabase
      .from("cobros")
      .select("*, factura:facturas(id, numero, cuenta_id)")
      .order("fecha", { ascending: false })
      .order("id")
      .range(a, b);
    if (filtro.desde) q = q.gte("fecha", filtro.desde);
    if (filtro.hasta) q = q.lt("fecha", filtro.hasta);
    return q.returns<CobroConFactura[]>();
  });
}

// ---------- Facturación por proyecto ----------

export async function facturacionDeProyectos(): Promise<Record<string, ProyectoFacturacion>> {
  const filas = await traerTodo<ProyectoFacturacion>((a, b) =>
    supabase.from("proyectos_facturacion").select("*").order("proyecto_id").range(a, b)
  );
  const m: Record<string, ProyectoFacturacion> = {};
  for (const f of filas) m[f.proyecto_id] = f;
  return m;
}

export async function facturacionDeProyecto(proyectoId: string): Promise<ProyectoFacturacion | null> {
  const { data, error } = await supabase.from("proyectos_facturacion").select("*").eq("proyecto_id", proyectoId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ProyectoFacturacion | null) ?? null;
}

/** Facturas (emitidas o no) que incluyen líneas de un proyecto, con el importe de esas líneas. */
export async function facturasDeProyecto(proyectoId: string): Promise<{ factura: FacturaConCuenta; importe: number }[]> {
  const { data, error } = await supabase.from("factura_lineas").select("factura_id, importe").eq("proyecto_id", proyectoId);
  if (error) throw new Error(error.message);
  const porFactura = new Map<string, number>();
  for (const l of data ?? []) porFactura.set(l.factura_id, (porFactura.get(l.factura_id) ?? 0) + Math.round(Number(l.importe) * 100));
  if (porFactura.size === 0) return [];
  const facturas = await listarFacturas({ ids: Array.from(porFactura.keys()) });
  return facturas.map((f) => ({ factura: f, importe: (porFactura.get(f.id) ?? 0) / 100 }));
}

export type LineaFacturada = {
  importe: number;
  factura: { fecha_emision: string; cuenta_id: string };
  proyecto: { id: string; tipo: TipoProyecto; marca: { id: string; nombre: string } | null } | null;
};

/** Líneas de facturas emitidas en [desde, hasta) con el proyecto (tipo y marca): para la analítica por marca y tipo. */
export async function lineasFacturadas(desde: string, hasta: string): Promise<LineaFacturada[]> {
  return traerTodo<LineaFacturada>((a, b) =>
    supabase
      .from("factura_lineas")
      .select("importe, factura:facturas!inner(fecha_emision, cuenta_id), proyecto:proyectos(id, tipo, marca:marcas(id, nombre))")
      .eq("factura.estado", "emitida")
      .gte("factura.fecha_emision", desde)
      .lt("factura.fecha_emision", hasta)
      .order("id")
      .range(a, b)
      .returns<LineaFacturada[]>()
  );
}

// ---------- Gastos ----------

export type GastoInsert = Pick<Gasto, "concepto" | "fecha" | "importe" | "categoria"> &
  Partial<Pick<Gasto, "proveedor" | "cuenta_id" | "proyecto_id" | "deducible" | "notas">>;

export async function listarGastos(filtro: { desde?: string; hasta?: string } = {}): Promise<Gasto[]> {
  return traerTodo<Gasto>((a, b) => {
    let q = supabase.from("gastos").select("*").order("fecha", { ascending: false }).order("id").range(a, b);
    if (filtro.desde) q = q.gte("fecha", filtro.desde);
    if (filtro.hasta) q = q.lt("fecha", filtro.hasta);
    return q;
  });
}

export async function crearGasto(payload: GastoInsert): Promise<Gasto> {
  const { data, error } = await supabase.from("gastos").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function actualizarGasto(id: string, cambios: Partial<GastoInsert>): Promise<Gasto> {
  const { data, error } = await supabase.from("gastos").update(cambios).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function eliminarGasto(id: string): Promise<void> {
  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- Suscripciones ----------

export type SuscripcionInsert = Pick<Suscripcion, "nombre" | "importe" | "periodicidad" | "categoria" | "proxima_renovacion"> &
  Partial<Pick<Suscripcion, "proveedor" | "fecha_inicio" | "activa" | "notas">>;

export async function listarSuscripciones(): Promise<Suscripcion[]> {
  const { data, error } = await supabase.from("suscripciones").select("*").order("activa", { ascending: false }).order("proxima_renovacion");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function crearSuscripcion(payload: SuscripcionInsert): Promise<Suscripcion> {
  const { data, error } = await supabase.from("suscripciones").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

export async function actualizarSuscripcion(id: string, cambios: Partial<SuscripcionInsert>): Promise<Suscripcion> {
  const { data, error } = await supabase.from("suscripciones").update(cambios).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}

/** Registra el gasto real del periodo actual y avanza la próxima renovación (atómico en BD). */
export async function registrarRenovacion(suscripcionId: string): Promise<void> {
  const { error } = await supabase.rpc("registrar_renovacion", { p_suscripcion_id: suscripcionId });
  if (error) throw new Error(traducirError(error.message));
}

// ---------- Errores legibles ----------

function traducirError(mensaje: string): string {
  if (mensaje.includes("uq_facturas_numero")) return "Ya existe una factura con ese número.";
  if (mensaje.includes("facturas_vencimiento_valido")) return "El vencimiento no puede ser anterior a la emisión.";
  if (mensaje.includes("violates foreign key") && mensaje.includes("cobros")) return "Esta factura tiene cobros: cancélala en vez de eliminarla.";
  return mensaje;
}
