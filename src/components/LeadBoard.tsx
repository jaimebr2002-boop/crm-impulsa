"use client";

import Link from "next/link";
import type { Lead, Usuario } from "@/lib/types";
import { ESTADOS, ESTADO_ACENTO, ESTADO_LABEL, formatEuros, sumarValor } from "@/lib/constants";
import { formatFechaRelativa } from "@/lib/dates";
import { Avatar } from "./Avatar";
import { KanbanBoard } from "./ui/KanbanBoard";

type Props = {
  leads: Lead[];
  usuariosPorId: Record<string, Usuario>;
  proximos: Record<string, string>;
  onMover: (leadId: string, nuevoEstado: string) => void;
};

/** Pipeline de ventas: una columna por estado del lead con su valor total. */
export function LeadBoard({ leads, usuariosPorId, proximos, onMover }: Props) {
  return (
    <KanbanBoard
      columnas={ESTADOS.map((e) => ({ id: e, titulo: ESTADO_LABEL[e], acento: ESTADO_ACENTO[e] ?? "bg-line" }))}
      items={leads}
      clave={(l) => l.id}
      columnaDe={(l) => l.estado}
      onMover={(l, estado) => onMover(l.id, estado)}
      resumenColumna={(lista) => {
        const total = sumarValor(lista);
        return total > 0 ? formatEuros(total) : null;
      }}
      renderTarjeta={(lead) => {
        const asignado = lead.asignado_a ? usuariosPorId[lead.asignado_a] : null;
        return (
          <>
            <Link href={`/leads/${lead.id}`} className="block" draggable={false}>
              <p className="truncate text-sm font-medium text-ink">{lead.negocio || "Sin negocio"}</p>
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
              <p
                className={`mt-1.5 truncate text-[11px] font-medium ${
                  new Date(proximos[lead.id]).getTime() < Date.now() ? "text-red-600 dark:text-red-400" : "text-ink2"
                }`}
              >
                Seguimiento {formatFechaRelativa(proximos[lead.id]).toLowerCase()}
              </p>
            ) : null}
          </>
        );
      }}
    />
  );
}
