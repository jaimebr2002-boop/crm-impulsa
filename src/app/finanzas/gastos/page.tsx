"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { actualizarGasto, eliminarGasto, listarGastos, listarSuscripciones } from "@/lib/data/finanzas";
import { listarProyectos } from "@/lib/data/proyectos";
import { formatYMDCorta, ymdADate } from "@/lib/dates";
import {
  agruparImportes,
  CATEGORIAS_GASTO,
  CATEGORIA_GASTO_LABEL,
  eur,
  periodoQueContiene,
  sumarImportes,
  type Periodo,
} from "@/lib/finanzas";
import type { CategoriaGasto, DocumentoContexto, Gasto, ProyectoConRelaciones, Suscripcion } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { FinanzasNav } from "@/components/finanzas/FinanzasNav";
import { BarrasImporte, SelectorPeriodo } from "@/components/finanzas/SelectorPeriodo";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";
import { Panel } from "@/components/ui/Panel";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { GastoForm } from "@/components/forms/GastoForm";
import { IconClip, IconMas, IconPapelera } from "@/components/Icons";
import { SeccionDocumentos } from "@/components/documentos/SeccionDocumentos";
import { VisorDocumento } from "@/components/documentos/VisorDocumento";
import { listarDocumentos } from "@/lib/data/documentos";

type Tipo = "todos" | "puntuales" | "recurrentes";

export default function GastosPage() {
  return (
    <SoloAdmin>
      <Suspense fallback={null}>
        <Gastos />
      </Suspense>
    </SoloAdmin>
  );
}

