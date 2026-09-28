import type { DocumentoContexto } from "@/lib/types";

/** Relación principal de un documento para mostrar y enlazar ("Factura 2026-004", "Campaña Segurma"…). */
export function relacionPrincipal(d: DocumentoContexto): { etiqueta: string; href: string; secundaria?: string } | null {
  if (d.factura_id) return { etiqueta: `Factura ${d.factura_numero ?? "borrador"}`, href: `/finanzas/facturas/${d.factura_id}`, secundaria: d.cuenta_nombre ?? undefined };
  if (d.gasto_id) return { etiqueta: `Gasto ${d.gasto_concepto ?? ""}`.trim(), href: "/finanzas/gastos", secundaria: d.proyecto_nombre ?? undefined };
  if (d.proyecto_id) return { etiqueta: d.proyecto_nombre ?? "Proyecto", href: `/proyectos/${d.proyecto_id}`, secundaria: d.cuenta_nombre ?? undefined };
  if (d.marca_id) return { etiqueta: d.marca_nombre ?? "Marca", href: `/marcas/${d.marca_id}`, secundaria: d.cuenta_nombre ?? undefined };
  if (d.cuenta_id) return { etiqueta: d.cuenta_nombre ?? "Cuenta", href: `/cuentas/${d.cuenta_id}` };
  return null;
}
