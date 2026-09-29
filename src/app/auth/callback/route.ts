import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

const DESTINOS_PERMITIDOS = new Set(["/actualizar-password"]);

export async function GET(request: NextRequest) {
  const destinoSolicitado = request.nextUrl.searchParams.get("next") ?? "";
  const destino = DESTINOS_PERMITIDOS.has(destinoSolicitado)
    ? destinoSolicitado
    : "/actualizar-password";
  const codigo = request.nextUrl.searchParams.get("code");

  if (!codigo) {
    return NextResponse.redirect(new URL("/login?error=enlace", request.url));
  }

  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.exchangeCodeForSession(codigo);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=enlace", request.url));
  }

  return NextResponse.redirect(new URL(destino, request.url));
}
