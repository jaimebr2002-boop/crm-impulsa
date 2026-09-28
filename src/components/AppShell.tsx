"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import {
  listarNotificacionesPendientes,
  marcarNotificacionLeida,
  marcarTodasLasNotificacionesLeidas,
} from "@/lib/data/eventos";
import type { EventoConLead } from "@/lib/types";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { NotificationBell } from "./NotificationBell";
import { Sidebar } from "./shell/Sidebar";
import { MobileTabBar, MobileTopBar } from "./shell/MobileNav";
import { CommandPalette } from "./shell/CommandPalette";
import { AltaRapidaModal } from "./shell/AltaRapidaModal";

const RUTAS_PUBLICAS = ["/login", "/actualizar-password"];
const CLAVE_SIDEBAR = "impulsa-sidebar-plegada";

export function AppShell({ children }: { children: ReactNode }) {
  const { cargando, error, usuarioActual } = useUsuario();
  const pathname = usePathname();
  const router = useRouter();

  const esRutaPublica = pathname === "/" || RUTAS_PUBLICAS.some((ruta) => pathname?.startsWith(ruta));

  useEffect(() => {
    if (!esRutaPublica && !cargando && !usuarioActual && !error) {
      router.replace("/login");
    }
  }, [esRutaPublica, cargando, usuarioActual, error, router]);

  if (esRutaPublica) return <>{children}</>;

  if (cargando) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-canvas">
        <LoadingState texto="Cargando Impulsa…" />
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
    <AppProvider>
      <ShellAutenticada>{children}</ShellAutenticada>
    </AppProvider>
  );
}

function ShellAutenticada({ children }: { children: ReactNode }) {
  const { usuarioActual } = useUsuario();
  const pathname = usePathname();
  const [notificaciones, setNotificaciones] = useState<EventoConLead[]>([]);
  const [plegada, setPlegada] = useState(false);

  useEffect(() => {
    try {
      setPlegada(localStorage.getItem(CLAVE_SIDEBAR) === "1");
    } catch {
      // Preferencia de comodidad: sin almacenamiento se queda expandida.
    }
  }, []);

  function alternarSidebar() {
    setPlegada((v) => {
      try {
        localStorage.setItem(CLAVE_SIDEBAR, v ? "0" : "1");
      } catch {
        // Ignorado a propósito.
      }
      return !v;
    });
  }

  const cargarNotificaciones = useCallback(async () => {
    if (!usuarioActual || !usuarioActual.notificaciones_activas) {
      setNotificaciones([]);
      return;
    }
    try {
      setNotificaciones(await listarNotificacionesPendientes(usuarioActual.id));
    } catch {
      // Si falla la carga de notificaciones no bloqueamos el resto de la app.
    }
  }, [usuarioActual]);

  // Se recalcula al cambiar de página para reflejar cambios hechos en otras vistas.
  useEffect(() => {
    cargarNotificaciones();
  }, [cargarNotificaciones, pathname]);

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

  const campana = (abrirHaciaArriba: boolean) =>
    usuarioActual?.notificaciones_activas ? (
      <NotificationBell
        eventos={notificaciones}
        onMarcarLeida={marcarLeida}
        onMarcarTodas={marcarTodas}
        abrirHaciaArriba={abrirHaciaArriba}
      />
    ) : null;

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar plegada={plegada} onAlternar={alternarSidebar} campana={campana(true)} />
      <MobileTopBar campana={campana(false)} />

      <div className={`transition-[padding] duration-200 ${plegada ? "md:pl-[60px]" : "md:pl-60"}`}>
        <main className="pb-28 md:pb-12">{children}</main>
      </div>

      <MobileTabBar />
      <CommandPalette />
      <AltaRapidaModal />
      <Toast />
    </div>
  );
}

function Toast() {
  const { aviso } = useApp();
  if (!aviso) return null;
  return (
    <div
      key={aviso.id}
      role="status"
      className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] left-1/2 z-[60] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg md:bottom-6 ${
        aviso.tono === "error" ? "bg-red-600 text-white" : "bg-ink text-canvas"
      }`}
    >
      <span className="truncate">{aviso.texto}</span>
      {aviso.enlace ? (
        <Link href={aviso.enlace.href} className="shrink-0 font-semibold text-brand underline-offset-2 hover:underline">
          {aviso.enlace.texto}
        </Link>
      ) : null}
    </div>
  );
}
