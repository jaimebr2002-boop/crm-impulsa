// Reglas financieras del Company OS, en un único sitio.
//
// Cuatro conceptos que NUNCA se mezclan:
//   · Valor de proyectos  → lo acordado/presupuestado (proyectos.importe, sin IVA).
//   · Facturado           → total de facturas EMITIDAS (no borradores ni canceladas),
//                           por fecha de emisión. Es lo que el cliente debe pagar
//                           (base + IVA − IRPF); la base se muestra aparte.
//   · Cobrado             → suma de cobros, por fecha de cobro. Dinero recibido.
//   · Pendiente de cobro  → facturado − cobrado de las facturas emitidas. Foto
//                           actual: no depende del periodo.
// Caja neta (aprox.) = cobrado − gastos del periodo. No es beneficio fiscal:
// incluye IVA y no descuenta impuestos.
//
// Todo se suma en CÉNTIMOS ENTEROS para no arrastrar errores de coma flotante.
// La base de datos es la fuente de verdad de los totales de factura; aquí solo
// se replica su redondeo para la vista previa del formulario.

import { addDias, aYMD, hoyYMD, ymdADate } from "./dates";
import type {
  CategoriaGasto,
  Cobro,
  EstadoCobro,
  FacturaEstado,
  Gasto,
  LineaBorrador,
  MetodoCobro,
  Periodicidad,
  ProyectoFacturacion,
  Suscripcion,
} from "./types";

// ---------- Dinero en céntimos ----------

export function aCentimos(valor: number | string | null | undefined): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function deCentimos(centimos: number): number {
  return centimos / 100;
}

/** Suma exacta de importes (en céntimos por dentro). */
export function sumarImportes<T>(filas: T[], importe: (f: T) => number | string | null | undefined): number {
  let c = 0;
  for (const f of filas) c += aCentimos(importe(f));
  return deCentimos(c);
}

/** Redondeo al entero alejándose de cero, como round() de numeric en PostgreSQL. */
function redondearMitadFueraDeCero(x: number): number {
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5 + 1e-9);
}

export type Totales = { base: number; iva: number; irpf: number; total: number };

/** Réplica exacta del cálculo de la BD (facturas_antes_de_guardar) para la vista previa. */
export function calcularTotales(lineas: Pick<LineaBorrador, "cantidad" | "precio_unitario">[], ivaPct: number, irpfPct: number): Totales {
  let baseC = 0;
  for (const l of lineas) {
    const cantC = aCentimos(l.cantidad); // cantidad con 2 decimales
    const precioC = aCentimos(l.precio_unitario);
    baseC += redondearMitadFueraDeCero((cantC * precioC) / 100);
  }
  const ivaC = redondearMitadFueraDeCero((baseC * aCentimos(ivaPct)) / 10000);
  const irpfC = redondearMitadFueraDeCero((baseC * aCentimos(irpfPct)) / 10000);
  return { base: deCentimos(baseC), iva: deCentimos(ivaC), irpf: deCentimos(irpfC), total: deCentimos(baseC + ivaC - irpfC) };
}

const FORMATO = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FORMATO_ENTERO = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** Importe con céntimos (facturas, cobros, gastos). */
export function eur(valor: number | string | null | undefined): string {
  return FORMATO.format(aCentimos(valor) / 100);
}

/** Importe redondeado para KPIs grandes. */
export function eurCorto(valor: number | string | null | undefined): string {
  return FORMATO_ENTERO.format(aCentimos(valor) / 100);
}

// ---------- Estados y catálogos ----------

export const ESTADO_COBRO_LABEL: Record<EstadoCobro, string> = {
  borrador: "Borrador",
  pendiente: "Pendiente",
  parcial: "Parcial",
  cobrada: "Cobrada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export const ESTADO_COBRO_ESTILO: Record<EstadoCobro, string> = {
  borrador: "border-line bg-mute text-ink2",
  pendiente: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200",
  parcial: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
  cobrada: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
  vencida: "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  cancelada: "border-line bg-canvas text-ink3 line-through",
};

