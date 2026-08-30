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
            <span className="mb-1 block text-xs font-medium text-ink2">Canal</span>
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
                  className={`rounded-full border px-3 py-2 text-sm font-medium ${
                    resultado === r
                      ? "border-brand bg-brand-light text-brand-dark"
                      : "border-line text-ink2"
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
        <span className="mb-1 block text-xs font-medium text-ink2">
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
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink2">Título</span>
            <input value={tituloSeguimiento} onChange={(e) => setTituloSeguimiento(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink2">Fecha y hora</span>
            <input
              type="datetime-local"
              value={fechaSeguimiento}
              onChange={(e) => setFechaSeguimiento(e.target.value)}
              className="input"
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="mt-1 flex gap-3">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-line py-3.5 text-base font-medium text-ink2">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="flex-1 rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
          {enviando ? "Guardando…" : variante === "llamada" ? "Registrar llamada" : "Guardar nota"}
        </button>
      </div>
    </form>
  );
}
