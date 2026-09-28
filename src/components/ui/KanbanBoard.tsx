"use client";

import { useState, type ReactNode } from "react";

export type ColumnaKanban = {
  id: string;
  titulo: string;
  /** Clase de fondo del punto de color de la columna. */
  acento: string;
};

type Props<T> = {
  columnas: ColumnaKanban[];
  items: T[];
  clave: (item: T) => string;
  columnaDe: (item: T) => string;
  renderTarjeta: (item: T) => ReactNode;
  onMover: (item: T, columnaId: string) => void;
  resumenColumna?: (items: T[]) => string | null;
  porColumna?: number;
};

/** Tablero Kanban genérico. En escritorio las tarjetas se arrastran entre
 * columnas (HTML5 drag & drop); en móvil, donde el arrastre táctil no es
 * fiable, cada tarjeta lleva un selector "Mover a…". */
export function KanbanBoard<T>({
  columnas,
  items,
  clave,
  columnaDe,
  renderTarjeta,
  onMover,
  resumenColumna,
  porColumna = 30,
}: Props<T>) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const [visibles, setVisibles] = useState<Record<string, number>>({});

  // Un elemento cuya columna no existe (p. ej. un estado antiguo importado) no
  // desaparece: va a "Otros" y desde ahí se puede arrastrar a su sitio.
  const OTROS = "__otros__";
  const porId: Record<string, T[]> = {};
  for (const c of columnas) porId[c.id] = [];
  const otros: T[] = [];
  for (const it of items) (porId[columnaDe(it)] ?? otros).push(it);
  if (otros.length) porId[OTROS] = otros;
  const columnasVisibles = otros.length ? [...columnas, { id: OTROS, titulo: "Otros estados", acento: "bg-line" }] : columnas;

  function soltar(columnaId: string) {
    const item = items.find((i) => clave(i) === arrastrando);
    if (item && columnaId !== OTROS && columnaDe(item) !== columnaId) onMover(item, columnaId);
    setArrastrando(null);
    setDestino(null);
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:mx-0 md:snap-none md:px-0">
      {columnasVisibles.map((col) => {
        const lista = porId[col.id];
        const limite = visibles[col.id] ?? porColumna;
        const resumen = resumenColumna?.(lista);
        const esDestino = destino === col.id && arrastrando !== null;
        return (
          <section
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (destino !== col.id) setDestino(col.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDestino(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              soltar(col.id);
            }}
            className={`flex w-[80vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border transition-colors md:w-auto md:min-w-[210px] md:flex-1 ${
              esDestino ? "border-brand bg-brand-light/40" : "border-transparent bg-mute/50"
            }`}
          >
            <header className="flex items-center gap-2 px-3 pb-2 pt-3">
              <span className={`h-2 w-2 rounded-full ${col.acento}`} />
              <h2 className="text-[13px] font-semibold text-ink">{col.titulo}</h2>
              <span className="text-xs text-ink3">{lista.length}</span>
              {resumen ? <span className="ml-auto text-xs font-medium text-ink2">{resumen}</span> : null}
            </header>

            <div className="flex max-h-[calc(100dvh-16rem)] min-h-[140px] flex-col gap-2 overflow-y-auto px-2 pb-2">
              {lista.slice(0, limite).map((item) => {
                const id = clave(item);
                return (
                  <div
                    key={id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", id);
                      setArrastrando(id);
                    }}
                    onDragEnd={() => {
                      setArrastrando(null);
                      setDestino(null);
                    }}
                    className={`rounded-lg border border-line bg-surface p-3 shadow-card transition-shadow hover:shadow-md md:cursor-grab ${
                      arrastrando === id ? "opacity-40" : ""
                    }`}
                  >
                    {renderTarjeta(item)}
                    <select
                      value={columnaDe(item)}
                      onChange={(e) => onMover(item, e.target.value)}
                      aria-label="Mover a otra columna"
                      className="mt-2 w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-xs text-ink2 md:hidden"
                    >
                      {col.id === OTROS ? <option value={columnaDe(item)}>Mover a… ({columnaDe(item)})</option> : null}
                      {columnas.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id === columnaDe(item) ? `Mover a… (${c.titulo})` : c.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {lista.length > limite ? (
                <button
                  onClick={() => setVisibles((v) => ({ ...v, [col.id]: limite + porColumna }))}
                  className="rounded-lg py-2 text-xs font-medium text-ink2 hover:bg-mute"
                >
                  Ver {Math.min(porColumna, lista.length - limite)} más
                </button>
              ) : null}
              {lista.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line py-6 text-center text-xs text-ink3">
                  {arrastrando ? "Suelta aquí" : "Vacío"}
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