export const METODOS_COBRO: MetodoCobro[] = ["transferencia", "bizum", "tarjeta", "efectivo", "domiciliacion", "otro"];
export const METODO_COBRO_LABEL: Record<MetodoCobro, string> = {
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  bizum: "Bizum",
  domiciliacion: "Domiciliación",
  otro: "Otro",
};

export const CATEGORIAS_GASTO: CategoriaGasto[] = [
  "software",
  "publicidad",
  "hardware",
  "gestoria",
  "formacion",
  "oficina",
  "transporte",
  "comida",
  "otros",
];
export const CATEGORIA_GASTO_LABEL: Record<CategoriaGasto, string> = {
  software: "Software",
  hardware: "Hardware",
  publicidad: "Publicidad",
  transporte: "Transporte",
  comida: "Comida",
  gestoria: "Gestoría",
  formacion: "Formación",
  oficina: "Oficina",
  otros: "Otros",
};

export const PERIODICIDADES: Periodicidad[] = ["mensual", "trimestral", "anual"];
export const PERIODICIDAD_LABEL: Record<Periodicidad, string> = { mensual: "Mensual", trimestral: "Trimestral", anual: "Anual" };
const PERIODICIDAD_CORTA: Record<Periodicidad, string> = { mensual: "/mes", trimestral: "/trim.", anual: "/año" };
export const periodicidadCorta = (p: Periodicidad) => PERIODICIDAD_CORTA[p];

/** Facturas que cuentan como facturación real. */
export const esEmitida = (f: Pick<FacturaEstado, "estado">) => f.estado === "emitida";

// ---------- Periodos ----------

export type TipoPeriodo = "mes" | "trimestre" | "anio";
/** Rango [desde, hasta) en fechas locales YYYY-MM-DD. */
export type Periodo = { tipo: TipoPeriodo; desde: string; hasta: string; etiqueta: string };

export function periodoQueContiene(tipo: TipoPeriodo, ref: Date = new Date()): Periodo {
  const a = ref.getFullYear();
  const m = ref.getMonth();
  if (tipo === "mes") {
    const d = new Date(a, m, 1);
    const etiqueta = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(d);
    return { tipo, desde: aYMD(d), hasta: aYMD(new Date(a, m + 1, 1)), etiqueta: etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1) };
  }
  if (tipo === "trimestre") {
    const q = Math.floor(m / 3);
    return { tipo, desde: aYMD(new Date(a, q * 3, 1)), hasta: aYMD(new Date(a, q * 3 + 3, 1)), etiqueta: `T${q + 1} ${a}` };
  }
  return { tipo, desde: aYMD(new Date(a, 0, 1)), hasta: aYMD(new Date(a + 1, 0, 1)), etiqueta: String(a) };
}

export function moverPeriodo(p: Periodo, delta: number): Periodo {
  const d = ymdADate(p.desde);
  if (p.tipo === "mes") return periodoQueContiene("mes", new Date(d.getFullYear(), d.getMonth() + delta, 1));
  if (p.tipo === "trimestre") return periodoQueContiene("trimestre", new Date(d.getFullYear(), d.getMonth() + 3 * delta, 1));
  return periodoQueContiene("anio", new Date(d.getFullYear() + delta, 0, 1));
}

const enRango = (ymd: string, desde: string, hasta: string) => ymd >= desde && ymd < hasta;

// ---------- Métricas ----------

export type KpisFinancieros = {
  facturado: number;
  facturadoBase: number;
  numFacturas: number;
  ticketMedio: number;
  cobrado: number;
  gastos: number;
  cajaNeta: number;
  /** Foto actual (no depende del periodo). */
  pendiente: number;
  vencido: number;
  numPendientes: number;
  numVencidas: number;
};

