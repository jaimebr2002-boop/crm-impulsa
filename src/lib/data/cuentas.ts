import { supabase } from "@/lib/supabase";
import type { Cuenta, DatosFiscalesCuenta, Marca, TipoCuenta } from "@/lib/types";
import { traerTodo } from "./paginar";

export async function listarCuentas({ archivadas = false }: { archivadas?: boolean } = {}): Promise<Cuenta[]> {
  return traerTodo<Cuenta>((desde, hasta) =>
    supabase.from("cuentas").select("*").eq("archivada", archivadas).order("nombre").range(desde, hasta)
  );
}

export async function obtenerCuenta(id: string): Promise<Cuenta | null> {
  const { data, error } = await supabase.from("cuentas").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export type CuentaInsert = { nombre: string; tipo?: TipoCuenta; lead_id?: string | null; email?: string | null; telefono?: string | null };

function errorDuplicado(error: { code?: string; message: string }, texto: string): Error {
  return new Error(error.code === "23505" ? texto : error.message);
}

export async function crearCuenta(payload: CuentaInsert): Promise<Cuenta> {
  const { data, error } = await supabase.from("cuentas").insert(payload).select("*").single();
  if (error) throw errorDuplicado(error, "Ya existe una cuenta con ese nombre.");
  return data;
}

export async function actualizarCuenta(
  id: string,
  cambios: Partial<Pick<Cuenta, "nombre" | "tipo" | "email" | "telefono" | "notas" | "archivada">> & DatosFiscalesCuenta
): Promise<Cuenta> {
  const { data, error } = await supabase.from("cuentas").update(cambios).eq("id", id).select("*").single();
  if (error?.message.includes("cuentas_email_facturacion_valido")) throw new Error("El email de facturación no es válido.");
  if (error) throw errorDuplicado(error, "Ya existe una cuenta con ese nombre.");
  return data;
}

export async function listarMarcas(filtro: { cuentaId?: string } = {}): Promise<Marca[]> {
  return traerTodo<Marca>((desde, hasta) => {
    let q = supabase.from("marcas").select("*").order("nombre").range(desde, hasta);
    if (filtro.cuentaId) q = q.eq("cuenta_id", filtro.cuentaId);
    return q;
  });
}

export type MarcaConCuenta = Marca & { cuenta: Pick<Cuenta, "id" | "nombre" | "tipo"> | null };

export async function obtenerMarca(id: string): Promise<MarcaConCuenta | null> {
  const { data, error } = await supabase.from("marcas").select("*, cuenta:cuentas(id, nombre, tipo)").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as MarcaConCuenta | null;
}

export async function crearMarca(payload: { cuenta_id: string; nombre: string; web?: string | null }): Promise<Marca> {
  const { data, error } = await supabase.from("marcas").insert(payload).select("*").single();
  if (error) throw errorDuplicado(error, "Esa marca ya existe en esta cuenta.");
  return data;
}

export async function actualizarMarca(
  id: string,
  cambios: Partial<Pick<Marca, "nombre" | "web" | "notas" | "cuenta_id">>
): Promise<Marca> {
  const { data, error } = await supabase.from("marcas").update(cambios).eq("id", id).select("*").single();
  if (error) throw errorDuplicado(error, "Esa marca ya existe en esta cuenta.");
  return data;
}
