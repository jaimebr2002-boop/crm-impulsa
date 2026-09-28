"use client";

import { useCallback, useEffect, useState } from "react";
import { listarActividad, type FiltroActividad } from "@/lib/data/actividad";
import type { Actividad } from "@/lib/types";
import { ActividadLista } from "./ActividadLista";
import { SkeletonLineas } from "../ui/Skeleton";

const PAGINA = 40;

/** Feed de actividad con "Cargar más". `filtro` debe ser estable (useMemo). */
export function ActividadPaginada({
  filtro,
  agruparPorDia = true,
  vacio,
}: {
  filtro: Omit<FiltroActividad, "limite" | "antesDe">;
  agruparPorDia?: boolean;
  vacio?: string;
}) {
  const [items, setItems] = useState<Actividad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    async (antesDe?: string) => {
      setCargando(true);
      setError(null);
      try {
        const nuevos = await listarActividad({ ...filtro, limite: PAGINA, antesDe });
        setItems((prev) => (antesDe ? [...prev, ...nuevos] : nuevos));
        setHayMas(nuevos.length === PAGINA);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se ha podido cargar la actividad.");
      } finally {
        setCargando(false);
      }
    },
    [filtro]
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) return <p className="py-6 text-center text-sm text-red-600">{error}</p>;
  if (cargando && items.length === 0) return <SkeletonLineas filas={5} alto="h-8" />;

  return (
    <div>
      <ActividadLista items={items} agruparPorDia={agruparPorDia} vacio={vacio} />
      {hayMas ? (
        <button
          onClick={() => cargar(items[items.length - 1]?.created_at)}
          disabled={cargando}
          className="btn-ghost mt-2 w-full"
        >
          {cargando ? "Cargando…" : "Cargar más"}
        </button>
      ) : null}
    </div>
  );
}