export function calcularKpis(
  datos: { facturas: FacturaEstado[]; cobros: Pick<Cobro, "fecha" | "importe">[]; gastos: Pick<Gasto, "fecha" | "importe">[] },
  desde: string,
  hasta: string
): KpisFinancieros {
  const emitidas = datos.facturas.filter(esEmitida);
  const delPeriodo = emitidas.filter((f) => enRango(f.fecha_emision, desde, hasta));
  const conPendiente = emitidas.filter((f) => aCentimos(f.pendiente) > 0);
  const vencidas = conPendiente.filter((f) => f.vencida);
  const facturado = sumarImportes(delPeriodo, (f) => f.total);
  const cobrado = sumarImportes(datos.cobros.filter((c) => enRango(c.fecha, desde, hasta)), (c) => c.importe);
  const gastos = sumarImportes(datos.gastos.filter((g) => enRango(g.fecha, desde, hasta)), (g) => g.importe);
  return {
    facturado,
    facturadoBase: sumarImportes(delPeriodo, (f) => f.base),
    numFacturas: delPeriodo.length,
    ticketMedio: delPeriodo.length ? deCentimos(Math.round(aCentimos(facturado) / delPeriodo.length)) : 0,
    cobrado,
    gastos,
    cajaNeta: deCentimos(aCentimos(cobrado) - aCentimos(gastos)),
    pendiente: sumarImportes(conPendiente, (f) => f.pendiente),
    vencido: sumarImportes(vencidas, (f) => f.pendiente),
    numPendientes: conPendiente.length,
    numVencidas: vencidas.length,
  };
}

export type PuntoMensual = { mes: string; etiqueta: string; facturado: number; cobrado: number; gastos: number };

/** Serie de los últimos `meses` meses hasta el mes de `hasta` (incluido). */
export function serieMensual(
  datos: { facturas: FacturaEstado[]; cobros: Pick<Cobro, "fecha" | "importe">[]; gastos: Pick<Gasto, "fecha" | "importe">[] },
  meses: number,
  refFin: Date = new Date()
): PuntoMensual[] {
  const puntos: PuntoMensual[] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const p = periodoQueContiene("mes", new Date(refFin.getFullYear(), refFin.getMonth() - i, 1));
    const k = calcularKpis(datos, p.desde, p.hasta);
    const etiqueta = new Intl.DateTimeFormat("es-ES", { month: "short" }).format(ymdADate(p.desde)).replace(".", "");
    puntos.push({ mes: p.desde.slice(0, 7), etiqueta, facturado: k.facturado, cobrado: k.cobrado, gastos: k.gastos });
  }
  return puntos;
}

/** Resumen de facturación de una cuenta (o de cualquier conjunto de facturas). */
export function resumenFacturas(facturas: FacturaEstado[]) {
  const emitidas = facturas.filter(esEmitida);
  return {
    facturado: sumarImportes(emitidas, (f) => f.total),
    facturadoBase: sumarImportes(emitidas, (f) => f.base),
    cobrado: sumarImportes(emitidas, (f) => f.cobrado),
    pendiente: sumarImportes(emitidas, (f) => f.pendiente),
    vencido: sumarImportes(emitidas.filter((f) => f.vencida), (f) => f.pendiente),
  };
}

/** Agrupa importes por una clave y los ordena de mayor a menor. */
export function agruparImportes<T>(filas: T[], clave: (f: T) => string, importe: (f: T) => number | string) {
  const m = new Map<string, number>();
  for (const f of filas) m.set(clave(f), (m.get(clave(f)) ?? 0) + aCentimos(importe(f)));
  return Array.from(m.entries())
    .map(([k, c]) => ({ clave: k, importe: deCentimos(c) }))
    .sort((a, b) => b.importe - a.importe);
}

// ---------- Proyectos ----------

export type EstadoFacturacionProyecto = "sin_facturar" | "parcial" | "facturado";

