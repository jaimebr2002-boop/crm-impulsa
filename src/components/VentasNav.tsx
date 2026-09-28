"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/leads", label: "Leads" },
  { href: "/hoy", label: "Seguimientos" },
  { href: "/importar", label: "Importar" },
];

/** Sub-navegación del módulo Ventas (CRM): Leads · Seguimientos · Importar. */
export function VentasNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-5 flex gap-1 border-b border-line" aria-label="Ventas">
      {SECCIONES.map((s) => {
        const activo = pathname === s.href || (s.href === "/leads" && pathname?.startsWith("/leads/"));
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              activo ? "border-brand text-ink" : "border-transparent text-ink3 hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
