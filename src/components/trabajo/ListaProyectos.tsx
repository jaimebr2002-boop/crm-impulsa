import Link from "next/link";
import { formatEuros } from "@/lib/constants";
import { motivoAtencion, TONO_ATENCION } from "@/lib/metricas";
import { TIPO_PROYECTO_LABEL } from "@/lib/trabajo";
import type { ProyectoConRelaciones } from "@/lib/types";
import { EstadoProyectoInsignia, FechaLimite, PrioridadIcono } from "./Insignias";

/** Lista densa de proyectos con los subproyectos agrupados bajo su padre.
 * `contexto` evita repetir información ya visible (p. ej. la cuenta en la
 * ficha de esa misma cuenta). */
export function ListaProyectos({
  proyectos,
  contexto = "global",
  vacio = "Sin proyectos.",
}: {
  proyectos: ProyectoConRelaciones[];
  contexto?: "global" | "cuenta" | "marca" | "padre";
  vacio?: string;
}) {
  if (proyectos.length === 0) {
    return <p className="rounded-xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-ink3">{vacio}</p>;
  }

  const ids = new Set(proyectos.map((p) => p.id));
  // Los hijos cuyo padre también está en la lista se pintan debajo de él.
  const raices = proyectos.filter((p) => !p.proyecto_padre_id || !ids.has(p.proyecto_padre_id));
  const hijosDe = (id: string) => proyectos.filter((p) => p.proyecto_padre_id === id);

  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {raices.map((p) => (
        <div key={p.id}>
          <Fila p={p} contexto={contexto} />
          {hijosDe(p.id).map((h) => (
            <Fila key={h.id} p={h} contexto={contexto} hijo />
          ))}
        </div>
      ))}
    </div>
  );
}

function Fila({ p, contexto, hijo = false }: { p: ProyectoConRelaciones; contexto: string; hijo?: boolean }) {
  const motivo = motivoAtencion(p);
  const origen =
    contexto === "global"
      ? [p.cuenta?.nombre, p.marca?.nombre].filter(Boolean).join(" · ")
      : contexto === "cuenta"
        ? p.marca?.nombre ?? ""
        : "";
  const padre = !hijo && p.padre && contexto !== "padre" ? `↳ ${p.padre.nombre}` : "";
  const sub = [origen, padre, TIPO_PROYECTO_LABEL[p.tipo]].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/proyectos/${p.id}`}
      className={`flex items-center gap-3 py-2.5 pr-4 hover:bg-mute/50 ${hijo ? "border-t border-dashed border-line pl-10" : "pl-4"}`}
    >
      <span className="w-4 shrink-0">
        <PrioridadIcono prioridad={p.prioridad} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">{p.nombre}</span>
        {sub ? <span className="block truncate text-xs text-ink3">{sub}</span> : null}
      </span>
      {motivo ? (
        <span className={`chip hidden shrink-0 sm:inline-flex ${TONO_ATENCION[motivo.tono]}`}>{motivo.etiqueta}</span>
      ) : null}
      <span className="hidden w-28 shrink-0 md:block">
        <EstadoProyectoInsignia estado={p.estado} />
      </span>
      <span className="w-20 shrink-0 text-right">
        <FechaLimite fecha={p.fecha_entrega} completada={p.estado === "entregado" || p.estado === "cancelado"} />
      </span>
      <span className="hidden w-20 shrink-0 text-right text-sm font-medium tabular-nums text-ink sm:block">
        {p.importe != null ? formatEuros(p.importe) : ""}
      </span>
    </Link>
  );
}
