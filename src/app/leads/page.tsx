"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUsuario } from "@/context/UsuarioContext";
import {
  actualizarLead,
  actualizarLeads,
  eliminarLeads,
  listarLeads,
  obtenerProximosSeguimientos,
  type FiltrosLeads,
} from "@/lib/data/leads";
import { listarUsuarios } from "@/lib/data/usuarios";
import type { Lead, LeadUpdate, Usuario } from "@/lib/types";
import { ESTADOS, ESTADO_LABEL, formatEuros, sumarValor } from "@/lib/constants";
import { descargarCsv, leadsACsv } from "@/lib/exportar";
import { LeadCard } from "@/components/LeadCard";
import { LeadBoard } from "@/components/LeadBoard";
import { LeadFilters } from "@/components/LeadFilters";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Modal } from "@/components/Modal";
import { IconBuscar, IconMas, IconImportar } from "@/components/Icons";

type Vista = "lista" | "tablero";

const POR_PAGINA = 50;
const CLAVE_VISTA = "impulsa-leads-vista";

export default function LeadsPage() {
  const { usuarioActual, esAdmin, cargando: cargandoUsuario } = useUsuario();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [proximos, setProximos] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [filtros, setFiltros] = useState<FiltrosLeads>({});
  const [filtroAsignado, setFiltroAsignado] = useState("todos");
  const [verArchivados, setVerArchivados] = useState(false);
  const [vista, setVista] = useState<Vista>("lista");
  const [visibles, setVisibles] = useState(POR_PAGINA);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

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

  useEffect(() => {
    if (cargandoUsuario || !usuarioActual) return;
    let activo = true;
    setCargando(true);
    setError(null);
    setVisibles(POR_PAGINA);
    setSeleccion(new Set());
    Promise.all([listarLeads(filtrosEfectivos), obtenerProximosSeguimientos().catch(() => ({}))])
      .then(([data, mapa]) => {
        if (!activo) return;
        setLeads(data);
        setProximos(mapa);
      })
      .catch((e) => activo && setError(e.message ?? "No se han podido cargar los leads."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [filtrosEfectivos, cargandoUsuario, usuarioActual]);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso]);

  const usuariosPorId = useMemo(() => {
    const m: Record<string, Usuario> = {};
    for (const u of usuarios) m[u.id] = u;
    return m;
  }, [usuarios]);

  const valorTotal = useMemo(() => sumarValor(leads), [leads]);

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
      setAviso(e instanceof Error ? e.message : "No se ha podido mover el lead.");
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
      setLeads((prev) => prev.map((l) => porId.get(l.id) ?? l).filter(sigueVisible));
      const omitidos = ids.length - actualizados.length;
      setAviso(
        `${actualizados.length} lead${actualizados.length === 1 ? "" : "s"} ${descripcion}` +
          (omitidos > 0 ? ` · ${omitidos} sin permiso` : "")
      );
      salirSeleccion();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se ha podido aplicar el cambio.");
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
      setAviso(`${borrados} lead${borrados === 1 ? "" : "s"} eliminado${borrados === 1 ? "" : "s"}`);
      salirSeleccion();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se han podido eliminar los leads.");
    } finally {
      setProcesando(false);
      setConfirmarBorrado(false);
    }
  }

  function exportar() {
    const aExportar = seleccion.size > 0 ? leads.filter((l) => seleccion.has(l.id)) : leads;
    const fecha = new Date().toISOString().slice(0, 10);
    descargarCsv(`leads-impulsa-${fecha}.csv`, leadsACsv(aExportar, usuariosPorId));
  }

  return (
    <div className={`mx-auto px-4 pt-6 md:px-8 ${vista === "tablero" ? "max-w-[1400px]" : "max-w-3xl"}`}>
      <div className="mb-5 flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold text-ink">Leads</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl border border-line bg-surface p-1 text-sm font-semibold">
            {(["lista", "tablero"] as const).map((v) => (
              <button
                key={v}
                onClick={() => cambiarVista(v)}
                className={`rounded-lg px-3 py-1.5 ${vista === v ? "bg-brand-gradient text-brand-ink" : "text-ink2"}`}
              >
                {v === "lista" ? "Lista" : "Tablero"}
              </button>
            ))}
          </div>
          <Link
            href="/importar"
            className="hidden items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-ink2 hover:text-ink md:flex"
          >
            <IconImportar className="h-4 w-4" />
            Importar
          </Link>
          <Link
            href="/leads/nuevo"
            className="hidden items-center gap-1.5 rounded-xl bg-brand-gradient px-4 py-2.5 text-sm font-semibold text-brand-ink md:flex"
          >
            <IconMas className="h-4 w-4" />
            Nuevo lead
          </Link>
        </div>
      </div>

      {esAdmin ? (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {[{ id: "todos", nombre: "Todos" }, ...usuarios].map((u) => (
            <button
              key={u.id}
              onClick={() => setFiltroAsignado(u.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                filtroAsignado === u.id ? "bg-brand-gradient text-brand-ink" : "border border-line bg-surface text-ink2"
              }`}
            >
              {u.nombre}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3 py-3">
          <IconBuscar className="h-4 w-4 text-ink3" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Negocio, contacto, teléfono, email…"
            className="w-full bg-transparent text-base outline-none placeholder:text-ink3"
          />
        </div>
        <LeadFilters filtros={filtros} onChange={setFiltros} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-ink2">
          {cargando ? "…" : `${leads.length} lead${leads.length === 1 ? "" : "s"}`}
          {!cargando && valorTotal > 0 ? <span className="text-ink3"> · {formatEuros(valorTotal)}</span> : null}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVerArchivados((v) => !v)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              verArchivados ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" : "border border-line bg-surface text-ink2"
            }`}
          >
            {verArchivados ? "Viendo archivados" : "Archivados"}
          </button>
          <button
            onClick={exportar}
            disabled={leads.length === 0}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink2 disabled:opacity-50"
          >
            Exportar CSV
          </button>
          {vista === "lista" ? (
            <button
              onClick={() => (modoSeleccion ? salirSeleccion() : setModoSeleccion(true))}
              disabled={leads.length === 0}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                modoSeleccion ? "bg-ink text-canvas" : "border border-line bg-surface text-ink2"
              }`}
            >
              {modoSeleccion ? "Cancelar" : "Seleccionar"}
            </button>
          ) : null}
        </div>
      </div>

      {cargando ? <LoadingState texto="Cargando leads…" /> : null}
      {error ? <ErrorState mensaje={error} /> : null}

      {!cargando && !error && leads.length === 0 ? (
        <EmptyState
          titulo={verArchivados ? "No hay leads archivados" : "No hay leads con estos filtros"}
          descripcion="Prueba a cambiar la búsqueda o los filtros."
        />
      ) : null}

      {!cargando && !error && leads.length > 0 && vista === "tablero" ? (
        <LeadBoard leads={leads} usuariosPorId={usuariosPorId} proximos={proximos} onMover={moverLead} />
      ) : null}

      {!cargando && !error && vista === "lista" ? (
        <div className={`flex flex-col gap-3 ${modoSeleccion ? "pb-44" : "pb-8"}`}>
          {leads.slice(0, visibles).map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              asignado={lead.asignado_a ? usuariosPorId[lead.asignado_a] : null}
              proximoSeguimiento={proximos[lead.id]}
              seleccionable={modoSeleccion}
              seleccionado={seleccion.has(lead.id)}
              onToggleSeleccion={() => toggleSeleccion(lead.id)}
            />
          ))}
          {leads.length > visibles ? (
            <button
              onClick={() => setVisibles((v) => v + POR_PAGINA)}
              className="rounded-2xl border border-line bg-surface py-3 text-sm font-semibold text-ink2"
            >
              Mostrar {Math.min(POR_PAGINA, leads.length - visibles)} más ({leads.length - visibles} restantes)
            </button>
          ) : null}
        </div>
      ) : null}

      {modoSeleccion ? (
        <div
          className="glass-strong fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] z-30 mx-auto max-w-3xl rounded-2xl p-3 shadow-glass dark:shadow-glass-dark md:bottom-28"
        >
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-ink">{seleccion.size} seleccionado{seleccion.size === 1 ? "" : "s"}</span>
            <button
              onClick={() => setSeleccion(todosSeleccionados ? new Set() : new Set(leads.map((l) => l.id)))}
              className="text-xs font-semibold text-brand-dark dark:text-brand"
            >
              {todosSeleccionados ? "Quitar todos" : `Seleccionar los ${leads.length}`}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value=""
              disabled={seleccion.size === 0 || procesando}
              onChange={(e) => e.target.value && aplicarMasivo({ estado: e.target.value }, `movidos a ${ESTADO_LABEL[e.target.value]}`)}
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-2 py-2 text-sm disabled:opacity-50"
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
                value=""
                disabled={seleccion.size === 0 || procesando}
                onChange={(e) => {
                  const u = usuariosPorId[e.target.value];
                  if (u) aplicarMasivo({ asignado_a: u.id }, `asignados a ${u.nombre}`);
                }}
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-2 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Asignar a…</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={() => aplicarMasivo({ archivado: !verArchivados }, verArchivados ? "restaurados" : "archivados")}
              disabled={seleccion.size === 0 || procesando}
              className="flex-1 rounded-xl border border-line bg-surface py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              {verArchivados ? "Restaurar" : "Archivar"}
            </button>
            <button
              onClick={exportar}
              disabled={seleccion.size === 0}
              className="flex-1 rounded-xl border border-line bg-surface py-2 text-sm font-semibold text-ink disabled:opacity-50"
            >
              Exportar
            </button>
            {esAdmin ? (
              <button
                onClick={() => setConfirmarBorrado(true)}
                disabled={seleccion.size === 0 || procesando}
                className="flex-1 rounded-xl border border-red-200 py-2 text-sm font-semibold text-red-600 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400"
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {confirmarBorrado ? (
        <Modal titulo="Eliminar leads" onClose={() => setConfirmarBorrado(false)}>
          <p className="text-sm text-ink2">
            Se borrarán <strong className="text-ink">{seleccion.size} leads</strong> con todo su historial y seguimientos. No se
            puede deshacer. Si solo quieres quitarlos de en medio, archívalos.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setConfirmarBorrado(false)}
              className="flex-1 rounded-xl border border-line py-3.5 text-base font-medium text-ink2"
            >
              Cancelar
            </button>
            <button
              onClick={borrarSeleccion}
              disabled={procesando}
              className="flex-1 rounded-xl bg-red-600 py-3.5 text-base font-semibold text-white disabled:opacity-60"
            >
              {procesando ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </Modal>
      ) : null}

      {aviso ? (
        <div
          role="status"
          className="fixed inset-x-4 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-40 mx-auto max-w-sm rounded-xl bg-ink px-4 py-3 text-center text-sm font-medium text-canvas shadow-lg"
        >
          {aviso}
        </div>
      ) : null}
    </div>
  );
}
