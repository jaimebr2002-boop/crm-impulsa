"use client";

import { useEffect, useState } from "react";
import { listarProyectos } from "@/lib/data/proyectos";
import type { GastoInsert } from "@/lib/data/finanzas";
import { hoyYMD } from "@/lib/dates";
import { aCentimos, CATEGORIAS_GASTO, CATEGORIA_GASTO_LABEL, deCentimos } from "@/lib/finanzas";
import type { CategoriaGasto, ProyectoConRelaciones } from "@/lib/types";

/** Gasto puntual: concepto, importe, fecha y categoría. El resto, opcional. */
export function GastoForm({
  inicial,
  onSubmit,
  onCancelar,
  botonTexto = "Registrar gasto",
}: {
  inicial?: Partial<GastoInsert>;
  onSubmit: (v: GastoInsert) => Promise<void>;
  onCancelar?: () => void;
  botonTexto?: string;
}) {
  const [concepto, setConcepto] = useState(inicial?.concepto ?? "");
  const [importe, setImporte] = useState(inicial?.importe != null ? String(inicial.importe) : "");
  const [fecha, setFecha] = useState(inicial?.fecha ?? hoyYMD());
  const [categoria, setCategoria] = useState<CategoriaGasto>(inicial?.categoria ?? "software");
  const [proveedor, setProveedor] = useState(inicial?.proveedor ?? "");
  const [proyectoId, setProyectoId] = useState(inicial?.proyecto_id ?? "");
  const [deducible, setDeducible] = useState(inicial?.deducible ?? true);
  const [notas, setNotas] = useState(inicial?.notas ?? "");
  const [mas, setMas] = useState(!!(inicial?.proyecto_id || inicial?.proveedor || inicial?.notas));
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mas) return;
    listarProyectos().then(setProyectos).catch(() => {});
  }, [mas]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!concepto.trim()) return setError("¿En qué has gastado?");
    const c = aCentimos(importe);
    if (c <= 0) return setError("El importe debe ser mayor que 0.");
    setEnviando(true);
    setError(null);
    const proyecto = proyectos.find((p) => p.id === proyectoId);
    try {
      await onSubmit({
        concepto: concepto.trim(),
        importe: deCentimos(c),
        fecha,
        categoria,
        proveedor: proveedor.trim() || null,
        proyecto_id: proyectoId || null,
        // El gasto de un proyecto también cuenta para su cuenta.
        cuenta_id: proyecto?.cuenta_id ?? inicial?.cuenta_id ?? null,
        deducible,
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
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Concepto (ej: Claude Pro)"
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
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink2">Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink2">Categoría</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaGasto)} className="input">
            {CATEGORIAS_GASTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_GASTO_LABEL[c]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {mas ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink2">Proveedor</span>
              <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="input" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink2">Proyecto</span>
              <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className="input">
                <option value="">Ninguno</option>
                {proyectos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink2">
            <input type="checkbox" checked={deducible} onChange={(e) => setDeducible(e.target.checked)} />
            Deducible (solo informativo)
          </label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas" className="input resize-y" />
        </>
      ) : (
        <button type="button" onClick={() => setMas(true)} className="self-start text-sm font-medium text-ink2 hover:text-ink">
          + Proveedor, proyecto, notas
        </button>
      )}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
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
