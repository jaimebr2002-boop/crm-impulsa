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
import { CANAL_LABEL, ESTADO_LABEL, ESTADOS_ABIERTOS, ORIGEN_LABEL, formatEuros, sumarValor } from "@/lib/constants";
import { PeriodSelector, calcularPeriodo, type Periodo } from "@/components/analitica/PeriodSelector";
import { BarChart } from "@/components/analitica/BarChart";
import { FunnelChart } from "@/components/analitica/FunnelChart";
import { TeamTable, type FilaEquipo } from "@/components/analitica/TeamTable";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Cabecera } from "@/components/ui/Cabecera";
import { SELECT_TOOLBAR } from "@/components/ui/CampoBusqueda";
import { Panel } from "@/components/ui/Panel";
import { SkeletonTarjetas } from "@/components/ui/Skeleton";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { BarrasImporte } from "@/components/finanzas/SelectorPeriodo";
import { AnaliticaOperaciones } from "@/components/analitica/AnaliticaOperaciones";
import { AnaliticaFinanzas } from "@/components/finanzas/AnaliticaFinanzas";

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

  const facturado = sumarValor(cerrados);
  const facturadoAnterior = sumarValor(cerradosAnterior);
  const cerradosConValor = cerrados.filter((l) => l.valor != null).length;
  const abiertos = leadsActuales.filter((l) => ESTADOS_ABIERTOS.has(l.estado));
  const valorPipeline = sumarValor(abiertos);
  const abiertosSinValor = abiertos.filter((l) => l.valor == null).length;

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

  const pct = (v: number | null) => (v === null ? "nuevo" : `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v))} %`);
  const vs = (actual: number, anterior: number) => `${pct(variacionPct(actual, anterior))} vs. periodo anterior`;
  const conversion = leads.length > 0 ? Math.round((cerrados.length / leads.length) * 100) : 0;

  const origenes = Object.entries(contarPor(leads, (l) => l.origen ?? "sin_origen"))
    .sort((a, b) => b[1] - a[1])
    .map(([o, n]) => ({ clave: o, etiqueta: o === "sin_origen" ? "Sin origen" : ORIGEN_LABEL[o] ?? o, importe: n }));

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 md:px-8">
      <Cabecera titulo="Analítica" subtitulo={`${periodo.etiqueta}, comparado con el periodo anterior equivalente.`} />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <PeriodSelector onChange={setPeriodo} />
        {esAdmin ? (
          <select aria-label="Persona" value={filtroUsuarioId} onChange={(e) => setFiltroUsuarioId(e.target.value)} className={SELECT_TOOLBAR}>
            <option value="todos">Todo el equipo</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="flex flex-col gap-10">
        {esAdmin ? (
          <Seccion titulo="Negocio" descripcion="Facturado, cobrado, gastos y caja por mes, trimestre o año (su propio periodo, de calendario).">
            <AnaliticaFinanzas />
          </Seccion>
        ) : null}

        {esAdmin ? (
          <Seccion titulo="Operaciones">
            <AnaliticaOperaciones desde={periodo.desde} hasta={periodo.hasta} />
          </Seccion>
        ) : null}

        <Seccion titulo="Ventas">
          {error ? <ErrorState mensaje="No se han podido cargar las métricas de ventas." onReintentar={cargar} /> : null}
          {cargando && !error ? <SkeletonTarjetas n={6} /> : null}
          {!cargando && !error ? (
            <div className="flex flex-col gap-4">
              <FilaKpis
                kpis={[
                  { etiqueta: "Leads nuevos", valor: leads.length, nota: vs(leads.length, leadsAnterior.length) },
                  { etiqueta: "Llamadas", valor: llamadas.length, nota: vs(llamadas.length, llamadasAnterior.length) },
                  { etiqueta: "Respuestas", valor: contestadas.length, nota: `${tasaRespuesta} % contestadas · ${pct(variacionPct(contestadas.length, contestadasAnterior.length))}` },
                  { etiqueta: "Seguimientos hechos", valor: seguimientosCompletados.length, nota: vs(seguimientosCompletados.length, seguimientosCompletadosAnterior.length) },
                  { etiqueta: "Ganados", valor: cerrados.length, nota: `${conversion} % de conversión · ${pct(variacionPct(cerrados.length, cerradosAnterior.length))}` },
                  {
                    etiqueta: "Valor ganado",
                    valor: formatEuros(facturado),
                    nota: cerradosConValor > 0 ? `Ticket medio ${formatEuros(facturado / cerradosConValor)}` : vs(facturado, facturadoAnterior),
                  },
                ]}
              />
              <Panel titulo="Leads nuevos por día">
                <div className="px-4 pb-3 pt-10">
                  <BarChart
                    datos={serieDatos.map((d) => ({ etiqueta: d.fecha, valor: d.valor }))}
                    formatoEtiqueta={(f) => new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(f))}
                  />
                </div>
              </Panel>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Panel titulo={`Pipeline actual · ${leadsActuales.length} leads`}>
                  <div className="px-4 py-3">
                    <FunnelChart etapas={funnelData} />
                    <p className="mt-3 text-xs text-ink3">
                      {formatEuros(valorPipeline)} en juego en {abiertos.length} leads abiertos
                      {abiertosSinValor ? ` (${abiertosSinValor} sin valor)` : ""}
                      {perdidos ? ` · ${perdidos} perdidos o sin contestar` : ""}. No depende del periodo.
                    </p>
                  </div>
                </Panel>
                <Panel titulo="Interacciones por canal">
                  <BarrasImporte filas={datosCanal.map((d) => ({ clave: d.etiqueta, etiqueta: d.etiqueta, importe: d.valor }))} formato={(n) => String(n)} />
                </Panel>
              </div>
              {esAdmin ? (
                <Panel titulo="Equipo">
                  <div className="px-4 py-3">
                    <TeamTable filas={equipo} />
                  </div>
                </Panel>
              ) : null}
            </div>
          ) : null}
        </Seccion>

        <Seccion titulo="Distribución" descripcion="Por cuenta, marca y tipo en Negocio; aquí, de dónde vienen los leads del periodo.">
          <Panel titulo="Leads nuevos por origen">
            <BarrasImporte filas={origenes} formato={(n) => String(n)} vacio="Sin leads nuevos en este periodo." />
          </Panel>
        </Seccion>
      </div>
    </div>
  );
}

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">{titulo}</h2>
        {descripcion ? <p className="text-sm text-ink3">{descripcion}</p> : null}
      </div>
      {children}
    </section>
  );
}
