import Link from "next/link";
import { motivoAtencion, TONO_ATENCION } from "@/lib/metricas";
import type { ProyectoConRelaciones } from "@/lib/types";
import { PrioridadIcono } from "./Insignias";

/** Proyectos activos que piden acción: vencidos, entrega inminente, esperando, en revisión. */
export function proyectosQueRequierenAtencion(proyectos: ProyectoConRelaciones[]) {
  return proyectos
    .map((p) => ({ p, motivo: motivoAtencion(p) }))
    .filter((x): x is { p: ProyectoConRelaciones; motivo: NonNullable<ReturnType<typeof motivoAtencion>> } => x.motivo !== null)
    .sort((a, b) => a.motivo.orden - b.motivo.orden || (a.p.fecha_entrega ?? "9999").localeCompare(b.p.fecha_entrega ?? "9999"));
}

export function ProyectosAtencion({
  proyectos,
  mostrarOrigen = true,
  limite = 8,
  vacio = "Ningún proyecto requiere atención.",
}: {
  proyectos: ProyectoConRelaciones[];
  mostrarOrigen?: boolean;
  limite?: number;
  vacio?: string;
}) {
  const lista = proyectosQueRequierenAtencion(proyectos);
  if (lista.length === 0) return <p className="px-4 py-8 text-center text-sm text-ink3">{vacio}</p>;
  return (
    <div className="divide-y divide-line">
      {lista.slice(0, limite).map(({ p, motivo }) => (
        <Link key={p.id} href={`/proyectos/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-mute/50">
          <span className="w-4 shrink-0">
            <PrioridadIcono prioridad={p.prioridad} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{p.nombre}</span>
            {mostrarOrigen ? (
              <span className="block truncate text-xs text-ink3">
                {[p.cuenta?.nombre, p.marca?.nombre].filter(Boolean).join(" · ") || "Sin cuenta"}
              </span>
            ) : null}
          </span>
          <span className={`chip shrink-0 ${TONO_ATENCION[motivo.tono]}`}>{motivo.etiqueta}</span>
        </Link>
      ))}
      {lista.length > limite ? <p className="px-4 py-2 text-xs text-ink3">y {lista.length - limite} más</p> : null}
    </div>
  );
}
