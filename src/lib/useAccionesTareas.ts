"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";
import { useApp } from "@/context/AppContext";
import { actualizarTarea, eliminarTarea } from "@/lib/data/tareas";
import type { TareaConRelaciones, TareaUpdate } from "@/lib/types";

/** Cambios sobre una lista de tareas con UI optimista: se aplica al momento
 * y se revierte con aviso si la base de datos lo rechaza. */
export function useAccionesTareas(setTareas: Dispatch<SetStateAction<TareaConRelaciones[]>>) {
  const { avisar } = useApp();

  const actualizar = useCallback(
    async (t: TareaConRelaciones, cambios: TareaUpdate) => {
      setTareas((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...cambios } : x)));
      try {
        const nueva = await actualizarTarea(t.id, cambios);
        setTareas((prev) => prev.map((x) => (x.id === t.id ? nueva : x)));
        return nueva;
      } catch (e) {
        setTareas((prev) => prev.map((x) => (x.id === t.id ? t : x)));
        avisar(e instanceof Error ? e.message : "No se ha podido guardar la tarea.", { tono: "error" });
        return null;
      }
    },
    [setTareas, avisar]
  );

  const alternar = useCallback(
    (t: TareaConRelaciones) => actualizar(t, { estado: t.estado === "completada" ? "pendiente" : "completada" }),
    [actualizar]
  );

  const eliminar = useCallback(
    async (t: TareaConRelaciones) => {
      setTareas((prev) => prev.filter((x) => x.id !== t.id));
      try {
        await eliminarTarea(t.id);
        avisar("Tarea eliminada");
      } catch (e) {
        setTareas((prev) => [t, ...prev]);
        avisar(e instanceof Error ? e.message : "No se ha podido eliminar la tarea.", { tono: "error" });
      }
    },
    [setTareas, avisar]
  );

  return { actualizar, alternar, eliminar };
}
