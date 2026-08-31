import { formatFechaRelativa } from "@/lib/dates";

export type ActividadItem = {
  id: string;
  texto: string;
  quien: string;
  cuandoIso: string;
  colorDot: string;
  colorTexto: string;
  etiqueta: string;
};

export function ActivityFeed({ items }: { items: ActividadItem[] }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-sm text-ink3">Sin actividad en este periodo.</p>;
  }

  return (
    <div className="flex flex-col">
      {items.map((a) => (
        <div key={a.id} className="flex items-start gap-3 border-b border-line py-3 last:border-0">
          <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.colorDot}`} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{a.texto}</p>
            <p className="mt-0.5 text-xs text-ink3">
              {a.quien} · {formatFechaRelativa(a.cuandoIso)}
            </p>
          </div>
          <span className={`shrink-0 rounded-lg bg-mute px-2 py-1 text-[10px] font-bold ${a.colorTexto}`}>{a.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}
