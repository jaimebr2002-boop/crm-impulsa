import { supabase } from "@/lib/supabase";
import type { AjustesFacturacion } from "@/lib/types";

// Fila única (id = true) con los datos del emisor y las preferencias de
// facturación. RLS: solo admin.

export async function obtenerAjustes(): Promise<AjustesFacturacion | null> {
  const { data, error } = await supabase.from("ajustes_facturacion").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as AjustesFacturacion | null) ?? null;
}

export type AjustesUpdate = Partial<Omit<AjustesFacturacion, "updated_at">>;

export async function guardarAjustes(cambios: AjustesUpdate): Promise<AjustesFacturacion> {
  const { data, error } = await supabase.from("ajustes_facturacion").upsert({ id: true, ...cambios }).select().single();
  if (error) {
    if (error.message.includes("iban")) throw new Error("El IBAN no es válido (formato ES00 0000 0000 0000 0000 0000, sin espacios se guarda igual).");
    if (error.message.includes("email")) throw new Error("El email no es válido.");
    throw new Error(error.message);
  }
  return data as AjustesFacturacion;
}

export { faltanDatosEmisor } from "@/lib/facturacion";
