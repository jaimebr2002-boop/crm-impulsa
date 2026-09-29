import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const url = process.env.NEXT_PUBLIC_SB_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SB_ANON_KEY || "placeholder-anon-key";

/**
 * Cliente de Supabase para route handlers con la SESIÓN DEL USUARIO (cookies).
 * Usa la clave anónima: RLS y las políticas de Storage se aplican igual que en
 * el navegador. No hay service role en la app.
 */
export async function supabaseServidor() {
  const almacen = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // En algunos contextos no se pueden escribir cookies; el middleware refresca la sesión.
        }
      },
    },
  });
}
