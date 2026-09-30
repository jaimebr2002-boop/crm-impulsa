"use client";

import { useEffect, useRef, useState } from "react";
import { listarLeadsPagina } from "@/lib/data/leads";
import { datetimeLocalToIso } from "@/lib/dates";
import type { Lead } from "@/lib/types";

export function QuickEventForm({
  onSubmit,
  onCancelar,
}: {
  onSubmit: (valores: { lead_id: string; titulo: string; fecha_hora: string }) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Lead[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [leadSeleccionado, setLeadSeleccionado] = useState<Lead | null>(null);
  const [titulo, setTitulo] = useState("");
  const [fechaHoraLocal, setFechaHoraLocal] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (leadSeleccionado || !busqueda.trim()) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      listarLeadsPagina({ busqueda }, 0, 6)
        .then(({ leads }) => setResultados(leads))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [busqueda, leadSeleccionado]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!leadSeleccionado || !titulo.trim() || !fechaHoraLocal) {
      setError("Elige un lead, un título y una fecha/hora.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({
        lead_id: leadSeleccionado.id,
        titulo: titulo.trim(),
        fecha_hora: datetimeLocalToIso(fechaHoraLocal),
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
        <span className="field-label">Lead</span>
        {leadSeleccionado ? (
          <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-3 py-2">
            <span className="text-base font-medium text-ink">
              {leadSeleccionado.negocio || leadSeleccionado.nombre_contacto}
            </span>
            <button
              type="button"
              onClick={() => {
                setLeadSeleccionado(null);
                setBusqueda("");
              }}
              className="text-sm font-medium text-brand-dark"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="input"
              placeholder="Negocio o contacto…"
              autoFocus
            />
            {busqueda.trim() ? (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
                {buscando ? (
                  <p className="px-3 py-2.5 text-sm text-ink3">Buscando…</p>
                ) : resultados.length === 0 ? (
                  <p className="px-3 py-2.5 text-sm text-ink3">Sin resultados.</p>
                ) : (
                  resultados.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => setLeadSeleccionado(lead)}
                      className="block w-full px-3 py-2.5 text-left text-sm hover:bg-mute"
                    >
                      <span className="font-medium text-ink">{lead.negocio || "Sin negocio"}</span>
                      {lead.nombre_contacto ? <span className="text-ink2"> · {lead.nombre_contacto}</span> : null}
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        )}
      </label>

      <label className="block">
        <span className="field-label">Título</span>
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          className="input"
          placeholder="Ej: Llamar de seguimiento"
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

      {error ? <p className="field-error">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button
            type="button"
            onClick={onCancelar}
            className="btn-ghost"
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="submit"
          disabled={enviando}
          className="btn-primary px-4"
        >
          {enviando ? "Guardando…" : "Crear seguimiento"}
        </button>
      </div>
    </form>
  );
}
