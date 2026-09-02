import Link from "next/link";
import type { Lead, Usuario } from "@/lib/types";
import { ESTADO_COLOR, ESTADO_LABEL, ORIGEN_LABEL } from "@/lib/constants";
import { PhoneIndicator } from "./PhoneIndicator";
import { Avatar } from "./Avatar";
import { formatFechaRelativa } from "@/lib/dates";

export function LeadCard({
  lead,
  asignado,
  proximoSeguimiento,
}: {
  lead: Lead;
  asignado?: Usuario | null;
  proximoSeguimiento?: string | null;
}) {
  return (
    <Link
      href={`/leads/${lead.id}`}
      className="block rounded-2xl border border-line bg-surface p-4 shadow-card transition-transform active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
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
        <span>{lead.origen ? ORIGEN_LABEL[lead.origen] ?? lead.origen : ""}</span>
      </div>

      {proximoSeguimiento ? (
        <p className="mt-2 text-xs font-medium text-brand-dark">
          Próximo seguimiento: {formatFechaRelativa(proximoSeguimiento)}
        </p>
      ) : null}
    </Link>
  );
}
