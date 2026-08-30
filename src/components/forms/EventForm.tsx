"use client";

import { useState } from "react";
import type { Usuario } from "@/lib/types";
import { datetimeLocalToIso } from "@/lib/dates";

export function EventForm({
  usuarios,
  usuarioResponsablePorDefecto,
  onSubmit,
  onCancelar,
}: {
  usuarios: Usuario[];
  usuarioResponsablePorDefecto?: string | null;
  onSubmit: (valores: { titulo: string; fecha_hora: string; usuario_id: string }) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [fechaHoraLocal, setFechaHoraLocal] = useState("");
  const [usuarioId, setUsuarioId] = useState(usuarioResponsablePorDefecto ?? "");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!titulo.trim() || !fechaHoraLocal) {
      setError("Indica al menos el título y la fecha/hora.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({
        titulo: titulo.trim(),
        fecha_hora: datetimeLocalToIso(fechaHoraLocal),
        usuario_id: usuarioId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido crear el seguimiento.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="input"
          placeholder="Ej: Llamar de seguimiento"
          autoFocus
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Fecha y hora</span>
        <input
          type="datetime-local"
          value={fechaHoraLocal}
          onChange={(e) => setFechaHoraLocal(e.target.value)}
          className="input"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Responsable</span>
        <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="input">
          <option value="">Sin asignar</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="mt-1 flex gap-3">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-slate-200 py-3.5 text-base font-medium text-slate-600">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="flex-1 rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
          {enviando ? "Guardando…" : "Crear seguimiento"}
        </button>
      </div>
    </form>
  );
}
