import type { ReactNode } from "react";
import {
  IconAjustes,
  IconAnalitica,
  IconCalendario,
  IconImportar,
  IconInicio,
  IconLeads,
  IconProyectos,
  IconSeguimientos,
  IconTareas,
} from "@/components/Icons";

export type ItemNav = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => ReactNode;
  soloAdmin?: boolean;
  /** Rutas adicionales que marcan este elemento como activo. */
  activoEn?: string[];
};

export type GrupoNav = { titulo: string | null; items: ItemNav[] };

// Solo se listan módulos ya construidos. Finanzas, Gastos y Documentos se
// añadirán aquí cuando existan (Fases 3 y 4).
export const GRUPOS_NAV: GrupoNav[] = [
  { titulo: null, items: [{ href: "/inicio", label: "Inicio", icon: IconInicio, soloAdmin: true }] },
  {
    titulo: "Trabajo",
    items: [
      { href: "/proyectos", label: "Proyectos", icon: IconProyectos, soloAdmin: true },
      { href: "/tareas", label: "Tareas", icon: IconTareas },
      { href: "/calendario", label: "Calendario", icon: IconCalendario },
    ],
  },
  {
    titulo: "Ventas",
    items: [
      { href: "/leads", label: "Leads", icon: IconLeads },
      { href: "/hoy", label: "Seguimientos", icon: IconSeguimientos },
      { href: "/importar", label: "Importar", icon: IconImportar },
    ],
  },
  {
    titulo: "Información",
    items: [{ href: "/analitica", label: "Analítica", icon: IconAnalitica }],
  },
  {
    titulo: "Sistema",
    items: [{ href: "/perfil", label: "Configuración", icon: IconAjustes }],
  },
];

export function gruposVisibles(esAdmin: boolean): GrupoNav[] {
  return GRUPOS_NAV.map((g) => ({ ...g, items: g.items.filter((i) => esAdmin || !i.soloAdmin) })).filter(
    (g) => g.items.length > 0
  );
}

export function esActivo(pathname: string | null, item: ItemNav): boolean {
  if (!pathname) return false;
  const rutas = [item.href, ...(item.activoEn ?? [])];
  return rutas.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

/** Pantalla de inicio según rol: el Company OS para admin, el CRM para comerciales. */
export function rutaInicio(esAdmin: boolean): string {
  return esAdmin ? "/inicio" : "/hoy";
}
