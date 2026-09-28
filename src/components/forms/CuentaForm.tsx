"use client";

import { useState } from "react";
import type { Cuenta, TipoCuenta } from "@/lib/types";
import { TIPOS_CUENTA, TIPO_CUENTA_LABEL } from "@/lib/trabajo";

export type CuentaFormValores = Pick<Cuenta, "nombre" | "tipo" | "email" | "telefono">;

export function CuentaForm({
  inicial,
  onSubmit,
  onCancelar,
  botonTexto = "Crear cuenta",
}: {
  inicial?: Partial<CuentaFormValores>;
  onSubmit: (v: CuentaFormValores) => Promise<void>;
  onCancelar?: () => void;
  botonTexto?: string;
}) {
  const [v, setV] = useState<CuentaFormValores>({ nombre: "", tipo: "intermediario", email: null, telefono: null, ...inicial });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) return setError("Ponle un nombre.");
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({ ...v, nombre: v.nombre.trim(), email: v.email?.trim() || null, telefono: v.telefono?.trim() || null });
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
        placeholder="Nombre (ej: Fer)"
        className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink3"
      />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink2">Tipo</span>
        <select value={v.tipo} onChange={(e) => setV({ ...v, tipo: e.target.value as TipoCuenta })} className="input">
          {TIPOS_CUENTA.map((t) => (
            <option key={t} value={t}>
              {TIPO_CUENTA_LABEL[t]}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-ink3">Intermediario: te pasa trabajo de otras marcas (como Fer). Cliente directo: el negocio te contrata a ti.</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink2">Email</span>
          <input type="email" value={v.email ?? ""} onChange={(e) => setV({ ...v, email: e.target.value })} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink2">Teléfono</span>
          <input inputMode="tel" value={v.telefono ?? ""} onChange={(e) => setV({ ...v, telefono: e.target.value })} className="input" />
        </label>
      </div>
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
