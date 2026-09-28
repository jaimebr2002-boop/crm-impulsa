"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import {
  actualizarProyecto,
  crearEnlace,
  eliminarEnlace,
  eliminarProyecto,
  listarEnlaces,
  obtenerProyecto,
} from "@/lib/data/proyectos";
import { crearTarea, listarTareas } from "@/lib/data/tareas";
import { listarActividad } from "@/lib/data/actividad";
import { formatEuros } from "@/lib/constants";
import { formatFecha } from "@/lib/dates";
import {
  ESTADOS_PROYECTO,
  ESTADO_PROYECTO_LABEL,
  ESTADO_PROYECTO_PUNTO,
  PRIORIDADES,
  PRIORIDAD_LABEL,
  TIPO_CUENTA_LABEL,
  TIPO_PROYECTO_LABEL,
} from "@/lib/trabajo";
import type {
  Actividad,
  EstadoProyecto,
  Prioridad,
  ProyectoConRelaciones,
  ProyectoEnlace,
  ProyectoUpdate,
  TareaConRelaciones,
} from "@/lib/types";
import { useAccionesTareas } from "@/lib/useAccionesTareas";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { ProyectoForm, valoresDesdeProyecto } from "@/components/forms/ProyectoForm";
import { TareaFila } from "@/components/trabajo/TareaFila";
import { TareaEditarModal } from "@/components/trabajo/TareaEditarModal";
import { ActividadLista } from "@/components/trabajo/ActividadLista";
import { FechaLimite, PrioridadIcono } from "@/components/trabajo/Insignias";
import { AltaTareaEnLinea } from "@/components/trabajo/AltaTareaEnLinea";
import { NotasAutoguardado } from "@/components/trabajo/NotasAutoguardado";
import { IconEnlace, IconPapelera } from "@/components/Icons";

type Tab = "resumen" | "tareas" | "enlaces" | "notas" | "actividad";

export default function ProyectoPage() {
  return (
    <SoloAdmin>
      <Suspense fallback={null}>
        <FichaProyecto />
      </Suspense>
    </SoloAdmin>
  );
}

