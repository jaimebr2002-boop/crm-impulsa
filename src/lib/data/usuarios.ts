import { supabase } from "@/lib/supabase";
import type { Usuario } from "@/lib/types";

const SELECT = "id, nombre, email, rol, notificaciones_activas";

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase.from("usuarios").select(SELECT).order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function actualizarPreferenciaNotificaciones(usuarioId: string, activa: boolean): Promise<Usuario> {
  const { data, error } = await supabase
    .from("usuarios")
    .update({ notificaciones_activas: activa })
    .eq("id", usuarioId)
    .select(SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data;
}
