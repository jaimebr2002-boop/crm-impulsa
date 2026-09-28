import { supabase } from "@/lib/supabase";
import type { Cuenta, Marca, TipoCuenta } from "@/lib/types";
import { traerTodo } from "./paginar";

export async function listarCuentas(): Promise<Cuenta[]> {
  return traerTodo<Cuenta>((desde, hasta) =>
    supabase.from("cuentas").select("*").eq("archivada", false).order("nombre").range(desde, hasta)
  );
}

export async function crearCuenta(payload: { nombre: string; tipo?: TipoCuenta; lead_id?: string | null }): Promise<Cuenta> {
  const { data, error } = await supabase.from("cuentas").insert(payload).select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe una cuenta con ese nombre.");
    throw new Error(error.message);
  }
  return data;
}

export async function listarMarcas(): Promise<Marca[]> {
  return traerTodo<Marca>((desde, hasta) => supabase.from("marcas").select("*").order("nombre").range(desde, hasta));
}

export async function crearMarca(payload: { cuenta_id: string; nombre: string }): Promise<Marca> {
  const { data, error } = await supabase.from("marcas").insert(payload).select("*").single();
  if (error) {
    if (error.code === "23505") throw new Error("Esa marca ya existe en esta cuenta.");
    throw new Error(error.message);
  }
  return data;
}
