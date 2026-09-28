"use client";

import { VentasNav } from "@/components/VentasNav";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUsuario } from "@/context/UsuarioContext";
import { crearEvento, listarEventosDeHoy, listarEventosPorRango, listarEventosVencidos, marcarEventoCompletado } from "@/lib/data/eventos";
import { listarUsuarios } from "@/lib/data/usuarios";
import { obtenerInteraccionesPeriodo, obtenerLeadsActuales, llamadaContestada, contarPor } from "@/lib/data/analitica";
import { startOfDay, endOfDay, addDias } from "@/lib/dates";
import type { EventoConLead, Lead, Usuario } from "@/lib/types";
import { ESTADOS, ESTADO_LABEL, ESTADO_COLOR } from "@/lib/constants";
import { EventCard } from "@/components/EventCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { QuickEventForm } from "@/components/forms/QuickEventForm";
import { IconMas } from "@/components/Icons";
import { Cabecera } from "@/components/ui/Cabecera";
import { SELECT_TOOLBAR } from "@/components/ui/CampoBusqueda";
import { Panel } from "@/components/ui/Panel";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { SkeletonLineas, SkeletonTarjetas } from "@/components/ui/Skeleton";

export default function HoyPage() {
  const { usuarioActual, esAdmin, cargando: cargandoUsuario } = useUsuario();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState<string>("todos");
  const [vencidos, setVencidos] = useState<EventoConLead[]>([]);
  const [deHoy, setDeHoy] = useState<EventoConLead[]>([]);
  const [proximos, setProximos] = useState<EventoConLead[]>([]);
  const [leadsActuales, setLeadsActuales] = useState<Lead[]>([]);
  const [contactadosSemana, setContactadosSemana] = useState(0);
  const [tasaRespuestaSemana, setTasaRespuestaSemana] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nuevoSeguimientoAbierto, setNuevoSeguimientoAbierto] = useState(false);

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  const usuarioIdParaFiltro = useMemo(() => {
    if (!usuarioActual) return undefined;
    if (!esAdmin) return usuarioActual.id;
    return filtroUsuarioId === "todos" ? undefined : filtroUsuarioId;
  }, [usuarioActual, esAdmin, filtroUsuarioId]);

  const cargar = useCallback(async () => {
    if (!usuarioActual) return;
    setCargando(true);
    setError(null);
    try {
      const ahora = new Date();
      const haceUnaSemana = new Date(ahora.getTime() - 7 * 24 * 60 * 60 * 1000);
      const [v, h, p, actuales, interaccionesSemana] = await Promise.all([
        listarEventosVencidos(startOfDay(ahora).toISOString(), usuarioIdParaFiltro),
        listarEventosDeHoy(startOfDay(ahora).toISOString(), endOfDay(ahora).toISOString(), usuarioIdParaFiltro),
        listarEventosPorRango(startOfDay(addDias(ahora, 1)).toISOString(), endOfDay(addDias(ahora, 7)).toISOString(), usuarioIdParaFiltro),
        obtenerLeadsActuales(usuarioIdParaFiltro),
        obtenerInteraccionesPeriodo({
          desdeIso: haceUnaSemana.toISOString(),
          hastaIso: ahora.toISOString(),
          usuarioId: usuarioIdParaFiltro,
        }),
      ]);
      setVencidos(v);
      setDeHoy(h);
      setProximos(p.filter((e) => !e.completada));
      setLeadsActuales(actuales);
      setContactadosSemana(new Set(interaccionesSemana.map((i) => i.lead_id)).size);
      const llamadasSemana = interaccionesSemana.filter((i) => i.canal === "llamada");
      const contestadasSemana = llamadasSemana.filter(llamadaContestada);
      setTasaRespuestaSemana(
        llamadasSemana.length > 0 ? Math.round((contestadasSemana.length / llamadasSemana.length) * 100) : 0
      );
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
    setProximos((prev) => prev.map((e) => (e.id === id ? { ...e, ...actualizado } : e)));
  }

  async function crearSeguimiento(valores: { lead_id: string; titulo: string; fecha_hora: string }) {
    await crearEvento({ ...valores, usuario_id: usuarioActual?.id ?? null });
    setNuevoSeguimientoAbierto(false);
    await cargar();
  }

  if (cargandoUsuario || !usuarioActual) return <LoadingState />;

  const pendientesHoy = deHoy.filter((e) => !e.completada);
  const completadosHoy = deHoy.filter((e) => e.completada);
  const leadsQueRequierenAtencion = new Set(
    [...vencidos, ...pendientesHoy].map((e) => e.lead?.id).filter(Boolean)
  ).size;

  const conteoPorEstado = contarPor(leadsActuales, (l) => l.estado);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Ventas"
        acciones={
          <button onClick={() => setNuevoSeguimientoAbierto(true)} className="btn-primary">
            <IconMas className="h-4 w-4" />
            Seguimiento
          </button>
        }
      />
      <VentasNav />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink2 first-letter:uppercase">
          {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        </p>
        {esAdmin ? (
          <select aria-label="Responsable" value={filtroUsuarioId} onChange={(e) => setFiltroUsuarioId(e.target.value)} className={SELECT_TOOLBAR}>
            <option value="todos">Todo el equipo</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {error ? <ErrorState mensaje="No se han podido cargar tus seguimientos." onReintentar={cargar} /> : null}
      {cargando && !error ? (
        <div className="flex flex-col gap-6">
          <SkeletonTarjetas n={5} />
          <SkeletonLineas filas={5} />
        </div>
      ) : null}

      {!cargando && !error ? (
        <div className="flex flex-col gap-6 pb-10">
          <FilaKpis
            columnas="md:grid-cols-5"
            kpis={[
              { etiqueta: "Vencidos", valor: vencidos.length, alerta: vencidos.length > 0, nota: vencidos.length ? "Ponte al día primero" : "Nada atrasado" },
              { etiqueta: "Para hoy", valor: pendientesHoy.length, nota: completadosHoy.length ? `${completadosHoy.length} hechos` : undefined },
              { etiqueta: "Leads a contactar", valor: leadsQueRequierenAtencion },
              { etiqueta: "Contactados · 7 días", valor: contactadosSemana, href: "/analitica" },
              { etiqueta: "Respuesta · 7 días", valor: `${tasaRespuestaSemana} %`, nota: "Llamadas contestadas" },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel titulo="Vencidos" contador={vencidos.length} tono={vencidos.length ? "alerta" : undefined}>
              {vencidos.length === 0 ? (
                <EmptyState compacto titulo="Nada vencido" descripcion="Todos tus seguimientos están al día." />
              ) : (
                <div className="divide-y divide-line">
                  {vencidos.map((e) => (
                    <EventCard key={e.id} evento={e} mostrarLead onToggleCompletada={toggle} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel titulo="Hoy" contador={pendientesHoy.length} accion={{ texto: "Nuevo", onClick: () => setNuevoSeguimientoAbierto(true) }}>
              {pendientesHoy.length === 0 && completadosHoy.length === 0 ? (
                <EmptyState
                  compacto
                  titulo="Nada programado para hoy"
                  accion={
                    <button onClick={() => setNuevoSeguimientoAbierto(true)} className="btn-secondary">
                      Programar seguimiento
                    </button>
                  }
                />
              ) : (
                <div className="divide-y divide-line">
                  {[...pendientesHoy, ...completadosHoy].map((e) => (
                    <EventCard key={e.id} evento={e} mostrarLead onToggleCompletada={toggle} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel titulo="Próximos 7 días" contador={proximos.length}>
            {proximos.length === 0 ? (
              <EmptyState compacto titulo="Nada programado esta semana" />
            ) : (
              <div className="divide-y divide-line">
                {proximos.map((e) => (
                  <EventCard key={e.id} evento={e} mostrarLead onToggleCompletada={toggle} />
                ))}
              </div>
            )}
          </Panel>

          <Panel titulo="Pipeline actual" enlace={{ href: "/leads", texto: "Ver leads" }}>
            <div className="flex flex-wrap gap-1.5 px-4 py-3">
              {ESTADOS.map((estado) => (
                <span key={estado} className={`chip ${ESTADO_COLOR[estado] ?? ""}`}>
                  {ESTADO_LABEL[estado] ?? estado}
                  <span className="font-semibold tabular-nums">{conteoPorEstado[estado] ?? 0}</span>
                </span>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {nuevoSeguimientoAbierto ? (
        <Modal titulo="Nuevo seguimiento" onClose={() => setNuevoSeguimientoAbierto(false)}>
          <QuickEventForm onSubmit={crearSeguimiento} onCancelar={() => setNuevoSeguimientoAbierto(false)} />
        </Modal>
      ) : null}
    </div>
  );
}
