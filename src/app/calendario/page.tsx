"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import {
  FILTRO_DE_TIPO,
  TIPO_ITEM,
  obtenerItemsCalendario,
  type EventoCalendario,
  type FiltroCalendario,
  type ItemCalendario,
} from "@/lib/data/calendario";
import { actualizarEvento, eliminarEvento, marcarEventoCompletado } from "@/lib/data/eventos";
import { actualizarTarea, eliminarTarea } from "@/lib/data/tareas";
import { aYMD, addDias, formatFechaHora, hoyYMD, inicioSemana, ymdADate } from "@/lib/dates";
import type { TareaConRelaciones, TareaUpdate } from "@/lib/types";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { CasillaTarea } from "@/components/trabajo/TareaFila";
import { TareaEditarModal } from "@/components/trabajo/TareaEditarModal";
import { EventoGenericoForm } from "@/components/forms/EventoGenericoForm";
import { IconChevron, IconMas } from "@/components/Icons";

type Vista = "mes" | "agenda";
const FILTROS: { id: FiltroCalendario; label: string; punto: string; soloAdmin?: boolean }[] = [
  { id: "tareas", label: "Tareas", punto: TIPO_ITEM.tarea.punto },
  { id: "proyectos", label: "Entregas", punto: TIPO_ITEM.entrega.punto },
  { id: "eventos", label: "Reuniones y eventos", punto: TIPO_ITEM.reunion.punto },
  { id: "crm", label: "Seguimientos CRM", punto: TIPO_ITEM.seguimiento.punto },
  { id: "facturas", label: "Facturas", punto: TIPO_ITEM.factura.punto, soloAdmin: true },
  { id: "renovaciones", label: "Renovaciones", punto: TIPO_ITEM.renovacion.punto, soloAdmin: true },
];
const ETIQUETA_DIA_COMPLETO: Partial<Record<ItemCalendario["tipo"], string>> = { entrega: "Entrega", factura: "Vence", renovacion: "Renueva" };
const TODOS_FILTROS = FILTROS.map((f) => f.id);
// v2: al añadir Facturas y Renovaciones, las preferencias guardadas antes no las incluían.
const CLAVE_FILTROS = "impulsa-calendario-filtros-v2";
const CLAVE_VISTA = "impulsa-calendario-vista";
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function leerLocal<T>(clave: string, porDefecto: T): T {
  try {
    const v = localStorage.getItem(clave);
    return v ? (JSON.parse(v) as T) : porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardarLocal(clave: string, valor: unknown) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Preferencia de comodidad: si no se puede guardar, no pasa nada.
  }
}

