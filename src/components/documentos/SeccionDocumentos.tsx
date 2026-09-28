"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import type { CategoriaDocumento, DocumentoContexto, RelacionDocumento } from "@/lib/types";
import { SkeletonLineas } from "../ui/Skeleton";
import { IconMas } from "../Icons";
import { TablaDocumentos } from "./TablaDocumentos";
import { ZonaSoltar } from "./ZonaSoltar";

export type FiltroSeccion = { id: string; label: string; aplica: (d: DocumentoContexto) => boolean };

/**
 * Documentos de un contexto (proyecto, cuenta, factura…): filtros rápidos,
 * subir (botón o soltar sobre la lista) y la tabla compacta.
 */
export function SeccionDocumentos({
  cargar,
  relacion,
  categoriaInicial,
  filtros,
  textoBoton = "Subir archivo",
  vacio,
  compacta = false,
}: {
  cargar: () => Promise<DocumentoContexto[]>;
  /** Relación con la que se suben los nuevos archivos. */
  relacion: RelacionDocumento;
  categoriaInicial?: CategoriaDocumento;
  filtros?: FiltroSeccion[];
  textoBoton?: string;
  vacio?: string;
  /** Sin borde propio (dentro de un Panel). */
  compacta?: boolean;
}) {
  const { abrirAlta, versionDatos, avisar } = useApp();
  const [docs, setDocs] = useState<DocumentoContexto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("todos");

  const recargar = useCallback(async () => {
    try {
      setDocs(await cargar());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar los documentos.");
    }
  }, [cargar]);

  useEffect(() => {
    recargar();
  }, [recargar, versionDatos]);

  const subir = (archivos?: File[]) => {
    if (archivos && archivos.length > 1) avisar("Se sube un archivo cada vez: abro el primero.");
    abrirAlta({ tipo: "documento", relacion, relacionFija: true, categoria: categoriaInicial, archivo: archivos?.[0] });
  };

  const activo = filtros?.find((f) => f.id === filtro);
  const visibles = (docs ?? []).filter((d) => !activo || activo.aplica(d));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {filtros?.length ? (
          <div className="-mx-1 flex flex-wrap gap-1 text-xs">
            {[{ id: "todos", label: "Todos", aplica: () => true } as FiltroSeccion, ...filtros].map((f) => {
              const n = (docs ?? []).filter(f.aplica).length;
              return (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={`rounded-md px-2 py-1 font-medium ${filtro === f.id ? "bg-mute text-ink" : "text-ink3 hover:text-ink"}`}
                >
                  {f.label}
                  {n ? <span className="ml-1 text-ink3">{n}</span> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <span />
        )}
        <button onClick={() => subir()} className="btn-secondary py-1.5 text-sm">
          <IconMas className="h-4 w-4" />
          {textoBoton}
        </button>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      {!docs && !error ? <SkeletonLineas filas={3} alto="h-10" /> : null}
      {docs ? (
        <ZonaSoltar onArchivos={subir}>
          <div className={compacta ? "" : "overflow-hidden rounded-xl border border-line bg-surface"}>
            <TablaDocumentos
              documentos={visibles}
              onCambio={recargar}
              siempreLista={compacta}
              vacio={
                <button onClick={() => subir()} className="w-full px-4 py-8 text-center text-sm text-ink3 hover:text-ink">
                  {activo ? "Nada en esta categoría." : vacio ?? "Sin archivos todavía."} Arrastra un archivo aquí o pulsa para subirlo.
                </button>
              }
            />
          </div>
        </ZonaSoltar>
      ) : null}
    </div>
  );
}
