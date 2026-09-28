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
        <span className="field-label">Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="input"
          placeholder="Ej: Llamar de seguimiento"
          autoFocus
        />
      </label>

      <label className="block">
        <span className="field-label">Fecha y hora</span>
        <input
          type="datetime-local"
          value={fechaHoraLocal}
          onChange={(e) => setFechaHoraLocal(e.target.value)}
          className="input"
        />
      </label>

      <label className="block">
        <span className="field-label">Responsable</span>
        <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)} className="input">
          <option value="">Sin asignar</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="btn-ghost">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="btn-primary px-4">
          {enviando ? "Guardando…" : "Crear seguimiento"}
        </button>
      </div>
    </form>
  );
}