export function estadoFacturacionProyecto(valor: number | null, facturado: number): EstadoFacturacionProyecto {
  if (aCentimos(facturado) <= 0) return "sin_facturar";
  if (valor != null && aCentimos(facturado) < aCentimos(valor)) return "parcial";
  return "facturado";
}

/**
 * Reparto del valor de un proyecto (sin IVA):
 *  · facturado  = líneas en facturas EMITIDAS (la única definición de "facturado").
 *  · enBorrador = líneas en facturas BORRADOR: aún no es facturado, pero ya está preparado.
 *  · porPreparar = valor − facturado − enBorrador (nunca negativo): lo que sigue sin
 *    estar en ninguna factura. Es lo que se ofrece "Facturar", para no duplicar un
 *    proyecto que ya está en un borrador.
 */
export function repartoFacturacion(
  p: { importe: number | null; estado?: string },
  fact: Pick<ProyectoFacturacion, "facturado" | "en_borrador" | "borradores"> | undefined | null
) {
  const facturado = aCentimos(fact?.facturado ?? 0);
  const enBorrador = aCentimos(fact?.en_borrador ?? 0);
  const valor = p.estado === "cancelado" || p.importe == null ? null : aCentimos(p.importe);
  return {
    valor: valor == null ? null : deCentimos(valor),
    facturado: deCentimos(facturado),
    enBorrador: deCentimos(enBorrador),
    porPreparar: valor == null ? 0 : deCentimos(Math.max(valor - facturado - enBorrador, 0)),
    borradores: fact?.borradores ?? [],
  };
}

export const ESTADO_FACTURACION_LABEL: Record<EstadoFacturacionProyecto, string> = {
  sin_facturar: "Sin facturar",
  parcial: "Parcialmente facturado",
  facturado: "Facturado",
};

// ---------- Suscripciones ----------

const MESES_POR_PERIODO: Record<Periodicidad, number> = { mensual: 1, trimestral: 3, anual: 12 };

/** Coste fijo ESTIMADO a partir de suscripciones activas (no son gastos reales). */
export function costeFijo(suscripciones: Suscripcion[]) {
  let anualC = 0;
  for (const s of suscripciones) {
    if (!s.activa) continue;
    anualC += aCentimos(s.importe) * (12 / MESES_POR_PERIODO[s.periodicidad]);
  }
  return { anual: deCentimos(anualC), mensual: deCentimos(Math.round(anualC / 12)) };
}

export function costeAnual(s: Pick<Suscripcion, "importe" | "periodicidad">): number {
  return deCentimos(aCentimos(s.importe) * (12 / MESES_POR_PERIODO[s.periodicidad]));
}

/** Renovaciones de una suscripción dentro de [desde, hasta), a partir de la próxima. */
export function renovacionesEntre(s: Suscripcion, desde: string, hasta: string): string[] {
  if (!s.activa) return [];
  const fechas: string[] = [];
  let d = ymdADate(s.proxima_renovacion);
  const dia = d.getDate();
  for (let i = 0; i < 60 && aYMD(d) < hasta; i++) {
    if (aYMD(d) >= desde) fechas.push(aYMD(d));
    const m = MESES_POR_PERIODO[s.periodicidad];
    // Mismo día del mes (ajustado a fin de mes si no existe: 31 → 30/28).
    const sig = new Date(d.getFullYear(), d.getMonth() + m, 1);
    const ultimo = new Date(sig.getFullYear(), sig.getMonth() + 1, 0).getDate();
    d = new Date(sig.getFullYear(), sig.getMonth(), Math.min(dia, ultimo));
  }
  return fechas;
}

/** Vencimiento por defecto a N días de la emisión. */
export function vencimientoPorDefecto(emision: string = hoyYMD(), dias = 30): string {
  return aYMD(addDias(ymdADate(emision), dias));
}
