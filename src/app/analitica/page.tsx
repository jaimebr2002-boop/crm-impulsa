"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useUsuario } from "@/context/UsuarioContext";
import { listarUsuarios } from "@/lib/data/usuarios";
import {
  agruparPorDia,
  contarPor,
  llamadaContestada,
  obtenerEventosPeriodo,
  obtenerInteraccionesPeriodo,
  obtenerLeadsActuales,
  obtenerLeadsPeriodo,
  type EventoAnalitica,
} from "@/lib/data/analitica";
import type { Interaccion, Lead, Usuario } from "@/lib/types";
import { CANAL_LABEL, ESTADO_LABEL, ESTADOS } from "@/lib/constants";
import { PeriodSelector, calcularPeriodo, type Periodo } from "@/components/analitica/PeriodSelector";
import { KpiCard } from "@/components/analitica/KpiCard";
import { BarChart } from "@/components/analitica/BarChart";
import { FunnelChart } from "@/components/analitica/FunnelChart";
import { TeamTable, type FilaEquipo } from "@/components/analitica/TeamTable";
import { ActivityFeed, type ActividadItem } from "@/components/analitica/ActivityFeed";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { IconLeads, IconTelefono, IconCalendario, IconCheck } from "@/components/Icons";

// Estados que cuentan como "pipeline activo" en el funnel; se excluyen los
// terminales negativos para que la barra final no quede aplastada por ellos.
const ETAPAS_FUNNEL = ["pendiente", "contactado", "respondido", "interesado", "reunión", "cerrado"] as const;

function variacionPct(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual === 0 ? 0 : null;
  return ((actual - anterior) / anterior) * 100;
}

