"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUsuario } from "@/context/UsuarioContext";
import { listarEventosPorRango, marcarEventoCompletado } from "@/lib/data/eventos";
import { listarUsuarios } from "@/lib/data/usuarios";
import { addDias, inicioSemana } from "@/lib/dates";
import type { EventoConLead, Usuario } from "@/lib/types";
import { CalendarViewMes, CalendarViewSemana } from "@/components/CalendarView";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { IconChevron } from "@/components/Icons";

export default function CalendarioPage() {
  const { usuarioActual, esAdmin, cargando: cargandoUsuario } = useUsuario();
  const [vista, setVista] = useState<"mes" | "semana">("mes");
  const [fechaReferencia, setFechaReferencia] = useState(new Date());
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("todos");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [eventos, setEventos] = useState<EventoConLead[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  const usuarioIdParaFiltro = useMemo(() => {
    if (!usuarioActual) return undefined;
    if (!esAdmin) return usuarioActual.id;
    return filtroUsuarioId === "todos" ? undefined : filtroUsuarioId;
  }, [usuarioActual, esAdmin, filtroUsuarioId]);

  const rango = useMemo(() => {
    if (vista === "semana") {
      const inicio = inicioSemana(fechaReferencia);
      return { desde: inicio, hasta: addDias(inicio, 7) };
    }
    const inicioMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
    const inicioGrid = inicioSemana(inicioMes);
    return { desde: inicioGrid, hasta: addDias(inicioGrid, 42) };
  }, [vista, fechaReferencia]);

  const cargar = useCallback(async () => {
    if (!usuarioActual) return;
    setCargando(true);
    setError(null);
    try {
      const data = await listarEventosPorRango(rango.desde.toISOString(), rango.hasta.toISOString(), usuarioIdParaFiltro);
      setEventos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cargar el calendario.");
    } finally {
      setCargando(false);
    }
  }, [usuarioActual, rango, usuarioIdParaFiltro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function toggle(id: string, completada: boolean) {
    const actualizado = await marcarEventoCompletado(id, completada);
    setEventos((prev) => prev.map((e) => (e.id === id ? { ...e, ...actualizado } : e)));
  }

  function navegar(direccion: -1 | 1) {
    setFechaReferencia((f) => (vista === "semana" ? addDias(f, 7 * direccion) : new Date(f.getFullYear(), f.getMonth() + direccion, 1)));
  }

  if (cargandoUsuario || !usuarioActual) return <LoadingState />;

  const etiquetaPeriodo =
    vista === "semana"
      ? `Semana del ${new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(inicioSemana(fechaReferencia))}`
      : new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(fechaReferencia);

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 md:px-8">
      <h1 className="text-2xl font-semibold text-ink">Calendario</h1>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => navegar(-1)} className="rounded-full p-2 text-ink2 hover:bg-mute">
            <IconChevron className="h-5 w-5 rotate-180" />
          </button>
          <span className="min-w-[9rem] text-center text-sm font-medium capitalize text-ink">{etiquetaPeriodo}</span>
          <button onClick={() => navegar(1)} className="rounded-full p-2 text-ink2 hover:bg-mute">
            <IconChevron className="h-5 w-5" />
          </button>
        </div>

        <div className="flex rounded-xl bg-mute p-1">
          <button
            onClick={() => setVista("mes")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${vista === "mes" ? "bg-surface text-ink shadow-card" : "text-ink2"}`}
          >
            Mes
          </button>
          <button
            onClick={() => setVista("semana")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${vista === "semana" ? "bg-surface text-ink shadow-card" : "text-ink2"}`}
          >
            Semana
          </button>
        </div>
      </div>

      {esAdmin ? (
        <div className="mt-4 flex gap-2 overflow-x-auto">
          {[{ id: "todos", nombre: "Todos" }, ...usuarios].map((u) => (
            <button
              key={u.id}
              onClick={() => setFiltroUsuarioId(u.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                filtroUsuarioId === u.id ? "bg-brand text-white" : "border border-line bg-surface text-ink2"
              }`}
            >
              {u.nombre}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        {cargando ? <LoadingState texto="Cargando calendario…" /> : null}
        {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
        {!cargando && !error && vista === "mes" ? (
          <CalendarViewMes fechaReferencia={fechaReferencia} eventos={eventos} onToggleCompletada={toggle} />
        ) : null}
        {!cargando && !error && vista === "semana" ? (
          <CalendarViewSemana fechaReferencia={fechaReferencia} eventos={eventos} onToggleCompletada={toggle} />
        ) : null}
      </div>
    </div>
  );
}
