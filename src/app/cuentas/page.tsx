"use client";

import { CampoBusqueda } from "@/components/ui/CampoBusqueda";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { listarCuentas, listarMarcas } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import { formatEuros } from "@/lib/constants";
import { formatHaceCuanto } from "@/lib/dates";
import { resumirProyectos, type ResumenProyectos } from "@/lib/metricas";
import { TIPO_CUENTA_LABEL } from "@/lib/trabajo";
import type { Cuenta, Marca, TipoCuenta } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Avatar } from "@/components/Avatar";
import { IconMas } from "@/components/Icons";

type Filtro = "todas" | TipoCuenta | "archivadas";
type Fila = { cuenta: Cuenta; marcas: Marca[]; resumen: ResumenProyectos; ultimo: string };

export default function CuentasPage() {
  return (
    <SoloAdmin>
      <Cuentas />
    </SoloAdmin>
  );
}

function Cuentas() {
  const { abrirAlta, versionDatos } = useApp();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [cuentas, marcas, proyectos] = await Promise.all([
        listarCuentas({ archivadas: filtro === "archivadas" }),
        listarMarcas(),
        listarProyectos(),
      ]);
      setFilas(
        cuentas.map((c) => {
          const suyos = proyectos.filter((p) => p.cuenta_id === c.id);
          const resumen = resumirProyectos(suyos);
          const ultimo = resumen.ultimoMovimiento && resumen.ultimoMovimiento > c.updated_at ? resumen.ultimoMovimiento : c.updated_at;
          return { cuenta: c, marcas: marcas.filter((m) => m.cuenta_id === c.id), resumen, ultimo };
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar las cuentas.");
    } finally {
      setCargando(false);
    }
  }, [filtro]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas
      .filter((f) => filtro === "todas" || filtro === "archivadas" || f.cuenta.tipo === filtro)
      .filter((f) => !q || f.cuenta.nombre.toLowerCase().includes(q) || f.marcas.some((m) => m.nombre.toLowerCase().includes(q)))
      .sort((a, b) => b.resumen.activos - a.resumen.activos || b.resumen.valorProyectos - a.resumen.valorProyectos);
  }, [filas, filtro, busqueda]);

  const totalEnCurso = visibles.reduce((s, f) => s + f.resumen.valorEnCurso, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Cuentas"
        subtitulo={
          cargando
            ? "…"
            : `${visibles.length} cuenta${visibles.length === 1 ? "" : "s"}${totalEnCurso ? ` · ${formatEuros(totalEnCurso)} en curso` : ""}`
        }
        acciones={
          <button onClick={() => abrirAlta({ tipo: "cuenta" })} className="btn-primary">
            <IconMas className="h-4 w-4" />
            Nueva cuenta
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Segmentado
            opciones={[
              { id: "todas", label: "Todas" },
              { id: "intermediario", label: "Intermediarios" },
              { id: "cliente_directo", label: "Clientes directos" },
              { id: "archivadas", label: "Archivadas" },
            ]}
            valor={filtro}
            onChange={setFiltro}
          />
        </div>
        <CampoBusqueda valor={busqueda} onChange={setBusqueda} placeholder="Buscar cuenta o marca" className="min-w-[180px] flex-1 md:max-w-xs" />
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={4} /> : null}

      {!cargando && !error && visibles.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
          <p className="text-sm font-medium text-ink">{filtro === "archivadas" ? "No hay cuentas archivadas." : "Aún no hay cuentas."}</p>
          <p className="mt-1 max-w-sm text-sm text-ink3">
            Una cuenta es de dónde viene el trabajo: un intermediario como Fer, o un cliente directo.
          </p>
          {filtro !== "archivadas" ? (
            <button onClick={() => abrirAlta({ tipo: "cuenta" })} className="btn-primary mt-4">
              <IconMas className="h-4 w-4" />
              Crear cuenta
            </button>
          ) : null}
        </div>
      ) : null}

      {!cargando && !error && visibles.length > 0 ? (
        <>
          {/* Escritorio */}
          <div className="hidden overflow-hidden rounded-xl border border-line bg-surface md:block">
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col />
                <col className="w-[26%]" />
                <col className="w-20" />
                <col className="w-24" />
                <col className="w-28" />
                <col className="w-28" />
                <col className="w-28" />
              </colgroup>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink3">
                  <th className="px-4 py-2.5 font-medium">Cuenta</th>
                  <th className="px-3 py-2.5 font-medium">Marcas</th>
                  <th className="px-3 py-2.5 text-right font-medium">Activos</th>
                  <th className="px-3 py-2.5 text-right font-medium">Entregados</th>
                  <th className="px-3 py-2.5 text-right font-medium">Valor proyectos</th>
                  <th className="px-3 py-2.5 text-right font-medium">En curso</th>
                  <th className="px-4 py-2.5 text-right font-medium">Movimiento</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(({ cuenta: c, marcas, resumen: r, ultimo }) => (
                  <tr key={c.id} className="group border-b border-line last:border-0 hover:bg-mute/50">
                    <td className="max-w-0 px-4 py-2.5">
                      <Link href={`/cuentas/${c.id}`} className="flex items-center gap-2.5">
                        <Avatar nombre={c.nombre} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink group-hover:underline">{c.nombre}</span>
                          <span className="block truncate text-xs text-ink3">{TIPO_CUENTA_LABEL[c.tipo]}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="max-w-0 px-3 py-2.5">
                      <span className="block truncate text-xs text-ink2">
                        {marcas.length ? marcas.map((m) => m.nombre).join(", ") : <span className="text-ink3">—</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink">{r.activos}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{r.entregados}</td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink">{formatEuros(r.valorProyectos)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink2">{formatEuros(r.valorEnCurso)}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-ink3">{formatHaceCuanto(ultimo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Móvil */}
          <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface md:hidden">
            {visibles.map(({ cuenta: c, marcas, resumen: r }) => (
              <Link key={c.id} href={`/cuentas/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-mute">
                <Avatar nombre={c.nombre} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{c.nombre}</span>
                  <span className="block truncate text-xs text-ink3">
                    {r.activos} activo{r.activos === 1 ? "" : "s"}
                    {marcas.length ? ` · ${marcas.length} marca${marcas.length === 1 ? "" : "s"}` : ""}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-semibold tabular-nums text-ink">{formatEuros(r.valorProyectos)}</span>
                  <span className="block text-[11px] text-ink3">valor proyectos</span>
                </span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