export default function CalendarioPage() {
  const { usuarioActual, esAdmin } = useUsuario();
  const { usuarios, abrirAlta, versionDatos, avisar } = useApp();
  const router = useRouter();

  const [vista, setVista] = useState<Vista>("mes");
  const [mes, setMes] = useState(() => {
    const h = new Date();
    return new Date(h.getFullYear(), h.getMonth(), 1);
  });
  const [diaSel, setDiaSel] = useState(hoyYMD());
  const [filtros, setFiltros] = useState<FiltroCalendario[]>(TODOS_FILTROS);
  const [soloMio, setSoloMio] = useState(true);
  const [items, setItems] = useState<ItemCalendario[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tareaEditando, setTareaEditando] = useState<TareaConRelaciones | null>(null);
  const [eventoAbierto, setEventoAbierto] = useState<EventoCalendario | null>(null);

  useEffect(() => {
    setFiltros(leerLocal(CLAVE_FILTROS, TODOS_FILTROS));
    setVista(leerLocal<Vista>(CLAVE_VISTA, "mes"));
  }, []);

  const inicioGrid = useMemo(() => inicioSemana(mes), [mes]);
  const finGrid = useMemo(() => addDias(inicioGrid, 42), [inicioGrid]);

  const cargar = useCallback(async () => {
    if (!usuarioActual) return;
    setError(null);
    try {
      setItems(await obtenerItemsCalendario(inicioGrid, finGrid, { soloDe: soloMio ? usuarioActual.id : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido cargar el calendario.");
    } finally {
      setCargando(false);
    }
  }, [usuarioActual, inicioGrid, finGrid, soloMio]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const visibles = useMemo(() => items.filter((i) => filtros.includes(FILTRO_DE_TIPO[i.tipo])), [items, filtros]);
  const porDia = useMemo(() => {
    const m = new Map<string, ItemCalendario[]>();
    for (const i of visibles) m.set(i.dia, [...(m.get(i.dia) ?? []), i]);
    return m;
  }, [visibles]);

  function alternarFiltro(f: FiltroCalendario) {
    setFiltros((prev) => {
      const nuevo = prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f];
      guardarLocal(CLAVE_FILTROS, nuevo);
      return nuevo;
    });
  }

  function cambiarVista(v: Vista) {
    setVista(v);
    guardarLocal(CLAVE_VISTA, v);
  }

  function moverMes(delta: number) {
    setMes((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  }

  function irAHoy() {
    const h = new Date();
    setMes(new Date(h.getFullYear(), h.getMonth(), 1));
    setDiaSel(hoyYMD());
  }

  /** Completar/reabrir desde el calendario (tareas y eventos), con UI optimista. */
  async function alternarCompletado(item: ItemCalendario) {
    const nuevo = !item.completado;
    setItems((prev) => prev.map((i) => (i.clave === item.clave ? { ...i, completado: nuevo } : i)));
    try {
      if (item.tarea) await actualizarTarea(item.tarea.id, { estado: nuevo ? "completada" : "pendiente" });
      else if (item.evento) await marcarEventoCompletado(item.evento.id, nuevo);
    } catch (e) {
      setItems((prev) => prev.map((i) => (i.clave === item.clave ? { ...i, completado: !nuevo } : i)));
      avisar(e instanceof Error ? e.message : "No se ha podido guardar.", { tono: "error" });
    }
  }

  function abrir(item: ItemCalendario) {
    if (item.tarea) setTareaEditando(item.tarea);
    else if (item.evento && item.tipo !== "seguimiento") setEventoAbierto(item.evento);
    else if (item.href) router.push(item.href);
  }

  const etiquetaMes = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(mes);
  const hoy = hoyYMD();

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Calendario"
        acciones={
          <>
            {esAdmin && usuarios.length > 1 ? (
              <Segmentado
                opciones={[
                  { id: "mio", label: "Mío" },
                  { id: "equipo", label: "Equipo" },
                ]}
                valor={soloMio ? "mio" : "equipo"}
                onChange={(v) => setSoloMio(v === "mio")}
              />
            ) : null}
            <Segmentado
              opciones={[
                { id: "mes", label: "Mes" },
                { id: "agenda", label: "Agenda" },
              ]}
              valor={vista}
              onChange={cambiarVista}
            />
            {esAdmin ? (
              <button onClick={() => abrirAlta({ tipo: "evento", valores: { fecha: diaSel } })} className="btn-primary">
                <IconMas className="h-4 w-4" />
                Evento
              </button>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => moverMes(-1)} aria-label="Mes anterior" className="rounded-lg p-1.5 text-ink2 hover:bg-mute">
            <IconChevron className="h-4 w-4 rotate-180" />
          </button>
          <span className="min-w-[9.5rem] text-center text-sm font-semibold text-ink first-letter:uppercase">{etiquetaMes}</span>
          <button onClick={() => moverMes(1)} aria-label="Mes siguiente" className="rounded-lg p-1.5 text-ink2 hover:bg-mute">
            <IconChevron className="h-4 w-4" />
          </button>
          <button onClick={irAHoy} className="btn-ghost ml-1 py-1 text-xs">
            Hoy
          </button>
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:px-0">
          {FILTROS.filter((f) => esAdmin || !f.soloAdmin).map((f) => {
            const activo = filtros.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => alternarFiltro(f.id)}
                aria-pressed={activo}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  activo ? "border-line bg-surface text-ink" : "border-dashed border-line text-ink3 line-through"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${activo ? f.punto : "bg-line"}`} />
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={6} alto="h-16" /> : null}

      {!cargando && !error && vista === "mes" ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="overflow-hidden rounded-xl border border-line bg-line">
            <div className="grid grid-cols-7 gap-px">
              {DIAS.map((d) => (
                <div key={d} className="bg-surface py-1.5 text-center text-[11px] font-medium text-ink3">
                  {d}
                </div>
              ))}
              {Array.from({ length: 42 }, (_, i) => aYMD(addDias(inicioGrid, i))).map((dia) => {
                const delDia = porDia.get(dia) ?? [];
                const enMes = ymdADate(dia).getMonth() === mes.getMonth();
                const seleccionado = dia === diaSel;
                return (
                  <button
                    key={dia}
                    onClick={() => setDiaSel(dia)}
                    className={`flex min-h-[3.25rem] flex-col items-stretch gap-0.5 p-1 text-left transition-colors md:min-h-[6.5rem] md:p-1.5 ${
                      seleccionado ? "bg-brand-light/50 dark:bg-brand-light" : enMes ? "bg-surface hover:bg-mute/60" : "bg-canvas"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center self-center rounded-full text-xs md:self-start ${
                        dia === hoy ? "bg-brand font-semibold text-brand-ink" : enMes ? "text-ink" : "text-ink3"
                      }`}
                    >
                      {ymdADate(dia).getDate()}
                    </span>
                    {/* Móvil: puntos. Escritorio: primeras entradas. */}
                    <span className="flex flex-wrap justify-center gap-0.5 md:hidden">
                      {delDia.slice(0, 4).map((it) => (
                        <span key={it.clave} className={`h-1.5 w-1.5 rounded-full ${TIPO_ITEM[it.tipo].punto} ${it.completado ? "opacity-40" : ""}`} />
                      ))}
                    </span>
                    <span className="hidden flex-col gap-0.5 md:flex">
                      {delDia.slice(0, 3).map((it) => (
                        <span
                          key={it.clave}
                          className={`truncate rounded px-1 py-px text-[11px] leading-4 ${TIPO_ITEM[it.tipo].chip} ${
                            it.completado ? "line-through opacity-60" : ""
                          }`}
                        >
                          {it.hora ? `${it.hora} ` : ""}
                          {it.titulo}
                        </span>
                      ))}
                      {delDia.length > 3 ? <span className="px-1 text-[11px] text-ink3">+{delDia.length - 3} más</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-ink first-letter:uppercase">
              {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(ymdADate(diaSel))}
            </h2>
            <ListaDia items={porDia.get(diaSel) ?? []} onAbrir={abrir} onAlternar={alternarCompletado} />
          </section>
        </div>
      ) : null}

      {!cargando && !error && vista === "agenda" ? (
        <Agenda mes={mes} porDia={porDia} hoy={hoy} onAbrir={abrir} onAlternar={alternarCompletado} />
      ) : null}

      {tareaEditando ? (
        <TareaEditarModal
          tarea={tareaEditando}
          onCerrar={() => setTareaEditando(null)}
          onGuardar={async (t, cambios: TareaUpdate) => {
            try {
              await actualizarTarea(t.id, cambios);
              cargar();
            } catch (e) {
              avisar(e instanceof Error ? e.message : "No se ha podido guardar.", { tono: "error" });
            }
          }}
          onEliminar={async (t) => {
            try {
              await eliminarTarea(t.id);
              avisar("Tarea eliminada");
              cargar();
            } catch (e) {
              avisar(e instanceof Error ? e.message : "No se ha podido eliminar.", { tono: "error" });
            }
          }}
        />
      ) : null}

      {eventoAbierto ? (
        <DetalleEvento
          evento={eventoAbierto}
          puedeEditar={esAdmin}
          onCerrar={() => setEventoAbierto(null)}
          onCambio={() => {
            setEventoAbierto(null);
            cargar();
          }}
        />
      ) : null}
    </div>
  );
}

function ItemFila({
  item,
  onAbrir,
  onAlternar,
  mostrarTipo = true,
}: {
  item: ItemCalendario;
  onAbrir: (i: ItemCalendario) => void;
  onAlternar: (i: ItemCalendario) => void;
  mostrarTipo?: boolean;
}) {
  const t = TIPO_ITEM[item.tipo];
  const completable = item.tipo !== "entrega" && item.tipo !== "factura" && item.tipo !== "renovacion";
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 hover:bg-mute/50">
      <span className="pt-0.5">
        {completable ? (
          <CasillaTarea completada={item.completado} onToggle={() => onAlternar(item)} etiqueta={item.titulo} />
        ) : (
          <span className={`mt-1 block h-[10px] w-[10px] rounded-[3px] ${t.punto} ${item.completado ? "opacity-40" : ""}`} />
        )}
      </span>
      <button type="button" onClick={() => onAbrir(item)} className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm ${item.completado ? "text-ink3 line-through" : "text-ink"}`}>{item.titulo}</span>
        <span className="flex items-center gap-1.5 truncate text-xs text-ink3">
          {mostrarTipo ? (
            <>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${t.punto}`} />
              {t.label}
              {item.subtitulo ? " · " : ""}
            </>
          ) : null}
          {item.subtitulo}
        </span>
      </button>
      <span className="shrink-0 pt-0.5 text-xs font-medium text-ink2">{item.hora ?? ETIQUETA_DIA_COMPLETO[item.tipo] ?? ""}</span>
    </div>
  );
}

function ListaDia({
  items,
  onAbrir,
  onAlternar,
}: {
  items: ItemCalendario[];
  onAbrir: (i: ItemCalendario) => void;
  onAlternar: (i: ItemCalendario) => void;
}) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink3">Nada este día.</p>;
  }
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((i) => (
        <ItemFila key={i.clave} item={i} onAbrir={onAbrir} onAlternar={onAlternar} />
      ))}
    </div>
  );
}

function Agenda({
  mes,
  porDia,
  hoy,
  onAbrir,
  onAlternar,
}: {
  mes: Date;
  porDia: Map<string, ItemCalendario[]>;
  hoy: string;
  onAbrir: (i: ItemCalendario) => void;
  onAlternar: (i: ItemCalendario) => void;
}) {
  const dias: string[] = [];
  for (let d = new Date(mes); d.getMonth() === mes.getMonth(); d = addDias(d, 1)) dias.push(aYMD(d));
  const conCosas = dias.filter((d) => (porDia.get(d) ?? []).length > 0 || d === hoy);
  if (conCosas.length === 0) {
    return <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-10 text-center text-sm text-ink3">Nada este mes con los filtros actuales.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      {conCosas.map((dia) => {
        const lista = porDia.get(dia) ?? [];
        const esHoy = dia === hoy;
        return (
          <section key={dia} className="grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr]">
            <h2 className={`text-sm font-semibold first-letter:uppercase md:pt-2.5 ${esHoy ? "text-brand-dark dark:text-brand" : "text-ink"}`}>
              {esHoy ? "Hoy · " : ""}
              {new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric", month: "short" }).format(ymdADate(dia))}
            </h2>
            {lista.length ? (
              <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {lista.map((i) => (
                  <ItemFila key={i.clave} item={i} onAbrir={onAbrir} onAlternar={onAlternar} />
                ))}
              </div>
            ) : (
              <p className="py-2 text-sm text-ink3">Nada programado.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function DetalleEvento({
  evento,
  puedeEditar,
  onCerrar,
  onCambio,
}: {
  evento: EventoCalendario;
  puedeEditar: boolean;
  onCerrar: () => void;
  onCambio: () => void;
}) {
  const { avisar } = useApp();
  const [editando, setEditando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const t = TIPO_ITEM[evento.tipo];

  if (editando) {
    return (
      <Modal titulo="Editar" onClose={onCerrar} ancho="max-w-lg">
        <EventoGenericoForm
          inicial={evento}
          onCancelar={() => setEditando(false)}
          onSubmit={async (v) => {
            await actualizarEvento(evento.id, v);
            avisar("Guardado");
            onCambio();
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal titulo={t.label} onClose={onCerrar}>
      <div className="flex flex-col gap-3">
        <p className="text-lg font-semibold text-ink">{evento.titulo}</p>
        <p className="flex items-center gap-2 text-sm text-ink2">
          <span className={`h-2 w-2 rounded-full ${t.punto}`} />
          {formatFechaHora(evento.fecha_hora)}
          {evento.completada ? <span className="chip border-emerald-300 text-emerald-700">Hecho</span> : null}
        </p>
        {evento.cuenta || evento.proyecto ? (
          <p className="flex flex-wrap gap-x-3 text-sm">
            {evento.cuenta ? (
              <Link href={`/cuentas/${evento.cuenta.id}`} className="text-ink hover:underline">
                {evento.cuenta.nombre}
              </Link>
            ) : null}
            {evento.proyecto ? (
              <Link href={`/proyectos/${evento.proyecto.id}`} className="text-ink hover:underline">
                {evento.proyecto.nombre}
              </Link>
            ) : null}
          </p>
        ) : null}
        {evento.descripcion ? <p className="whitespace-pre-wrap text-sm text-ink2">{evento.descripcion}</p> : null}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
          {puedeEditar ? (
            confirmando ? (
              <span className="flex items-center gap-2 text-sm">
                ¿Eliminar?
                <button onClick={() => setConfirmando(false)} className="btn-ghost">
                  No
                </button>
                <button
                  onClick={async () => {
                    try {
                      await eliminarEvento(evento.id);
                      avisar("Eliminado del calendario");
                      onCambio();
                    } catch (e) {
                      avisar(e instanceof Error ? e.message : "No se ha podido eliminar.", { tono: "error" });
                    }
                  }}
                  className="btn bg-red-600 text-white hover:bg-red-700"
                >
                  Eliminar
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirmando(true)} className="text-sm text-red-600 hover:underline dark:text-red-400">
                Eliminar
              </button>
            )
          ) : (
            <span />
          )}
          <span className="flex gap-2">
            {puedeEditar ? (
              <button onClick={() => setEditando(true)} className="btn-secondary">
                Editar
              </button>
            ) : null}
            <button
              onClick={async () => {
                try {
                  await marcarEventoCompletado(evento.id, !evento.completada);
                  onCambio();
                } catch (e) {
                  avisar(e instanceof Error ? e.message : "No se ha podido guardar.", { tono: "error" });
                }
              }}
              className="btn-primary"
            >
              {evento.completada ? "Reabrir" : "Marcar como hecho"}
            </button>
          </span>
        </div>
      </div>
    </Modal>
  );
}
