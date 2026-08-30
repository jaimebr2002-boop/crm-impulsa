import { createClient } from "@supabase/supabase-js";

// Nombres propios (no NEXT_PUBLIC_SUPABASE_*) a propósito: el import
// automático de Vercel precreó esas variables vacías en el proyecto, y una
// variable de entorno vacía definida por la plataforma tiene prioridad sobre
// el valor real de .env.production durante el build.
const url = process.env.NEXT_PUBLIC_SB_URL;
const anonKey = process.env.NEXT_PUBLIC_SB_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anonKey);

if (!supabaseConfigurado) {
  // No lanzamos: createClient exige una URL con formato válido incluso en
  // build/SSR sin envs (ej. Vercel build sin variables). Se usa un
  // placeholder para que la app cargue; cualquier llamada real sin
  // configurar fallará con un error de red gestionado por cada pantalla.
  console.warn(
    "Supabase no está configurado: define NEXT_PUBLIC_SB_URL y NEXT_PUBLIC_SB_ANON_KEY en .env.local"
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key");
