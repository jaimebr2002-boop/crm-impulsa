import type { AjustesFacturacion, DatosFiscalesCuenta } from "./types";

// Requisitos mínimos para el PDF de una factura (sin dependencias de cliente:
// se usan en el navegador y en la ruta del servidor que genera el PDF).

const EMISOR_OBLIGATORIO: { campo: keyof AjustesFacturacion; label: string }[] = [
  { campo: "nombre", label: "nombre o razón social" },
  { campo: "nif", label: "NIF" },
  { campo: "direccion", label: "dirección" },
  { campo: "codigo_postal", label: "código postal" },
  { campo: "ciudad", label: "ciudad" },
];

export function faltanDatosEmisor(a: Partial<AjustesFacturacion> | null | undefined): string[] {
  return EMISOR_OBLIGATORIO.filter(({ campo }) => !String(a?.[campo] ?? "").trim()).map((c) => c.label);
}

/** Qué falta de un receptor (cuenta) para poder emitir el PDF de su factura. */
export function faltanDatosReceptor(c: DatosFiscalesCuenta | null | undefined): string[] {
  const falta: string[] = [];
  if (!String(c?.fiscal_nif ?? "").trim()) falta.push("NIF/CIF");
  if (!String(c?.fiscal_direccion ?? "").trim()) falta.push("dirección");
  if (!String(c?.fiscal_codigo_postal ?? "").trim() || !String(c?.fiscal_ciudad ?? "").trim()) falta.push("código postal y ciudad");
  return falta;
}
