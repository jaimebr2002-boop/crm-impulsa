"use client";

export type Pestana<T extends string> = { id: T; label: string; n?: number };

/** Pestañas subrayadas; en móvil se desplazan en horizontal. */
export function Pestanas<T extends string>({
  pestanas,
  activa,
  onChange,
}: {
  pestanas: Pestana<T>[];
  activa: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0" role="tablist">
      {pestanas.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={activa === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            activa === t.id ? "border-brand text-ink" : "border-transparent text-ink3 hover:text-ink"
          }`}
        >
          {t.label}
          {t.n ? <span className="ml-1.5 text-xs text-ink3">{t.n}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Pestaña inicial desde ?tab= y sincronización de la URL sin recargar. */
export function tabDesdeUrl<T extends string>(valor: string | null, validas: readonly T[], porDefecto: T): T {
  return valor && (validas as readonly string[]).includes(valor) ? (valor as T) : porDefecto;
}

export function reflejarTabEnUrl(ruta: string, tab: string, porDefecto: string) {
  window.history.replaceState(null, "", tab === porDefecto ? ruta : `${ruta}?tab=${tab}`);
}
