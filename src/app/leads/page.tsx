"use client";

import { VentasNav } from "@/components/VentasNav";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useUsuario } from "@/context/UsuarioContext";
import {
  actualizarLead,
  actualizarLeads,
  eliminarLeads,
  LEADS_POR_PAGINA,
  listarLeads,
  listarLeadsPagina,
  listarLeadsTablero,
  obtenerProximosSeguimientos,
  valorTotalLeads,
  type FiltrosLeads,
} from "@/lib/data/leads";
import { listarUsuarios } from "@/lib/data/usuarios";
import type { Lead, LeadUpdate, Usuario } from "@/lib/types";
import { ESTADOS, ESTADO_LABEL, formatEuros } from "@/lib/constants";
import { descargarCsv, leadsACsv } from "@/lib/exportar";
import { TablaLeads } from "@/components/ventas/TablaLeads";
import { useApp } from "@/context/AppContext";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";
import { CampoBusqueda, SELECT_TOOLBAR } from "@/components/ui/CampoBusqueda";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { LeadBoard } from "@/components/LeadBoard";
import { LeadFilters } from "@/components/LeadFilters";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { IconMas } from "@/components/Icons";

type Vista = "lista" | "tablero";

const CLAVE_VISTA = "impulsa-leads-vista";

export default function LeadsPage() {
  const { usuarioActual, esAdmin, cargando: cargandoUsuario } = useUsuario();
  const { avisar } = useApp();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [proximos, setProximos] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [filtros, setFiltros] = useState<FiltrosLeads>({});
  const [filtroAsignado, setFiltroAsignado] = useState("todos");
  const [verArchivados, setVerArchivados] = useState(false);
  const [vista, setVista] = useState<Vista>("lista");
  const [total, setTotal] = useState(0);
  const [totalesTablero, setTotalesTablero] = useState<Record<string, number>>({});
  const [valorTotal, setValorTotal] = useState(0);
  const [cargandoMas, setCargandoMas] = useState(false);
  const paginaCargada = useRef(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
    try {
      const guardada = localStorage.getItem(CLAVE_VISTA);
      if (guardada === "lista" || guardada === "tablero") setVista(guardada);
    } catch {
      // Sin almacenamiento disponible: se queda la vista por defecto.
    }
  }, []);

  function cambiarVista(v: Vista) {
    setVista(v);
    salirSeleccion();
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Preferencia solo de comodidad; si no se puede guardar no pasa nada.
    }
  }

  // Una consulta por pausa al escribir, no una por tecla.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const filtrosEfectivos = useMemo<FiltrosLeads>(() => {
    if (!usuarioActual) return {};
    return {
      ...filtros,
      busqueda: busquedaAplicada,
      archivados: verArchivados,
      asignadoA: esAdmin ? filtroAsignado : usuarioActual.id,
    };
  }, [filtros, busquedaAplicada, verArchivados, usuarioActual, esAdmin, filtroAsignado]);

  // Lista: solo la primera página; el resto se pide al pulsar «Mostrar más».
  // Tablero: unos pocos leads recientes por columna con el total real de cada una.
  useEffect(() => {
    if (cargandoUsuario || !usuarioActual) return;
    let activo = true;
    setCargando(true);
    setError(null);
    setSeleccion(new Set());
    paginaCargada.current = 0;
    const pedir =
      vista === "tablero"
        ? listarLeadsTablero(filtrosEfectivos, ESTADOS).then(({ leads: l, totales }) => ({ l, total: Object.values(totales).reduce((a, b) => a + b, 0), totales }))
        : listarLeadsPagina(filtrosEfectivos, 0).then(({ leads: l, total: t }) => ({ l, total: t, totales: {} as Record<string, number> }));
    pedir
      .then(async ({ l, total: t, totales }) => {
        const mapa = await obtenerProximosSeguimientos(l.map((x) => x.id)).catch(() => ({}));
        if (!activo) return;
        setLeads(l);
        setTotal(t);
        setTotalesTablero(totales);
        setProximos(mapa);
      })
      .catch((e) => activo && setError(e.message ?? "No se han podido cargar los leads."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [filtrosEfectivos, cargandoUsuario, usuarioActual, vista]);

  // El importe en juego se calcula aparte: no bloquea la lista.
  useEffect(() => {
    if (cargandoUsuario || !usuarioActual) return;
    let activo = true;
    valorTotalLeads(filtrosEfectivos)
      .then((v) => activo && setValorTotal(v))
      .catch(() => activo && setValorTotal(0));
    return () => {
      activo = false;
    };
  }, [filtrosEfectivos, cargandoUsuario, usuarioActual]);

  async function mostrarMas() {
    if (cargandoMas) return;
    setCargandoMas(true);
    try {
      const { leads: nuevos, total: t } = await listarLeadsPagina(filtrosEfectivos, paginaCargada.current + 1);
      const mapa = await obtenerProximosSeguimientos(nuevos.map((x) => x.id)).catch(() => ({}));
      setLeads((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        return [...prev, ...nuevos.filter((x) => !ids.has(x.id))];
      });
      paginaCargada.current += 1;
      setTotal(t);
      setProximos((prev) => ({ ...prev, ...mapa }));
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se han podido cargar más leads.", { tono: "error" });
    } finally {
      setCargandoMas(false);
    }
  }

  const usuariosPorId = useMemo(() => {
    const m: Record<string, Usuario> = {};
    for (const u of usuarios) m[u.id] = u;
    return m;
  }, [usuarios]);

  // --- Tablero: mover de estado con actualización optimista ---
  async function moverLead(leadId: string, nuevoEstado: string) {
    const anterior = leads.find((l) => l.id === leadId);
    if (!anterior || anterior.estado === nuevoEstado) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, estado: nuevoEstado } : l)));
    try {
      const actualizado = await actualizarLead(leadId, { estado: nuevoEstado });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? actualizado : l)));
    } catch (e) {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? anterior : l)));
      avisar(e instanceof Error ? e.message : "No se ha podido mover el lead.", { tono: "error" });
    }
  }

  // --- Selección múltiple ---
  function salirSeleccion() {
    setModoSeleccion(false);
    setSeleccion(new Set());
  }

  function toggleSeleccion(id: string) {
    setSeleccion((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(id)) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });
  }

  const todosSeleccionados = leads.length > 0 && seleccion.size === leads.length;

  async function aplicarMasivo(payload: LeadUpdate, descripcion: string) {
    const ids = Array.from(seleccion);
    if (ids.length === 0 || procesando) return;
    setProcesando(true);
    try {
      const actualizados = await actualizarLeads(ids, payload);
      const porId = new Map(actualizados.map((l) => [l.id, l]));
      // Si el cambio saca al lead de la vista actual (archivar/restaurar, o un
      // filtro de estado/responsable que ya no cumple), se quita de la lista.
      const sigueVisible = (l: Lead) =>
        l.archivado === verArchivados &&
        (!filtros.estado || l.estado === filtros.estado) &&
        (!esAdmin || filtroAsignado === "todos" || l.asignado_a === filtroAsignado);
      const restantes = leads.map((l) => porId.get(l.id) ?? l).filter(sigueVisible);
      setTotal((t) => Math.max(0, t - (leads.length - restantes.length)));
      setLeads(restantes);
      const omitidos = ids.length - actualizados.length;
      avisar(
        `${actualizados.length} lead${actualizados.length === 1 ? "" : "s"} ${descripcion}` +
          (omitidos > 0 ? ` · ${omitidos} sin permiso` : "")
      );
      salirSeleccion();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido aplicar el cambio.", { tono: "error" });
    } finally {
      setProcesando(false);
    }
  }

  async function borrarSeleccion() {
    const ids = Array.from(seleccion);
    setProcesando(true);
    try {
      const borrados = await eliminarLeads(ids);
      setLeads((prev) => prev.filter((l) => !seleccion.has(l.id)));
      setTotal((t) => Math.max(0, t - borrados));
      avisar(`${borrados} lead${borrados === 1 ? "" : "s"} eliminado${borrados === 1 ? "" : "s"}`);
      salirSeleccion();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se han podido eliminar los leads.", { tono: "error" });
    } finally {
      setProcesando(false);
      setConfirmarBorrado(false);
    }
  }

  async function exportar() {
    let aExportar: Lead[];
    if (seleccion.size > 0) aExportar = leads.filter((l) => seleccion.has(l.id));
    else if (leads.length >= total) aExportar = leads;
    else {
      // Hay más leads de los cargados: se piden todos los que cumplen los filtros.
      try {
        aExportar = await listarLeads(filtrosEfectivos);
      } catch (e) {
        avisar(e instanceof Error ? e.message : "No se ha podido exportar.", { tono: "error" });
        return;
      }
    }
    const fecha = new Date().toISOString().slice(0, 10);
    descargarCsv(`leads-impulsa-${fecha}.csv`, leadsACsv(aExportar, usuariosPorId));
  }

  const menuAcciones = (
    <div className="flex flex-wrap items-center gap-1">
      <button onClick={() => setVerArchivados((v) => !v)} aria-pressed={verArchivados} className={verArchivados ? "btn-secondary" : "btn-ghost"}>
        {verArchivados ? "Viendo archivados" : "Archivados"}
      </button>
      <button onClick={exportar} disabled={leads.length === 0} className="btn-ghost">
        Exportar CSV
      </button>
      {vista === "lista" ? (
        <button
          onClick={() => (modoSeleccion ? salirSeleccion() : setModoSeleccion(true))}
          disabled={leads.length === 0}
          aria-pressed={modoSeleccion}
          className={modoSeleccion ? "btn-secondary" : "btn-ghost"}
        >
          {modoSeleccion ? "Cancelar selección" : "Seleccionar"}
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Ventas"
        acciones={
          <Link href="/leads/nuevo" className="btn-primary">
            <IconMas className="h-4 w-4" />
            Lead
          </Link>
        }
      />
      <VentasNav />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CampoBusqueda valor={busqueda} onChange={setBusqueda} placeholder="Negocio, contacto, teléfono, email…" etiqueta="Buscar leads" className="w-full md:max-w-sm md:flex-1" />
        <LeadFilters filtros={filtros} onChange={setFiltros} />
        {esAdmin ? (
          <select aria-label="Responsable" value={filtroAsignado} onChange={(e) => setFiltroAsignado(e.target.value)} className={`${SELECT_TOOLBAR} min-w-0 flex-1 md:flex-none`}>
            <option value="todos">Todos los responsables</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        ) : null}
        <span className="ml-auto">
          <Segmentado
            opciones={[
              { id: "lista", label: "Lista" },
              { id: "tablero", label: "Pipeline" },
            ]}
            valor={vista}
            onChange={cambiarVista}
          />
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-ink2">
          {cargando ? <span className="skeleton inline-block h-4 w-24 align-middle" /> : `${total.toLocaleString("es-ES")} lead${total === 1 ? "" : "s"}`}
          {!cargando && valorTotal > 0 ? <span className="text-ink3"> · {formatEuros(valorTotal)} en juego</span> : null}
        </p>
        {menuAcciones}
      </div>

      {cargando ? <SkeletonLineas filas={8} alto="h-12" /> : null}
      {error ? <ErrorState mensaje="No se han podido cargar los leads." onReintentar={() => setFiltros((f) => ({ ...f }))} /> : null}

      {!cargando && !error && leads.length === 0 ? (
        <EmptyState
          titulo={verArchivados ? "No hay leads archivados" : busquedaAplicada || Object.values(filtros).some(Boolean) ? "Ningún lead con estos filtros" : "Aún no hay leads"}
          descripcion={verArchivados ? undefined : "Crea uno a mano o impórtalos desde una hoja de cálculo."}
          accion={
            verArchivados ? undefined : (
              <div className="flex gap-2">
                <Link href="/importar" className="btn-secondary">
                  Importar
                </Link>
                <Link href="/leads/nuevo" className="btn-primary">
                  <IconMas className="h-4 w-4" />
                  Nuevo lead
                </Link>
              </div>
            )
          }
        />
      ) : null}

      {!cargando && !error && leads.length > 0 && vista === "tablero" ? (
        <LeadBoard leads={leads} totales={totalesTablero} usuariosPorId={usuariosPorId} proximos={proximos} onMover={moverLead} />
      ) : null}

      {!cargando && !error && vista === "lista" && leads.length > 0 ? (
        <div className={modoSeleccion ? "pb-40" : "pb-8"}>
          <TablaLeads
            leads={leads}
            usuariosPorId={usuariosPorId}
            proximos={proximos}
            seleccionable={modoSeleccion}
            seleccion={seleccion}
            onToggle={toggleSeleccion}
          />
          {total > leads.length ? (
            <button onClick={mostrarMas} disabled={cargandoMas} className="btn-secondary mt-3 w-full">
              {cargandoMas ? "Cargando…" : `Mostrar ${Math.min(LEADS_POR_PAGINA, total - leads.length)} más (${(total - leads.length).toLocaleString("es-ES")} restantes)`}
            </button>
          ) : null}
        </div>
      ) : null}

      {modoSeleccion ? (
        <div className="glass-strong fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-30 mx-auto flex max-w-3xl flex-wrap items-center gap-2 rounded-xl p-2.5 shadow-lg md:bottom-6">
          <span className="px-1 text-sm font-medium text-ink">{seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}</span>
          <button onClick={() => setSeleccion(todosSeleccionados ? new Set() : new Set(leads.map((l) => l.id)))} className="btn-ghost px-2 text-xs">
            {todosSeleccionados ? "Quitar todos" : `Cargados (${leads.length})`}
          </button>
          <span className="flex flex-1 flex-wrap justify-end gap-2">
            <select
              aria-label="Cambiar estado"
              value=""
              disabled={seleccion.size === 0 || procesando}
              onChange={(e) => e.target.value && aplicarMasivo({ estado: e.target.value }, `movidos a ${ESTADO_LABEL[e.target.value]}`)}
              className={SELECT_TOOLBAR}
            >
              <option value="">Cambiar estado…</option>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {ESTADO_LABEL[e]}
                </option>
              ))}
            </select>
            {esAdmin ? (
              <select
                aria-label="Asignar a"
                value=""
                disabled={seleccion.size === 0 || procesando}
                onChange={(e) => {
                  const u = usuariosPorId[e.target.value];
                  if (u) aplicarMasivo({ asignado_a: u.id }, `asignados a ${u.nombre}`);
                }}
                className={SELECT_TOOLBAR}
              >
                <option value="">Asignar a…</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            ) : null}
            <button onClick={() => aplicarMasivo({ archivado: !verArchivados }, verArchivados ? "restaurados" : "archivados")} disabled={seleccion.size === 0 || procesando} className="btn-secondary">
              {verArchivados ? "Restaurar" : "Archivar"}
            </button>
            <button onClick={exportar} disabled={seleccion.size === 0} className="btn-secondary">
              Exportar
            </button>
            {esAdmin ? (
              <button onClick={() => setConfirmarBorrado(true)} disabled={seleccion.size === 0 || procesando} className="btn-ghost text-red-600 dark:text-red-400">
                Eliminar
              </button>
            ) : null}
          </span>
        </div>
      ) : null}

      {confirmarBorrado ? (
        <Modal titulo="Eliminar leads" onClose={() => setConfirmarBorrado(false)}>
          <p className="text-sm text-ink2">
            Se borrarán <strong className="text-ink">{seleccion.size} leads</strong> con todo su historial y seguimientos. No se puede deshacer. Si solo quieres
            quitarlos de en medio, archívalos.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmarBorrado(false)} className="btn-ghost">
              Cancelar
            </button>
            <button onClick={borrarSeleccion} disabled={procesando} className="btn-danger">
              {procesando ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
