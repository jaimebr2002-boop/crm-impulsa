"use client";

import Link from "next/link";
import { useState } from "react";
import type { Evento, EventoConLead } from "@/lib/types";
import { formatFechaRelativa } from "@/lib/dates";
import { IconCheck } from "./Icons";

/**
 * Fila de seguimiento (mismo patrón que TareaFila): casilla redonda, título,
 * cuándo (rojo si vencido), lead y responsable. Sin tarjetas grandes.
 */
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

  const leadNombre = conLead?.lead ? conLead.lead.negocio || conLead.lead.nombre_contacto || "Lead" : null;
  const texto = (
    <span className="min-w-0 flex-1">
      <span className={`block truncate text-sm ${evento.completada ? "text-ink3 line-through" : "font-medium text-ink"}`}>{evento.titulo}</span>
      <span className="block truncate text-xs text-ink3">
        {[mostrarLead ? leadNombre : null, conLead?.usuario?.nombre].filter(Boolean).join(" · ")}
      </span>
    </span>
  );

  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 hover:bg-mute/40">
      <button
        type="button"
        onClick={toggle}
        disabled={guardando || !onToggleCompletada}
        aria-label={evento.completada ? `Marcar «${evento.titulo}» como pendiente` : `Completar «${evento.titulo}»`}
        aria-pressed={evento.completada}
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
          evento.completada ? "border-emerald-500 bg-emerald-500 text-white" : "border-ink3 text-transparent hover:border-ink hover:text-ink3"
        }`}
      >
        <IconCheck className="h-3 w-3" />
      </button>
      {mostrarLead && conLead?.lead?.id ? (
        <Link href={`/leads/${conLead.lead.id}`} className="flex min-w-0 flex-1 hover:underline">
          {texto}
        </Link>
      ) : (
        texto
      )}
      <span className={`shrink-0 text-xs ${vencido ? "font-medium text-red-600 dark:text-red-400" : "text-ink2"}`}>
        {formatFechaRelativa(evento.fecha_hora)}
      </span>
    </div>
  );
}
