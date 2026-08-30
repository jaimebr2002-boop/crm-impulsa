import { CANAL_LABEL } from "@/lib/constants";
import { formatFechaHora } from "@/lib/dates";
import type { InteraccionConUsuario } from "@/lib/data/interacciones";
import { EmptyState } from "./EmptyState";

export function InteractionTimeline({ interacciones }: { interacciones: InteraccionConUsuario[] }) {
  if (interacciones.length === 0) {
    return <EmptyState titulo="Sin historial todavía" descripcion="Las llamadas y notas aparecerán aquí." />;
  }

  return (
    <ul className="flex flex-col gap-3">
      {interacciones.map((i) => (
        <li key={i.id} className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-900">{i.usuario?.nombre ?? "Usuario desconocido"}</span>
            <span className="text-xs text-slate-400">{formatFechaHora(i.fecha)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {i.canal ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {CANAL_LABEL[i.canal] ?? i.canal}
              </span>
            ) : null}
            {i.resultado ? (
              <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand-dark">
                {i.resultado}
              </span>
            ) : null}
          </div>
          {i.nota ? <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{i.nota}</p> : null}
        </li>
      ))}
    </ul>
  );
}
