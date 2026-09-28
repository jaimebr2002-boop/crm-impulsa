import { CANAL_LABEL } from "@/lib/constants";
import { formatHaceCuanto } from "@/lib/dates";
import type { InteraccionConUsuario } from "@/lib/data/interacciones";
import { EmptyState } from "./EmptyState";

/** Historial de un lead con el mismo lenguaje que Actividad: punto, frase, hora. */
export function InteractionTimeline({ interacciones }: { interacciones: InteraccionConUsuario[] }) {
  if (interacciones.length === 0) {
    return <EmptyState compacto titulo="Sin historial todavía" descripcion="Las llamadas y notas aparecerán aquí." />;
  }
  return (
    <ul className="flex flex-col">
      {interacciones.map((i) => {
        const canal = i.canal ? CANAL_LABEL[i.canal] ?? i.canal : null;
        const accion = canal ? (i.canal === "llamada" ? "llamó" : `contactó por ${canal.toLowerCase()}`) : "añadió una nota";
        return (
          <li key={i.id} className="flex gap-3 py-2.5">
            <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${i.resultado ? "bg-blue-500" : "bg-ink3"}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink2">
                <span className="font-medium text-ink">{i.usuario?.nombre ?? "Alguien"}</span> {accion}
                {i.resultado ? (
                  <>
                    {" "}
                    · <span className="text-ink">{i.resultado}</span>
                  </>
                ) : null}
              </p>
              {i.nota ? <p className="mt-1 whitespace-pre-wrap rounded-lg bg-mute/60 px-3 py-2 text-sm text-ink">{i.nota}</p> : null}
            </div>
            <span className="shrink-0 pt-0.5 text-xs text-ink3" title={new Date(i.fecha).toLocaleString("es-ES")}>
              {formatHaceCuanto(i.fecha)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
