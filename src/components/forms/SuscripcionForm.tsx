"use client";

import { useState } from "react";
import type { SuscripcionInsert } from "@/lib/data/finanzas";
import { hoyYMD } from "@/lib/dates";
import { aCentimos, CATEGORIAS_GASTO, CATEGORIA_GASTO_LABEL, deCentimos, PERIODICIDADES, PERIODICIDAD_LABEL } from "@/lib/finanzas";
import type { CategoriaGasto, Periodicidad } from "@/lib/types";

/** Suscripción = plantilla de un gasto recurrente. No crea gastos por sí sola:
 * cada periodo se registra con "Registrar este periodo". */
export function SuscripcionForm({
  inicial,
  onSubmit,
  onCancelar,
  botonTexto = "Crear suscripción",
}: {
  inicial?: Partial<SuscripcionInsert>;
  onSubmit: (v: SuscripcionInsert) => Promise<void>;
  onCancelar?: () => void;
  botonTexto?: string;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [importe, setImporte] = useState(inicial?.importe != null ? String(inicial.importe) : "");
  const [periodicidad, setPeriodicidad] = useState<Periodicidad>(inicial?.periodicidad ?? "mensual");
  const [categoria, setCategoria] = useState<CategoriaGasto>(inicial?.categoria ?? "software");
  const [proxima, setProxima] = useState(inicial?.proxima_renovacion ?? hoyYMD());
  const [proveedor, setProveedor] = useState(inicial?.proveedor ?? "");
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Ponle nombre (ej: ChatGPT).");
    const c = aCentimos(importe);
    if (c <= 0) return setError("El importe debe ser mayor que 0.");
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({
        nombre: nombre.trim(),
        importe: deCentimos(c),
        periodicidad,
        categoria,
        proxima_renovacion: proxima,
        fecha_inicio: inicial?.fecha_inicio ?? proxima,
        proveedor: proveedor.trim() || null,
        notas: notas.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Herramienta (ej: ChatGPT)"
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-lg font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink3"
        />
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={importe}
          onChange={(e) => setImporte(e.target.value)}
          placeholder="0,00 €"
          aria-label="Importe"
          className="w-28 rounded-lg border border-line bg-surface px-2 py-1.5 text-right text-lg font-semibold tabular-nums text-ink"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="field-label">Cada</span>
          <select value={periodicidad} onChange={(e) => setPeriodicidad(e.target.value as Periodicidad)} className="input">
            {PERIODICIDADES.map((p) => (
              <option key={p} value={p}>
                {PERIODICIDAD_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Próxima renovación</span>
          <input type="date" value={proxima} onChange={(e) => setProxima(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="field-label">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)} className="input">
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_GASTO_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} placeholder="Proveedor (opcional)" className="input" />
        <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (opcional)" className="input" />
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="btn-ghost">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="btn-primary px-4">
          {enviando ? "Guardando…" : botonTexto}
        </button>
      </div>
    </form>
  );
}
