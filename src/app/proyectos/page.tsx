"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { actualizarProyecto, listarProyectos } from "@/lib/data/proyectos";
import { listarTareas } from "@/lib/data/tareas";
import { formatEuros } from "@/lib/constants";
import {
  COLUMNAS_KANBAN_PROYECTO,
  ESTADOS_PROYECTO_ACTIVOS,
  ESTADO_PROYECTO_LABEL,
  ESTADO_PROYECTO_PUNTO,
  PRIORIDAD_ORDEN,
  TIPO_PROYECTO_LABEL,
} from "@/lib/trabajo";
import type { EstadoProyecto, ProyectoConRelaciones } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";
import { KanbanBoard } from "@/components/ui/KanbanBoard";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { EstadoProyectoInsignia, FechaLimite, PrioridadIcono } from "@/components/trabajo/Insignias";
import { IconBuscar, IconMas } from "@/components/Icons";

type Vista = "lista" | "tablero";
type Filtro = "activos" | "entregados" | "todos" | "archivados";
const CLAVE_VISTA = "impulsa-proyectos-vista";

export default function ProyectosPage() {
  return (
    <SoloAdmin>
      <Suspense fallback={null}>
        <Proyectos />
      </Suspense>
    </SoloAdmin>
  );
}

type Progreso = { abiertas: number; total: number };

