"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useUsuario } from "@/context/UsuarioContext";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { IconHoy, IconLeads, IconCalendario, IconMas, IconPerfil } from "./Icons";
import { Avatar } from "./Avatar";

const NAV = [
  { href: "/hoy", label: "Hoy", icon: IconHoy },
  { href: "/leads", label: "Leads", icon: IconLeads },
  { href: "/calendario", label: "Calendario", icon: IconCalendario },
  { href: "/leads/nuevo", label: "Nuevo lead", icon: IconMas },
  { href: "/perfil", label: "Perfil", icon: IconPerfil },
];

const RUTAS_PUBLICAS = ["/login", "/actualizar-password"];

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  comercial: "Comercial",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { cargando, error, usuarioActual } = useUsuario();
  const pathname = usePathname();
  const router = useRouter();

  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => pathname?.startsWith(ruta));

  useEffect(() => {
    if (!esRutaPublica && !cargando && !usuarioActual && !error) {
      router.replace("/login");
    }
  }, [esRutaPublica, cargando, usuarioActual, error, router]);

  if (esRutaPublica) {
    return <>{children}</>;
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState texto="Cargando Impulsa CRM…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <ErrorState mensaje={error} />
      </div>
    );
  }

  if (!usuarioActual) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingState texto="Redirigiendo…" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-slate-50 md:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5 md:flex">
        <p className="px-2 text-lg font-semibold text-slate-900">Impulsa CRM</p>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {NAV.filter((n) => n.href !== "/perfil").map((item) => {
            const activo = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  activo ? "bg-brand-light text-brand-dark" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/perfil"
          className="mt-auto flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-sm hover:bg-slate-50"
        >
          <Avatar nombre={usuarioActual.nombre} />
          <span>
            <span className="block font-medium text-slate-900">{usuarioActual.nombre}</span>
            <span className="block text-xs text-slate-400">{ROL_LABEL[usuarioActual.rol] ?? usuarioActual.rol}</span>
          </span>
        </Link>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <main className="flex-1 pb-20 md:pb-8">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
          {NAV.map((item) => {
            const activo = pathname === item.href || pathname?.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px]"
              >
                <Icon className={`h-6 w-6 ${activo ? "text-brand-dark" : "text-slate-400"}`} />
                <span className={activo ? "font-medium text-brand-dark" : "text-slate-400"}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
