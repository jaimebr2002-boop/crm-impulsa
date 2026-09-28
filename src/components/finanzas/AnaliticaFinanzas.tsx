"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { lineasFacturadas, listarCobros, listarFacturas, listarGastos, type LineaFacturada } from "@/lib/data/finanzas";
import { aYMD, sumarDiasYMD, ymdADate } from "@/lib/dates";
import { agruparImportes, calcularKpis, eur, periodoQueContiene, serieMensual, type Periodo } from "@/lib/finanzas";
import { TIPO_PROYECTO_LABEL } from "@/lib/trabajo";
import type { CobroConFactura, FacturaConCuenta, Gasto, TipoProyecto } from "@/lib/types";
import { FilaKpis } from "../trabajo/FilaKpis";
import { Panel } from "../ui/Panel";
import { SkeletonLineas } from "../ui/Skeleton";
import { ErrorState } from "../ErrorState";
import { BarrasImporte, SelectorPeriodo } from "./SelectorPeriodo";
import { GraficoMensual } from "./GraficoMensual";

/** Sección financiera de Analítica (solo admin). Usa las mismas reglas que /finanzas. */
export function AnaliticaFinanzas() {
  const { versionDatos } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>(() => periodoQueContiene("anio"));
  const [facturas, setFacturas] = useState<FacturaConCuenta[]>([]);
  const [cobros, setCobros] = useState<CobroConFactura[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [lineas, setLineas] = useState<LineaFacturada[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const finSerie = useMemo(() => ymdADate(sumarDiasYMD(periodo.hasta, -1)), [periodo]);
  const desdeCarga = useMemo(() => {
    const inicioSerie = aYMD(new Date(finSerie.getFullYear(), finSerie.getMonth() - 11, 1));
    return inicioSerie < periodo.desde ? inicioSerie : periodo.desde;
  }, [finSerie, periodo]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [f, c, g, l] = await Promise.all([
        listarFacturas(),
        listarCobros({ desde: desdeCarga, hasta: periodo.hasta }),
        listarGastos({ desde: desdeCarga, hasta: periodo.hasta }),
        lineasFacturadas(periodo.desde, periodo.hasta),
      ]);
      setFacturas(f);
      setCobros(c);
      setGastos(g);
      setLineas(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar las finanzas.");
    } finally {
      setCargando(false);
    }
  }, [desdeCarga, periodo]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const datos = { facturas, cobros, gastos };
  const k = calcularKpis(datos, periodo.desde, periodo.hasta);
  const serie = serieMensual(datos, 12, finSerie);

  const emitidasPeriodo = facturas.filter((f) => f.estado === "emitida" && f.fecha_emision >= periodo.desde && f.fecha_emision < periodo.hasta);
  const porCuenta = agruparImportes(emitidasPeriodo, (f) => f.cuenta_id, (f) => f.base).map((x) => ({
    clave: x.clave,
    etiqueta: facturas.find((f) => f.cuenta_id === x.clave)?.cuenta?.nombre ?? "—",
    importe: x.importe,
    href: `/cuentas/${x.clave}`,
  }));
  const marcas = new Map(lineas.flatMap((l) => (l.proyecto?.marca ? [[l.proyecto.marca.id, l.proyecto.marca.nombre] as const] : [])));
  const porMarca = agruparImportes(lineas, (l) => l.proyecto?.marca?.id ?? "", (l) => l.importe).map((x) => ({
    clave: x.clave || "sin",
    etiqueta: x.clave ? marcas.get(x.clave) ?? "—" : "Sin marca",
    importe: x.importe,
    href: x.clave ? `/marcas/${x.clave}` : undefined,
  }));
  const porTipo = agruparImportes(lineas, (l) => l.proyecto?.tipo ?? "", (l) => l.importe).map((x) => ({
    clave: x.clave || "manual",
    etiqueta: x.clave ? TIPO_PROYECTO_LABEL[x.clave as TipoProyecto] ?? x.clave : "Líneas manuales",
    importe: x.importe,
  }));

  return (
    <section className="flex flex-col gap-4" aria-labelledby="analitica-finanzas">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-6">
        <h2 id="analitica-finanzas" className="font-display text-lg font-bold text-ink">
          Finanzas
        </h2>
        <SelectorPeriodo periodo={periodo} onChange={setPeriodo} />
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={4} /> : null}

      {!cargando && !error ? (
        <>
          <FilaKpis
            columnas="md:grid-cols-4"
            kpis={[
              { etiqueta: "Facturado", valor: eur(k.facturado), nota: `${eur(k.facturadoBase)} base`, href: "/finanzas" },
              { etiqueta: "Cobrado", valor: eur(k.cobrado) },
              { etiqueta: "Gastos", valor: eur(k.gastos), href: "/finanzas/gastos" },
              {
                etiqueta: "Resultado (caja, aprox.)",
                valor: <span className={k.cajaNeta < 0 ? "text-red-600 dark:text-red-400" : ""}>{eur(k.cajaNeta)}</span>,
                nota: "Cobrado − gastos · no fiscal",
              },
            ]}
          />
          <Panel titulo="Facturado, cobrado y gastos por mes">
            <GraficoMensual puntos={serie} />
          </Panel>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel titulo="Por cuenta">
              <BarrasImporte filas={porCuenta} formato={eur} vacio="Sin facturas en este periodo." />
            </Panel>
            <Panel titulo="Por marca">
              <BarrasImporte filas={porMarca} formato={eur} vacio="Sin facturas en este periodo." />
            </Panel>
            <Panel titulo="Por tipo de proyecto">
              <BarrasImporte filas={porTipo} formato={eur} vacio="Sin facturas en este periodo." />
            </Panel>
          </div>
          <p className="text-xs text-ink3">Desgloses en base imponible (sin IVA), de las facturas emitidas en el periodo.</p>
        </>
      ) : null}
    </section>
  );
}
