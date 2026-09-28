"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApp, useContextoPantalla, usePestanaPedida } from "@/context/AppContext";
import { actualizarCuenta, listarMarcas, obtenerCuenta } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import { listarTareas } from "@/lib/data/tareas";
import { listarActividad } from "@/lib/data/actividad";
import { facturacionDeProyectos, listarCobros, listarFacturas } from "@/lib/data/finanzas";
import { eur, resumenFacturas } from "@/lib/finanzas";
import { formatEuros } from "@/lib/constants";
import { hoyYMD } from "@/lib/dates";
import { resumirProyectos } from "@/lib/metricas";
import { ESTADOS_PROYECTO_ACTIVOS, TIPO_CUENTA_LABEL } from "@/lib/trabajo";
import type {
  Actividad,
  CobroConFactura,
  Cuenta,
  FacturaConCuenta,
  Marca,
  ProyectoConRelaciones,
  ProyectoFacturacion,
  TareaConRelaciones,
} from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { Pestanas, reflejarTabEnUrl, tabDesdeUrl } from "@/components/trabajo/Pestanas";
import { ListaProyectos } from "@/components/trabajo/ListaProyectos";
import { ProyectosAtencion } from "@/components/trabajo/ProyectosAtencion";
import { SeccionTareas } from "@/components/trabajo/SeccionTareas";
import { ActividadLista } from "@/components/trabajo/ActividadLista";
import { ActividadPaginada } from "@/components/trabajo/ActividadPaginada";
import { NotasAutoguardado } from "@/components/trabajo/NotasAutoguardado";
import { Segmentado } from "@/components/ui/Cabecera";
import { SkeletonLineas, SkeletonTarjetas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { FinanzasCuenta } from "@/components/finanzas/FinanzasCuenta";
import { Panel } from "@/components/ui/Panel";
import { Modal } from "@/components/Modal";
import { Avatar } from "@/components/Avatar";
import { CuentaForm } from "@/components/forms/CuentaForm";
import { IconFlecha, IconMas } from "@/components/Icons";

const TABS = ["resumen", "proyectos", "marcas", "tareas", "finanzas", "actividad", "notas"] as const;
type Tab = (typeof TABS)[number];

export default function CuentaPage() {
  return (
    <SoloAdmin>
      <Suspense fallback={null}>
        <FichaCuenta />
      </Suspense>
    </SoloAdmin>
  );
}

function FichaCuenta() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const { abrirAlta, versionDatos, avisar } = useApp();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);
  const [tareas, setTareas] = useState<TareaConRelaciones[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [facturas, setFacturas] = useState<FacturaConCuenta[]>([]);
  const [cobros, setCobros] = useState<CobroConFactura[]>([]);
  const [facturacion, setFacturacion] = useState<Record<string, ProyectoFacturacion>>({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [tab, setTab] = useState<Tab>(tabDesdeUrl(params.get("tab"), TABS, "resumen"));
  const [filtroProyectos, setFiltroProyectos] = useState<"activos" | "entregados" | "todos">("activos");

  const cambiarTab = useCallback(
    (t: string) => {
      const v = tabDesdeUrl(t, TABS, "resumen");
      setTab(v);
      reflejarTabEnUrl(`/cuentas/${id}`, v, "resumen");
    },
    [id]
  );
  usePestanaPedida(cambiarTab);
  useContextoPantalla(cuenta ? { tipo: "cuenta", id: cuenta.id, nombre: cuenta.nombre } : null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [c, m, ps, a, fs, cs, fp] = await Promise.all([
        obtenerCuenta(id),
        listarMarcas({ cuentaId: id }),
        listarProyectos(),
        listarActividad({ cuentaId: id, limite: 6 }),
        listarFacturas({ cuentaId: id }),
        listarCobros(),
        facturacionDeProyectos(),
      ]);
      const suyos = ps.filter((p) => p.cuenta_id === id);
      setCuenta(c);
      setMarcas(m);
      setProyectos(suyos);
      setActividad(a);
      setFacturas(fs);
      setCobros(cs.filter((x) => x.factura?.cuenta_id === id));
      setFacturacion(fp);
      setTareas(suyos.length ? await listarTareas({ proyectoIds: suyos.map((p) => p.id), diasCompletadas: 14 }) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido cargar la cuenta.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const resumen = useMemo(() => resumirProyectos(proyectos), [proyectos]);
  const fin = useMemo(() => resumenFacturas(facturas), [facturas]);
  const tareasAbiertas = tareas.filter((t) => t.estado !== "completada");
  const filtroActividad = useMemo(() => ({ cuentaId: id }), [id]);

  if (cargando) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
        <div className="skeleton mb-6 h-9 w-48" />
        <SkeletonTarjetas n={5} />
        <div className="mt-6">
          <SkeletonLineas filas={4} />
        </div>
      </div>
    );
  }
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje={error} onReintentar={cargar} /></div>;
  if (!cuenta) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje="Esta cuenta no existe." /></div>;

  const proyectosFiltrados = proyectos.filter((p) =>
    filtroProyectos === "activos"
      ? ESTADOS_PROYECTO_ACTIVOS.has(p.estado)
      : filtroProyectos === "entregados"
        ? p.estado === "entregado"
        : true
  );
  const porMarca = (marcaId: string) => resumirProyectos(proyectos.filter((p) => p.marca_id === marcaId));
  const sinMarca = proyectos.filter((p) => !p.marca_id);

  async function guardarNotas(notas: string) {
    const c = await actualizarCuenta(id, { notas: notas || null });
    setCuenta(c);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 md:px-8">
      <nav className="mb-3 text-sm text-ink3">
        <Link href="/cuentas" className="hover:text-ink">
          Cuentas
        </Link>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar nombre={cuenta.nombre} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight text-ink md:text-[28px]">{cuenta.nombre}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink2">
              {TIPO_CUENTA_LABEL[cuenta.tipo]}
              {cuenta.email ? (
                <a href={`mailto:${cuenta.email}`} className="text-ink3 hover:text-ink">
                  · {cuenta.email}
                </a>
              ) : null}
              {cuenta.telefono ? (
                <a href={`tel:${cuenta.telefono}`} className="text-ink3 hover:text-ink">
                  · {cuenta.telefono}
                </a>
              ) : null}
              {cuenta.lead_id ? (
                <Link href={`/leads/${cuenta.lead_id}`} className="text-ink3 hover:text-ink">
                  · Ver lead de origen
                </Link>
              ) : null}
              {cuenta.archivada ? <span className="chip border-amber-300 text-amber-700">Archivada</span> : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => abrirAlta({ tipo: "proyecto", valores: { cuenta_id: cuenta.id } })} className="btn-primary">
            <IconMas className="h-4 w-4" />
            Proyecto
          </button>
          <button onClick={() => setEditando(true)} className="btn-secondary">
            Editar
          </button>
          <button
            onClick={async () => {
              try {
                setCuenta(await actualizarCuenta(id, { archivada: !cuenta.archivada }));
                avisar(cuenta.archivada ? "Cuenta restaurada" : "Cuenta archivada");
              } catch (e) {
                avisar(e instanceof Error ? e.message : "No se ha podido guardar.", { tono: "error" });
              }
            }}
            className="btn-ghost"
          >
            {cuenta.archivada ? "Restaurar" : "Archivar"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <FilaKpis
          columnas="md:grid-cols-3 xl:grid-cols-6"
          kpis={[
            {
              etiqueta: "Proyectos activos",
              valor: resumen.activos,
              nota: tareasAbiertas.some((t) => t.fecha_limite && t.fecha_limite < hoyYMD())
                ? "Hay tareas vencidas"
                : `${resumen.entregados} entregado${resumen.entregados === 1 ? "" : "s"}`,
              alerta: tareasAbiertas.some((t) => t.fecha_limite && t.fecha_limite < hoyYMD()),
            },
            { etiqueta: "Valor de proyectos", valor: formatEuros(resumen.valorProyectos), nota: "Sin cancelados · sin IVA" },
            { etiqueta: "Valor en curso", valor: formatEuros(resumen.valorEnCurso), nota: "Proyectos activos" },
            { etiqueta: "Facturado", valor: eur(fin.facturado), nota: `${eur(fin.facturadoBase)} base` },
            { etiqueta: "Cobrado", valor: eur(fin.cobrado) },
            {
              etiqueta: "Pendiente",
              valor: eur(fin.pendiente),
              nota: fin.vencido > 0 ? `${eur(fin.vencido)} vencido` : undefined,
              alerta: fin.vencido > 0,
            },
          ]}
        />
      </div>

      <Pestanas
        activa={tab}
        onChange={cambiarTab}
        pestanas={[
          { id: "resumen", label: "Resumen" },
          { id: "proyectos", label: "Proyectos", n: proyectos.length },
          { id: "marcas", label: "Marcas", n: marcas.length },
          { id: "tareas", label: "Tareas", n: tareasAbiertas.length },
          { id: "finanzas", label: "Finanzas", n: facturas.length },
          { id: "actividad", label: "Actividad" },
          { id: "notas", label: "Notas" },
        ]}
      />

      {tab === "resumen" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            <Panel titulo="Requieren atención" accion={{ texto: "Todos los proyectos", onClick: () => cambiarTab("proyectos") }}>
              <ProyectosAtencion proyectos={proyectos} mostrarOrigen={false} vacio="Todo en orden con esta cuenta." />
            </Panel>
            <Panel titulo="Actividad reciente" accion={{ texto: "Ver toda", onClick: () => cambiarTab("actividad") }}>
              <div className="px-4 py-1">
                <ActividadLista items={actividad} vacio="Sin actividad todavía." />
              </div>
            </Panel>
          </div>
          <div className="flex flex-col gap-6">
            <Panel titulo="Marcas" accion={{ texto: "Gestionar", onClick: () => cambiarTab("marcas") }}>
              {marcas.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-ink3">Sin marcas.</p>
              ) : (
                <div className="divide-y divide-line">
                  {marcas.map((m) => {
                    const r = porMarca(m.id);
                    return (
                      <Link key={m.id} href={`/marcas/${m.id}`} className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-mute/50">
                        <span className="truncate text-sm font-medium text-ink">{m.nombre}</span>
                        <span className="shrink-0 text-xs text-ink3">
                          {r.activos} activo{r.activos === 1 ? "" : "s"} · {formatEuros(r.valorProyectos)}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Panel>
            <Panel titulo="Notas" accion={{ texto: "Editar", onClick: () => cambiarTab("notas") }}>
              <p className="line-clamp-6 whitespace-pre-wrap px-4 py-3 text-sm text-ink2">
                {cuenta.notas || <span className="text-ink3">Forma de trabajo, acuerdos, preferencias…</span>}
              </p>
            </Panel>
          </div>
        </div>
      ) : null}

      {tab === "proyectos" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmentado
              opciones={[
                { id: "activos", label: "Activos" },
                { id: "entregados", label: "Entregados" },
                { id: "todos", label: "Todos" },
              ]}
              valor={filtroProyectos}
              onChange={setFiltroProyectos}
            />
            <button onClick={() => abrirAlta({ tipo: "proyecto", valores: { cuenta_id: cuenta.id } })} className="btn-secondary">
              <IconMas className="h-4 w-4" />
              Proyecto
            </button>
          </div>
          <ListaProyectos proyectos={proyectosFiltrados} contexto="cuenta" vacio="No hay proyectos con este filtro." />
        </div>
      ) : null}

      {tab === "marcas" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button onClick={() => abrirAlta({ tipo: "marca", cuentaId: cuenta.id })} className="btn-secondary">
              <IconMas className="h-4 w-4" />
              Marca
            </button>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            {marcas.length === 0 && sinMarca.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink3">
                Añade las empresas o marcas para las que trabajas a través de {cuenta.nombre}.
              </p>
            ) : null}
            <div className="divide-y divide-line">
              {marcas.map((m) => {
                const r = porMarca(m.id);
                return (
                  <Link key={m.id} href={`/marcas/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-mute/50">
                    <Avatar nombre={m.nombre} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{m.nombre}</span>
                      <span className="block truncate text-xs text-ink3">{m.web?.replace(/^https?:\/\//, "") ?? "Sin web"}</span>
                    </span>
                    <span className="hidden w-24 text-right text-xs text-ink2 sm:block">
                      {r.activos} activo{r.activos === 1 ? "" : "s"}
                    </span>
                    <span className="hidden w-24 text-right text-xs text-ink2 sm:block">{r.total} en total</span>
                    <span className="w-24 text-right text-sm font-medium tabular-nums text-ink">{formatEuros(r.valorProyectos)}</span>
                    <IconFlecha className="h-3.5 w-3.5 text-ink3" />
                  </Link>
                );
              })}
              {sinMarca.length ? (
                <div className="flex items-center gap-3 px-4 py-3 text-sm text-ink3">
                  <span className="flex-1">Proyectos sin marca</span>
                  <span className="w-24 text-right text-sm tabular-nums">{formatEuros(resumirProyectos(sinMarca).valorProyectos)}</span>
                  <span className="w-3.5" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === "tareas" ? (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <button
              onClick={() => abrirAlta({ tipo: "tarea", cuentaId: cuenta.id })}
              disabled={proyectos.length === 0}
              className="btn-secondary"
              title={proyectos.length === 0 ? "Crea antes un proyecto" : undefined}
            >
              <IconMas className="h-4 w-4" />
              Tarea
            </button>
          </div>
          <SeccionTareas tareas={tareas} setTareas={setTareas} vacio="Sin tareas abiertas en los proyectos de esta cuenta." />
        </div>
      ) : null}

      {tab === "finanzas" ? (
        <FinanzasCuenta cuentaId={cuenta.id} proyectos={proyectos} facturas={facturas} cobros={cobros} facturacion={facturacion} />
      ) : null}

      {tab === "actividad" ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-2">
          <ActividadPaginada filtro={filtroActividad} vacio="Sin actividad todavía." />
        </div>
      ) : null}

      {tab === "notas" ? (
        <NotasAutoguardado
          key={cuenta.id}
          inicial={cuenta.notas ?? ""}
          onGuardar={guardarNotas}
          placeholder={`Cómo trabaja ${cuenta.nombre}, qué habéis acordado, preferencias, contexto…`}
        />
      ) : null}

      {editando ? (
        <Modal titulo="Editar cuenta" onClose={() => setEditando(false)}>
          <CuentaForm
            botonTexto="Guardar"
            inicial={cuenta}
            onCancelar={() => setEditando(false)}
            onSubmit={async (v) => {
              setCuenta(await actualizarCuenta(id, v));
              setEditando(false);
              avisar("Cuenta actualizada");
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
