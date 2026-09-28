"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { listarCobros, listarFacturas, listarGastos, listarSuscripciones } from "@/lib/data/finanzas";
import { aYMD, diasHasta, formatYMDCorta, formatYMDRelativa, hoyYMD, sumarDiasYMD, ymdADate } from "@/lib/dates";
import {
  aCentimos,
  agruparImportes,
  calcularKpis,
  eur,
  periodoQueContiene,
  renovacionesEntre,
  serieMensual,
  type Periodo,
} from "@/lib/finanzas";
import type { CobroConFactura, FacturaConCuenta, Gasto, Suscripcion } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { FinanzasNav } from "@/components/finanzas/FinanzasNav";
import { BarrasImporte, SelectorPeriodo } from "@/components/finanzas/SelectorPeriodo";
import { GraficoMensual } from "@/components/finanzas/GraficoMensual";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { Cabecera } from "@/components/ui/Cabecera";
import { Panel } from "@/components/ui/Panel";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { IconMas } from "@/components/Icons";

export default function FinanzasPage() {
  return (
    <SoloAdmin>
      <Resumen />
    </SoloAdmin>
  );
}

type Proximo = {
  clave: string;
  fecha: string;
  titulo: string;
  detalle: string;
  importe: number;
  href: string;
  tipo: "factura" | "renovacion";
};

