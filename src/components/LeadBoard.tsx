"use client";

import Link from "next/link";
import { useState } from "react";
import type { Lead, Usuario } from "@/lib/types";
import { ESTADOS, ESTADO_ACENTO, ESTADO_LABEL, formatEuros, sumarValor } from "@/lib/constants";
import { formatFechaRelativa } from "@/lib/dates";
import { Avatar } from "./Avatar";

const POR_COLUMNA = 30;

type Props = {
  leads: Lead[];
  usuariosPorId: Record<string, Usuario>;
  proximos: Record<string, string>;
  onMover: (leadId: string, nuevoEstado: string) => void;
};

/** Tablero Kanban del pipeline. En escritorio se arrastran las tarjetas entre
 * columnas; en móvil (sin drag & drop táctil fiable) cada tarjeta tiene un
 * selector "Mover a…" nativo. */
export function LeadBoard({ leads, usuariosPorId, proximos, onMover }: Props) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaDestino, setColumnaDestino] = useState<string | null>(null);
  const [visibles, setVisibles] = useState<Record<string, number>>({});

  const porEstado: Record<string, Lead[]> = {};
  for (const estado of ESTADOS) porEstado[estado] = [];
  for (const lead of leads) (porEstado[lead.estado] ??= []).push(lead);

  function soltar(estado: string) {
    const lead = leads.find((l) => l.id === arrastrando);
    if (lead && lead.estado !== estado) onMover(lead.id, estado);
    setArrastrando(null);
    setColumnaDestino(null);
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-6 md:mx-0 md:snap-none md:px-0">
      {ESTADOS.map((estado) => {
        const columna = porEstado[estado];
        const limite = visibles[estado] ?? POR_COLUMNA;
        const total = sumarValor(columna);
        const esDestino = columnaDestino === estado && arrastrando !== null;
        return (
          <section
            key={estado}
            onDragOver={(e) => {
              e.preventDefault();
              if (columnaDestino !== estado) setColumnaDestino(estado);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setColumnaDestino(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              soltar(estado);
            }}
            className={`flex w-[78vw] max-w-[280px] shrink-0 snap-start flex-col rounded-2xl border bg-mute/60 transition-colors md:w-64 ${
              esDestino ? "border-brand bg-brand-light/40" : "border-line"
            }`}
          >
            <header className="relative overflow-hidden rounded-t-2xl px-3 pb-2 pt-3">
              <span className={`absolute inset-x-0 top-0 h-1 ${ESTADO_ACENTO[estado] ?? "bg-line"}`} />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-ink">{ESTADO_LABEL[estado]}</h2>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-ink2">{columna.length}</span>
              </div>
              <p className="mt-0.5 text-xs text-ink3">{total > 0 ? formatEuros(total) : "Sin valor"}</p>
            </header>

            <div className="flex max-h-[65dvh] min-h-[120px] flex-col gap-2 overflow-y-auto px-2 pb-2">
              {columna.slice(0, limite).map((lead) => {
                const asignado = lead.asignado_a ? usuariosPorId[lead.asignado_a] : null;
                return (
                  <article
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", lead.id);
                      setArrastrando(lead.id);
                    }}
                    onDragEnd={() => {
                      setArrastrando(null);
                      setColumnaDestino(null);
                    }}
                    className={`rounded-xl border border-line bg-surface p-3 shadow-card md:cursor-grab ${
                      arrastrando === lead.id ? "opacity-40" : ""
                    }`}
                  >
                    <Link href={`/leads/${lead.id}`} className="block" draggable={false}>
                      <p className="truncate text-sm font-semibold text-ink">{lead.negocio || "Sin negocio"}</p>
                      <p className="truncate text-xs text-ink2">{lead.nombre_contacto || "Sin contacto"}</p>
                    </Link>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-1.5 text-ink3">
                        {asignado ? <Avatar nombre={asignado.nombre} size="sm" /> : null}
                        <span className="truncate">{asignado?.nombre ?? "Sin asignar"}</span>
                      </span>
                      {lead.valor != null ? <span className="shrink-0 font-semibold text-ink">{formatEuros(lead.valor)}</span> : null}
                    </div>
                    {proximos[lead.id] ? (
                      <p className="mt-1.5 truncate text-[11px] font-medium text-brand-dark dark:text-brand">
                        ⏰ {formatFechaRelativa(proximos[lead.id])}
                      </p>
                    ) : null}
                    <select
                      value={lead.estado}
                      onChange={(e) => onMover(lead.id, e.target.value)}
                      aria-label="Mover a otro estado"
                      className="mt-2 w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink2 md:hidden"
                    >
                      {ESTADOS.map((e) => (
                        <option key={e} value={e}>
                          {e === lead.estado ? `Mover a… (${ESTADO_LABEL[e]})` : ESTADO_LABEL[e]}
                        </option>
                      ))}
                    </select>
                  </article>
                );
              })}
              {columna.length > limite ? (
                <button
                  onClick={() => setVisibles((v) => ({ ...v, [estado]: limite + POR_COLUMNA }))}
                  className="rounded-xl py-2 text-xs font-semibold text-brand-dark"
                >
                  Ver {Math.min(POR_COLUMNA, columna.length - limite)} más
                </button>
              ) : null}
              {columna.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line py-6 text-center text-xs text-ink3">Vacío</p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
