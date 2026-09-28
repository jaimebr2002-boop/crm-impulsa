"use client";

import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { formatYMDCorta } from "@/lib/dates";
import { aCentimos, deCentimos, eur, METODO_COBRO_LABEL } from "@/lib/finanzas";
import type { CobroConFactura, FacturaConCuenta, ProyectoConRelaciones, ProyectoFacturacion } from "@/lib/types";
import { Panel } from "../ui/Panel";
import { EstadoFacturaChip } from "./EstadoFactura";
import { IconMas } from "../Icons";

/** Importe de un proyecto que aún no está en ninguna factura emitida (base, sin IVA). */
export function porFacturar(p: Pick<ProyectoConRelaciones, "importe" | "estado">, fact: ProyectoFacturacion | undefined): number {
  if (p.estado === "cancelado" || p.importe == null) return 0;
  return Math.max(deCentimos(aCentimos(p.importe) - aCentimos(fact?.facturado ?? 0)), 0);
}

/** Pestaña Finanzas de una cuenta: qué falta por facturar, sus facturas y sus cobros. */
export function FinanzasCuenta({
  cuentaId,
  proyectos,
  facturas,
  cobros,
  facturacion,
}: {
  cuentaId: string;
  proyectos: ProyectoConRelaciones[];
  facturas: FacturaConCuenta[];
  cobros: CobroConFactura[];
  facturacion: Record<string, ProyectoFacturacion>;
}) {
  const { abrirAlta } = useApp();
  const sinFacturar = proyectos
    .map((p) => ({ p, falta: porFacturar(p, facturacion[p.id]) }))
    .filter((x) => x.falta > 0)
    .sort((a, b) => b.falta - a.falta);
  const totalSinFacturar = deCentimos(sinFacturar.reduce((t, x) => t + aCentimos(x.falta), 0));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={() => abrirAlta({ tipo: "cobro" })}
          disabled={!facturas.some((f) => f.estado === "emitida" && aCentimos(f.pendiente) > 0)}
          className="btn-secondary"
        >
          Registrar cobro
        </button>
        <button onClick={() => abrirAlta({ tipo: "factura", cuentaId })} className="btn-primary">
          <IconMas className="h-4 w-4" />
          Factura
        </button>
      </div>

      <Panel
        titulo={`Por facturar${sinFacturar.length ? ` · ${eur(totalSinFacturar)}` : ""}`}
        contador={sinFacturar.length}
        accion={
          sinFacturar.length > 1
            ? { texto: "Facturar todos", onClick: () => abrirAlta({ tipo: "factura", cuentaId, proyectoIds: sinFacturar.map((x) => x.p.id) }) }
            : undefined
        }
      >
        {sinFacturar.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink3">Todo el valor de los proyectos está facturado.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sinFacturar.map(({ p, falta }) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link href={`/proyectos/${p.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:underline">
                  {p.nombre}
                </Link>
                <span className="hidden text-xs text-ink3 sm:block">
                  {aCentimos(facturacion[p.id]?.facturado ?? 0) > 0 ? `${eur(facturacion[p.id]?.facturado)} de ${eur(p.importe)}` : "Sin facturar"}
                </span>
                <span className="w-24 text-right font-medium tabular-nums text-ink">{eur(falta)}</span>
                <button onClick={() => abrirAlta({ tipo: "factura", cuentaId, proyectoIds: [p.id] })} className="btn-ghost py-1 text-xs">
                  Facturar
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-2 text-xs text-ink3">Importes sin IVA: valor del proyecto menos lo ya facturado.</p>
      </Panel>

      <Panel titulo="Facturas" contador={facturas.length}>
        {facturas.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink3">Aún no hay facturas para esta cuenta.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink3">
                  <th className="px-4 py-2 font-medium">Factura</th>
                  <th className="px-3 py-2 font-medium">Emisión</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                  <th className="px-3 py-2 text-right font-medium">Cobrado</th>
                  <th className="px-3 py-2 text-right font-medium">Pendiente</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {facturas.map((f) => (
                  <tr key={f.id} className="group border-b border-line last:border-0 hover:bg-mute/50">
                    <td className="px-4 py-2">
                      <Link href={`/finanzas/facturas/${f.id}`} className="font-medium tabular-nums text-ink group-hover:underline">
                        {f.numero ?? "Borrador"}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink2">{formatYMDCorta(f.fecha_emision)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{eur(f.total)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink2">{eur(f.cobrado)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">
                      {f.estado === "emitida" && aCentimos(f.pendiente) > 0 ? eur(f.pendiente) : <span className="text-ink3">—</span>}
                    </td>
                    <td className="px-4 py-2">
                      <EstadoFacturaChip factura={f} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel titulo="Cobros" contador={cobros.length}>
        {cobros.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink3">Sin cobros registrados.</p>
        ) : (
          <ul className="divide-y divide-line">
            {cobros.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-12 shrink-0 tabular-nums text-ink3">{formatYMDCorta(c.fecha)}</span>
                <span className="min-w-0 flex-1 truncate text-ink2">
                  {c.factura ? (
                    <Link href={`/finanzas/facturas/${c.factura.id}`} className="font-medium text-ink hover:underline">
                      {c.factura.numero}
                    </Link>
                  ) : null}
                  {" · "}
                  {METODO_COBRO_LABEL[c.metodo]}
                  {c.referencia ? ` · ${c.referencia}` : ""}
                </span>
                <span className="font-medium tabular-nums text-ink">{eur(c.importe)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
