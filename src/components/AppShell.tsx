"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useUsuario } from "@/context/UsuarioContext";
import {
  listarNotificacionesPendientes,
  marcarNotificacionLeida,
  marcarTodasLasNotificacionesLeidas,
} from "@/lib/data/eventos";
import type { EventoConLead } from "@/lib/types";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import {
  IconHoy,
  IconLeads,
  IconCalendario,
  IconMas,
  IconMasOpciones,
  IconPerfil,
  IconAnalitica,
  IconImportar,
} from "./Icons";
import { Avatar } from "./Avatar";
import { ThemeToggle } from "./ThemeToggle";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";

// Dock flotante de escritorio — navegación principal. Perfil se añade aparte,
// al final, tras el botón "+" (el chip de la cabecera es un atajo adicional).
const NAV = [
  { href: "/hoy", label: "Hoy", icon: IconHoy },
  { href: "/leads", label: "Leads", icon: IconLeads },
  { href: "/calendario", label: "Calendario", icon: IconCalendario },
  { href: "/analitica", label: "Analítica", icon: IconAnalitica },
  { href: "/importar", label: "Importar", icon: IconImportar },
];

// Barra inferior de móvil — el botón "Nuevo lead" se renderiza elevado, en el
// centro. Analítica e Importar no caben con holgura junto a las otras 5
// secciones (etiquetas de una sola palabra, densidad tipo Instagram/WhatsApp),
// así que se agrupan detrás de "Más".
const NAV_MOVIL = [
  { href: "/hoy", label: "Hoy", icon: IconHoy },
  { href: "/leads", label: "Leads", icon: IconLeads },
  { href: "/leads/nuevo", label: "Nuevo lead", icon: IconMas },
  { href: "/calendario", label: "Calendario", icon: IconCalendario },
  { href: "/perfil", label: "Perfil", icon: IconPerfil },
];

const NAV_MOVIL_MAS = [
  { href: "/analitica", label: "Analítica", icon: IconAnalitica },
  { href: "/importar", label: "Importar leads", icon: IconImportar },
];

const RUTAS_PUBLICAS = ["/login", "/actualizar-password"];

