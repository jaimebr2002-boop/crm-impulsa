"use client";

import { useEffect, useState } from "react";
import { listarCuentas } from "@/lib/data/cuentas";
import type { Cuenta, Marca } from "@/lib/types";

export type MarcaFormValores = Pick<Marca, "nombre" | "cuenta_id" | "web">;

export function MarcaForm({
  inicial,
  onSubmit,
  onCancelar,
  botonTexto = "Crear marca",
}: {
  inicial?: Partial<MarcaFormValores>;
  onSubmit: (v: MarcaFormValores) => Promise<void>;
  onCancelar?: () => void;
  botonTexto?: string;
}) {
  const [v, setV] = useState<MarcaFormValores>({ nombre: "", cuenta_id: "", web: null, ...inicial });
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarCuentas()
      .then((c) => {
        setCuentas(c);
        setV((prev) => (prev.cuenta_id || c.length !== 1 ? prev : { ...prev, cuenta_id: c[0].id }));
      })
      .catch(() => {});
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) return setError("Ponle un nombre.");
    if (!v.cuenta_id) return setError("Elige a qué cuenta pertenece.");
    let web = v.web?.trim() || null;
    if (web && !/^https?:\/\//i.test(web)) web = `https://${web}`;
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({ ...v, nombre: v.nombre.trim(), web });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input
        autoFocus
        value={v.nombre}
        onChange={(e) => setV({ ...v, nombre: e.target.value })}
        placeholder="Nombre de la marca (ej: Segurma)"
        className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink3"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Cuenta</span>
          <select value={v.cuenta_id} onChange={(e) => setV({ ...v, cuenta_id: e.target.value })} className="input">
            <option value="">Elige…</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Web</span>
          <input value={v.web ?? ""} onChange={(e) => setV({ ...v, web: e.target.value })} placeholder="segurma.es" className="input" />
        </label>
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
