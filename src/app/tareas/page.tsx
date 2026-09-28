"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { crearTarea, listarTareas } from "@/lib/data/tareas";
import { aYMD, formatYMDRelativa, hoyYMD, sumarDiasYMD, ymdADate } from "@/lib/dates";
import { ESTADOS_TAREA, ESTADO_TAREA_LABEL, ESTADO_TAREA_PUNTO, PRIORIDAD_ORDEN } from "@/lib/trabajo";
import type { EstadoTarea, TareaConRelaciones } from "@/lib/types";
import { useAccionesTareas } from "@/lib/useAccionesTareas";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";
import { KanbanBoard } from "@/components/ui/KanbanBoard";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { TareaFila } from "@/components/trabajo/TareaFila";
import { TareaEditarModal } from "@/components/trabajo/TareaEditarModal";
import { AltaTareaEnLinea } from "@/components/trabajo/AltaTareaEnLinea";
import { FechaLimite, PrioridadIcono } from "@/components/trabajo/Insignias";
import { IconMas } from "@/components/Icons";

type Vista = "hoy" | "semana" | "vencidas" | "todas" | "kanban";
const VISTAS: Vista[] = ["hoy", "semana", "vencidas", "todas", "kanban"];

export default function TareasPage() {
  return (
    <Suspense fallback={null}>
      <Tareas />
    </Suspense>
  );
}

function ordenar(a: TareaConRelaciones, b: TareaConRelaciones) {
  const f = (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999");
  if (f !== 0) return f;
  return PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad];
}

