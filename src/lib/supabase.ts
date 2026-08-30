import { supabaseBrowser, supabaseConfigurado } from "@/lib/supabase/client";

export { supabaseConfigurado };

// Cliente único para toda la app cliente (data/*.ts, contexto de auth, etc.).
// Usa el mecanismo oficial de Supabase para Next.js (@supabase/ssr): la sesión
// se persiste vía cookies, compartida con el middleware que protege las rutas.
export const supabase = supabaseBrowser();