function Gastos() {
  const { abrirAlta, versionDatos, avisar } = useApp();
  const params = useSearchParams();
  const fecha = params.get("fecha");
  const [sinJustificante, setSinJustificante] = useState(params.get("justificante") === "sin");
  const [visor, setVisor] = useState<DocumentoContexto | null>(null);
  // ?fecha=YYYY-MM-DD (desde la búsqueda) abre el mes de ese gasto.
  const [periodo, setPeriodo] = useState<Periodo>(() =>
    // ?justificante=sin (aviso del Inicio) mira el año entero.
    periodoQueContiene(params.get("justificante") === "sin" ? "anio" : "mes", fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? ymdADate(fecha) : new Date())
  );
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [proyectos, setProyectos] = useState<Record<string, ProyectoConRelaciones>>({});
  const [tipo, setTipo] = useState<Tipo>("todos");
  const [categoria, setCategoria] = useState<CategoriaGasto | "">("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [borrando, setBorrando] = useState<Gasto | null>(null);
  const idEditando = editando?.id;
  const cargarJustificantes = useCallback(
    () => (idEditando ? listarDocumentos({ gastoId: idEditando }) : Promise.resolve([])),
    [idEditando]
  );

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [g, s, p] = await Promise.all([listarGastos({ desde: periodo.desde, hasta: periodo.hasta }), listarSuscripciones(), listarProyectos()]);
      setGastos(g);
      setSuscripciones(s);
      setProyectos(Object.fromEntries(p.map((x) => [x.id, x])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar los gastos.");
    } finally {
      setCargando(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const visibles = useMemo(
    () =>
      gastos.filter(
        (g) =>
          (tipo === "todos" || (tipo === "recurrentes" ? !!g.suscripcion_id : !g.suscripcion_id)) &&
          (!categoria || g.categoria === categoria) &&
          (!sinJustificante || !g.justificante_path)
      ),
    [gastos, tipo, categoria, sinJustificante]
  );

  const total = sumarImportes(visibles, (g) => g.importe);

  const adjuntar = (g: Gasto) =>
    abrirAlta({ tipo: "documento", relacion: { tipo: "gasto", id: g.id, etiqueta: g.concepto }, categoria: "justificante", relacionFija: true });
  async function verJustificante(g: Gasto) {
    try {
      const [d] = await listarDocumentos({ gastoId: g.id, categoria: "justificante", limite: 1 });
      if (d) setVisor(d);
      else avisar("No se encuentra el justificante.", { tono: "error" });
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido abrir.", { tono: "error" });
    }
  }
  const recurrente = sumarImportes(visibles.filter((g) => g.suscripcion_id), (g) => g.importe);
  const porCategoria = agruparImportes(visibles, (g) => g.categoria, (g) => g.importe).map((f) => ({
    clave: f.clave,
    etiqueta: CATEGORIA_GASTO_LABEL[f.clave as CategoriaGasto],
    importe: f.importe,
  }));
  const nombreSuscripcion = (id: string | null) => suscripciones.find((s) => s.id === id)?.nombre;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Finanzas"
        acciones={
          <>
            <button onClick={() => abrirAlta({ tipo: "suscripcion" })} className="btn-secondary">
              <IconMas className="h-4 w-4" />
              Suscripción
            </button>
            <button onClick={() => abrirAlta({ tipo: "gasto" })} className="btn-primary">
              <IconMas className="h-4 w-4" />
              Gasto
            </button>
          </>
        }
      />
      <FinanzasNav />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <SelectorPeriodo periodo={periodo} onChange={setPeriodo} />
        <div className="flex flex-wrap items-center gap-2">
          <Segmentado
            opciones={[
              { id: "todos", label: "Todos" },
              { id: "puntuales", label: "Puntuales" },
              { id: "recurrentes", label: "De suscripciones" },
            ]}
            valor={tipo}
            onChange={setTipo}
          />
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value as CategoriaGasto | "")}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
            aria-label="Categoría"
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_GASTO_LABEL[c]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setSinJustificante((v) => !v)}
            aria-pressed={sinJustificante}
            className={`rounded-lg border px-2.5 py-1.5 text-sm ${sinJustificante ? "border-ink bg-ink text-canvas" : "border-line bg-surface text-ink2 hover:text-ink"}`}
          >
            Sin justificante{gastos.filter((g) => !g.justificante_path && Number(g.importe) > 0).length ? ` ${gastos.filter((g) => !g.justificante_path && Number(g.importe) > 0).length}` : ""}
          </button>
        </div>
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={5} /> : null}

      {!cargando && !error ? (
        <div className="flex flex-col gap-6">
          <FilaKpis
            columnas="md:grid-cols-3"
            kpis={[
              { etiqueta: `Gastos · ${periodo.etiqueta}`, valor: eur(total), nota: `${visibles.length} movimiento${visibles.length === 1 ? "" : "s"}` },
              { etiqueta: "De suscripciones", valor: eur(recurrente) },
              { etiqueta: "Puntuales", valor: eur(total - recurrente) },
            ]}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            <Panel titulo="Por categoría">
              <BarrasImporte filas={porCategoria} formato={eur} vacio="Sin gastos en este periodo." />
            </Panel>

            <Panel titulo="Movimientos" contador={visibles.length}>
              {visibles.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-ink3">Sin gastos con estos filtros.</p>
                  <button onClick={() => abrirAlta({ tipo: "gasto" })} className="btn-secondary mt-3">
                    <IconMas className="h-4 w-4" />
                    Registrar gasto
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-line">
                  {visibles.map((g) => {
                    const p = g.proyecto_id ? proyectos[g.proyecto_id] : null;
                    return (
                      <div key={g.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                        <span className="w-14 shrink-0 whitespace-nowrap tabular-nums text-ink3">{formatYMDCorta(g.fecha)}</span>
                        <button onClick={() => setEditando(g)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate font-medium text-ink hover:underline">{g.concepto}</span>
                          <span className="block truncate text-xs text-ink3">
                            {CATEGORIA_GASTO_LABEL[g.categoria]}
                            {g.suscripcion_id ? ` · Suscripción ${nombreSuscripcion(g.suscripcion_id) ?? ""}` : ""}
                            {g.proveedor ? ` · ${g.proveedor}` : ""}
                          </span>
                        </button>
                        {p ? (
                          <Link href={`/proyectos/${p.id}`} className="hidden max-w-[10rem] truncate text-xs text-ink3 hover:text-ink sm:block">
                            {p.nombre}
                          </Link>
                        ) : null}
                        {g.justificante_path ? (
                          <button
                            onClick={() => verJustificante(g)}
                            title="Justificante ✓ · ver"
                            aria-label={`Ver justificante de ${g.concepto}`}
                            className="rounded p-1 text-emerald-600 hover:bg-mute dark:text-emerald-400"
                          >
                            <IconClip className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => adjuntar(g)}
                            title="Sin justificante · adjuntar"
                            aria-label={`Adjuntar justificante a ${g.concepto}`}
                            className="rounded p-1 text-ink3/60 hover:bg-mute hover:text-ink"
                          >
                            <IconClip className="h-4 w-4" />
                          </button>
                        )}
                        <span className="w-24 text-right font-medium tabular-nums text-ink">{eur(g.importe)}</span>
                        <button
                          onClick={() => setBorrando(g)}
                          aria-label={`Eliminar gasto ${g.concepto}`}
                          className="rounded p-1 text-ink3 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                        >
                          <IconPapelera className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
          <p className="text-xs text-ink3">Importes pagados (IVA incluido). El clip indica si el gasto tiene justificante; púlsalo para verlo o adjuntarlo.</p>
        </div>
      ) : null}

      {editando ? (
        <Modal titulo="Editar gasto" onClose={() => setEditando(null)}>
          <GastoForm
            botonTexto="Guardar"
            inicial={editando}
            onCancelar={() => setEditando(null)}
            onSubmit={async (v) => {
              await actualizarGasto(editando.id, v);
              setEditando(null);
              avisar("Gasto actualizado");
              cargar();
            }}
          />
          <div className="mt-5 border-t border-line pt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink3">Justificante</p>
            <SeccionDocumentos
              cargar={cargarJustificantes}
              relacion={{ tipo: "gasto", id: editando.id, etiqueta: editando.concepto }}
              categoriaInicial="justificante"
              textoBoton={editando.justificante_path ? "Añadir otro" : "Adjuntar justificante"}
              vacio="Sin justificante."
              compacta
            />
          </div>
        </Modal>
      ) : null}
      {visor ? <VisorDocumento doc={visor} onCerrar={() => setVisor(null)} /> : null}

      {borrando ? (
        <Modal titulo="Eliminar gasto" onClose={() => setBorrando(null)}>
          <p className="text-sm text-ink2">
            Se eliminará <strong className="text-ink">{borrando.concepto}</strong> ({eur(borrando.importe)}).
            {borrando.suscripcion_id ? " Si era el periodo de una suscripción, podrás volver a registrarlo." : ""}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setBorrando(null)} className="btn-ghost">
              Volver
            </button>
            <button
              onClick={async () => {
                try {
                  await eliminarGasto(borrando.id);
                  setBorrando(null);
                  avisar("Gasto eliminado");
                  cargar();
                } catch (e) {
                  avisar(e instanceof Error ? e.message : "No se ha podido eliminar.", { tono: "error" });
                }
              }}
              className="btn-danger"
            >
              Eliminar
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