function Resumen() {
  const { abrirAlta, versionDatos } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoQueContiene("mes"));
  const [facturas, setFacturas] = useState<FacturaConCuenta[]>([]);
  const [cobros, setCobros] = useState<CobroConFactura[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [suscripciones, setSuscripciones] = useState<Suscripcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // La gráfica muestra los 12 meses que terminan con el periodo elegido.
  const finSerie = useMemo(() => ymdADate(sumarDiasYMD(periodo.hasta, -1)), [periodo]);
  const desdeCarga = useMemo(() => {
    const inicioSerie = aYMD(new Date(finSerie.getFullYear(), finSerie.getMonth() - 11, 1));
    return inicioSerie < periodo.desde ? inicioSerie : periodo.desde;
  }, [finSerie, periodo]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [f, c, g, s] = await Promise.all([
        listarFacturas(),
        listarCobros({ desde: desdeCarga, hasta: periodo.hasta }),
        listarGastos({ desde: desdeCarga, hasta: periodo.hasta }),
        listarSuscripciones(),
      ]);
      setFacturas(f);
      setCobros(c);
      setGastos(g);
      setSuscripciones(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar las finanzas.");
    } finally {
      setCargando(false);
    }
  }, [desdeCarga, periodo.hasta]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const datos = { facturas, cobros, gastos };
  const k = calcularKpis(datos, periodo.desde, periodo.hasta);
  const serie = serieMensual(datos, 12, finSerie);

  const pendientes = facturas
    .filter((f) => f.estado === "emitida" && aCentimos(f.pendiente) > 0)
    .sort((a, b) => (a.fecha_vencimiento ?? "9999").localeCompare(b.fecha_vencimiento ?? "9999"));

  const porCuenta = agruparImportes(
    facturas.filter((f) => f.estado === "emitida" && f.fecha_emision >= periodo.desde && f.fecha_emision < periodo.hasta),
    (f) => f.cuenta_id,
    (f) => f.total
  ).map((x) => ({
    clave: x.clave,
    etiqueta: facturas.find((f) => f.cuenta_id === x.clave)?.cuenta?.nombre ?? "—",
    importe: x.importe,
    href: `/cuentas/${x.clave}`,
  }));

  // Próximos 30 días: vencimientos de facturas con pendiente y renovaciones de suscripciones.
  const hoy = hoyYMD();
  const limite = sumarDiasYMD(hoy, 31);
  const proximos: Proximo[] = [
    ...pendientes
      .filter((f) => f.fecha_vencimiento && f.fecha_vencimiento < limite)
      .map<Proximo>((f) => ({
        clave: `f-${f.id}`,
        fecha: f.fecha_vencimiento as string,
        titulo: `Factura ${f.numero}`,
        detalle: f.cuenta?.nombre ?? "",
        importe: Number(f.pendiente),
        href: `/finanzas/facturas/${f.id}`,
        tipo: "factura",
      })),
    ...suscripciones.flatMap((s) =>
      // Una renovación atrasada (sin registrar) también aparece: sigue pendiente de registrar.
      renovacionesEntre(s, "0000-01-01", limite).map<Proximo>((fecha) => ({
        clave: `r-${s.id}-${fecha}`,
        fecha,
        titulo: s.nombre,
        detalle: "Renovación",
        importe: Number(s.importe),
        href: "/finanzas/suscripciones",
        tipo: "renovacion",
      }))
    ),
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Finanzas"
        acciones={
          <>
            <button onClick={() => abrirAlta({ tipo: "gasto" })} className="btn-secondary">
              <IconMas className="h-4 w-4" />
              Gasto
            </button>
            <button onClick={() => abrirAlta({ tipo: "factura" })} className="btn-primary">
              <IconMas className="h-4 w-4" />
              Factura
            </button>
          </>
        }
      />
      <FinanzasNav />

      <div className="mb-4">
        <SelectorPeriodo periodo={periodo} onChange={setPeriodo} />
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={6} /> : null}

      {!cargando && !error ? (
        <div className="flex flex-col gap-6">
          <FilaKpis
            kpis={[
              {
                etiqueta: "Facturado",
                valor: eur(k.facturado),
                nota: k.numFacturas ? `${eur(k.facturadoBase)} base · ${k.numFacturas} fact.` : "Sin facturas emitidas",
                href: "/finanzas/facturas",
              },
              {
                etiqueta: "Cobrado",
                valor: eur(k.cobrado),
                nota: "Recibido en el periodo",
              },
              {
                etiqueta: "Pendiente de cobro",
                valor: eur(k.pendiente),
                nota: k.numVencidas
                  ? `${eur(k.vencido)} vencido · ${k.numVencidas} fact.`
                  : `${k.numPendientes} factura${k.numPendientes === 1 ? "" : "s"} · a hoy`,
                alerta: k.numVencidas > 0,
                href: k.numVencidas ? "/finanzas/facturas?estado=vencidas" : "/finanzas/facturas?estado=pendientes",
              },
              {
                etiqueta: "Gastos",
                valor: eur(k.gastos),
                nota: "Pagados en el periodo",
                href: "/finanzas/gastos",
              },
              {
                etiqueta: "Caja neta (aprox.)",
                valor: <span className={k.cajaNeta < 0 ? "text-red-600 dark:text-red-400" : ""}>{eur(k.cajaNeta)}</span>,
                nota: "Cobrado − gastos",
              },
              {
                etiqueta: "Ticket medio",
                valor: k.numFacturas ? eur(k.ticketMedio) : "—",
                nota: "Por factura emitida",
              },
            ]}
          />

          <Panel titulo="Últimos 12 meses">
            <GraficoMensual puntos={serie} />
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_340px]">
            <Panel
              titulo="Pendiente de cobro"
              contador={pendientes.length}
              enlace={{
                href: "/finanzas/facturas?estado=pendientes",
                texto: "Todas",
              }}
            >
              {pendientes.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink3">Todo cobrado. No hay facturas pendientes.</p>
              ) : (
                <>
                  <ul className="divide-y divide-line md:hidden">
                    {pendientes.slice(0, 8).map((f) => (
                      <li key={f.id}>
                        <Link href={`/finanzas/facturas/${f.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm active:bg-mute">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">
                              {f.cuenta?.nombre} <span className="font-normal tabular-nums text-ink3">· {f.numero}</span>
                            </span>
                            <span className={`block text-xs ${f.vencida ? "font-medium text-red-600 dark:text-red-400" : "text-ink3"}`}>
                              {f.fecha_vencimiento
                                ? `${f.vencida ? "Vencida" : "Vence"} ${formatYMDRelativa(f.fecha_vencimiento).toLowerCase()}`
                                : "Sin vencimiento"}
                              {aCentimos(f.cobrado) > 0 ? ` · cobrado ${eur(f.cobrado)}` : ""}
                            </span>
                          </span>
                          <span className="font-medium tabular-nums text-ink">{eur(f.pendiente)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden md:block">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-line text-left text-xs text-ink3">
                          <th className="px-4 py-2 font-medium">Factura</th>
                          <th className="px-3 py-2 font-medium">Cuenta</th>
                          <th className="px-3 py-2 text-right font-medium">Total</th>
                          <th className="px-3 py-2 text-right font-medium">Cobrado</th>
                          <th className="px-3 py-2 text-right font-medium">Pendiente</th>
                          <th className="px-4 py-2 font-medium">Vence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendientes.slice(0, 8).map((f) => (
                          <tr key={f.id} className="group border-b border-line last:border-0 hover:bg-mute/50">
                            <td className="px-4 py-2">
                              <Link href={`/finanzas/facturas/${f.id}`} className="font-medium tabular-nums text-ink group-hover:underline">
                                {f.numero}
                              </Link>
                            </td>
                            <td className="max-w-[10rem] truncate px-3 py-2 text-ink2">{f.cuenta?.nombre}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ink2">{eur(f.total)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-ink2">{eur(f.cobrado)}</td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">{eur(f.pendiente)}</td>
                            <td
                              className={`whitespace-nowrap px-4 py-2 ${f.vencida ? "font-medium text-red-600 dark:text-red-400" : "text-ink2"}`}
                            >
                              {f.fecha_vencimiento ? formatYMDRelativa(f.fecha_vencimiento) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Panel>

            <Panel titulo="Próximos 30 días" contador={proximos.length}>
              {proximos.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink3">Sin vencimientos ni renovaciones.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {proximos.slice(0, 10).map((p) => {
                    const d = diasHasta(p.fecha);
                    return (
                      <li key={p.clave}>
                        <Link href={p.href} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-mute/50">
                          <span
                            className={`w-14 shrink-0 whitespace-nowrap tabular-nums ${d < 0 ? "font-medium text-red-600 dark:text-red-400" : "text-ink3"}`}
                          >
                            {formatYMDCorta(p.fecha)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-ink">{p.titulo}</span>
                            <span className="block truncate text-xs text-ink3">
                              {p.tipo === "factura" ? `Vencimiento · ${p.detalle}` : d < 0 ? "Renovación sin registrar" : "Renovación"}
                            </span>
                          </span>
                          <span className={`tabular-nums ${p.tipo === "factura" ? "font-medium text-ink" : "text-ink2"}`}>
                            {p.tipo === "factura" ? "+" : "−"}
                            {eur(p.importe)}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>

          <Panel titulo={`Facturado por cuenta · ${periodo.etiqueta}`}>
            <BarrasImporte filas={porCuenta} formato={eur} vacio="Sin facturas emitidas en este periodo." />
          </Panel>

          <p className="text-xs leading-relaxed text-ink3">
            Facturado: total de las facturas emitidas en el periodo (IVA incluido, IRPF descontado). Cobrado: cobros con fecha en el
            periodo. Pendiente: lo que falta por cobrar hoy de todas las facturas emitidas. Caja neta (aprox.) = cobrado − gastos del
            periodo; es un indicador de caja, no el beneficio fiscal.
          </p>
        </div>
      ) : null}
    </div>
  );
}
