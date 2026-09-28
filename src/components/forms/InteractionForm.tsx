"use client";

import { useState } from "react";
import { CANALES, CANAL_LABEL, RESULTADOS_LLAMADA } from "@/lib/constants";
import { datetimeLocalToIso } from "@/lib/dates";
import type { Usuario } from "@/lib/types";

type ValorInteraccion = {
  canal: string;
  resultado: string | null;
  nota: string | null;
};

type ValorSeguimiento = { titulo: string; fecha_hora: string; usuario_id: string } | null;

export function InteractionForm({
  variante,
  usuarios,
  usuarioResponsablePorDefecto,
  onSubmit,
  onCancelar,
}: {
  variante: "llamada" | "nota";
  usuarios: Usuario[];
  usuarioResponsablePorDefecto?: string | null;
  onSubmit: (interaccion: ValorInteraccion, seguimiento: ValorSeguimiento) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [canal, setCanal] = useState(variante === "llamada" ? "llamada" : "nota");
  const [resultado, setResultado] = useState(variante === "llamada" ? RESULTADOS_LLAMADA[0] : "");
  const [nota, setNota] = useState("");
  const [crearSeguimiento, setCrearSeguimiento] = useState(false);
  const [tituloSeguimiento, setTituloSeguimiento] = useState("Seguimiento");
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

    if (crearSeguimiento && (!tituloSeguimiento.trim() || !fechaSeguimiento)) {
      setError("Completa el título y la fecha del seguimiento, o desactívalo.");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      await onSubmit(
        { canal, resultado: variante === "llamada" ? resultado : null, nota: nota.trim() || null },
        crearSeguimiento
          ? {
              titulo: tituloSeguimiento.trim(),
              fecha_hora: datetimeLocalToIso(fechaSeguimiento),
              usuario_id: usuarioResponsablePorDefecto ?? "",
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {variante === "llamada" ? (
        <>
          <label className="block">
            <span className="field-label">Canal</span>
            <select value={canal} onChange={(e) => setCanal(e.target.value)} className="input">
              {CANALES.map((c) => (
                <option key={c} value={c}>
                  {CANAL_LABEL[c]}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="mb-2 block text-xs font-medium text-ink2">Resultado</span>
            <div className="flex flex-wrap gap-2">
              {RESULTADOS_LLAMADA.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setResultado(r)}
                  aria-pressed={resultado === r}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    resultado === r ? "border-ink bg-ink text-canvas" : "border-line text-ink2 hover:bg-mute"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <label className="block">
        <span className="field-label">
          Nota {variante === "llamada" ? "(opcional)" : ""}
        </span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          className="input"
          placeholder={variante === "llamada" ? "¿Algo que recordar de la llamada?" : "Escribe la nota…"}
          autoFocus={variante === "nota"}
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" checked={crearSeguimiento} onChange={(e) => setCrearSeguimiento(e.target.checked)} className="h-4 w-4" />
        Crear próximo seguimiento
      </label>

      {crearSeguimiento ? (
        <div className="flex flex-col gap-3 rounded-lg border border-line p-3">
          <label className="block">
            <span className="field-label">Título</span>
            <input value={tituloSeguimiento} onChange={(e) => setTituloSeguimiento(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="field-label">Fecha y hora</span>
            <input
              type="datetime-local"
              value={fechaSeguimiento}
              onChange={(e) => setFechaSeguimiento(e.target.value)}
              className="input"
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="btn-ghost">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="btn-primary px-4">
          {enviando ? "Guardando…" : variante === "llamada" ? "Registrar llamada" : "Guardar nota"}
        </button>
      </div>
    </form>
  );
}