function Proyectos() {
  const { abrirAlta, versionDatos, avisar } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const cuentaFiltro = params.get("cuenta");

  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);
  const [progreso, setProgreso] = useState<Record<string, Progreso>>({});
  const [vista, setVista] = useState<Vista>("lista");
  const [filtro, setFiltro] = useState<Filtro>("activos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(CLAVE_VISTA);
      if (v === "lista" || v === "tablero") setVista(v);
    } catch {
      // Sin almacenamiento: vista por defecto.
    }
  }, []);

  function cambiarVista(v: Vista) {
    setVista(v);
    if (v === "tablero" && filtro === "archivados") setFiltro("activos");
    try {
      localStorage.setItem(CLAVE_VISTA, v);
    } catch {
      // Ignorado a propósito.
    }
  }

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const [ps, ts] = await Promise.all([listarProyectos({ archivados: filtro === "archivados" }), listarTareas()]);
      setProyectos(ps);
      const prog: Record<string, Progreso> = {};
      for (const t of ts) {
        if (!t.proyecto_id) continue;
        const p = (prog[t.proyecto_id] ??= { abiertas: 0, total: 0 });
        p.total++;
        if (t.estado !== "completada") p.abiertas++;
      }
      setProgreso(prog);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar los proyectos.");
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return proyectos
      .filter((p) => {
        if (cuentaFiltro && p.cuenta_id !== cuentaFiltro) return false;
        if (filtro === "activos" && !ESTADOS_PROYECTO_ACTIVOS.has(p.estado)) return false;
        if (filtro === "entregados" && p.estado !== "entregado") return false;
        if (!q) return true;
        return [p.nombre, p.cuenta?.nombre, p.marca?.nombre].some((t) => t?.toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (filtro === "entregados") return (b.entregado_en ?? "").localeCompare(a.entregado_en ?? "");
        const pr = PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad];
        if (pr !== 0) return pr;
        return (a.fecha_entrega ?? "9999").localeCompare(b.fecha_entrega ?? "9999");
      });
  }, [proyectos, filtro, busqueda, cuentaFiltro]);

  // En el tablero se ven también los entregados (última columna) y nunca los cancelados.
  const paraTablero = useMemo(
    () => proyectos.filter((p) => p.estado !== "cancelado" && (!cuentaFiltro || p.cuenta_id === cuentaFiltro)),
    [proyectos, cuentaFiltro]
  );

  const valorVisible = visibles.reduce((s, p) => s + (Number(p.importe) || 0), 0);
  const nombreCuenta = cuentaFiltro ? proyectos.find((p) => p.cuenta_id === cuentaFiltro)?.cuenta?.nombre : null;

  async function moverEstado(p: ProyectoConRelaciones, estado: EstadoProyecto) {
    if (p.estado === estado) return;
    const anterior = p;
    setProyectos((prev) => prev.map((x) => (x.id === p.id ? { ...x, estado } : x)));
    try {
      const actualizado = await actualizarProyecto(p.id, { estado });
      setProyectos((prev) => prev.map((x) => (x.id === p.id ? actualizado : x)));
    } catch (e) {
      setProyectos((prev) => prev.map((x) => (x.id === p.id ? anterior : x)));
      avisar(e instanceof Error ? e.message : "No se ha podido mover el proyecto.", { tono: "error" });
    }
  }

  return (
    <div className={`mx-auto px-4 pt-6 md:px-8 ${vista === "tablero" ? "max-w-[1500px]" : "max-w-6xl"}`}>
      <Cabecera
        titulo="Proyectos"
        subtitulo={
          cargando
            ? "…"
            : `${visibles.length} proyecto${visibles.length === 1 ? "" : "s"}${valorVisible > 0 ? ` · ${formatEuros(valorVisible)}` : ""}`
        }
        acciones={
          <>
            <Segmentado
              opciones={[
                { id: "lista", label: "Lista" },
                { id: "tablero", label: "Tablero" },
              ]}
              valor={vista}
              onChange={cambiarVista}
            />
            <button
              onClick={() => abrirAlta({ tipo: "proyecto", valores: cuentaFiltro ? { cuenta_id: cuentaFiltro } : undefined })}
              className="btn-primary"
            >
              <IconMas className="h-4 w-4" />
              Nuevo
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {vista === "lista" ? (
          <Segmentado
            opciones={[
              { id: "activos", label: "Activos" },
              { id: "entregados", label: "Entregados" },
              { id: "todos", label: "Todos" },
              { id: "archivados", label: "Archivados" },
            ]}
            valor={filtro}
            onChange={setFiltro}
          />
        ) : null}
        <div className="flex min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 md:max-w-xs">
          <IconBuscar className="h-3.5 w-3.5 text-ink3" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Filtrar por nombre, cuenta o marca"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ink3"
          />
        </div>
        {cuentaFiltro ? (
          <button onClick={() => router.replace("/proyectos")} className="chip border-line bg-mute text-ink2">
            Cuenta: {nombreCuenta ?? "…"} ×
          </button>
        ) : null}
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={6} /> : null}

      {!cargando && !error && vista === "tablero" ? (
        <KanbanBoard
          columnas={COLUMNAS_KANBAN_PROYECTO.map((c) => ({
            id: c.estado,
            titulo: ESTADO_PROYECTO_LABEL[c.estado],
            acento: ESTADO_PROYECTO_PUNTO[c.estado],
          }))}
          items={paraTablero.filter((p) => !busqueda || p.nombre.toLowerCase().includes(busqueda.toLowerCase()))}
          clave={(p) => p.id}
          columnaDe={(p) => COLUMNAS_KANBAN_PROYECTO.find((c) => c.incluye.includes(p.estado))?.estado ?? "pendiente"}
          onMover={(p, col) => moverEstado(p, col as EstadoProyecto)}
          resumenColumna={(lista) => {
            const total = lista.reduce((s, p) => s + (Number(p.importe) || 0), 0);
            return total > 0 ? formatEuros(total) : null;
          }}
          renderTarjeta={(p) => <TarjetaProyecto p={p} progreso={progreso[p.id]} />}
        />
      ) : null}

      {!cargando && !error && vista === "lista" ? (
        visibles.length === 0 ? (
          <VacioProyectos filtro={filtro} onCrear={() => abrirAlta({ tipo: "proyecto" })} />
        ) : (
          <TablaProyectos proyectos={visibles} progreso={progreso} />
        )
      ) : null}
    </div>
  );
}

function Subtitulo({ p }: { p: ProyectoConRelaciones }) {
  const partes = [p.cuenta?.nombre, p.marca?.nombre].filter(Boolean);
  return partes.length ? <span className="truncate text-xs text-ink3">{partes.join(" · ")}</span> : null;
}

function BarraProgreso({ progreso }: { progreso?: Progreso }) {
  if (!progreso || progreso.total === 0) return <span className="text-xs text-ink3">—</span>;
  const hechas = progreso.total - progreso.abiertas;
  return (
    <span className="flex items-center gap-2 text-xs text-ink2">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-mute">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${(hechas / progreso.total) * 100}%` }} />
      </span>
      {hechas}/{progreso.total}
    </span>
  );
}

