"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { listarProyectos } from "@/lib/data/proyectos";
import { listarTareas } from "@/lib/data/tareas";
import { listarActividad } from "@/lib/data/actividad";
import { listarEventosDeHoy, listarEventosVencidos, marcarEventoCompletado } from "@/lib/data/eventos";
import { obtenerLeadsActuales } from "@/lib/data/analitica";
import { listarCobros, listarFacturas } from "@/lib/data/finanzas";
import { aCentimos, calcularKpis, eur, periodoQueContiene } from "@/lib/finanzas";
import { ESTADOS_ABIERTOS, formatEuros, sumarValor } from "@/lib/constants";
import { aYMD, endOfDay, formatHora, formatYMDRelativa, hoyYMD, startOfDay, sumarDiasYMD } from "@/lib/dates";
import { ESTADOS_PROYECTO_ACTIVOS } from "@/lib/trabajo";
import type { Actividad, CobroConFactura, EventoConLead, FacturaConCuenta, Lead, ProyectoConRelaciones, TareaConRelaciones } from "@/lib/types";
import { useAccionesTareas } from "@/lib/useAccionesTareas";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { SkeletonLineas, SkeletonTarjetas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Panel } from "@/components/ui/Panel";
import { TareaFila, CasillaTarea } from "@/components/trabajo/TareaFila";
import { TareaEditarModal } from "@/components/trabajo/TareaEditarModal";
import { ActividadLista } from "@/components/trabajo/ActividadLista";
import { FechaLimite, PrioridadIcono } from "@/components/trabajo/Insignias";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { ProyectosAtencion, proyectosQueRequierenAtencion } from "@/components/trabajo/ProyectosAtencion";
import { IconMas } from "@/components/Icons";
import { ListaOpcionesAnadir } from "@/components/shell/OpcionesAnadir";

export default function InicioPage() {
  return (
    <SoloAdmin>
      <Inicio />
    </SoloAdmin>
  );
}

function saludo(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 14) return "Buenos días";
  if (h < 21) return "Buenas tardes";
  return "Buenas noches";
}

// Urgente = lo tuyo que ya ha vencido. Los proyectos tienen su propio panel
// ("Requieren atención") para no repetirlos aquí.
type Urgente =
  | { tipo: "tarea"; id: string; fecha: string | null; tarea: TareaConRelaciones }
  | { tipo: "seguimiento"; id: string; fecha: string | null; evento: EventoConLead };

