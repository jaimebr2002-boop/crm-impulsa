"use client";

import Link from "next/link";
import { useState } from "react";
import type { Evento, EventoConLead } from "@/lib/types";
import { formatFechaRelativa } from "@/lib/dates";
import { IconCheck } from "./Icons";

export function EventCard({
  evento,
  mostrarLead = false,
  onToggleCompletada,
}: {
  evento: Evento | EventoConLead;
  mostrarLead?: boolean;
  onToggleCompletada?: (id: string, completada: boolean) => Promise<void>;
}) {
  const [guardando, setGuardando] = useState(false);
  const conLead = "lead" in evento ? (evento as EventoConLead) : null;
  const vencido = !evento.completada && new Date(evento.fecha_hora) < new Date();

  async function toggle() {
    if (!onToggleCompletada || guardando) return;
    setGuardando(true);
    try {
      await onToggleCompletada(evento.id, !evento.completada);
    } finally {
      setGuardando(false);
    }
  }

  const contenido = (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        evento.completada
          ? "border-line bg-canvas"
          : vencido
          ? "border-red-200 bg-red-50"
          : "border-line bg-surface"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle();
        }}
        disabled={guardando}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
          evento.completada ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-transparent"
        }`}
      >
        <IconCheck className="h-3.5 w-3.5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${evento.completada ? "text-ink3 line-through" : "text-ink"}`}>
          {evento.titulo}
        </p>
        <p className={`mt-0.5 text-xs ${vencido && !evento.completada ? "font-semibold text-red-600" : "text-ink2"}`}>
          {formatFechaRelativa(evento.fecha_hora)}
          {vencido && !evento.completada ? " · Vencido" : ""}
        </p>
        {mostrarLead && conLead?.lead ? (
          <p className="mt-1 truncate text-xs text-ink2">
            {conLead.lead.negocio || conLead.lead.nombre_contacto || "Lead"}
          </p>
        ) : null}
        {conLead?.usuario ? <p className="mt-0.5 text-xs text-ink3">Responsable: {conLead.usuario.nombre}</p> : null}
      </div>
    </div>
  );

  if (mostrarLead && conLead?.lead?.id) {
    return <Link href={`/leads/${conLead.lead.id}`}>{contenido}</Link>;
  }
  return contenido;
}
