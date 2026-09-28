"use client";

import { IconBuscar } from "../Icons";

/** Búsqueda de las barras de herramientas: misma altura que botones y selects. */
export function CampoBusqueda({
  valor,
  onChange,
  placeholder = "Buscar…",
  etiqueta,
  className = "",
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  etiqueta?: string;
  className?: string;
}) {
  return (
    <label className={`flex min-h-[2.25rem] min-w-0 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 focus-within:border-ink/40 focus-within:ring-2 focus-within:ring-brand/40 ${className}`}>
      <IconBuscar className="h-3.5 w-3.5 shrink-0 text-ink3" />
      <input
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta ?? placeholder}
        className="w-full min-w-0 bg-transparent py-1.5 text-base outline-none placeholder:text-ink3 focus-visible:outline-none md:text-sm"
      />
      {valor ? (
        <button type="button" onClick={() => onChange("")} aria-label="Borrar búsqueda" className="shrink-0 rounded px-1 text-ink3 hover:text-ink">
          ×
        </button>
      ) : null}
    </label>
  );
}

/** Select compacto de barra de herramientas. */
export const SELECT_TOOLBAR = "min-h-[2.25rem] rounded-lg border border-line bg-surface px-2.5 py-1.5 text-base text-ink md:text-sm";
