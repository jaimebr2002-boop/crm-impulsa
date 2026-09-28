"use client";

import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { formatYMDCorta } from "@/lib/dates";
import { aCentimos, deCentimos, eur, METODO_COBRO_LABEL, repartoFacturacion } from "@/lib/finanzas";
import type { CobroConFactura, FacturaConCuenta, ProyectoConRelaciones, ProyectoFacturacion } from "@/lib/types";
import { Panel } from "../ui/Panel";
import { EstadoFacturaChip } from "./EstadoFactura";
import { IconMas } from "../Icons";

/** Lo que falta por meter en alguna factura (ni emitida ni en borrador). Base, sin IVA. */
export function porFacturar(p: Pick<ProyectoConRelaciones, "importe" | "estado">, fact: ProyectoFacturacion | undefined): number {
  return repartoFacturacion(p, fact).porPreparar;
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
  // Proyectos con algo pendiente de emitir: sin preparar (se ofrece "Facturar")
  // o ya preparado en un borrador (se muestra "En borrador", no se ofrece otra vez).
  const filas = proyectos
    .map((p) => ({ p, r: repartoFacturacion(p, facturacion[p.id]) }))
    .filter((x) => x.r.porPreparar > 0 || x.r.enBorrador > 0)
    .sort((a, b) => b.r.porPreparar - a.r.porPreparar || b.r.enBorrador - a.r.enBorrador);
  const sinFacturar = filas.filter((x) => x.r.porPreparar > 0);
  const totalSinFacturar = deCentimos(sinFacturar.reduce((t, x) => t + aCentimos(x.r.porPreparar), 0));
  const totalBorrador = deCentimos(filas.reduce((t, x) => t + aCentimos(x.r.enBorrador), 0));

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
        {filas.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink3">Todo el valor de los proyectos está facturado.</p>
        ) : (
          <ul className="divide-y divide-line">
            {filas.map(({ p, r }) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Link href={`/proyectos/${p.id}`} className="min-w-0 flex-1 truncate font-medium text-ink hover:underline">
                  {p.nombre}
                </Link>
                <span className="hidden text-xs text-ink3 sm:block">
                  {[
                    r.facturado > 0 ? `${eur(r.facturado)} facturado` : r.enBorrador > 0 ? null : "Sin facturar",
                    r.enBorrador > 0 && r.porPreparar > 0 ? `${eur(r.enBorrador)} en borrador` : null,
                    r.valor != null && (r.facturado > 0 || r.enBorrador > 0) ? `de ${eur(r.valor)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {r.porPreparar > 0 ? (
                  <>
                    <span className="w-24 text-right font-medium tabular-nums text-ink">{eur(r.porPreparar)}</span>
                    <button onClick={() => abrirAlta({ tipo: "factura", cuentaId, proyectoIds: [p.id] })} className="btn-ghost w-24 py-1 text-xs">
                      Facturar
                    </button>
                  </>
                ) : (
                  <>
                    <span className="w-24 text-right tabular-nums text-ink3">{eur(r.enBorrador)}</span>
                    <Link href={`/finanzas/facturas/${r.borradores[0]}`} className="w-24 text-center">
                      <span className="chip border-line text-ink2">En borrador</span>
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-4 py-2 text-xs text-ink3">
          Sin IVA: valor del proyecto − facturado (emitido) − lo que ya está en un borrador.
          {totalBorrador > 0 ? ` En borradores: ${eur(totalBorrador)} (aún no cuenta como facturado).` : ""}
        </p>
      </Panel>

      <Panel titulo="Facturas" contador={facturas.length}>
        {facturas.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink3">Aún no hay facturas para esta cuenta.</p>
        ) : (
          <>
          <ul className="divide-y divide-line md:hidden">
            {facturas.map((f) => (
              <li key={f.id}>
                <Link href={`/finanzas/facturas/${f.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm active:bg-mute">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium tabular-nums text-ink">{f.numero ?? "Borrador"}</span>
                    <span className="block text-xs text-ink3">
                      {formatYMDCorta(f.fecha_emision)}
                      {f.estado === "emitida" && aCentimos(f.pendiente) > 0 ? ` · pendiente ${eur(f.pendiente)}` : ""}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="font-medium tabular-nums text-ink">{eur(f.total)}</span>
                    <EstadoFacturaChip factura={f} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <table className="w-full text-sm">
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
          </>
        )}
      </Panel>

      <Panel titulo="Cobros" contador={cobros.length}>
        {cobros.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-ink3">Sin cobros registrados.</p>
        ) : (
          <ul className="divide-y divide-line">
            {cobros.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-14 shrink-0 whitespace-nowrap tabular-nums text-ink3">{formatYMDCorta(c.fecha)}</span>
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
