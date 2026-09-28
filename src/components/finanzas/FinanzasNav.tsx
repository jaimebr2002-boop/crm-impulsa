"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECCIONES = [
  { href: "/finanzas", label: "Resumen", exacta: true },
  { href: "/finanzas/facturas", label: "Facturas" },
  { href: "/finanzas/gastos", label: "Gastos" },
  { href: "/finanzas/suscripciones", label: "Suscripciones" },
];

/** Finanzas es una sola entrada de navegación; sus secciones van en pestañas. */
export function FinanzasNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0" aria-label="Finanzas">
      {SECCIONES.map((s) => {
        const activo = s.exacta ? pathname === s.href : pathname === s.href || pathname.startsWith(s.href + "/");
        return (
          <Link
            key={s.href}
            href={s.href}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
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