function FichaProyecto() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { usuarios, usuariosPorId, avisar, versionDatos } = useApp();

  const [proyecto, setProyecto] = useState<ProyectoConRelaciones | null>(null);
  const [tareas, setTareas] = useState<TareaConRelaciones[]>([]);
  const [enlaces, setEnlaces] = useState<ProyectoEnlace[]>([]);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"editar" | "eliminar" | null>(null);
  const [tareaEditando, setTareaEditando] = useState<TareaConRelaciones | null>(null);

  const tabParam = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(tabParam ?? "resumen");
  const acciones = useAccionesTareas(setTareas);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [p, t, e, a] = await Promise.all([
        obtenerProyecto(id),
        listarTareas({ proyectoId: id, diasCompletadas: 3650 }),
        listarEnlaces(id),
        listarActividad({ proyectoId: id, limite: 50 }),
      ]);
      setProyecto(p);
      setTareas(t);
      setEnlaces(e);
      setActividad(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cargar el proyecto.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  function cambiarTab(t: Tab) {
    setTab(t);
    // Solo actualiza la URL (compartible); no hace falta ida y vuelta al servidor.
    window.history.replaceState(null, "", t === "resumen" ? `/proyectos/${id}` : `/proyectos/${id}?tab=${t}`);
  }

  async function guardar(cambios: ProyectoUpdate) {
    if (!proyecto) return;
    const anterior = proyecto;
    setProyecto({ ...proyecto, ...cambios });
    try {
      const nuevo = await actualizarProyecto(proyecto.id, cambios);
      setProyecto(nuevo);
      listarActividad({ proyectoId: id, limite: 50 }).then(setActividad).catch(() => {});
    } catch (e) {
      setProyecto(anterior);
      avisar(e instanceof Error ? e.message : "No se ha podido guardar.", { tono: "error" });
    }
  }

  if (cargando) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
        <div className="skeleton mb-2 h-4 w-24" />
        <div className="skeleton mb-6 h-8 w-72" />
        <SkeletonLineas filas={5} />
      </div>
    );
  }
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje={error} onReintentar={cargar} /></div>;
  if (!proyecto) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <ErrorState mensaje="Este proyecto no existe o se ha eliminado." />
      </div>
    );
  }

  const abiertas = tareas.filter((t) => t.estado !== "completada");
  const hechas = tareas.filter((t) => t.estado === "completada");
  const origen = [proyecto.cuenta?.nombre, proyecto.marca?.nombre].filter(Boolean).join(" · ");

  const TABS: { id: Tab; label: string; n?: number }[] = [
    { id: "resumen", label: "Resumen" },
    { id: "tareas", label: "Tareas", n: abiertas.length },
    { id: "enlaces", label: "Enlaces", n: enlaces.length },
    { id: "notas", label: "Notas" },
    { id: "actividad", label: "Actividad" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 md:px-8">
      <nav className="mb-3 flex items-center gap-1.5 text-sm text-ink3">
        <Link href="/proyectos" className="hover:text-ink">
          Proyectos
        </Link>
        {proyecto.cuenta ? (
          <>
            <span>/</span>
            <Link href={`/proyectos?cuenta=${proyecto.cuenta.id}`} className="hover:text-ink">
              {proyecto.cuenta.nombre}
            </Link>
          </>
        ) : null}
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink md:text-[28px]">{proyecto.nombre}</h1>
          <p className="mt-1 text-sm text-ink2">
            {[origen, TIPO_PROYECTO_LABEL[proyecto.tipo]].filter(Boolean).join(" · ")}
            {proyecto.archivado ? <span className="chip ml-2 border-amber-300 text-amber-700">Archivado</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setModal("editar")} className="btn-secondary">
            Editar
          </button>
          <button
            onClick={() => guardar({ archivado: !proyecto.archivado })}
            className="btn-ghost"
            title={proyecto.archivado ? "Restaurar" : "Archivar"}
          >
            {proyecto.archivado ? "Restaurar" : "Archivar"}
          </button>
          <button onClick={() => setModal("eliminar")} className="btn-ghost text-red-600" aria-label="Eliminar proyecto">
            <IconPapelera className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        {/* Propiedades — en móvil van primero */}
        <aside className="order-first lg:order-last">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-4 text-sm lg:grid-cols-1">
            <Propiedad label="Estado">
              <SelectLimpio
                value={proyecto.estado}
                onChange={(v) => guardar({ estado: v as EstadoProyecto })}
                opciones={ESTADOS_PROYECTO.map((e) => ({ id: e, label: ESTADO_PROYECTO_LABEL[e] }))}
                punto={ESTADO_PROYECTO_PUNTO[proyecto.estado]}
              />
            </Propiedad>
            <Propiedad label="Prioridad">
              <div className="flex items-center gap-1.5">
                <PrioridadIcono prioridad={proyecto.prioridad} />
                <SelectLimpio
                  value={proyecto.prioridad}
                  onChange={(v) => guardar({ prioridad: v as Prioridad })}
                  opciones={PRIORIDADES.map((p) => ({ id: p, label: PRIORIDAD_LABEL[p] }))}
                />
              </div>
            </Propiedad>
            <Propiedad label="Entrega">
              <div className="flex flex-col gap-0.5">
                <input
                  type="date"
                  value={proyecto.fecha_entrega ?? ""}
                  onChange={(e) => guardar({ fecha_entrega: e.target.value || null })}
                  className="-ml-1 rounded-md bg-transparent px-1 py-0.5 text-sm text-ink hover:bg-mute"
                />
                {proyecto.estado === "entregado" && proyecto.entregado_en ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">Entregado el {formatFecha(proyecto.entregado_en)}</span>
                ) : (
                  <FechaLimite fecha={proyecto.fecha_entrega} />
                )}
              </div>
            </Propiedad>
            <Propiedad label="Importe">
              <span className="font-semibold text-ink">{proyecto.importe != null ? formatEuros(proyecto.importe) : "—"}</span>
            </Propiedad>
            <Propiedad label="Cuenta">
              {proyecto.cuenta ? (
                <Link href={`/proyectos?cuenta=${proyecto.cuenta.id}`} className="text-ink hover:underline">
                  {proyecto.cuenta.nombre}
                  <span className="ml-1 text-xs text-ink3">{TIPO_CUENTA_LABEL[proyecto.cuenta.tipo]}</span>
                </Link>
              ) : (
                <span className="text-ink3">—</span>
              )}
            </Propiedad>
            <Propiedad label="Marca">
              <span className="text-ink">{proyecto.marca?.nombre ?? <span className="text-ink3">—</span>}</span>
            </Propiedad>
            {usuarios.length > 1 ? (
              <Propiedad label="Responsable">
                <SelectLimpio
                  value={proyecto.responsable_id ?? ""}
                  onChange={(v) => guardar({ responsable_id: v || null })}
                  opciones={[{ id: "", label: "Sin asignar" }, ...usuarios.map((u) => ({ id: u.id, label: u.nombre }))]}
                />
              </Propiedad>
            ) : null}
            {proyecto.lead_id ? (
              <Propiedad label="Origen">
                <Link href={`/leads/${proyecto.lead_id}`} className="text-ink hover:underline">
                  Lead ganado →
                </Link>
              </Propiedad>
            ) : null}
            <Propiedad label="Creado">
              <span className="text-ink2">
                {formatFecha(proyecto.created_at)}
                {proyecto.creado_por && usuariosPorId[proyecto.creado_por] ? ` · ${usuariosPorId[proyecto.creado_por].nombre}` : ""}
              </span>
            </Propiedad>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => cambiarTab(t.id)}
                className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                  tab === t.id ? "border-brand text-ink" : "border-transparent text-ink3 hover:text-ink"
                }`}
              >
                {t.label}
                {t.n ? <span className="ml-1.5 text-xs text-ink3">{t.n}</span> : null}
              </button>
            ))}
          </div>

          {tab === "resumen" ? (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink3">Descripción</h2>
                {proyecto.descripcion ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{proyecto.descripcion}</p>
                ) : (
                  <button onClick={() => setModal("editar")} className="text-sm text-ink3 hover:text-ink">
                    Añadir descripción…
                  </button>
                )}
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-wider text-ink3">Próximas tareas</h2>
                  <button onClick={() => cambiarTab("tareas")} className="text-xs text-ink3 hover:text-ink">
                    Ver todas
                  </button>
                </div>
                <ListaTareas
                  tareas={abiertas.slice(0, 5)}
                  onToggle={acciones.alternar}
                  onAbrir={setTareaEditando}
                  vacio="Sin tareas abiertas."
                />
              </div>
              {enlaces.length > 0 ? (
                <div>
                  <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-ink3">Enlaces</h2>
                  <div className="flex flex-wrap gap-2">
                    {enlaces.map((e) => (
                      <a
                        key={e.id}
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink hover:bg-mute"
                      >
                        <IconEnlace className="h-3.5 w-3.5 text-ink3" />
                        {e.titulo}
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "tareas" ? (
            <div className="flex flex-col gap-4">
              <AltaTareaEnLinea
                onCrear={async (titulo) => {
                  const t = await crearTarea({ titulo, proyecto_id: proyecto.id });
                  setTareas((prev) => [t, ...prev]);
                }}
              />
              <ListaTareas
                tareas={abiertas}
                onToggle={acciones.alternar}
                onAbrir={setTareaEditando}
                vacio="Sin tareas abiertas. Escribe arriba para añadir la primera."
              />
              {hechas.length > 0 ? (
                <details className="group">
                  <summary className="cursor-pointer list-none text-xs font-medium text-ink3 hover:text-ink">
                    <span className="group-open:hidden">▸</span>
                    <span className="hidden group-open:inline">▾</span> Completadas ({hechas.length})
                  </summary>
                  <div className="mt-2">
                    <ListaTareas tareas={hechas} onToggle={acciones.alternar} onAbrir={setTareaEditando} vacio="" />
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {tab === "enlaces" ? (
            <Enlaces
              enlaces={enlaces}
              onCrear={async (titulo, url) => {
                const e = await crearEnlace({ proyecto_id: proyecto.id, titulo, url });
                setEnlaces((prev) => [...prev, e]);
              }}
              onEliminar={async (e) => {
                setEnlaces((prev) => prev.filter((x) => x.id !== e.id));
                try {
                  await eliminarEnlace(e.id);
                } catch (err) {
                  setEnlaces((prev) => [...prev, e]);
                  avisar(err instanceof Error ? err.message : "No se ha podido eliminar.", { tono: "error" });
                }
              }}
            />
          ) : null}

          {tab === "notas" ? (
            <NotasAutoguardado
              key={proyecto.id}
              inicial={proyecto.notas ?? ""}
              onGuardar={async (notas) => {
                await actualizarProyecto(proyecto.id, { notas: notas || null });
              }}
            />
          ) : null}

          {tab === "actividad" ? (
            <div className="rounded-xl border border-line bg-surface px-4 py-2">
              <ActividadLista items={actividad} />
            </div>
          ) : null}
        </section>
      </div>

      {modal === "editar" ? (
        <Modal titulo="Editar proyecto" onClose={() => setModal(null)} ancho="max-w-lg">
          <ProyectoForm
            botonTexto="Guardar"
            valoresIniciales={valoresDesdeProyecto(proyecto)}
            onCancelar={() => setModal(null)}
            onSubmit={async (v) => {
              const nuevo = await actualizarProyecto(proyecto.id, v);
              setProyecto(nuevo);
              setModal(null);
              avisar("Proyecto actualizado");
            }}
          />
        </Modal>
      ) : null}

      {modal === "eliminar" ? (
        <Modal titulo="Eliminar proyecto" onClose={() => setModal(null)}>
          <p className="text-sm text-ink2">
            Se borrará <strong className="text-ink">{proyecto.nombre}</strong> junto con sus {tareas.length} tareas y{" "}
            {enlaces.length} enlaces. No se puede deshacer. Si solo quieres quitarlo de en medio, archívalo.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-ghost">
              Cancelar
            </button>
            <button
              onClick={async () => {
                try {
                  await eliminarProyecto(proyecto.id);
                  avisar("Proyecto eliminado");
                  router.replace("/proyectos");
                } catch (e) {
                  avisar(e instanceof Error ? e.message : "No se ha podido eliminar.", { tono: "error" });
                  setModal(null);
                }
              }}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </Modal>
      ) : null}

      {tareaEditando ? (
        <TareaEditarModal
          tarea={tareaEditando}
          onCerrar={() => setTareaEditando(null)}
          onGuardar={acciones.actualizar}
          onEliminar={acciones.eliminar}
        />
      ) : null}
    </div>
  );
}

function Propiedad({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 lg:flex-row lg:items-center lg:gap-3">
      <span className="text-xs text-ink3 lg:w-24 lg:shrink-0">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SelectLimpio({
  value,
  onChange,
  opciones,
  punto,
}: {
  value: string;
  onChange: (v: string) => void;
  opciones: { id: string; label: string }[];
  punto?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {punto ? <span className={`h-2 w-2 rounded-full ${punto}`} /> : null}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="-ml-1 cursor-pointer rounded-md bg-transparent px-1 py-0.5 text-sm text-ink hover:bg-mute"
      >
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

function ListaTareas({
  tareas,
  onToggle,
  onAbrir,
  vacio,
}: {
  tareas: TareaConRelaciones[];
  onToggle: (t: TareaConRelaciones) => void;
  onAbrir: (t: TareaConRelaciones) => void;
  vacio: string;
}) {
  if (tareas.length === 0) return vacio ? <p className="py-3 text-sm text-ink3">{vacio}</p> : null;
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {tareas.map((t) => (
        <TareaFila key={t.id} tarea={t} onToggle={onToggle} onAbrir={onAbrir} mostrarProyecto={false} />
      ))}
    </div>
  );
}

function Enlaces({
  enlaces,
  onCrear,
  onEliminar,
}: {
  enlaces: ProyectoEnlace[];
  onCrear: (titulo: string, url: string) => Promise<void>;
  onEliminar: (e: ProyectoEnlace) => void;
}) {
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    let limpia = url.trim();
    if (!limpia) return;
    if (!/^https?:\/\//i.test(limpia)) limpia = `https://${limpia}`;
    let dominio: string;
    try {
      dominio = new URL(limpia).hostname.replace(/^www\./, "");
    } catch {
      return setError("Esa URL no parece válida.");
    }
    setError(null);
    try {
      await onCrear(titulo.trim() || dominio, limpia);
      setUrl("");
      setTitulo("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {enlaces.length > 0 ? (
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {enlaces.map((e) => (
            <div key={e.id} className="group flex items-center gap-3 px-3 py-2.5">
              <IconEnlace className="h-4 w-4 shrink-0 text-ink3" />
              <a href={e.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink hover:underline">{e.titulo}</span>
                <span className="block truncate text-xs text-ink3">{e.url}</span>
              </a>
              <button
                onClick={() => onEliminar(e)}
                aria-label={`Eliminar enlace ${e.titulo}`}
                className="rounded-md p-1 text-ink3 opacity-100 hover:bg-mute hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
              >
                <IconPapelera className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink3">Guarda aquí Drive, Figma, la web, Vercel, Meta Ads, GitHub…</p>
      )}
      <form onSubmit={enviar} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 sm:flex-row">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/…"
          className="input sm:flex-[2]"
          inputMode="url"
        />
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Nombre (opcional)" className="input sm:flex-1" />
        <button type="submit" className="btn-primary shrink-0">
          Añadir
        </button>
      </form>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
