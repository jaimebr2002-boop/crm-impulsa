"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { facturacionDeProyecto, facturasDeProyecto } from "@/lib/data/finanzas";
import { aCentimos, eur, estadoFacturacionProyecto, ESTADO_FACTURACION_LABEL, repartoFacturacion } from "@/lib/finanzas";
import type { FacturaConCuenta, ProyectoConRelaciones, ProyectoFacturacion } from "@/lib/types";
import { EstadoFacturaChip } from "./EstadoFactura";

const ESTILO = {
  sin_facturar: "border-line text-ink2",
  parcial: "border-amber-300 text-amber-700 dark:border-amber-500/40 dark:text-amber-400",
  facturado: "border-emerald-300 text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-400",
} as const;

/** Bloque ligero de facturación en la ficha de proyecto (importes sin IVA). */
export function FacturacionProyecto({ proyecto }: { proyecto: ProyectoConRelaciones }) {
  const { abrirAlta, versionDatos } = useApp();
  const [fact, setFact] = useState<ProyectoFacturacion | null>(null);
  const [facturas, setFacturas] = useState<{ factura: FacturaConCuenta; importe: number }[]>([]);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [f, fs] = await Promise.all([facturacionDeProyecto(proyecto.id), facturasDeProyecto(proyecto.id)]);
      setFact(f);
      setFacturas(fs.sort((a, b) => b.factura.fecha_emision.localeCompare(a.factura.fecha_emision)));
      setError(false);
    } catch {
      setError(true);
    }
  }, [proyecto.id]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const facturado = Number(fact?.facturado ?? 0);
  const estado = estadoFacturacionProyecto(proyecto.importe, facturado);
  const r = repartoFacturacion(proyecto, fact);
  const falta = r.porPreparar;

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm" data-testid="facturacion-proyecto">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-ink3">Facturación</h3>
        <span className={`chip ${ESTILO[estado]}`}>{ESTADO_FACTURACION_LABEL[estado]}</span>
      </div>
      {error ? (
        <p className="text-xs text-ink3">No se ha podido cargar la facturación.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:gap-1.5">
            <Fila label="Valor" valor={proyecto.importe != null ? eur(proyecto.importe) : "—"} />
            <Fila label="Facturado" valor={eur(facturado)} />
            <Fila label="Cobrado" valor={eur(fact?.cobrado ?? 0)} />
            {r.enBorrador > 0 ? <Fila label="En borrador" valor={eur(r.enBorrador)} /> : null}
          </dl>
          {facturas.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3">
              {facturas.map(({ factura: f, importe }) => (
                <li key={f.id} className="flex items-center gap-2">
                  <Link href={`/finanzas/facturas/${f.id}`} className="font-medium tabular-nums text-ink hover:underline">
                    {f.numero ?? "Borrador"}
                  </Link>
                  <span className="flex-1 text-xs tabular-nums text-ink3">{eur(importe)}</span>
                  <EstadoFacturaChip factura={f} />
                </li>
              ))}
            </ul>
          ) : null}
          {proyecto.cuenta_id && (aCentimos(falta) > 0 || proyecto.importe == null) ? (
            <button
              onClick={() => abrirAlta({ tipo: "factura", cuentaId: proyecto.cuenta_id ?? undefined, proyectoIds: [proyecto.id] })}
              className="btn-secondary mt-3 w-full justify-center py-1.5 text-xs"
            >
              {facturas.some((x) => x.factura.estado === "borrador") ? "Nueva factura" : "Facturar"}
              {aCentimos(falta) > 0 ? ` ${eur(falta)}` : ""}
            </button>
          ) : null}
          {aCentimos(falta) === 0 && r.enBorrador > 0 && r.borradores[0] ? (
            <Link href={`/finanzas/facturas/${r.borradores[0]}`} className="btn-ghost mt-3 w-full justify-center py-1.5 text-xs">
              En borrador · revisar y emitir
            </Link>
          ) : null}
          <p className="mt-2 text-[11px] text-ink3">
            Sin IVA. Facturado: solo facturas emitidas. Cobrado: parte proporcional de los cobros de sus facturas.
          </p>
        </>
      )}
    </div>
  );
}

function Fila({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-baseline lg:justify-between">
      <dt className="text-xs text-ink3">{label}</dt>
      <dd className="font-medium tabular-nums text-ink">{valor}</dd>
    </div>
  );
}
