"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { listarProyectos } from "@/lib/data/proyectos";
import { listarTareas } from "@/lib/data/tareas";
import { listarActividad } from "@/lib/data/actividad";
import { listarEventosDeHoy, listarEventosVencidos, marcarEventoCompletado } from "@/lib/data/eventos";
import { obtenerLeadsActuales } from "@/lib/data/analitica";
import { ESTADOS_ABIERTOS, formatEuros, sumarValor } from "@/lib/constants";
import { aYMD, endOfDay, formatHora, hoyYMD, startOfDay, sumarDiasYMD } from "@/lib/dates";
import { ESTADOS_PROYECTO_ACTIVOS, PRIORIDAD_ORDEN } from "@/lib/trabajo";
import type { Actividad, EventoConLead, Lead, ProyectoConRelaciones, TareaConRelaciones } from "@/lib/types";
import { useAccionesTareas } from "@/lib/useAccionesTareas";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { SkeletonLineas, SkeletonTarjetas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { TareaFila, CasillaTarea } from "@/components/trabajo/TareaFila";
import { TareaEditarModal } from "@/components/trabajo/TareaEditarModal";
import { ActividadLista } from "@/components/trabajo/ActividadLista";
import { EstadoProyectoInsignia, FechaLimite, PrioridadIcono } from "@/components/trabajo/Insignias";
import { IconFlecha, IconMas } from "@/components/Icons";
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

type Urgente =
  | { tipo: "tarea"; id: string; fecha: string | null; tarea: TareaConRelaciones }
  | { tipo: "proyecto"; id: string; fecha: string | null; proyecto: ProyectoConRelaciones }
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
      const [p, t, eh, ev, l, a] = await Promise.all([
        listarProyectos(),
        listarTareas({ diasCompletadas: 1 }),
        listarEventosDeHoy(startOfDay(ahora).toISOString(), endOfDay(ahora).toISOString(), usuarioActual.id),
        listarEventosVencidos(startOfDay(ahora).toISOString(), usuarioActual.id),
        obtenerLeadsActuales(),
        listarActividad({ limite: 8 }),
      ]);
      setProyectos(p);
      setTareas(t);
      setEventosHoy(eh);
      setEventosVencidos(ev);
      setLeads(l);
      setActividad(a);
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
  const en3 = sumarDiasYMD(hoy, 3);
  const mesActual = hoy.slice(0, 7);

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
      ...activos
        .filter((p) => (p.fecha_entrega && p.fecha_entrega <= en3) || p.prioridad === "urgente")
        .filter((p) => p.fecha_entrega !== hoy)
        .map((p) => ({ tipo: "proyecto" as const, id: p.id, fecha: p.fecha_entrega, proyecto: p })),
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
  }, [proyectos, tareas, leads, eventosVencidos, usuarioActual, hoy, en7, en3, mesActual]);

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
  const topProyectos = [...m.activos]
    .sort(
      (a, b) =>
        PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad] ||
        (a.fecha_entrega ?? "9999").localeCompare(b.fecha_entrega ?? "9999")
    )
    .slice(0, 6);
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
          {/* KPIs */}
          <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
            <Kpi etiqueta="Proyectos activos" valor={m.activos.length} href="/proyectos"
              nota={[m.enRevision && `${m.enRevision} en revisión`, m.esperando && `${m.esperando} esperando`].filter(Boolean).join(" · ") || undefined} />
            <Kpi etiqueta="Tareas pendientes" valor={m.abiertas.length} href="/tareas?vista=todas"
              nota={m.tareasVencidas.length ? `${m.tareasVencidas.length} vencida${m.tareasVencidas.length === 1 ? "" : "s"}` : "Nada vencido"} alerta={m.tareasVencidas.length > 0} />
            <Kpi etiqueta="Entregas en 7 días" valor={m.entregasSemana.length} href="/proyectos" />
            <Kpi etiqueta="Valor en curso" valor={formatEuros(m.valorEnCurso)} nota="Proyectos activos" />
            <Kpi etiqueta="Entregado este mes" valor={formatEuros(m.valorEntregadoMes)}
              nota={`${m.entregadosMes.length} proyecto${m.entregadosMes.length === 1 ? "" : "s"}`} />
            <Kpi etiqueta="Leads activos" valor={m.leadsActivos.length} href="/leads"
              nota={m.valorLeads > 0 ? `${formatEuros(m.valorLeads)} en juego` : undefined} />
          </section>

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
                <p className="px-4 py-8 text-center text-sm text-ink3">Nada vencido ni con entrega inminente.</p>
              ) : (
                <div className="divide-y divide-line">
                  {m.urgentes.slice(0, 8).map((u) =>
                    u.tipo === "tarea" ? (
                      <TareaFila key={u.id} tarea={u.tarea} onToggle={acciones.alternar} onAbrir={setEditando} />
                    ) : u.tipo === "proyecto" ? (
                      <FilaProyecto key={u.id} p={u.proyecto} />
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
            <Panel titulo="Proyectos activos" contador={m.activos.length} enlace={{ href: "/proyectos", texto: "Ver todos" }} className="lg:col-span-2">
              {topProyectos.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-ink3">Sin proyectos activos.</p>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {topProyectos.map((p) => (
                    <Link key={p.id} href={`/proyectos/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-mute/50">
                      <PrioridadIcono prioridad={p.prioridad} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{p.nombre}</span>
                        <span className="block truncate text-xs text-ink3">
                          {[p.cuenta?.nombre, p.marca?.nombre].filter(Boolean).join(" · ") || "Sin cuenta"}
                        </span>
                      </span>
                      <span className="hidden sm:block">
                        <EstadoProyectoInsignia estado={p.estado} />
                      </span>
                      <span className="w-20 text-right">
                        <FechaLimite fecha={p.fecha_entrega} />
                      </span>
                      <span className="hidden w-20 text-right text-sm font-medium tabular-nums text-ink sm:block">
                        {p.importe != null ? formatEuros(p.importe) : ""}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel titulo="Actividad reciente">
              <div className="px-4 py-1">
                <ActividadLista items={actividad} vacio="Aquí aparecerá lo que vaya pasando: proyectos, tareas, leads…" />
              </div>
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

function Kpi({
  etiqueta,
  valor,
  nota,
  href,
  alerta = false,
}: {
  etiqueta: string;
  valor: ReactNode;
  nota?: string;
  href?: string;
  alerta?: boolean;
}) {
  const contenido = (
    <>
      <p className="text-[11px] font-medium uppercase tracking-wider text-ink3">{etiqueta}</p>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums tracking-tight text-ink">{valor}</p>
      {nota ? <p className={`mt-0.5 truncate text-xs ${alerta ? "font-medium text-red-600 dark:text-red-400" : "text-ink3"}`}>{nota}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="block bg-surface p-4 transition-colors hover:bg-mute/40">
      {contenido}
    </Link>
  ) : (
    <div className="bg-surface p-4">{contenido}</div>
  );
}

function Panel({
  titulo,
  contador,
  enlace,
  tono,
  className = "",
  children,
}: {
  titulo: string;
  contador?: number;
  enlace?: { href: string; texto: string };
  tono?: "alerta";
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {tono === "alerta" ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
          {titulo}
          {contador ? <span className="text-xs font-normal text-ink3">{contador}</span> : null}
        </h2>
        {enlace ? (
          <Link href={enlace.href} className="flex items-center gap-1 text-xs text-ink3 hover:text-ink">
            {enlace.texto}
            <IconFlecha className="h-3 w-3" />
          </Link>
        ) : null}
      </header>
      {children}
    </section>
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
      <Link href={ev.lead ? `/leads/${ev.lead.id}` : "/hoy"} className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${ev.completada ? "text-ink3 line-through" : "text-ink"}`}>{ev.titulo}</span>
        <span className="block truncate text-xs text-ink3">
          Seguimiento CRM · {ev.lead?.negocio || ev.lead?.nombre_contacto || "Lead"}
        </span>
      </Link>
      <span className={`shrink-0 pt-0.5 text-xs font-medium ${vencido ? "text-red-600 dark:text-red-400" : "text-ink2"}`}>
        {vencido ? "Vencido" : formatHora(ev.fecha_hora)}
      </span>
    </div>
  );
}
