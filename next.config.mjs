import { readFileSync } from "node:fs";

// Qué Supabase usa cada build. En Vercel, .env.production se carga en TODOS los
// builds (también en los Preview), así que sin esto cualquier rama desplegada
// como Preview trabajaría contra la base de datos de producción.
//   · Production → .env.production (o las variables del proyecto en Vercel).
//   · Preview    → .env.staging, salvo que Vercel ya dé un Supabase que no sea
//                  el de producción (variables de Preview configuradas a mano).
// Y dos cinturones: un Preview nunca arranca contra producción, y producción
// nunca contra staging (el build falla).
function leerEnv(ruta) {
  try {
    return Object.fromEntries(
      readFileSync(new URL(ruta, import.meta.url), "utf8")
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#") && l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
    );
  } catch {
    return {};
  }
}

const produccion = leerEnv("./.env.production");
const staging = leerEnv("./.env.staging");
const refDe = (url) => (url ? new URL(url).hostname.split(".")[0] : null);
const REF_PRODUCCION = refDe(produccion.NEXT_PUBLIC_SB_URL);
const REF_STAGING = refDe(staging.NEXT_PUBLIC_SB_URL);

let url = process.env.NEXT_PUBLIC_SB_URL;
let anonKey = process.env.NEXT_PUBLIC_SB_ANON_KEY;
const entorno = process.env.VERCEL_ENV;

if (entorno === "preview" && (!url || refDe(url) === REF_PRODUCCION)) {
  url = staging.NEXT_PUBLIC_SB_URL;
  anonKey = staging.NEXT_PUBLIC_SB_ANON_KEY;
}
if (entorno === "preview" && refDe(url) === REF_PRODUCCION) {
  throw new Error("Un Preview no puede usar el Supabase de producción.");
}
if (entorno === "production" && REF_STAGING && refDe(url) === REF_STAGING) {
  throw new Error("Producción no puede usar el Supabase de staging.");
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: url && anonKey ? { NEXT_PUBLIC_SB_URL: url, NEXT_PUBLIC_SB_ANON_KEY: anonKey } : {},
};

export default nextConfig;
