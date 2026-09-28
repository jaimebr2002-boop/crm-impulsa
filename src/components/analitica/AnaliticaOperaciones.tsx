"use client";

import { useEffect, useState } from "react";
import { listarProyectos } from "@/lib/data/proyectos";
import { listarTareas } from "@/lib/data/tareas";
import { hoyYMD } from "@/lib/dates";
import { formatEuros } from "@/lib/constants";
import { resumirProyectos } from "@/lib/metricas";
import { ESTADOS_PROYECTO_ACTIVOS, TIPO_PROYECTO_LABEL } from "@/lib/trabajo";
import type { ProyectoConRelaciones, TareaConRelaciones, TipoProyecto } from "@/lib/types";
import { FilaKpis } from "../trabajo/FilaKpis";
import { Panel } from "../ui/Panel";
import { BarrasImporte } from "../finanzas/SelectorPeriodo";
import { SkeletonTarjetas } from "../ui/Skeleton";

/** Operaciones (solo admin): proyectos y tareas en el periodo de Analítica. */
export function AnaliticaOperaciones({ desde, hasta }: { desde: Date; hasta: Date }) {
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[] | null>(null);
  const [tareas, setTareas] = useState<TareaConRelaciones[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let vivo = true;
    const dias = Math.ceil((Date.now() - desde.getTime()) / 86_400_000) + 1;
    Promise.all([listarProyectos(), listarTareas({ diasCompletadas: dias })])
      .then(([p, t]) => {
        if (!vivo) return;
        setProyectos(p);
        setTareas(t);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [desde]);

  if (error) return <p className="text-sm text-ink3">No se han podido cargar los datos de operaciones.</p>;
  if (!proyectos) return <SkeletonTarjetas n={4} />;

  const enRango = (iso: string | null) => !!iso && new Date(iso) >= desde && new Date(iso) <= hasta;
  const activos = proyectos.filter((p) => ESTADOS_PROYECTO_ACTIVOS.has(p.estado));
  const entregados = proyectos.filter((p) => p.estado === "entregado" && enRango(p.entregado_en));
  const aTiempo = entregados.filter((p) => !p.fecha_entrega || (p.entregado_en ?? "").slice(0, 10) <= p.fecha_entrega).length;
  const completadas = tareas.filter((t) => t.estado === "completada" && enRango(t.completada_en));
  const vencidas = tareas.filter((t) => t.estado !== "completada" && t.fecha_limite && t.fecha_limite < hoyYMD());
  const resumen = resumirProyectos(proyectos);

  const porTipo = Object.entries(
    entregados.reduce<Record<string, number>>((m, p) => ({ ...m, [p.tipo]: (m[p.tipo] ?? 0) + 1 }), {})
  )
    .sort((a, b) => b[1] - a[1])
    .map(([t, n]) => ({ clave: t, etiqueta: TIPO_PROYECTO_LABEL[t as TipoProyecto] ?? t, importe: n }));

  return (
    <div className="flex flex-col gap-4">
      <FilaKpis
        columnas="md:grid-cols-4"
        kpis={[
          { etiqueta: "Proyectos activos", valor: activos.length, nota: `${formatEuros(resumen.valorEnCurso)} en curso · hoy`, href: "/proyectos" },
          { etiqueta: "Entregados", valor: entregados.length, nota: entregados.length ? `${aTiempo} a tiempo` : "En el periodo" },
          { etiqueta: "Tareas completadas", valor: completadas.length, nota: "En el periodo", href: "/tareas" },
          { etiqueta: "Tareas vencidas", valor: vencidas.length, nota: "Hoy", alerta: vencidas.length > 0, href: "/tareas?vista=vencidas" },
        ]}
      />
      {porTipo.length ? (
        <Panel titulo="Entregados por tipo de proyecto">
          <BarrasImporte filas={porTipo} formato={(n) => String(n)} />
        </Panel>
      ) : null}
    </div>
  );
}
