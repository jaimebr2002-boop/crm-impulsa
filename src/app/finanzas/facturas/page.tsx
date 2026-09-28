"use client";

import { CampoBusqueda } from "@/components/ui/CampoBusqueda";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { listarFacturas } from "@/lib/data/finanzas";
import { formatYMDCorta } from "@/lib/dates";
import { aCentimos, eur, resumenFacturas } from "@/lib/finanzas";
import type { FacturaConCuenta } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { FinanzasNav } from "@/components/finanzas/FinanzasNav";
import { EstadoFacturaChip } from "@/components/finanzas/EstadoFactura";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { IconMas } from "@/components/Icons";

type Filtro = "todas" | "pendientes" | "vencidas" | "cobradas" | "borradores" | "sinpdf";
const FILTROS: Filtro[] = ["todas", "pendientes", "vencidas", "cobradas", "borradores", "sinpdf"];

export default function FacturasPage() {
  return (
    <SoloAdmin>
      <Suspense fallback={null}>
        <Facturas />
      </Suspense>
    </SoloAdmin>
  );
}

function Facturas() {
  const { abrirAlta, versionDatos } = useApp();
  const params = useSearchParams();
  const inicial = params.get("estado") as Filtro | null;
  const [facturas, setFacturas] = useState<FacturaConCuenta[]>([]);
  const [filtro, setFiltro] = useState<Filtro>(inicial && FILTROS.includes(inicial) ? inicial : "todas");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFacturas(await listarFacturas());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar las facturas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return facturas
      .filter((f) => {
        if (filtro === "pendientes") return f.estado === "emitida" && aCentimos(f.pendiente) > 0;
        if (filtro === "vencidas") return f.vencida;
        if (filtro === "cobradas") return f.estado_cobro === "cobrada";
        if (filtro === "borradores") return f.estado === "borrador";
        if (filtro === "sinpdf") return f.estado === "emitida" && f.pdf_estado !== "actualizado";
        return true;
      })
      .filter((f) => !q || (f.numero ?? "borrador").toLowerCase().includes(q) || (f.cuenta?.nombre ?? "").toLowerCase().includes(q));
  }, [facturas, filtro, busqueda]);

  const r = resumenFacturas(visibles);
  const cuenta = (n: number) => facturas.filter((f) => {
    if (n === 0) return f.estado === "emitida" && aCentimos(f.pendiente) > 0;
    return f.vencida;
  }).length;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Finanzas"
        acciones={
          <button onClick={() => abrirAlta({ tipo: "factura" })} className="btn-primary">
            <IconMas className="h-4 w-4" />
            Factura
          </button>
        }
      />
      <FinanzasNav />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Segmentado
            opciones={[
              { id: "todas", label: "Todas" },
              { id: "pendientes", label: `Pendientes${cuenta(0) ? ` ${cuenta(0)}` : ""}` },
              { id: "vencidas", label: `Vencidas${cuenta(1) ? ` ${cuenta(1)}` : ""}` },
              { id: "cobradas", label: "Cobradas" },
              { id: "borradores", label: "Borradores" },
              { id: "sinpdf", label: "Sin PDF al día" },
            ]}
            valor={filtro}
            onChange={setFiltro}
          />
        </div>
        <CampoBusqueda valor={busqueda} onChange={setBusqueda} placeholder="Número o cuenta" className="min-w-[180px] flex-1 md:max-w-xs" />
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={5} alto="h-11" /> : null}

      {!cargando && !error && visibles.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="text-sm font-medium text-ink">No hay facturas {filtro === "todas" ? "todavía" : "con este filtro"}.</p>
          <p className="mt-1 max-w-sm text-sm text-ink3">Una factura puede incluir varios proyectos (p. ej. la mensual de Fer) y líneas manuales.</p>
          <button onClick={() => abrirAlta({ tipo: "factura" })} className="btn-primary mt-4">
            <IconMas className="h-4 w-4" />
            Crear factura
          </button>
        </div>
      ) : null}

      {!cargando && !error && visibles.length > 0 ? (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-28" />
                <col />
                <col className="w-24" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink3">
                  <th className="px-4 py-2.5 font-medium">Número</th>
                  <th className="px-3 py-2.5 font-medium">Cuenta</th>
                  <th className="px-3 py-2.5 font-medium">Emisión</th>
                  <th className="px-3 py-2.5 font-medium">Vence</th>
                  <th className="px-3 py-2.5 text-right font-medium">Total</th>
                  <th className="px-3 py-2.5 text-right font-medium">Cobrado</th>
                  <th className="px-3 py-2.5 text-right font-medium">Pendiente</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} className="group border-b border-line last:border-0 hover:bg-mute/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/finanzas/facturas/${f.id}`} className="font-medium tabular-nums text-ink group-hover:underline">
                        {f.numero ?? "Borrador"}
                      </Link>
                    </td>
                    <td className="truncate px-3 py-2.5 text-ink2">{f.cuenta?.nombre}</td>
                    <td className="px-3 py-2.5 text-ink2">{formatYMDCorta(f.fecha_emision)}</td>
                    <td className={`px-3 py-2.5 ${f.vencida ? "font-medium text-red-600 dark:text-red-400" : "text-ink2"}`}>
                      {f.fecha_vencimiento ? formatYMDCorta(f.fecha_vencimiento) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink">{eur(f.total)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{eur(f.cobrado)}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink">
                      {aCentimos(f.pendiente) > 0 && f.estado === "emitida" ? eur(f.pendiente) : <span className="text-ink3">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <EstadoFacturaChip factura={f} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-mute/30 text-xs text-ink2">
                  <td className="px-4 py-2" colSpan={4}>
                    {visibles.length} factura{visibles.length === 1 ? "" : "s"} · solo emitidas en los totales
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{eur(r.facturado)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{eur(r.cobrado)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{eur(r.pendiente)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:hidden">
            {visibles.map((f) => (
              <Link key={f.id} href={`/finanzas/facturas/${f.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-mute">
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium tabular-nums text-ink">{f.numero ?? "Borrador"}</span>
                  <span className="block truncate text-xs text-ink3">
                    {f.cuenta?.nombre} · {formatYMDCorta(f.fecha_emision)}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold tabular-nums text-ink">{eur(f.total)}</span>
                  <EstadoFacturaChip factura={f} />
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
