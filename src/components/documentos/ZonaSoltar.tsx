"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Zona donde se pueden soltar archivos (solo en su área, no en toda la app).
 * Muestra una capa discreta mientras se arrastra un archivo encima.
 */
export function ZonaSoltar({
  onArchivos,
  texto = "Suelta el archivo para subirlo",
  desactivada = false,
  className = "",
  children,
}: {
  onArchivos: (archivos: File[]) => void;
  texto?: string;
  desactivada?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [encima, setEncima] = useState(false);
  // Contador: dragenter/dragleave se disparan también al pasar por los hijos.
  const profundidad = useRef(0);
  const conArchivos = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  if (desactivada) return <div className={className}>{children}</div>;
  return (
    <div
      className={`relative ${className}`}
      onDragEnter={(e) => {
        if (!conArchivos(e)) return;
        e.preventDefault();
        profundidad.current += 1;
        setEncima(true);
      }}
      onDragOver={(e) => {
        if (!conArchivos(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!conArchivos(e)) return;
        profundidad.current = Math.max(profundidad.current - 1, 0);
        if (profundidad.current === 0) setEncima(false);
      }}
      onDrop={(e) => {
        if (!conArchivos(e)) return;
        e.preventDefault();
        profundidad.current = 0;
        setEncima(false);
        const archivos = Array.from(e.dataTransfer.files ?? []);
        if (archivos.length) onArchivos(archivos);
      }}
      data-testid="zona-soltar"
    >
      {children}
      {encima ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-ink/40 bg-surface/85 backdrop-blur-[1px]">
          <span className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-canvas">{texto}</span>
        </div>
      ) : null}
    </div>
  );
}