export default function AnaliticaPage() {
  const { usuarioActual, esAdmin, cargando: cargandoUsuario } = useUsuario();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [filtroUsuarioId, setFiltroUsuarioId] = useState("todos");
  const [periodo, setPeriodo] = useState<Periodo>(() => calcularPeriodo("30 días"));

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsAnterior, setLeadsAnterior] = useState<Lead[]>([]);
  const [leadsActuales, setLeadsActuales] = useState<Lead[]>([]);
  const [interacciones, setInteracciones] = useState<Interaccion[]>([]);
  const [interaccionesAnterior, setInteraccionesAnterior] = useState<Interaccion[]>([]);
  const [eventos, setEventos] = useState<EventoAnalitica[]>([]);
  const [eventosAnterior, setEventosAnterior] = useState<EventoAnalitica[]>([]);

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

  const cargar = useCallback(async () => {
    if (!usuarioActual) return;
    setCargando(true);
    setError(null);
    try {
      const duracionMs = periodo.hasta.getTime() - periodo.desde.getTime();
      const desdeAnterior = new Date(periodo.desde.getTime() - duracionMs - 1);
      const hastaAnterior = new Date(periodo.desde.getTime() - 1);

      const filtroActual = { desdeIso: periodo.desde.toISOString(), hastaIso: periodo.hasta.toISOString(), usuarioId: usuarioIdParaFiltro };
      const filtroAnterior = { desdeIso: desdeAnterior.toISOString(), hastaIso: hastaAnterior.toISOString(), usuarioId: usuarioIdParaFiltro };

      const [l, lAnt, lActuales, i, iAnt, e, eAnt] = await Promise.all([
        obtenerLeadsPeriodo(filtroActual),
        obtenerLeadsPeriodo(filtroAnterior),
        obtenerLeadsActuales(usuarioIdParaFiltro),
        obtenerInteraccionesPeriodo(filtroActual),
        obtenerInteraccionesPeriodo(filtroAnterior),
        obtenerEventosPeriodo(filtroActual),
        obtenerEventosPeriodo(filtroAnterior),
      ]);

      setLeads(l);
      setLeadsAnterior(lAnt);
      setLeadsActuales(lActuales);
      setInteracciones(i);
      setInteraccionesAnterior(iAnt);
      setEventos(e);
      setEventosAnterior(eAnt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cargar la analítica.");
    } finally {
      setCargando(false);
    }
  }, [usuarioActual, periodo, usuarioIdParaFiltro]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargandoUsuario || !usuarioActual) return <LoadingState />;

  // --- Métricas derivadas, todas de datos reales ---
  const llamadas = interacciones.filter((i) => i.canal === "llamada");
  const llamadasAnterior = interaccionesAnterior.filter((i) => i.canal === "llamada");
  const contestadas = llamadas.filter(llamadaContestada);
  const contestadasAnterior = llamadasAnterior.filter(llamadaContestada);
  const tasaRespuesta = llamadas.length > 0 ? Math.round((contestadas.length / llamadas.length) * 100) : 0;

  const seguimientosCompletados = eventos.filter((e) => e.completada);
  const seguimientosCompletadosAnterior = eventosAnterior.filter((e) => e.completada);

  const cerrados = leads.filter((l) => l.estado === "cerrado");
  const cerradosAnterior = leadsAnterior.filter((l) => l.estado === "cerrado");

  const serieLeads = agruparPorDia(leads, (l) => l.created_at, periodo.desde, periodo.hasta).map((d) => d.valor);
  const serieDatos = agruparPorDia(leads, (l) => l.created_at, periodo.desde, periodo.hasta);

  const funnelData = ETAPAS_FUNNEL.map((estado) => ({
    clave: estado,
    etiqueta: ESTADO_LABEL[estado] ?? estado,
    valor: leadsActuales.filter((l) => l.estado === estado).length,
  }));
  const perdidos = leadsActuales.filter((l) => l.estado === "descartado" || l.estado === "no contesta").length;

  const porCanal = contarPor(interacciones, (i) => i.canal);
  const datosCanal = Object.keys(CANAL_LABEL)
    .filter((c) => porCanal[c])
    .map((c) => ({ etiqueta: CANAL_LABEL[c], valor: porCanal[c] }));

  const equipo: FilaEquipo[] = usuarios
    .filter((u) => usuarioIdParaFiltro === undefined || u.id === usuarioIdParaFiltro)
    .map((u) => ({
      usuarioId: u.id,
      nombre: u.nombre,
      leads: leads.filter((l) => l.asignado_a === u.id).length,
      interacciones: interacciones.filter((i) => i.usuario_id === u.id).length,
      llamadasContestadas: contestadas.filter((i) => i.usuario_id === u.id).length,
      seguimientosCompletados: seguimientosCompletados.filter((e) => e.usuario_id === u.id).length,
      cerrados: cerrados.filter((l) => l.asignado_a === u.id).length,
    }))
    .sort((a, b) => b.cerrados - a.cerrados || b.interacciones - a.interacciones);

  // --- Actividad reciente: mezcla real de interacciones + eventos del periodo ---
  const leadsPorId: Record<string, Lead> = {};
  for (const l of leadsActuales) leadsPorId[l.id] = l;
  const usuariosPorId: Record<string, Usuario> = {};
  for (const u of usuarios) usuariosPorId[u.id] = u;
  const nombreLead = (leadId: string) => {
    const l = leadsPorId[leadId];
    return l?.negocio || l?.nombre_contacto || "Lead";
  };
  const nombreUsuarioDe = (usuarioId: string | null) => (usuarioId ? usuariosPorId[usuarioId]?.nombre ?? "—" : "—");

  const actividadInteracciones: ActividadItem[] = interacciones.map((i) => {
    if (i.canal === "llamada") {
      const contestada = llamadaContestada(i);
      return {
        id: `int-${i.id}`,
        texto: `Llamada${i.resultado ? `: ${i.resultado}` : ""} — ${nombreLead(i.lead_id)}`,
        quien: nombreUsuarioDe(i.usuario_id),
        cuandoIso: i.fecha,
        colorDot: contestada ? "bg-emerald-500" : "bg-red-400",
        colorTexto: contestada ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
        etiqueta: "Llamada",
      };
    }
    if (i.canal === "nota") {
      return {
        id: `int-${i.id}`,
        texto: `${i.nota || "Nota añadida"} — ${nombreLead(i.lead_id)}`,
        quien: nombreUsuarioDe(i.usuario_id),
        cuandoIso: i.fecha,
        colorDot: "bg-brand",
        colorTexto: "text-brand-dark dark:text-brand",
        etiqueta: "Nota",
      };
    }
    const etiquetaCanal = (i.canal && CANAL_LABEL[i.canal]) || "Interacción";
    return {
      id: `int-${i.id}`,
      texto: `${etiquetaCanal}${i.resultado ? `: ${i.resultado}` : ""} — ${nombreLead(i.lead_id)}`,
      quien: nombreUsuarioDe(i.usuario_id),
      cuandoIso: i.fecha,
      colorDot: "bg-sky-500",
      colorTexto: "text-sky-600 dark:text-sky-400",
      etiqueta: etiquetaCanal,
    };
  });

  const actividadEventos: ActividadItem[] = eventos.map((e) => ({
    id: `ev-${e.id}`,
    texto: `Seguimiento ${e.completada ? "completado" : "programado"} — ${nombreLead(e.lead_id)}`,
    quien: nombreUsuarioDe(e.usuario_id),
    cuandoIso: e.completada ? e.fecha_hora : e.created_at,
    colorDot: e.completada ? "bg-emerald-500" : "bg-amber-400",
    colorTexto: e.completada ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400",
    etiqueta: e.completada ? "Seguimiento" : "Programado",
  }));

  const actividad = [...actividadInteracciones, ...actividadEventos]
    .sort((a, b) => new Date(b.cuandoIso).getTime() - new Date(a.cuandoIso).getTime())
    .slice(0, 15);

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 md:px-8">
      <h1 className="font-display text-2xl font-bold text-ink">Analítica</h1>
      <p className="mt-0.5 text-sm text-ink2">{periodo.etiqueta}, comparado con el periodo anterior equivalente.</p>

      {esAdmin ? (
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {[{ id: "todos", nombre: "Todos" }, ...usuarios].map((u) => (
            <button
              key={u.id}
              onClick={() => setFiltroUsuarioId(u.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                filtroUsuarioId === u.id ? "bg-brand-gradient text-white shadow-md shadow-brand/25" : "border border-line bg-surface text-ink2"
              }`}
            >
              {u.nombre}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-4">
        <PeriodSelector onChange={setPeriodo} />
      </div>

      {cargando ? <div className="mt-10"><LoadingState texto="Calculando métricas…" /></div> : null}
      {error ? <div className="mt-10"><ErrorState mensaje={error} onReintentar={cargar} /></div> : null}

      {!cargando && !error ? (
        <div className="mt-6 flex flex-col gap-8">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <KpiCard
              etiqueta="Leads nuevos"
              valor={leads.length}
              variacion={variacionPct(leads.length, leadsAnterior.length)}
              serie={serieLeads}
              icono={IconLeads}
            />
            <KpiCard
              etiqueta="Llamadas registradas"
              valor={llamadas.length}
              variacion={variacionPct(llamadas.length, llamadasAnterior.length)}
              icono={IconTelefono}
            />
            <KpiCard
              etiqueta="Llamadas contestadas"
              valor={contestadas.length}
              variacion={variacionPct(contestadas.length, contestadasAnterior.length)}
              icono={IconCheck}
              nota={`${tasaRespuesta}% de tasa de respuesta`}
            />
            <KpiCard
              etiqueta="Seguimientos completados"
              valor={seguimientosCompletados.length}
              variacion={variacionPct(seguimientosCompletados.length, seguimientosCompletadosAnterior.length)}
              icono={IconCalendario}
            />
            <KpiCard
              etiqueta="Leads cerrados"
              valor={cerrados.length}
              variacion={variacionPct(cerrados.length, cerradosAnterior.length)}
              icono={IconCheck}
            />
            <KpiCard
              etiqueta="Leads en pipeline"
              valor={leadsActuales.length}
              icono={IconLeads}
              nota="Total actual, no depende del periodo"
            />
          </section>

          <section className="glass rounded-2xl p-5 shadow-glass dark:shadow-glass-dark">
            <h2 className="mb-4 font-display text-sm font-bold text-ink">Leads nuevos por día</h2>
            <BarChart
              datos={serieDatos.map((d) => ({ etiqueta: d.fecha, valor: d.valor }))}
              formatoEtiqueta={(f) => new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit" }).format(new Date(f))}
            />
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.3fr_1fr]">
            <section className="glass rounded-2xl p-5 shadow-glass dark:shadow-glass-dark">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-sm font-bold text-ink">Pipeline actual</h2>
                {perdidos > 0 ? <span className="text-xs text-ink3">{perdidos} descartados / sin contestar</span> : null}
              </div>
              <FunnelChart etapas={funnelData} />
            </section>

            <section className="glass rounded-2xl p-5 shadow-glass dark:shadow-glass-dark">
              <h2 className="mb-2 font-display text-sm font-bold text-ink">Actividad reciente</h2>
              <ActivityFeed items={actividad} />
            </section>
          </div>

          <section className="glass rounded-2xl p-5 shadow-glass dark:shadow-glass-dark">
            <h2 className="mb-4 font-display text-sm font-bold text-ink">Interacciones por canal</h2>
            <BarChart datos={datosCanal} />
          </section>

          {esAdmin ? (
            <section className="glass rounded-2xl p-5 shadow-glass dark:shadow-glass-dark">
              <h2 className="mb-4 font-display text-sm font-bold text-ink">Rendimiento del equipo</h2>
              <TeamTable filas={equipo} />
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
