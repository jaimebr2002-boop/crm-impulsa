"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUsuario } from "@/context/UsuarioContext";
import { listarEventosDeHoy, listarEventosVencidos, marcarEventoCompletado } from "@/lib/data/eventos";
import { listarUsuarios } from "@/lib/data/usuarios";
import { startOfDay, endOfDay } from "@/lib/dates";
import type { EventoConLead, Usuario } from "@/lib/types";
import { EventCard } from "@/components/EventCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { IconAlerta, IconCalendario, IconLeads } from "@/components/Icons";

export default function HoyPage() {
  const { usuarioActual, esJaime, cargando: cargandoUsuario } = useUsuario();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<string>("todos");
  const [vencidos, setVencidos] = useState<EventoConLead[]>([]);
  const [deHoy, setDeHoy] = useState<EventoConLead[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  const usuarioIdParaFiltro = useMemo(() => {
    if (!usuarioActual) return undefined;
    if (!esJaime) return usuarioActual.id;
    return filtroUsuarioId === "todos" ? undefined : filtroUsuarioId;
  }, [usuarioActual, esJaime, filtroUsuarioId]);

  const cargar = useCallback(async () => {
    if (!usuarioActual) return;
    setCargando(true);
    setError(null);
    try {
      const ahora = new Date();
      const [v, h] = await Promise.all([
        listarEventosVencidos(startOfDay(ahora).toISOString(), usuarioIdParaFiltro),
        listarEventosDeHoy(startOfDay(ahora).toISOString(), endOfDay(ahora).toISOString(), usuarioIdParaFiltro),
      ]);
      setVencidos(v);
      setDeHoy(h);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cargar la vista de hoy.");
    } finally {
      setCargando(false);
    }
  }, [usuarioActual, usuarioIdParaFiltro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function toggle(id: string, completada: boolean) {
    const actualizado = await marcarEventoCompletado(id, completada);
    // Un evento vencido que se completa deja de ser "vencido" (esa lista solo contiene pendientes).
    setVencidos((prev) => (completada ? prev.filter((e) => e.id !== id) : prev.map((e) => (e.id === id ? { ...e, ...actualizado } : e))));
    setDeHoy((prev) => prev.map((e) => (e.id === id ? { ...e, ...actualizado } : e)));
  }

  if (cargandoUsuario || !usuarioActual) return <LoadingState />;

  const pendientesHoy = deHoy.filter((e) => !e.completada);
  const completadosHoy = deHoy.filter((e) => e.completada);
  const leadsQueRequierenAtencion = new Set(
    [...vencidos, ...pendientesHoy].map((e) => e.lead?.id).filter(Boolean)
  ).size;

  return (
    <div className="mx-auto max-w-2xl px-4 pt-6 md:px-8">
      <h1 className="text-2xl font-semibold text-slate-900">Hoy</h1>
      <p className="mt-0.5 text-sm text-slate-500">
        {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      </p>

      {esJaime ? (
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {[{ id: "todos", nombre: "Todos" }, ...usuarios].map((u) => (
            <button
              key={u.id}
              onClick={() => setFiltroUsuarioId(u.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                filtroUsuarioId === u.id ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {u.nombre}
            </button>
          ))}
        </div>
      ) : null}

      {!cargando && !error ? (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Metrica valor={pendientesHoy.length + vencidos.length} etiqueta="Seguimientos pendientes" tono="brand" icono={IconCalendario} />
          <Metrica
            valor={vencidos.length}
            etiqueta="Eventos vencidos"
            tono={vencidos.length > 0 ? "alerta" : "neutro"}
            icono={IconAlerta}
          />
          <Metrica valor={leadsQueRequierenAtencion} etiqueta="Leads a atender" tono="info" icono={IconLeads} />
        </div>
      ) : null}

      {cargando ? <div className="mt-8"><LoadingState texto="Cargando tu día…" /></div> : null}
      {error ? <div className="mt-8"><ErrorState mensaje={error} onReintentar={cargar} /></div> : null}

      {!cargando && !error ? (
        <div className="mt-6 flex flex-col gap-8 pb-10">
          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Vencidos</h2>
            {vencidos.length === 0 ? (
              <EmptyState titulo="Sin eventos vencidos" />
            ) : (
              <div className="flex flex-col gap-2">
                {vencidos.map((e) => (
                  <EventCard key={e.id} evento={e} mostrarLead onToggleCompletada={toggle} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-slate-900">Hoy</h2>
            {pendientesHoy.length === 0 && completadosHoy.length === 0 ? (
              <EmptyState titulo="No tienes eventos hoy" />
            ) : (
              <div className="flex flex-col gap-2">
                {pendientesHoy.map((e) => (
                  <EventCard key={e.id} evento={e} mostrarLead onToggleCompletada={toggle} />
                ))}
                {completadosHoy.map((e) => (
                  <EventCard key={e.id} evento={e} mostrarLead onToggleCompletada={toggle} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

const TONOS = {
  brand: { fondo: "bg-brand-light", texto: "text-brand-dark", icono: "text-brand-dark" },
  info: { fondo: "bg-sky-50", texto: "text-sky-900", icono: "text-sky-600" },
  alerta: { fondo: "bg-red-50", texto: "text-red-700", icono: "text-red-600" },
  neutro: { fondo: "bg-slate-50", texto: "text-slate-900", icono: "text-slate-400" },
} as const;

function Metrica({
  valor,
  etiqueta,
  tono,
  icono: Icono,
}: {
  valor: number;
  etiqueta: string;
  tono: keyof typeof TONOS;
  icono: (props: { className?: string }) => React.ReactNode;
}) {
  const estilo = TONOS[tono];
  return (
    <div className={`rounded-2xl border border-transparent p-3.5 ${estilo.fondo}`}>
      <Icono className={`h-4 w-4 ${estilo.icono}`} />
      <p className={`mt-2 text-2xl font-semibold ${estilo.texto}`}>{valor}</p>
      <p className={`mt-0.5 text-[11px] leading-tight ${estilo.texto} opacity-70`}>{etiqueta}</p>
    </div>
  );
}
