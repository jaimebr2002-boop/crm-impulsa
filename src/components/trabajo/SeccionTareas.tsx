"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useAccionesTareas } from "@/lib/useAccionesTareas";
import { PRIORIDAD_ORDEN } from "@/lib/trabajo";
import type { TareaConRelaciones } from "@/lib/types";
import { TareaFila } from "./TareaFila";
import { TareaEditarModal } from "./TareaEditarModal";

/** Tareas abiertas (y completadas plegadas) de un ámbito: cuenta, marca… */
export function SeccionTareas({
  tareas,
  setTareas,
  mostrarProyecto = true,
  vacio = "Sin tareas abiertas.",
}: {
  tareas: TareaConRelaciones[];
  setTareas: Dispatch<SetStateAction<TareaConRelaciones[]>>;
  mostrarProyecto?: boolean;
  vacio?: string;
}) {
  const acciones = useAccionesTareas(setTareas);
  const [editando, setEditando] = useState<TareaConRelaciones | null>(null);
  const orden = (a: TareaConRelaciones, b: TareaConRelaciones) =>
    (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999") || PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad];
  const abiertas = tareas.filter((t) => t.estado !== "completada").sort(orden);
  const hechas = tareas.filter((t) => t.estado === "completada");

  const fila = (t: TareaConRelaciones) => (
    <TareaFila key={t.id} tarea={t} onToggle={acciones.alternar} onAbrir={setEditando} mostrarProyecto={mostrarProyecto} />
  );

  return (
    <div className="flex flex-col gap-4">
      {abiertas.length ? (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{abiertas.map(fila)}</div>
      ) : (
        <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink3">{vacio}</p>
      )}
      {hechas.length ? (
        <details>
          <summary className="cursor-pointer list-none text-xs font-medium text-ink3 hover:text-ink">
            Completadas recientemente ({hechas.length})
          </summary>
          <div className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{hechas.map(fila)}</div>
        </details>
      ) : null}
      {editando ? (
        <TareaEditarModal
          tarea={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={acciones.actualizar}
          onEliminar={acciones.eliminar}
        />
      ) : null}
    </div>
  );
}
