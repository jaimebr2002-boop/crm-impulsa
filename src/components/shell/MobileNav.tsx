"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { esActivo, gruposVisibles, rutaInicio, type ItemNav } from "@/lib/navegacion";
import { Avatar } from "../Avatar";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import {
  IconBuscar,
  IconCalendario,
  IconInicio,
  IconLeads,
  IconMas,
  IconMenu,
  IconProyectos,
  IconSeguimientos,
  IconTareas,
} from "../Icons";
import { ListaOpcionesAnadir } from "./OpcionesAnadir";

// Cuatro destinos fijos + botón central. El resto vive en "Menú".
const TABS_ADMIN: ItemNav[] = [
  { href: "/inicio", label: "Inicio", icon: IconInicio },
  { href: "/tareas", label: "Tareas", icon: IconTareas },
  { href: "/proyectos", label: "Proyectos", icon: IconProyectos },
];
const TABS_COMERCIAL: ItemNav[] = [
  { href: "/hoy", label: "Hoy", icon: IconSeguimientos },
  { href: "/leads", label: "Leads", icon: IconLeads },
  { href: "/calendario", label: "Calendario", icon: IconCalendario },
];

export function MobileTopBar({ campana }: { campana: ReactNode }) {
  const { usuarioActual, esAdmin } = useUsuario();
  const { setPaletaAbierta } = useApp();
  if (!usuarioActual) return null;
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-canvas/90 px-3 backdrop-blur md:hidden">
      <Link href={rutaInicio(esAdmin)} className="flex items-center gap-2">
        <Logo size={22} />
        <span className="font-display text-[15px] font-bold tracking-tight text-ink">Impulsa</span>
      </Link>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => setPaletaAbierta(true)}
          aria-label="Buscar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink2 hover:bg-mute"
        >
          <IconBuscar className="h-4 w-4" />
        </button>
        {campana}
        <Link href="/perfil" aria-label="Configuración" className="ml-1">
          <Avatar nombre={usuarioActual.nombre} size="sm" />
        </Link>
      </div>
    </header>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  const { esAdmin } = useUsuario();
  const [hoja, setHoja] = useState<"menu" | "anadir" | null>(null);

  useEffect(() => setHoja(null), [pathname]);

  const tabs = esAdmin ? TABS_ADMIN : TABS_COMERCIAL;
  const [primera, segunda, tercera] = tabs;

  return (
    <>
      <nav
        className="glass-strong fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] z-30 flex items-center justify-around rounded-2xl px-1 py-1.5 shadow-glass dark:shadow-glass-dark md:hidden"
        aria-label="Navegación principal"
      >
        <Tab item={primera} activo={esActivo(pathname, primera)} />
        <Tab item={segunda} activo={esActivo(pathname, segunda)} />
        <button
          type="button"
          onClick={() => setHoja("anadir")}
          aria-label="Añadir"
          className="flex flex-1 justify-center"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-ink shadow-md shadow-brand/30">
            <IconMas className="h-5 w-5" />
          </span>
        </button>
        <Tab item={tercera} activo={esActivo(pathname, tercera)} />
        <button
          type="button"
          onClick={() => setHoja("menu")}
          className="flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] text-ink3"
        >
          <IconMenu className="h-5 w-5" />
          Menú
        </button>
      </nav>

      {hoja ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 md:hidden" onClick={() => setHoja(null)}>
          <div
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-line" />
            {hoja === "anadir" ? (
              <>
                <p className="px-2.5 pb-1 text-xs font-medium uppercase tracking-wider text-ink3">Añadir</p>
                <ListaOpcionesAnadir onElegir={() => setHoja(null)} />
              </>
            ) : (
              <MenuCompleto esAdmin={esAdmin} pathname={pathname} />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Tab({ item, activo }: { item: ItemNav; activo: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-[10px] ${activo ? "font-medium text-ink" : "text-ink3"}`}
    >
      <Icon className={`h-5 w-5 ${activo ? "text-brand-dark dark:text-brand" : ""}`} />
      {item.label}
    </Link>
  );
}

function MenuCompleto({ esAdmin, pathname }: { esAdmin: boolean; pathname: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      {gruposVisibles(esAdmin).map((grupo, i) => (
        <div key={grupo.titulo ?? i}>
          {grupo.titulo ? (
            <p className="px-2.5 pb-1 text-xs font-medium uppercase tracking-wider text-ink3">{grupo.titulo}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-1">
            {grupo.items.map((item) => {
              const Icon = item.icon;
              const activo = esActivo(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm ${
                    activo ? "bg-mute font-medium text-ink" : "text-ink hover:bg-mute"
                  }`}
                >
                  <Icon className="h-4 w-4 text-ink2" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between border-t border-line px-2.5 pt-3">
        <span className="text-sm text-ink2">Tema</span>
        <ThemeToggle />
      </div>
    </div>
  );
}
