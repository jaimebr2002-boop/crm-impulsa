"use client";

import { useState } from "react";
import { CANALES, CANAL_LABEL, ESTADOS, ESTADO_LABEL, ORIGENES, ORIGEN_LABEL, SEGMENTOS, SEGMENTO_LABEL } from "@/lib/constants";
import type { FiltrosLeads } from "@/lib/data/leads";
import { IconFiltro } from "./Icons";
import { Modal } from "./Modal";

type Props = {
  filtros: FiltrosLeads;
  onChange: (filtros: FiltrosLeads) => void;
};

function contarFiltrosActivos(f: FiltrosLeads) {
  let n = 0;
  if (f.estado) n++;
  if (f.origen) n++;
  if (f.segmento) n++;
  if (f.canal) n++;
  return n;
}

export function LeadFilters({ filtros, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const activos = contarFiltrosActivos(filtros);

  function set(campo: keyof FiltrosLeads, valor: string) {
    onChange({ ...filtros, [campo]: valor || undefined });
  }

  function limpiar() {
    onChange({ busqueda: filtros.busqueda });
  }

  const campo = (clave: keyof FiltrosLeads, label: string, opciones: string[], etiquetas: Record<string, string>) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <select value={(filtros[clave] as string) ?? ""} onChange={(e) => set(clave, e.target.value)} className="input">
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {etiquetas[o]}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <button onClick={() => setAbierto(true)} className="btn-secondary" aria-label={`Filtros${activos ? ` (${activos} activos)` : ""}`}>
        <IconFiltro className="h-4 w-4" />
        <span className="hidden sm:inline">Filtros</span>
        {activos > 0 ? <span className="rounded bg-ink px-1.5 text-[11px] font-semibold text-canvas">{activos}</span> : null}
      </button>

      {abierto ? (
        <Modal titulo="Filtros" onClose={() => setAbierto(false)}>
          <div className="flex flex-col gap-3">
            {campo("estado", "Estado", ESTADOS, ESTADO_LABEL)}
            {campo("origen", "Origen", ORIGENES, ORIGEN_LABEL)}
            {campo("segmento", "Segmento", SEGMENTOS, SEGMENTO_LABEL)}
            {campo("canal", "Canal", CANALES, CANAL_LABEL)}
          </div>
          <div className="mt-5 flex justify-between gap-2">
            <button onClick={limpiar} className="btn-ghost" disabled={activos === 0}>
              Quitar filtros
            </button>
            <button onClick={() => setAbierto(false)} className="btn-primary px-4">
              Ver resultados
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
