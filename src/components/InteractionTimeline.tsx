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
        <li key={i.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-ink">{i.usuario?.nombre ?? "Usuario desconocido"}</span>
            <span className="text-xs text-ink3">{formatFechaHora(i.fecha)}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {i.canal ? (
              <span className="rounded-full bg-mute px-2.5 py-1 text-[11px] font-medium text-ink2">
                {CANAL_LABEL[i.canal] ?? i.canal}
              </span>
            ) : null}
            {i.resultado ? (
              <span className="rounded-full bg-brand-light px-2.5 py-1 text-[11px] font-medium text-brand-dark">
                {i.resultado}
              </span>
            ) : null}
          </div>
          {i.nota ? <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{i.nota}</p> : null}
        </li>
      ))}
    </ul>
  );
}
