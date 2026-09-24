import Link from "next/link";
import type { Lead, Usuario } from "@/lib/types";
import { ESTADO_COLOR, ESTADO_LABEL, ORIGEN_LABEL, formatEuros } from "@/lib/constants";
import { PhoneIndicator } from "./PhoneIndicator";
import { Avatar } from "./Avatar";
import { formatFechaRelativa } from "@/lib/dates";

export function LeadCard({
  lead,
  asignado,
  proximoSeguimiento,
  seleccionable = false,
  seleccionado = false,
  onToggleSeleccion,
}: {
  lead: Lead;
  asignado?: Usuario | null;
  proximoSeguimiento?: string | null;
  /** En modo selección la tarjeta marca/desmarca en vez de abrir el lead. */
  seleccionable?: boolean;
  seleccionado?: boolean;
  onToggleSeleccion?: () => void;
}) {
  const clase = `block w-full rounded-2xl border bg-surface p-4 text-left shadow-card transition-transform active:scale-[0.99] ${
    seleccionado ? "border-brand ring-2 ring-brand/40" : "border-line"
  }`;
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {seleccionable ? (
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                seleccionado ? "border-brand bg-brand text-white" : "border-line"
              }`}
            >
              {seleccionado ? "✓" : ""}
            </span>
          ) : null}
          <Avatar nombre={lead.negocio || lead.nombre_contacto || "?"} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink">
              {lead.negocio || "Sin negocio"}
            </p>
            <p className="truncate text-sm text-ink2">{lead.nombre_contacto || "Sin contacto"}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            ESTADO_COLOR[lead.estado] ?? "bg-mute text-ink2 border-line"
          }`}
        >
          {ESTADO_LABEL[lead.estado] ?? lead.estado}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink2">
        {lead.telefono ? <span>{lead.telefono}</span> : null}
        <PhoneIndicator telefono={lead.telefono} />
        {lead.instagram ? <span className="text-ink3">· {lead.instagram}</span> : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink2">
        <span className="flex items-center gap-1.5">
          {asignado ? (
            <>
              <Avatar nombre={asignado.nombre} size="sm" />
              {asignado.nombre}
            </>
          ) : (
            "Sin asignar"
          )}
        </span>
        <span className="flex items-center gap-2">
          {lead.origen ? ORIGEN_LABEL[lead.origen] ?? lead.origen : ""}
          {lead.valor != null ? <span className="font-semibold text-ink">{formatEuros(lead.valor)}</span> : null}
        </span>
      </div>

      {proximoSeguimiento ? (
        <p className="mt-2 text-xs font-medium text-brand-dark">
          Próximo seguimiento: {formatFechaRelativa(proximoSeguimiento)}
        </p>
      ) : null}
    </>
  );

  if (seleccionable) {
    return (
      <button type="button" onClick={onToggleSeleccion} aria-pressed={seleccionado} className={clase}>
        {contenido}
      </button>
    );
  }
  return (
    <Link href={`/leads/${lead.id}`} className={clase}>
      {contenido}
    </Link>
  );
}
