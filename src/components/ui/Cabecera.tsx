import type { ReactNode } from "react";

/** Cabecera estándar de página: título, subtítulo y acciones a la derecha. */
export function Cabecera({
  titulo,
  subtitulo,
  acciones,
  antes,
}: {
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acciones?: ReactNode;
  antes?: ReactNode;
}) {
  return (
    <div className="mb-5">
      {antes}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{titulo}</h1>
          {subtitulo ? <p className="mt-0.5 text-sm text-ink2">{subtitulo}</p> : null}
        </div>
        {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
      </div>
    </div>
  );
}

/** Control segmentado (Lista | Tablero, pestañas de filtros…). */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { id: T; label: ReactNode }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-sm">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
            valor === o.id ? "bg-mute text-ink" : "text-ink3 hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
