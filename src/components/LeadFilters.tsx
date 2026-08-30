"use client";

import { useState } from "react";
import { CANALES, CANAL_LABEL, ESTADOS, ESTADO_LABEL, ORIGENES, ORIGEN_LABEL, SEGMENTOS, SEGMENTO_LABEL } from "@/lib/constants";
import type { FiltrosLeads } from "@/lib/data/leads";
import { IconFiltro } from "./Icons";

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

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="relative flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-medium text-ink"
      >
        <IconFiltro className="h-4 w-4" />
        Filtros
        {activos > 0 ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-white">
            {activos}
          </span>
        ) : null}
      </button>

      {abierto ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 md:items-center" onClick={() => setAbierto(false)}>
          <div
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-5 md:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Filtros</h2>
              <button onClick={limpiar} className="text-sm font-medium text-brand-dark">
                Limpiar
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink2">Estado</span>
                <select
                  value={filtros.estado ?? ""}
                  onChange={(e) => set("estado", e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base"
                >
                  <option value="">Todos</option>
                  {ESTADOS.map((e) => (
                    <option key={e} value={e}>
                      {ESTADO_LABEL[e]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink2">Origen</span>
                <select
                  value={filtros.origen ?? ""}
                  onChange={(e) => set("origen", e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base"
                >
                  <option value="">Todos</option>
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEN_LABEL[o]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink2">Segmento</span>
                <select
                  value={filtros.segmento ?? ""}
                  onChange={(e) => set("segmento", e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base"
                >
                  <option value="">Todos</option>
                  {SEGMENTOS.map((s) => (
                    <option key={s} value={s}>
                      {SEGMENTO_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink2">Canal</span>
                <select
                  value={filtros.canal ?? ""}
                  onChange={(e) => set("canal", e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base"
                >
                  <option value="">Todos</option>
                  {CANALES.map((c) => (
                    <option key={c} value={c}>
                      {CANAL_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button
              onClick={() => setAbierto(false)}
              className="mt-6 w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white"
            >
              Ver resultados
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
