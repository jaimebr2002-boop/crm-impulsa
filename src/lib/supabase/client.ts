import { createBrowserClient } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SB_URL;
const anonKey = process.env.NEXT_PUBLIC_SB_ANON_KEY;

export const supabaseConfigurado = Boolean(url && anonKey);

if (!supabaseConfigurado) {
  console.warn(
    "Supabase no está configurado: define NEXT_PUBLIC_SB_URL y NEXT_PUBLIC_SB_ANON_KEY en .env.local"
  );
}

export function supabaseBrowser() {
  return createBrowserClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key");
}
