import { supabase } from "@/lib/supabase";
import type { Usuario } from "@/lib/types";

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase.from("usuarios").select("id, nombre, email, rol").order("nombre");
  if (error) throw new Error(error.message);
  return data ?? [];
}