export function AppShell({ children }: { children: ReactNode }) {
  const { cargando, error, usuarioActual } = useUsuario();
  const pathname = usePathname();
  const router = useRouter();

  const [notificaciones, setNotificaciones] = useState<EventoConLead[]>([]);
  const [masAbierto, setMasAbierto] = useState(false);

  const esRutaPublica = pathname === "/" || RUTAS_PUBLICAS.some((ruta) => pathname?.startsWith(ruta));

  useEffect(() => {
    if (!esRutaPublica && !cargando && !usuarioActual && !error) {
      router.replace("/login");
    }
  }, [esRutaPublica, cargando, usuarioActual, error, router]);

  const cargarNotificaciones = useCallback(async () => {
    if (!usuarioActual || !usuarioActual.notificaciones_activas) {
      setNotificaciones([]);
      return;
    }
    try {
      const pendientes = await listarNotificacionesPendientes(usuarioActual.id);
      setNotificaciones(pendientes);
    } catch {
      // Si falla la carga de notificaciones no bloqueamos el resto de la app.
    }
  }, [usuarioActual]);

  // Se recalcula al cambiar de página para reflejar cambios hechos en otras vistas.
  useEffect(() => {
    if (esRutaPublica) return;
    cargarNotificaciones();
  }, [cargarNotificaciones, esRutaPublica, pathname]);

  useEffect(() => {
    setMasAbierto(false);
  }, [pathname]);

  async function marcarLeida(id: string) {
    setNotificaciones((prev) => prev.filter((e) => e.id !== id));
    try {
      await marcarNotificacionLeida(id);
    } catch {
      cargarNotificaciones();
    }
  }

  async function marcarTodas() {
    if (!usuarioActual) return;
    setNotificaciones([]);
    try {
      await marcarTodasLasNotificacionesLeidas(usuarioActual.id);
    } catch {
      cargarNotificaciones();
    }
  }

  if (esRutaPublica) {
    return <>{children}</>;
  }

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <LoadingState texto="Cargando Impulsa CRM…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas px-6">
        <ErrorState mensaje={error} />
      </div>
    );
  }

  if (!usuarioActual) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <LoadingState texto="Redirigiendo…" />
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div className="blob-bg -left-32 -top-40 h-[420px] w-[420px]" style={{ background: "var(--blob1)" }} />
      <div className="blob-bg -bottom-48 -right-32 h-[480px] w-[480px]" style={{ background: "var(--blob2)" }} />

      {/* Barra superior fija — campana y perfil, visibles en todas las pantallas internas */}
      <header className="glass sticky top-0 z-20 flex items-center justify-between px-4 py-3 md:px-8">
        <Link href="/hoy" className="flex items-center gap-2">
          <Logo size={26} />
          <p className="font-display text-base font-bold tracking-tight text-ink">Impulsa</p>
        </Link>
        <div className="flex items-center gap-2">
          {usuarioActual.notificaciones_activas ? (
            <NotificationBell eventos={notificaciones} onMarcarLeida={marcarLeida} onMarcarTodas={marcarTodas} />
          ) : null}
          <ThemeToggle />
          <Link
            href="/perfil"
            className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-1 transition-colors hover:bg-mute md:pr-3"
          >
            <Avatar nombre={usuarioActual.nombre} size="sm" />
            <span className="hidden text-sm font-medium text-ink md:inline">{usuarioActual.nombre}</span>
          </Link>
        </div>
      </header>

      <div className="relative z-[1]">
        <main className="pb-32">{children}</main>
      </div>

      {/* Dock flotante — escritorio, sustituye a la barra lateral */}
      <nav className="glass-strong fixed bottom-6 left-1/2 z-20 hidden -translate-x-1/2 items-end gap-1 rounded-[28px] p-2 shadow-glass dark:shadow-glass-dark md:flex">
        {NAV.map((item) => {
          const activo = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex origin-bottom flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-transform duration-150 ease-out hover:scale-110 hover:bg-mute focus-visible:scale-110 ${
                activo ? "text-brand-dark dark:text-brand" : "text-ink2 hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}

        <span className="mx-1 mb-2 h-8 w-px self-center bg-line" />
        <Link
          href="/leads/nuevo"
          title="Nuevo lead"
          className="flex origin-bottom flex-col items-center gap-1 rounded-2xl bg-brand-gradient px-4 py-3 text-brand-ink shadow-lg shadow-brand/30 transition-transform duration-150 ease-out hover:scale-110"
        >
          <IconMas className="h-6 w-6" />
        </Link>
        <span className="mx-1 mb-2 h-8 w-px self-center bg-line" />

        {(() => {
          const activo = pathname === "/perfil" || pathname?.startsWith("/perfil/");
          return (
            <Link
              href="/perfil"
              className={`flex origin-bottom flex-col items-center gap-1 rounded-2xl px-3 py-2 transition-transform duration-150 ease-out hover:scale-110 hover:bg-mute focus-visible:scale-110 ${
                activo ? "text-brand-dark dark:text-brand" : "text-ink2 hover:text-ink"
              }`}
            >
              <IconPerfil className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">Perfil</span>
            </Link>
          );
        })()}
      </nav>

      {/* Barra inferior — móvil, flotante tipo Instagram/WhatsApp, mismo lenguaje glass que el dock de escritorio */}
      <nav
        className="glass-strong fixed inset-x-4 z-20 flex items-center justify-around rounded-[28px] px-1 py-2 shadow-glass dark:shadow-glass-dark md:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 1rem)" }}
      >
        {NAV_MOVIL.map((item) => {
          const activo = pathname === item.href || pathname?.startsWith(item.href + "/");
          const Icon = item.icon;

          if (item.href === "/leads/nuevo") {
            return (
              <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center">
                <span className="-mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gradient text-brand-ink shadow-lg">
                  <Icon className="h-6 w-6" />
                </span>
              </Link>
            );
          }
          return (
            <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center gap-1 text-[10px]">
              <Icon className={`h-5 w-5 ${activo ? "text-brand-dark dark:text-brand" : "text-ink3"}`} />
              <span className={activo ? "font-medium text-brand-dark dark:text-brand" : "text-ink3"}>{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMasAbierto(true)}
          className="flex flex-1 flex-col items-center gap-1 text-[10px] text-ink3"
        >
          <IconMasOpciones className="h-5 w-5" />
          <span>Más</span>
        </button>
      </nav>

      {masAbierto ? (
        <div
          className="fixed inset-0 z-30 flex items-end bg-black/30 md:hidden"
          onClick={() => setMasAbierto(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-surface p-5"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.25rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="flex flex-col gap-1">
              {NAV_MOVIL_MAS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMasAbierto(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-3.5 text-base font-medium text-ink hover:bg-mute"
                  >
                    <Icon className="h-5 w-5 text-ink2" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
