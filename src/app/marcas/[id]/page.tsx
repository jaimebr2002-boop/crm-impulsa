"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApp, useContextoPantalla, usePestanaPedida } from "@/context/AppContext";
import { actualizarMarca, obtenerMarca, type MarcaConCuenta } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import { listarTareas } from "@/lib/data/tareas";
import { formatEuros } from "@/lib/constants";
import { resumirProyectos } from "@/lib/metricas";
import { ESTADOS_PROYECTO_ACTIVOS } from "@/lib/trabajo";
import type { ProyectoConRelaciones, TareaConRelaciones } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { Pestanas, reflejarTabEnUrl, tabDesdeUrl } from "@/components/trabajo/Pestanas";
import { ListaProyectos } from "@/components/trabajo/ListaProyectos";
import { SeccionTareas } from "@/components/trabajo/SeccionTareas";
import { ActividadPaginada } from "@/components/trabajo/ActividadPaginada";
import { NotasAutoguardado } from "@/components/trabajo/NotasAutoguardado";
import { Segmentado } from "@/components/ui/Cabecera";
import { SkeletonLineas, SkeletonTarjetas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { MarcaForm } from "@/components/forms/MarcaForm";
import { IconMas } from "@/components/Icons";

const TABS = ["proyectos", "tareas", "actividad", "notas"] as const;
type Tab = (typeof TABS)[number];

export default function MarcaPage() {
  return (
    <SoloAdmin>
      <Suspense fallback={null}>
        <FichaMarca />
      </Suspense>
    </SoloAdmin>
  );
}

function FichaMarca() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { abrirAlta, versionDatos, avisar } = useApp();
  const [marca, setMarca] = useState<MarcaConCuenta | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);
  const [tareas, setTareas] = useState<TareaConRelaciones[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [tab, setTab] = useState<Tab>(tabDesdeUrl(params.get("tab"), TABS, "proyectos"));
  const [filtro, setFiltro] = useState<"activos" | "entregados" | "todos">("activos");

  const cambiarTab = useCallback(
    (t: string) => {
      const v = tabDesdeUrl(t, TABS, "proyectos");
      setTab(v);
      reflejarTabEnUrl(`/marcas/${id}`, v, "proyectos");
    },
    [id]
  );
  usePestanaPedida(cambiarTab);
  useContextoPantalla(marca?.cuenta ? { tipo: "marca", id: marca.id, nombre: marca.nombre, cuentaId: marca.cuenta.id } : null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [m, ps] = await Promise.all([obtenerMarca(id), listarProyectos()]);
      const suyos = ps.filter((p) => p.marca_id === id);
      setMarca(m);
      setProyectos(suyos);
      setTareas(suyos.length ? await listarTareas({ proyectoIds: suyos.map((p) => p.id), diasCompletadas: 14 }) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido cargar la marca.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const resumen = useMemo(() => resumirProyectos(proyectos), [proyectos]);
  const filtroActividad = useMemo(() => ({ marca: { id, proyectoIds: proyectos.map((p) => p.id) } }), [id, proyectos]);

  if (cargando) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
        <div className="skeleton mb-6 h-9 w-48" />
        <SkeletonTarjetas n={4} />
        <div className="mt-6">
          <SkeletonLineas filas={4} />
        </div>
      </div>
    );
  }
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje={error} onReintentar={cargar} /></div>;
  if (!marca) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje="Esta marca no existe." /></div>;

  const abiertas = tareas.filter((t) => t.estado !== "completada");
  const visibles = proyectos.filter((p) =>
    filtro === "activos" ? ESTADOS_PROYECTO_ACTIVOS.has(p.estado) : filtro === "entregados" ? p.estado === "entregado" : true
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 md:px-8">
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-ink3">
        <Link href="/cuentas" className="hidden hover:text-ink sm:inline">
          Cuentas
        </Link>
        <span className="hidden sm:inline">/</span>
        {marca.cuenta ? (
          <Link href={`/cuentas/${marca.cuenta.id}`} className="hover:text-ink">
            <span className="sm:hidden">← </span>
            {marca.cuenta.nombre}
          </Link>
        ) : null}
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight text-ink md:text-[28px]">{marca.nombre}</h1>
          <p className="mt-0.5 text-sm text-ink2">
            Marca de {marca.cuenta?.nombre ?? "—"}
            {marca.web ? (
              <a href={marca.web} target="_blank" rel="noreferrer" className="ml-2 text-ink3 hover:text-ink">
                · {marca.web.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => abrirAlta({ tipo: "proyecto", valores: { cuenta_id: marca.cuenta_id, marca_id: marca.id } })}
            className="btn-primary"
          >
            <IconMas className="h-4 w-4" />
            Proyecto
          </button>
          <button onClick={() => setEditando(true)} className="btn-secondary">
            Editar
          </button>
        </div>
      </div>

      <div className="mb-6">
        <FilaKpis
          columnas="md:grid-cols-4"
          kpis={[
            { etiqueta: "Proyectos activos", valor: resumen.activos },
            { etiqueta: "Entregados", valor: resumen.entregados },
            { etiqueta: "Valor de proyectos", valor: formatEuros(resumen.valorProyectos) },
            { etiqueta: "Tareas abiertas", valor: abiertas.length },
          ]}
        />
      </div>

      <Pestanas
        activa={tab}
        onChange={cambiarTab}
        pestanas={[
          { id: "proyectos", label: "Proyectos", n: proyectos.length },
          { id: "tareas", label: "Tareas", n: abiertas.length },
          { id: "actividad", label: "Actividad" },
          { id: "notas", label: "Notas" },
        ]}
      />

      {tab === "proyectos" ? (
        <div className="flex flex-col gap-3">
          <Segmentado
            opciones={[
              { id: "activos", label: "Activos" },
              { id: "entregados", label: "Entregados" },
              { id: "todos", label: "Todos" },
            ]}
            valor={filtro}
            onChange={setFiltro}
          />
          <ListaProyectos proyectos={visibles} contexto="marca" vacio="No hay proyectos con este filtro." />
        </div>
      ) : null}

      {tab === "tareas" ? <SeccionTareas tareas={tareas} setTareas={setTareas} /> : null}

      {tab === "actividad" ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-2">
          <ActividadPaginada filtro={filtroActividad} />
        </div>
      ) : null}

      {tab === "notas" ? (
        <NotasAutoguardado
          key={marca.id}
          inicial={marca.notas ?? ""}
          onGuardar={async (notas) => {
            await actualizarMarca(marca.id, { notas: notas || null });
          }}
          placeholder={`Tono de ${marca.nombre}, guía de estilo, accesos, contacto de marketing…`}
        />
      ) : null}

      {editando ? (
        <Modal titulo="Editar marca" onClose={() => setEditando(false)}>
          <MarcaForm
            botonTexto="Guardar"
            inicial={{ nombre: marca.nombre, cuenta_id: marca.cuenta_id, web: marca.web }}
            onCancelar={() => setEditando(false)}
            onSubmit={async (v) => {
              await actualizarMarca(marca.id, v);
              setEditando(false);
              avisar("Marca actualizada");
              cargar();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