function Inicio() {
  const { usuarioActual } = useUsuario();
  const { versionDatos } = useApp();
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);
  const [tareas, setTareas] = useState<TareaConRelaciones[]>([]);
  const [eventosHoy, setEventosHoy] = useState<EventoConLead[]>([]);
  const [eventosVencidos, setEventosVencidos] = useState<EventoConLead[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [facturas, setFacturas] = useState<FacturaConCuenta[]>([]);
  const [cobros, setCobros] = useState<CobroConFactura[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [anadirAbierto, setAnadirAbierto] = useState(false);
  const [editando, setEditando] = useState<TareaConRelaciones | null>(null);
  const acciones = useAccionesTareas(setTareas);

  const cargar = useCallback(async () => {
    if (!usuarioActual) return;
    setError(null);
    try {
      const ahora = new Date();
      const [p, t, eh, ev, l, a, fs, cs] = await Promise.all([
        listarProyectos(),
        listarTareas({ diasCompletadas: 1 }),
        listarEventosDeHoy(startOfDay(ahora).toISOString(), endOfDay(ahora).toISOString(), usuarioActual.id),
        listarEventosVencidos(startOfDay(ahora).toISOString(), usuarioActual.id),
        obtenerLeadsActuales(),
        listarActividad({ limite: 8 }),
        listarFacturas(),
        listarCobros({ desde: periodoQueContiene("anio").desde }),
      ]);
      setProyectos(p);
      setTareas(t);
      setEventosHoy(eh);
      setEventosVencidos(ev);
      setLeads(l);
      setActividad(a);
      setFacturas(fs);
      setCobros(cs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido cargar el inicio.");
    } finally {
      setCargando(false);
    }
  }, [usuarioActual]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const hoy = hoyYMD();
  const en7 = sumarDiasYMD(hoy, 7);
  const mesActual = hoy.slice(0, 7);

  // Finanzas: las mismas reglas que /finanzas (lib/finanzas.ts).
  const fin = useMemo(() => {
    const mes = periodoQueContiene("mes");
    const anio = periodoQueContiene("anio");
    const datos = { facturas, cobros, gastos: [] };
    const pendientes = facturas
      .filter((f) => f.estado === "emitida" && aCentimos(f.pendiente) > 0)
      .sort((a, b) => (a.fecha_vencimiento ?? "9999").localeCompare(b.fecha_vencimiento ?? "9999"));
    return { mes: calcularKpis(datos, mes.desde, mes.hasta), anio: calcularKpis(datos, anio.desde, anio.hasta), pendientes };
  }, [facturas, cobros]);

  const m = useMemo(() => {
    const activos = proyectos.filter((p) => ESTADOS_PROYECTO_ACTIVOS.has(p.estado));
    const mias = tareas.filter((t) => !t.responsable_id || t.responsable_id === usuarioActual?.id);
    const abiertas = mias.filter((t) => t.estado !== "completada");
    const tareasVencidas = abiertas.filter((t) => t.fecha_limite && t.fecha_limite < hoy);
    const tareasHoy = mias.filter(
      (t) => t.fecha_limite === hoy || (t.estado === "completada" && t.completada_en && t.completada_en >= startOfDay(new Date()).toISOString())
    );
    const entregasSemana = activos.filter((p) => p.fecha_entrega && p.fecha_entrega >= hoy && p.fecha_entrega <= en7);
    const entregasHoy = activos.filter((p) => p.fecha_entrega === hoy);
    const entregadosMes = proyectos.filter((p) => p.estado === "entregado" && !!p.entregado_en && aYMD(new Date(p.entregado_en)).startsWith(mesActual));
    const leadsActivos = leads.filter((l) => ESTADOS_ABIERTOS.has(l.estado));

    const urgentes: Urgente[] = [
      ...tareasVencidas.map((t) => ({ tipo: "tarea" as const, id: t.id, fecha: t.fecha_limite, tarea: t })),
      ...eventosVencidos.map((e) => ({ tipo: "seguimiento" as const, id: e.id, fecha: e.fecha_hora.slice(0, 10), evento: e })),
    ].sort((a, b) => (a.fecha ?? "9999").localeCompare(b.fecha ?? "9999"));

    return {
      activos,
      abiertas,
      tareasVencidas,
      tareasHoy: tareasHoy.sort((a, b) => Number(a.estado === "completada") - Number(b.estado === "completada")),
      entregasSemana,
      entregasHoy,
      entregadosMes,
      valorEnCurso: activos.reduce((s, p) => s + (Number(p.importe) || 0), 0),
      valorEntregadoMes: entregadosMes.reduce((s, p) => s + (Number(p.importe) || 0), 0),
      leadsActivos,
      valorLeads: sumarValor(leadsActivos),
      urgentes,
      enRevision: activos.filter((p) => p.estado === "revision").length,
      esperando: activos.filter((p) => p.estado === "esperando").length,
    };
  }, [proyectos, tareas, leads, eventosVencidos, usuarioActual, hoy, en7, mesActual]);

  async function completarSeguimiento(ev: EventoConLead) {
    const nuevo = !ev.completada;
    setEventosHoy((prev) => prev.map((e) => (e.id === ev.id ? { ...e, completada: nuevo } : e)));
    setEventosVencidos((prev) => prev.filter((e) => e.id !== ev.id || !nuevo));
    try {
      await marcarEventoCompletado(ev.id, nuevo);
    } catch {
      cargar();
    }
  }

  const fecha = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  // Cuentas con trabajo en marcha: cuántos proyectos, cuánto valor y la próxima entrega.
  const porCuenta = new Map<string, { id: string; nombre: string; activos: number; valorEnCurso: number; proximaEntrega: string | null }>();
  for (const p of m.activos) {
    if (!p.cuenta) continue;
    const c = porCuenta.get(p.cuenta.id) ?? { id: p.cuenta.id, nombre: p.cuenta.nombre, activos: 0, valorEnCurso: 0, proximaEntrega: null };
    c.activos++;
    c.valorEnCurso += Number(p.importe) || 0;
    if (p.fecha_entrega && p.fecha_entrega >= hoy && (!c.proximaEntrega || p.fecha_entrega < c.proximaEntrega)) c.proximaEntrega = p.fecha_entrega;
    porCuenta.set(c.id, c);
  }
  const cuentasActivas = Array.from(porCuenta.values()).sort((a, b) => b.activos - a.activos || b.valorEnCurso - a.valorEnCurso);
  const itemsHoy = m.tareasHoy.length + m.entregasHoy.length + eventosHoy.length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8 md:pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink3 first-letter:uppercase">{fecha}</p>
          <h1 className="mt-0.5 font-display text-[28px] font-bold tracking-tight text-ink">
            {saludo()}, {usuarioActual?.nombre}
          </h1>
        </div>
        <div className="relative hidden md:block">
          <button onClick={() => setAnadirAbierto((v) => !v)} className="btn-primary">
            <IconMas className="h-4 w-4" />
            Añadir
          </button>
          {anadirAbierto ? (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setAnadirAbierto(false)} />
              <div className="absolute right-0 top-11 z-50 w-48 rounded-xl border border-line bg-surface shadow-glass dark:shadow-glass-dark">
                <ListaOpcionesAnadir onElegir={() => setAnadirAbierto(false)} />
              </div>
            </>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}

      {cargando && !error ? (
        <div className="flex flex-col gap-6">
          <SkeletonTarjetas n={6} />
          <SkeletonLineas filas={5} />
        </div>
      ) : null}

      {!cargando && !error ? (
        <div className="flex flex-col gap-6">
          <FilaKpis
            kpis={[
              {
                etiqueta: "Proyectos activos",
                valor: m.activos.length,
                href: "/proyectos",
                nota: [m.enRevision && `${m.enRevision} en revisión`, m.esperando && `${m.esperando} esperando`].filter(Boolean).join(" · ") || undefined,
              },
              {
                etiqueta: "Tareas pendientes",
                valor: m.abiertas.length,
                href: "/tareas?vista=todas",
                nota: m.tareasVencidas.length ? `${m.tareasVencidas.length} vencida${m.tareasVencidas.length === 1 ? "" : "s"}` : "Nada vencido",
                alerta: m.tareasVencidas.length > 0,
              },
              { etiqueta: "Entregas en 7 días", valor: m.entregasSemana.length, href: "/calendario" },
              { etiqueta: "Valor en curso", valor: formatEuros(m.valorEnCurso), nota: "Proyectos activos" },
              {
                etiqueta: "Entregado este mes",
                valor: formatEuros(m.valorEntregadoMes),
                nota: `${m.entregadosMes.length} proyecto${m.entregadosMes.length === 1 ? "" : "s"}`,
              },
              {
                etiqueta: "Leads activos",
                valor: m.leadsActivos.length,
                href: "/leads",
                nota: m.valorLeads > 0 ? `${formatEuros(m.valorLeads)} en juego` : undefined,
              },
            ]}
          />

          <FilaKpis
            columnas="md:grid-cols-4"
            kpis={[
              { etiqueta: "Facturado este mes", valor: eur(fin.mes.facturado), nota: `${fin.mes.numFacturas} factura${fin.mes.numFacturas === 1 ? "" : "s"}`, href: "/finanzas" },
              { etiqueta: "Cobrado este mes", valor: eur(fin.mes.cobrado), href: "/finanzas" },
              {
                etiqueta: "Pendiente de cobro",
                valor: eur(fin.mes.pendiente),
                nota: fin.mes.numVencidas ? `${eur(fin.mes.vencido)} vencido` : `${fin.mes.numPendientes} factura${fin.mes.numPendientes === 1 ? "" : "s"}`,
                alerta: fin.mes.numVencidas > 0,
                href: "/finanzas/facturas?estado=pendientes",
              },
              { etiqueta: "Facturado este año", valor: eur(fin.anio.facturado), nota: `Cobrado ${eur(fin.anio.cobrado)}`, href: "/finanzas" },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Hoy */}
            <Panel titulo="Hoy" contador={itemsHoy} enlace={{ href: "/tareas", texto: "Tareas" }} className="lg:col-span-2">
              {itemsHoy === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink3">Nada programado para hoy.</p>
              ) : (
                <div className="divide-y divide-line">
                  {m.entregasHoy.map((p) => (
                    <FilaProyecto key={p.id} p={p} etiqueta="Entrega hoy" />
                  ))}
                  {eventosHoy.map((ev) => (
                    <FilaSeguimiento key={ev.id} ev={ev} onToggle={completarSeguimiento} />
                  ))}
                  {m.tareasHoy.map((t) => (
                    <TareaFila key={t.id} tarea={t} onToggle={acciones.alternar} onAbrir={setEditando} />
                  ))}
                </div>
              )}
            </Panel>

            {/* Urgente */}
            <Panel titulo="Urgente" contador={m.urgentes.length} tono={m.urgentes.length ? "alerta" : undefined}>
              {m.urgentes.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink3">Nada vencido. Todo al día.</p>
              ) : (
                <div className="divide-y divide-line">
                  {m.urgentes.slice(0, 8).map((u) =>
                    u.tipo === "tarea" ? (
                      <TareaFila key={u.id} tarea={u.tarea} onToggle={acciones.alternar} onAbrir={setEditando} />
                    ) : (
                      <FilaSeguimiento key={u.id} ev={u.evento} onToggle={completarSeguimiento} vencido />
                    )
                  )}
                  {m.urgentes.length > 8 ? (
                    <p className="px-4 py-2 text-xs text-ink3">y {m.urgentes.length - 8} más</p>
                  ) : null}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              titulo="Proyectos que requieren atención"
              contador={proyectosQueRequierenAtencion(m.activos).length}
              enlace={{ href: "/proyectos", texto: "Todos los proyectos" }}
              className="lg:col-span-2"
            >
              <ProyectosAtencion proyectos={m.activos} vacio="Ningún proyecto vencido, con entrega inminente, esperando o en revisión." />
            </Panel>

            <Panel titulo="Cuentas activas" enlace={{ href: "/cuentas", texto: "Cuentas" }}>
              {cuentasActivas.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink3">Ninguna cuenta con proyectos activos.</p>
              ) : (
                <div className="divide-y divide-line">
                  {cuentasActivas.slice(0, 6).map((c) => (
                    <Link key={c.id} href={`/cuentas/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-mute/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{c.nombre}</span>
                        <span className="block truncate text-xs text-ink3">
                          {c.activos} proyecto{c.activos === 1 ? "" : "s"} activo{c.activos === 1 ? "" : "s"}
                          {c.proximaEntrega ? ` · entrega ${formatYMDRelativa(c.proximaEntrega).toLowerCase()}` : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{formatEuros(c.valorEnCurso)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel titulo="Actividad reciente" enlace={{ href: "/actividad", texto: "Ver toda" }} className="lg:col-span-2">
              <div className="px-4 py-1">
                <ActividadLista items={actividad} vacio="Aquí aparecerá lo que vaya pasando: proyectos, tareas, leads…" />
              </div>
            </Panel>

            <Panel
              titulo="Pendiente de cobro"
              contador={fin.pendientes.length}
              tono={fin.pendientes.some((f) => f.vencida) ? "alerta" : undefined}
              enlace={{ href: "/finanzas/facturas?estado=pendientes", texto: "Facturas" }}
            >
              {fin.pendientes.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink3">Todo cobrado.</p>
              ) : (
                <div className="divide-y divide-line">
                  {fin.pendientes.slice(0, 6).map((f) => (
                    <Link key={f.id} href={`/finanzas/facturas/${f.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-mute/50">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{f.cuenta?.nombre}</span>
                        <span className="block truncate text-xs text-ink3">
                          Factura {f.numero}
                          {f.fecha_vencimiento ? (
                            <span className={f.vencida ? "font-medium text-red-600 dark:text-red-400" : ""}>
                              {" · "}
                              {f.vencida ? "vencida " : "vence "}
                              {formatYMDRelativa(f.fecha_vencimiento).toLowerCase()}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-ink">{eur(f.pendiente)}</span>
                    </Link>
                  ))}
                  {fin.pendientes.length > 6 ? <p className="px-4 py-2 text-xs text-ink3">y {fin.pendientes.length - 6} más</p> : null}
                </div>
              )}
            </Panel>
          </div>
        </div>
      ) : null}

      {editando ? (
        <TareaEditarModal tarea={editando} onCerrar={() => setEditando(null)} onGuardar={acciones.actualizar} onEliminar={acciones.eliminar} />
      ) : null}
    </div>
  );
}

function FilaProyecto({ p, etiqueta }: { p: ProyectoConRelaciones; etiqueta?: string }) {
  return (
    <Link href={`/proyectos/${p.id}`} className="flex items-start gap-3 px-3 py-2.5 hover:bg-mute/50">
      <span className="mt-1 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] bg-violet-500/15 text-[10px] font-bold text-violet-600 dark:text-violet-400">
        P
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{p.nombre}</span>
        <span className="block truncate text-xs text-ink3">
          {etiqueta ?? "Entrega"}
          {p.cuenta ? ` · ${p.cuenta.nombre}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 pt-0.5">
        <PrioridadIcono prioridad={p.prioridad} />
        <FechaLimite fecha={p.fecha_entrega} />
      </span>
    </Link>
  );
}

function FilaSeguimiento({ ev, onToggle, vencido = false }: { ev: EventoConLead; onToggle: (e: EventoConLead) => void; vencido?: boolean }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-mute/50">
      <span className="pt-0.5">
        <CasillaTarea completada={ev.completada} onToggle={() => onToggle(ev)} etiqueta={ev.titulo} />
      </span>
      <Link href={ev.lead ? `/leads/${ev.lead.id}` : "/calendario"} className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${ev.completada ? "text-ink3 line-through" : "text-ink"}`}>{ev.titulo}</span>
        <span className="block truncate text-xs text-ink3">
          {ev.tipo === "reunion"
            ? "Reunión"
            : ev.tipo === "evento"
              ? "Evento"
              : `Seguimiento CRM · ${ev.lead?.negocio || ev.lead?.nombre_contacto || "Lead"}`}
        </span>
      </Link>
      <span className={`shrink-0 pt-0.5 text-xs font-medium ${vencido ? "text-red-600 dark:text-red-400" : "text-ink2"}`}>
        {vencido ? "Vencido" : formatHora(ev.fecha_hora)}
      </span>
    </div>
  );
}
