"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useUsuario } from "@/context/UsuarioContext";
import { listarLeads, type FiltrosLeads } from "@/lib/data/leads";
import { listarUsuarios } from "@/lib/data/usuarios";
import { supabase } from "@/lib/supabase";
import type { Lead, Usuario } from "@/lib/types";
import { LeadCard } from "@/components/LeadCard";
import { LeadFilters } from "@/components/LeadFilters";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { IconBuscar, IconMas } from "@/components/Icons";

export default function LeadsPage() {
  const { usuarioActual, esAdmin, cargando: cargandoUsuario } = useUsuario();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [proximos, setProximos] = useState<Record<string, string>>({});
  const [busqueda, setBusqueda] = useState("");
  const [filtros, setFiltros] = useState<FiltrosLeads>({});
  const [filtroAsignado, setFiltroAsignado] = useState("todos");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  const filtrosEfectivos = useMemo<FiltrosLeads>(() => {
    if (!usuarioActual) return {};
    const base: FiltrosLeads = { ...filtros, busqueda };
    base.asignadoA = esAdmin ? filtroAsignado : usuarioActual.id;
    return base;
  }, [filtros, busqueda, usuarioActual, esAdmin, filtroAsignado]);

  useEffect(() => {
    if (cargandoUsuario || !usuarioActual) return;
    let activo = true;
    setCargando(true);
    setError(null);
    listarLeads(filtrosEfectivos)
      .then(async (data) => {
        if (!activo) return;
        setLeads(data);
        if (data.length > 0) {
          const ids = data.map((l) => l.id);
          const { data: eventos } = await supabase
            .from("eventos")
            .select("lead_id, fecha_hora")
            .in("lead_id", ids)
            .eq("completada", false)
            .order("fecha_hora", { ascending: true });
          if (!activo) return;
          const mapa: Record<string, string> = {};
          for (const ev of eventos ?? []) {
            if (!mapa[ev.lead_id]) mapa[ev.lead_id] = ev.fecha_hora;
          }
          setProximos(mapa);
        } else {
          setProximos({});
        }
      })
      .catch((e) => activo && setError(e.message ?? "No se han podido cargar los leads."))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosEfectivos, cargandoUsuario, usuarioActual]);

  const usuariosPorId = useMemo(() => {
    const m: Record<string, Usuario> = {};
    for (const u of usuarios) m[u.id] = u;
    return m;
  }, [usuarios]);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-8">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
        <Link
          href="/leads/nuevo"
          className="hidden items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white md:flex"
        >
          <IconMas className="h-4 w-4" />
          Nuevo lead
        </Link>
      </div>

      {esAdmin ? (
        <div className="mb-4 flex gap-2 overflow-x-auto">
          {[{ id: "todos", nombre: "Todos" }, ...usuarios].map((u) => (
            <button
              key={u.id}
              onClick={() => setFiltroAsignado(u.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ${
                filtroAsignado === u.id ? "bg-brand text-white" : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              {u.nombre}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3">
          <IconBuscar className="h-4 w-4 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Negocio, contacto o teléfono…"
            className="w-full bg-transparent text-base outline-none placeholder:text-slate-400"
          />
        </div>
        <LeadFilters filtros={filtros} onChange={setFiltros} />
      </div>

      {cargando ? <LoadingState texto="Cargando leads…" /> : null}
      {error ? <ErrorState mensaje={error} /> : null}

      {!cargando && !error && leads.length === 0 ? (
        <EmptyState titulo="No hay leads con estos filtros" descripcion="Prueba a cambiar la búsqueda o los filtros." />
      ) : null}

      {!cargando && !error ? (
        <div className="flex flex-col gap-3 pb-8">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              asignado={lead.asignado_a ? usuariosPorId[lead.asignado_a] : null}
              proximoSeguimiento={proximos[lead.id]}
            />
          ))}
        </div>
      ) : null}

      <Link
        href="/leads/nuevo"
        className="fixed bottom-24 right-5 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg md:hidden"
      >
        <IconMas className="h-6 w-6" />
      </Link>
    </div>
  );
}
