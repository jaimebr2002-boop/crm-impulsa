"use client";

import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { ESTADO_LABEL } from "@/lib/constants";
import { formatHaceCuanto } from "@/lib/dates";
import { ESTADO_PROYECTO_LABEL, ESTADO_TAREA_LABEL } from "@/lib/trabajo";
import type { Actividad, EstadoProyecto, EstadoTarea } from "@/lib/types";

type Frase = { verbo: string; objeto: string; href: string | null; punto: string };

function describir(a: Actividad): Frase {
  const nombre = a.titulo ? `«${a.titulo}»` : "";
  const hacia = typeof a.datos?.a === "string" ? (a.datos.a as string) : "";
  const proyectoId = typeof a.datos?.proyecto_id === "string" ? (a.datos.proyecto_id as string) : null;

  if (a.entidad === "proyecto") {
    const href = a.accion === "eliminado" ? null : `/proyectos/${a.entidad_id}`;
    switch (a.accion) {
      case "creado":
        return { verbo: "creó el proyecto", objeto: nombre, href, punto: "bg-brand" };
      case "estado":
        return {
          verbo: hacia === "entregado" ? "entregó" : `movió a ${ESTADO_PROYECTO_LABEL[hacia as EstadoProyecto] ?? hacia}`,
          objeto: nombre,
          href,
          punto: hacia === "entregado" ? "bg-emerald-500" : "bg-blue-500",
        };
      case "archivado":
        return { verbo: "archivó el proyecto", objeto: nombre, href, punto: "bg-ink3" };
      case "restaurado":
        return { verbo: "restauró el proyecto", objeto: nombre, href, punto: "bg-ink3" };
      case "eliminado":
        return { verbo: "eliminó el proyecto", objeto: nombre, href, punto: "bg-red-500" };
    }
  }

  if (a.entidad === "tarea") {
    const href = proyectoId ? `/proyectos/${proyectoId}?tab=tareas` : "/tareas";
    if (a.accion === "creado") return { verbo: "añadió la tarea", objeto: nombre, href, punto: "bg-ink3" };
    if (a.accion === "completada") return { verbo: "completó", objeto: nombre, href, punto: "bg-emerald-500" };
    return {
      verbo: `movió a ${ESTADO_TAREA_LABEL[hacia as EstadoTarea] ?? hacia}`,
      objeto: nombre,
      href,
      punto: "bg-blue-500",
    };
  }

  if (a.entidad === "lead") {
    const href = `/leads/${a.entidad_id}`;
    if (hacia === "cerrado") return { verbo: "ganó el lead", objeto: nombre, href, punto: "bg-emerald-500" };
    if (hacia === "descartado") return { verbo: "perdió el lead", objeto: nombre, href, punto: "bg-red-400" };
    return { verbo: `movió el lead a ${ESTADO_LABEL[hacia] ?? hacia}`, objeto: nombre, href, punto: "bg-sky-500" };
  }

  return { verbo: a.accion, objeto: nombre, href: null, punto: "bg-ink3" };
}

export function ActividadLista({ items, vacio = "Sin actividad todavía." }: { items: Actividad[]; vacio?: string }) {
  const { usuariosPorId } = useApp();

  if (items.length === 0) return <p className="px-1 py-6 text-center text-sm text-ink3">{vacio}</p>;

  return (
    <ol className="flex flex-col">
      {items.map((a) => {
        const f = describir(a);
        const actor = a.actor_id ? usuariosPorId[a.actor_id]?.nombre ?? "Alguien" : "Sistema";
        return (
          <li key={a.id} className="flex items-start gap-3 py-2">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${f.punto}`} />
            <p className="min-w-0 flex-1 text-sm leading-snug text-ink2">
              <span className="font-medium text-ink">{actor}</span> {f.verbo}{" "}
              {f.href ? (
                <Link href={f.href} className="text-ink hover:underline">
                  {f.objeto}
                </Link>
              ) : (
                <span className="text-ink">{f.objeto}</span>
              )}
            </p>
            <time className="shrink-0 pt-px text-xs text-ink3" dateTime={a.created_at}>
              {formatHaceCuanto(a.created_at)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}
