import type { ReactNode } from "react";

/** Estado vacío: mensaje + (si procede) la acción que lo resuelve. */
export function EmptyState({
  titulo,
  descripcion,
  accion,
  compacto = false,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  /** Dentro de un panel: sin borde propio y con menos aire. */
  compacto?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compacto ? "px-4 py-8" : "rounded-xl border border-dashed border-line bg-surface px-6 py-12"
      }`}
    >
      <p className="text-sm font-medium text-ink">{titulo}</p>
      {descripcion ? <p className="mt-1 max-w-sm text-sm text-ink3">{descripcion}</p> : null}
      {accion ? <div className="mt-4">{accion}</div> : null}
    </div>
  );
}
