import { supabase } from "@/lib/supabase";
import type { Interaccion, InteraccionInsert } from "@/lib/types";

export type InteraccionConUsuario = Interaccion & { usuario: { id: string; nombre: string } | null };

export async function listarInteracciones(leadId: string): Promise<InteraccionConUsuario[]> {
  const { data, error } = await supabase
    .from("interacciones")
    .select("*, usuario:usuarios(id, nombre)")
    .eq("lead_id", leadId)
    .order("fecha", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as InteraccionConUsuario[];
}

export async function crearInteraccion(payload: InteraccionInsert): Promise<Interaccion> {
  const { data, error } = await supabase.from("interacciones").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  return data;
}