function TarjetaProyecto({ p, progreso }: { p: ProyectoConRelaciones; progreso?: Progreso }) {
  return (
    <Link href={`/proyectos/${p.id}`} draggable={false} className="block">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug text-ink">{p.nombre}</p>
        <PrioridadIcono prioridad={p.prioridad} />
      </div>
      <div className="mt-0.5 flex">
        <Subtitulo p={p} />
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="chip border-line text-ink3">{TIPO_PROYECTO_LABEL[p.tipo]}</span>
        <div className="flex items-center gap-2">
          <FechaLimite fecha={p.fecha_entrega} completada={p.estado === "entregado"} />
          {p.importe != null ? <span className="text-xs font-semibold text-ink">{formatEuros(p.importe)}</span> : null}
        </div>
      </div>
      {progreso && progreso.total > 0 ? (
        <div className="mt-2">
          <BarraProgreso progreso={progreso} />
        </div>
      ) : null}
    </Link>
  );
}

function TablaProyectos({ proyectos, progreso }: { proyectos: ProyectoConRelaciones[]; progreso: Record<string, Progreso> }) {
  return (
    <>
      {/* Escritorio: tabla densa */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-32" />
            <col className="w-28" />
            <col className="w-28" />
            <col className="w-32" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink3">
              <th className="px-4 py-2.5 font-medium">Proyecto</th>
              <th className="px-3 py-2.5 font-medium">Estado</th>
              <th className="px-3 py-2.5 font-medium">Tipo</th>
              <th className="px-3 py-2.5 font-medium">Tareas</th>
              <th className="px-3 py-2.5 font-medium">Entrega</th>
              <th className="px-4 py-2.5 text-right font-medium">Importe</th>
            </tr>
          </thead>
          <tbody>
            {proyectos.map((p) => (
              <tr key={p.id} className="group border-b border-line last:border-0 hover:bg-mute/50">
                <td className="max-w-0 px-4 py-2.5">
                  <Link href={`/proyectos/${p.id}`} className="flex items-center gap-2">
                    <PrioridadIcono prioridad={p.prioridad} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-ink group-hover:underline">{p.nombre}</span>
                      <Subtitulo p={p} />
                    </span>
                  </Link>
                </td>
                <td className="px-3 py-2.5">
                  <EstadoProyectoInsignia estado={p.estado} />
                </td>
                <td className="px-3 py-2.5 text-xs text-ink2">{TIPO_PROYECTO_LABEL[p.tipo]}</td>
                <td className="px-3 py-2.5">
                  <BarraProgreso progreso={progreso[p.id]} />
                </td>
                <td className="px-3 py-2.5">
                  <FechaLimite fecha={p.fecha_entrega} completada={p.estado === "entregado"} />
                </td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">
                  {p.importe != null ? formatEuros(p.importe) : <span className="text-ink3">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Móvil: filas compactas */}
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:hidden">
        {proyectos.map((p) => (
          <Link key={p.id} href={`/proyectos/${p.id}`} className="block px-4 py-3 active:bg-mute">
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-ink">{p.nombre}</span>
                <Subtitulo p={p} />
              </span>
              {p.importe != null ? <span className="shrink-0 text-sm font-semibold text-ink">{formatEuros(p.importe)}</span> : null}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <EstadoProyectoInsignia estado={p.estado} />
              <PrioridadIcono prioridad={p.prioridad} />
              <FechaLimite fecha={p.fecha_entrega} completada={p.estado === "entregado"} />
              <span className="ml-auto">
                <BarraProgreso progreso={progreso[p.id]} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function VacioProyectos({ filtro, onCrear }: { filtro: Filtro; onCrear: () => void }) {
  const textos: Record<Filtro, string> = {
    activos: "No tienes proyectos activos.",
    entregados: "Aún no has entregado ningún proyecto.",
    todos: "Todavía no hay proyectos.",
    archivados: "No hay proyectos archivados.",
  };
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <p className="text-sm font-medium text-ink">{textos[filtro]}</p>
      <p className="mt-1 max-w-sm text-sm text-ink3">
        Un proyecto agrupa un trabajo con su cuenta (p. ej. Fer), la marca, las tareas, la entrega y el importe.
      </p>
      {filtro !== "archivados" ? (
        <button onClick={onCrear} className="btn-primary mt-4">
          <IconMas className="h-4 w-4" />
          Crear proyecto
        </button>
      ) : null}
    </div>
  );
}