function Tareas() {
  const { usuarioActual, esAdmin } = useUsuario();
  const { abrirAlta, versionDatos, usuarios } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const vistaParam = params.get("vista") as Vista | null;
  const vista: Vista = vistaParam && VISTAS.includes(vistaParam) ? vistaParam : "hoy";

  const [tareas, setTareas] = useState<TareaConRelaciones[]>([]);
  const [soloMias, setSoloMias] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<TareaConRelaciones | null>(null);
  const acciones = useAccionesTareas(setTareas);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setTareas(await listarTareas());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar las tareas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const hoy = hoyYMD();
  const finSemana = sumarDiasYMD(hoy, 6);

  const mias = useMemo(
    () => (esAdmin && !soloMias ? tareas : tareas.filter((t) => !t.responsable_id || t.responsable_id === usuarioActual?.id)),
    [tareas, soloMias, esAdmin, usuarioActual]
  );
  const abiertas = useMemo(() => mias.filter((t) => t.estado !== "completada").sort(ordenar), [mias]);
  const vencidas = abiertas.filter((t) => t.fecha_limite && t.fecha_limite < hoy);
  const deHoy = abiertas.filter((t) => t.fecha_limite === hoy);
  const semana = abiertas.filter((t) => t.fecha_limite && t.fecha_limite >= hoy && t.fecha_limite <= finSemana);
  const completadasHoy = mias.filter((t) => t.estado === "completada" && t.completada_en && aYMD(new Date(t.completada_en)) >= hoy);

  function irA(v: Vista) {
    router.replace(v === "hoy" ? "/tareas" : `/tareas?vista=${v}`, { scroll: false });
  }

  async function altaEnLinea(titulo: string) {
    const fecha = vista === "hoy" || vista === "semana" ? hoy : null;
    const t = await crearTarea({ titulo, fecha_limite: fecha });
    setTareas((prev) => [t, ...prev]);
  }

  const fila = (t: TareaConRelaciones) => (
    <TareaFila key={t.id} tarea={t} onToggle={acciones.alternar} onAbrir={setEditando} />
  );

  return (
    <div className={`mx-auto px-4 pt-6 md:px-8 ${vista === "kanban" ? "max-w-[1400px]" : "max-w-3xl"}`}>
      <Cabecera
        titulo="Tareas"
        subtitulo={
          cargando
            ? "…"
            : `${abiertas.length} abiertas${vencidas.length ? ` · ${vencidas.length} vencidas` : ""}`
        }
        acciones={
          <>
            {esAdmin && usuarios.length > 1 ? (
              <Segmentado
                opciones={[
                  { id: "mias", label: "Mías" },
                  { id: "todas", label: "Equipo" },
                ]}
                valor={soloMias ? "mias" : "todas"}
                onChange={(v) => setSoloMias(v === "mias")}
              />
            ) : null}
            <button onClick={() => abrirAlta({ tipo: "tarea", valores: { fecha_limite: vista === "hoy" ? hoy : null } })} className="btn-primary">
              <IconMas className="h-4 w-4" />
              Nueva
            </button>
          </>
        }
      />

      <div className="-mx-4 mb-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <Segmentado
          opciones={[
            { id: "hoy", label: <Etiqueta texto="Hoy" n={deHoy.length + vencidas.length} /> },
            { id: "semana", label: <Etiqueta texto="Esta semana" n={semana.length} /> },
            { id: "vencidas", label: <Etiqueta texto="Vencidas" n={vencidas.length} alerta /> },
            { id: "todas", label: <Etiqueta texto="Todas" n={abiertas.length} /> },
            { id: "kanban", label: "Kanban" },
          ]}
          valor={vista}
          onChange={irA}
        />
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={6} alto="h-11" /> : null}

      {!cargando && !error ? (
        <div className="flex flex-col gap-5">
          {vista !== "kanban" ? (
            <AltaTareaEnLinea
              onCrear={altaEnLinea}
              placeholder={vista === "hoy" || vista === "semana" ? "Añadir tarea para hoy y pulsar Enter" : "Añadir tarea y pulsar Enter"}
            />
          ) : null}

          {vista === "hoy" ? (
            <>
              {vencidas.length > 0 ? <Seccion titulo="Vencidas" tono="alerta">{vencidas.map(fila)}</Seccion> : null}
              <Seccion titulo="Hoy">
                {deHoy.length ? deHoy.map(fila) : <Vacio texto={vencidas.length ? "Nada más para hoy." : "Nada pendiente para hoy."} />}
              </Seccion>
              {completadasHoy.length > 0 ? (
                <Seccion titulo={`Completadas hoy · ${completadasHoy.length}`} plegada>
                  {completadasHoy.map(fila)}
                </Seccion>
              ) : null}
            </>
          ) : null}

          {vista === "semana"
            ? Array.from({ length: 7 }, (_, i) => sumarDiasYMD(hoy, i)).map((dia) => {
                const delDia = semana.filter((t) => t.fecha_limite === dia);
                const nombre = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric" }).format(ymdADate(dia));
                const relativa = formatYMDRelativa(dia);
                return (
                  <Seccion key={dia} titulo={relativa === "Hoy" || relativa === "Mañana" ? `${relativa} · ${nombre}` : nombre}>
                    {delDia.length ? delDia.map(fila) : <Vacio texto="—" compacto />}
                  </Seccion>
                );
              })
            : null}

          {vista === "vencidas" ? (
            <Seccion titulo="Vencidas" tono="alerta">
              {vencidas.length ? vencidas.map(fila) : <Vacio texto="Nada vencido. Todo al día." />}
            </Seccion>
          ) : null}

          {vista === "todas" ? (
            <>
              <Seccion titulo="Con fecha">
                {abiertas.filter((t) => t.fecha_limite).map(fila)}
                {!abiertas.some((t) => t.fecha_limite) ? <Vacio texto="—" compacto /> : null}
              </Seccion>
              <Seccion titulo="Sin fecha">
                {abiertas.filter((t) => !t.fecha_limite).map(fila)}
                {!abiertas.some((t) => !t.fecha_limite) ? <Vacio texto="—" compacto /> : null}
              </Seccion>
              {mias.some((t) => t.estado === "completada") ? (
                <Seccion titulo="Completadas (últimos 30 días)" plegada>
                  {mias
                    .filter((t) => t.estado === "completada")
                    .sort((a, b) => (b.completada_en ?? "").localeCompare(a.completada_en ?? ""))
                    .map(fila)}
                </Seccion>
              ) : null}
            </>
          ) : null}

          {vista === "kanban" ? (
            <KanbanBoard
              columnas={ESTADOS_TAREA.map((e) => ({ id: e, titulo: ESTADO_TAREA_LABEL[e], acento: ESTADO_TAREA_PUNTO[e] }))}
              items={[...mias].sort(ordenar)}
              clave={(t) => t.id}
              columnaDe={(t) => t.estado}
              onMover={(t, estado) => acciones.actualizar(t, { estado: estado as EstadoTarea })}
              renderTarjeta={(t) => (
                <button type="button" onClick={() => setEditando(t)} className="block w-full text-left">
                  <p className={`text-sm leading-snug ${t.estado === "completada" ? "text-ink3 line-through" : "text-ink"}`}>{t.titulo}</p>
                  {t.proyecto ? <p className="mt-0.5 truncate text-xs text-ink3">{t.proyecto.nombre}</p> : null}
                  <div className="mt-2 flex items-center gap-2">
                    <PrioridadIcono prioridad={t.prioridad} />
                    <FechaLimite fecha={t.fecha_limite} completada={t.estado === "completada"} />
                  </div>
                </button>
              )}
            />
          ) : null}
        </div>
      ) : null}

      {editando ? (
        <TareaEditarModal
          tarea={editando}
          onCerrar={() => setEditando(null)}
          onGuardar={acciones.actualizar}
          onEliminar={acciones.eliminar}
        />
      ) : null}
    </div>
  );
}

function Etiqueta({ texto, n, alerta = false }: { texto: string; n: number; alerta?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      {texto}
      {n > 0 ? (
        <span className={`ml-1.5 text-xs ${alerta ? "font-semibold text-red-600 dark:text-red-400" : "text-ink3"}`}>{n}</span>
      ) : null}
    </span>
  );
}

function Seccion({
  titulo,
  children,
  tono,
  plegada = false,
}: {
  titulo: string;
  children: React.ReactNode;
  tono?: "alerta";
  plegada?: boolean;
}) {
  const cabecera = (
    <span className={`text-xs font-medium uppercase tracking-wider ${tono === "alerta" ? "text-red-600 dark:text-red-400" : "text-ink3"}`}>
      {titulo}
    </span>
  );
  const cuerpo = <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{children}</div>;
  if (plegada) {
    return (
      <details>
        <summary className="mb-2 cursor-pointer list-none">{cabecera}</summary>
        {cuerpo}
      </details>
    );
  }
  return (
    <section>
      <h2 className="mb-2 first-letter:uppercase">{cabecera}</h2>
      {cuerpo}
    </section>
  );
}

function Vacio({ texto, compacto = false }: { texto: string; compacto?: boolean }) {
  return <p className={`px-3 text-sm text-ink3 ${compacto ? "py-2" : "py-6 text-center"}`}>{texto}</p>;
}
