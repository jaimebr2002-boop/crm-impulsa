"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp, useContextoPantalla } from "@/context/AppContext";
import {
  cambiarEstadoFactura,
  eliminarCobro,
  eliminarFactura,
  marcarFacturaEnviada,
  obtenerFactura,
} from "@/lib/data/finanzas";
import { formatFecha, formatYMDCorta, formatYMDRelativa } from "@/lib/dates";
import { aCentimos, eur, METODO_COBRO_LABEL } from "@/lib/finanzas";
import type { Cobro, FacturaConCuenta, FacturaLineaConProyecto } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { FinanzasNav } from "@/components/finanzas/FinanzasNav";
import { EstadoFacturaChip } from "@/components/finanzas/EstadoFactura";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { ActividadPaginada } from "@/components/trabajo/ActividadPaginada";
import { Panel } from "@/components/ui/Panel";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { FacturaForm } from "@/components/forms/FacturaForm";
import { CobroForm } from "@/components/forms/CobroForm";
import { IconMas, IconPapelera } from "@/components/Icons";

export default function FacturaPage() {
  return (
    <SoloAdmin>
      <FichaFactura />
    </SoloAdmin>
  );
}

function FichaFactura() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { avisar, versionDatos, notificarCambio } = useApp();
  const [factura, setFactura] = useState<FacturaConCuenta | null>(null);
  const [lineas, setLineas] = useState<FacturaLineaConProyecto[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"editar" | "cobro" | "cancelar" | "eliminar" | null>(null);
  const [cobroABorrar, setCobroABorrar] = useState<Cobro | null>(null);
  const [version, setVersion] = useState(0);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await obtenerFactura(id);
      setFactura(r.factura);
      setLineas(r.lineas);
      setCobros(r.cobros);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido cargar la factura.");
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  useContextoPantalla(
    factura && factura.estado === "emitida"
      ? { tipo: "factura", id: factura.id, nombre: factura.numero ?? "Factura", pendiente: factura.pendiente }
      : null
  );

  const filtroActividad = useMemo(() => ({ facturaId: id, _v: version }), [id, version]);

  async function accion(fn: () => Promise<void>, ok: string) {
    try {
      await fn();
      avisar(ok);
      setModal(null);
      notificarCambio();
      await cargar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido completar.", { tono: "error" });
    }
  }

  if (cargando) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
        <div className="skeleton mb-6 h-9 w-56" />
        <SkeletonLineas filas={6} />
      </div>
    );
  }
  if (error) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje={error} onReintentar={cargar} /></div>;
  if (!factura) return <div className="mx-auto max-w-3xl p-6"><ErrorState mensaje="Esta factura no existe." /></div>;

  const emitida = factura.estado === "emitida";
  const pendiente = aCentimos(factura.pendiente) > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:px-8">
      <FinanzasNav />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-ink3">Factura</p>
          <h1 className="font-display text-[28px] font-bold tabular-nums tracking-tight text-ink">
            {factura.numero ?? "Borrador"}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink2">
            {factura.cuenta ? (
              <Link href={`/cuentas/${factura.cuenta.id}`} className="font-medium text-ink hover:underline">
                {factura.cuenta.nombre}
              </Link>
            ) : null}
            <span>· Emitida el {formatYMDCorta(factura.fecha_emision)}</span>
            <EstadoFacturaChip factura={factura} />
            {factura.enviada_en ? <span className="text-xs text-ink3">Enviada {formatFecha(factura.enviada_en)}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {emitida && pendiente ? (
            <button onClick={() => setModal("cobro")} className="btn-primary">
              <IconMas className="h-4 w-4" />
              Registrar cobro
            </button>
          ) : null}
          {factura.estado === "borrador" ? (
            <button onClick={() => setModal("editar")} className="btn-primary">
              Revisar y emitir
            </button>
          ) : null}
          {emitida ? (
            <button onClick={() => setModal("editar")} className="btn-secondary">
              Editar
            </button>
          ) : null}
          {emitida && !factura.enviada_en ? (
            <button onClick={() => accion(() => marcarFacturaEnviada(factura.id), "Marcada como enviada")} className="btn-ghost">
              Marcar enviada
            </button>
          ) : null}
          {emitida ? (
            <button onClick={() => setModal("cancelar")} className="btn-ghost text-red-600 dark:text-red-400">
              Cancelar
            </button>
          ) : null}
          {factura.estado === "borrador" ? (
            <button onClick={() => setModal("eliminar")} className="btn-ghost text-red-600" aria-label="Eliminar borrador">
              <IconPapelera className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-6">
        <FilaKpis
          columnas="md:grid-cols-4"
          kpis={[
            { etiqueta: "Total", valor: eur(factura.total), nota: `Base ${eur(factura.base)}` },
            { etiqueta: "Cobrado", valor: eur(factura.cobrado), nota: factura.ultimo_cobro ? `Último ${formatYMDCorta(factura.ultimo_cobro)}` : "Sin cobros" },
            { etiqueta: "Pendiente", valor: eur(emitida ? factura.pendiente : 0), alerta: factura.vencida, nota: factura.vencida ? "Vencida" : undefined },
            {
              etiqueta: "Vencimiento",
              valor: factura.fecha_vencimiento ? formatYMDCorta(factura.fecha_vencimiento) : "—",
              nota: factura.fecha_vencimiento && pendiente && emitida ? formatYMDRelativa(factura.fecha_vencimiento) : undefined,
              alerta: factura.vencida,
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Panel titulo="Líneas" contador={lineas.length}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink3">
                    <th className="px-4 py-2 font-medium">Concepto</th>
                    <th className="px-3 py-2 text-right font-medium">Cant.</th>
                    <th className="px-3 py-2 text-right font-medium">Precio</th>
                    <th className="px-4 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((l) => (
                    <tr key={l.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="block text-ink">{l.descripcion}</span>
                        {l.proyecto ? (
                          <Link href={`/proyectos/${l.proyecto.id}`} className="text-xs text-ink3 hover:text-ink hover:underline">
                            Proyecto: {l.proyecto.nombre}
                          </Link>
                        ) : (
                          <span className="text-xs text-ink3">Línea manual</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{Number(l.cantidad)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{eur(l.precio_unitario)}</td>
                      <td className="px-4 py-2.5 text-right font-medium tabular-nums text-ink">{eur(l.importe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto grid max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-line px-4 py-3 text-sm">
              <dt className="text-ink2">Base imponible</dt>
              <dd className="text-right tabular-nums text-ink">{eur(factura.base)}</dd>
              <dt className="text-ink2">IVA {Number(factura.iva_pct)} %</dt>
              <dd className="text-right tabular-nums text-ink">+{eur(factura.iva)}</dd>
              <dt className="text-ink2">IRPF {Number(factura.irpf_pct)} %</dt>
              <dd className="text-right tabular-nums text-ink">−{eur(factura.irpf)}</dd>
              <dt className="border-t border-line pt-1 font-semibold text-ink">Total</dt>
              <dd className="border-t border-line pt-1 text-right font-display text-base font-bold tabular-nums text-ink">{eur(factura.total)}</dd>
            </dl>
          </Panel>

          <Panel titulo="Actividad">
            <div className="px-4 py-1">
              <ActividadPaginada filtro={filtroActividad} agruparPorDia={false} vacio="Sin actividad todavía." />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          <Panel
            titulo="Cobros"
            contador={cobros.length}
            accion={emitida && pendiente ? { texto: "Registrar", onClick: () => setModal("cobro") } : undefined}
          >
            {cobros.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink3">{emitida ? "Aún no has cobrado nada." : "Los cobros se registran en facturas emitidas."}</p>
            ) : (
              <div className="divide-y divide-line">
                {cobros.map((c) => (
                  <div key={c.id} className="group flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-14 shrink-0 tabular-nums text-ink2">{formatYMDCorta(c.fecha)}</span>
                    <span className="min-w-0 flex-1 truncate text-ink2">
                      {METODO_COBRO_LABEL[c.metodo]}
                      {c.referencia ? ` · ${c.referencia}` : ""}
                    </span>
                    <span className="font-medium tabular-nums text-ink">{eur(c.importe)}</span>
                    <button
                      onClick={() => setCobroABorrar(c)}
                      aria-label="Eliminar cobro"
                      className="rounded p-1 text-ink3 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100"
                    >
                      <IconPapelera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>
          {factura.notas ? (
            <Panel titulo="Notas">
              <p className="whitespace-pre-wrap px-4 py-3 text-sm text-ink2">{factura.notas}</p>
            </Panel>
          ) : null}
          <p className="px-1 text-xs text-ink3">El PDF de la factura se podrá adjuntar cuando exista el módulo de Documentos.</p>
        </div>
      </div>

      {modal === "editar" ? (
        <Modal titulo={factura.estado === "borrador" ? "Revisar borrador" : `Editar ${factura.numero}`} onClose={() => setModal(null)} ancho="max-w-3xl">
          <FacturaForm
            existente={{
              id: factura.id,
              estado: factura.estado,
              numero: factura.numero,
              cabecera: {
                cuenta_id: factura.cuenta_id,
                fecha_emision: factura.fecha_emision,
                fecha_vencimiento: factura.fecha_vencimiento,
                iva_pct: Number(factura.iva_pct),
                irpf_pct: Number(factura.irpf_pct),
                notas: factura.notas,
              },
              lineas: lineas.map((l) => ({
                proyecto_id: l.proyecto_id,
                descripcion: l.descripcion,
                cantidad: Number(l.cantidad),
                precio_unitario: Number(l.precio_unitario),
              })),
            }}
            onCancelar={() => setModal(null)}
            onGuardada={(_, estado) => {
              setModal(null);
              avisar(estado === "emitida" ? "Factura guardada" : "Borrador guardado");
              notificarCambio();
              cargar();
            }}
          />
        </Modal>
      ) : null}

      {modal === "cobro" ? (
        <Modal titulo="Registrar cobro" onClose={() => setModal(null)}>
          <CobroForm
            facturaInicial={factura}
            onCancelar={() => setModal(null)}
            onGuardado={() => {
              setModal(null);
              avisar("Cobro registrado");
              notificarCambio();
              cargar();
            }}
          />
        </Modal>
      ) : null}

      {modal === "cancelar" ? (
        <Modal titulo={`Cancelar ${factura.numero}`} onClose={() => setModal(null)}>
          <p className="text-sm text-ink2">
            La factura deja de contar como facturada y como pendiente, pero se conserva (con su número) en el historial. Lo habitual
            es emitir después una factura rectificativa con tu gestor.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-ghost">
              Volver
            </button>
            <button
              onClick={() => accion(() => cambiarEstadoFactura(factura.id, "cancelada"), "Factura cancelada")}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              Cancelar factura
            </button>
          </div>
        </Modal>
      ) : null}

      {modal === "eliminar" ? (
        <Modal titulo="Eliminar borrador" onClose={() => setModal(null)}>
          <p className="text-sm text-ink2">El borrador y sus líneas se borrarán. No afecta a ningún número de factura.</p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setModal(null)} className="btn-ghost">
              Volver
            </button>
            <button
              onClick={async () => {
                try {
                  await eliminarFactura(factura.id);
                  avisar("Borrador eliminado");
                  router.replace("/finanzas/facturas");
                } catch (e) {
                  avisar(e instanceof Error ? e.message : "No se ha podido eliminar.", { tono: "error" });
                }
              }}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </button>
          </div>
        </Modal>
      ) : null}

      {cobroABorrar ? (
        <Modal titulo="Eliminar cobro" onClose={() => setCobroABorrar(null)}>
          <p className="text-sm text-ink2">
            Se eliminará el cobro de <strong className="text-ink">{eur(cobroABorrar.importe)}</strong> del {formatYMDCorta(cobroABorrar.fecha)}. La
            factura volverá a mostrar ese importe como pendiente.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setCobroABorrar(null)} className="btn-ghost">
              Volver
            </button>
            <button
              onClick={async () => {
                const c = cobroABorrar;
                setCobroABorrar(null);
                await accion(() => eliminarCobro(c.id), "Cobro eliminado");
              }}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar cobro
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
