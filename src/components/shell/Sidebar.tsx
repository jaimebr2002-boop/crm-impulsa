"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { esActivo, gruposVisibles, rutaInicio } from "@/lib/navegacion";
import { Avatar } from "../Avatar";
import { Logo } from "../Logo";
import { ThemeToggle } from "../ThemeToggle";
import { IconBuscar, IconMas, IconPanelLateral } from "../Icons";
import { ListaOpcionesAnadir } from "./OpcionesAnadir";

export function Sidebar({
  plegada,
  onAlternar,
  campana,
}: {
  plegada: boolean;
  onAlternar: () => void;
  campana: ReactNode;
}) {
  const pathname = usePathname();
  const { usuarioActual, esAdmin } = useUsuario();
  const { setPaletaAbierta } = useApp();
  const [anadirAbierto, setAnadirAbierto] = useState(false);
  const anadirRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anadirAbierto) return;
    function fuera(e: MouseEvent) {
      if (anadirRef.current && !anadirRef.current.contains(e.target as Node)) setAnadirAbierto(false);
    }
    function esc(e: KeyboardEvent) {
      if (e.key === "Escape") setAnadirAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [anadirAbierto]);

  if (!usuarioActual) return null;

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 md:flex ${
        plegada ? "w-[60px]" : "w-60"
      }`}
    >
      {/* Marca + plegar */}
      <div className={`flex h-14 items-center gap-2 px-3 ${plegada ? "justify-center" : "justify-between"}`}>
        {!plegada ? (
          <Link href={rutaInicio(esAdmin)} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1">
            <Logo size={22} />
            <span className="truncate font-display text-[15px] font-bold tracking-tight text-ink">Impulsa</span>
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onAlternar}
          title={plegada ? "Expandir barra lateral" : "Plegar barra lateral"}
          aria-label={plegada ? "Expandir barra lateral" : "Plegar barra lateral"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink3 hover:bg-mute hover:text-ink"
        >
          <IconPanelLateral className="h-4 w-4" />
        </button>
      </div>

      {/* Buscar + Añadir */}
      <div className={`flex flex-col gap-1.5 px-2.5 pb-3 ${plegada ? "items-center" : ""}`}>
        <button
          type="button"
          onClick={() => setPaletaAbierta(true)}
          title="Buscar (⌘K)"
          className={`flex h-8 items-center gap-2 rounded-lg border border-line bg-canvas text-sm text-ink3 hover:text-ink ${
            plegada ? "w-9 justify-center" : "px-2.5"
          }`}
        >
          <IconBuscar className="h-3.5 w-3.5 shrink-0" />
          {!plegada ? (
            <>
              <span className="flex-1 text-left">Buscar…</span>
              <span className="kbd">⌘K</span>
            </>
          ) : null}
        </button>

        <div ref={anadirRef} className="relative">
          <button
            type="button"
            onClick={() => setAnadirAbierto((v) => !v)}
            title="Añadir"
            aria-expanded={anadirAbierto}
            className={`flex h-8 items-center gap-1.5 rounded-lg bg-brand text-sm font-semibold text-brand-ink hover:bg-[#9BEF00] ${
              plegada ? "w-9 justify-center" : "w-full px-2.5"
            }`}
          >
            <IconMas className="h-4 w-4" />
            {!plegada ? "Añadir" : null}
          </button>
          {anadirAbierto ? (
            <div className="absolute left-0 top-10 z-50 w-48 rounded-xl border border-line bg-surface shadow-glass dark:shadow-glass-dark">
              <ListaOpcionesAnadir onElegir={() => setAnadirAbierto(false)} />
            </div>
          ) : null}
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-2.5 pb-4">
        {gruposVisibles(esAdmin).map((grupo, i) => (
          <div key={grupo.titulo ?? i} className="mb-3">
            {grupo.titulo && !plegada ? (
              <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-ink3">{grupo.titulo}</p>
            ) : grupo.titulo && plegada ? (
              <div className="mx-auto mb-2 mt-1 h-px w-6 bg-line" />
            ) : null}
            <ul className="flex flex-col gap-px">
              {grupo.items.map((item) => {
                const activo = esActivo(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={plegada ? item.label : undefined}
                      className={`group relative flex h-8 items-center gap-2.5 rounded-lg text-sm transition-colors ${
                        plegada ? "justify-center" : "px-2"
                      } ${activo ? "bg-mute font-medium text-ink" : "text-ink2 hover:bg-mute/70 hover:text-ink"}`}
                    >
                      {activo ? <span className="absolute -left-2.5 top-1.5 h-5 w-[3px] rounded-r bg-brand" /> : null}
                      <Icon className={`h-4 w-4 shrink-0 ${activo ? "text-ink" : "text-ink3 group-hover:text-ink2"}`} />
                      {!plegada ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Pie: notificaciones, tema, usuario */}
      <div className={`flex border-t border-line p-2.5 ${plegada ? "flex-col items-center gap-1" : "items-center gap-1"}`}>
        <Link
          href="/perfil"
          title={usuarioActual.nombre}
          className={`flex min-w-0 items-center gap-2 rounded-lg p-1 hover:bg-mute ${plegada ? "" : "flex-1"}`}
        >
          <Avatar nombre={usuarioActual.nombre} size="sm" />
          {!plegada ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium leading-tight text-ink">{usuarioActual.nombre}</span>
              <span className="block text-[11px] leading-tight text-ink3">{esAdmin ? "Admin" : "Comercial"}</span>
            </span>
          ) : null}
        </Link>
        {campana}
        <ThemeToggle />
      </div>
    </aside>
  );
}
