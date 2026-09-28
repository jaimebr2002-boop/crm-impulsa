"use client";

import Link from "next/link";
import { ESTADO_LABEL, formatEuros } from "@/lib/constants";
import { TONO_CHIP, TONO_LEAD, TONO_TEXTO } from "@/lib/tonos";
import type { Lead, Usuario } from "@/lib/types";
import { Avatar } from "../Avatar";
import { PhoneIndicator } from "../PhoneIndicator";

/** Próximo seguimiento: "Hoy 10:30", "Mañana", "Lun 6"… y rojo si ya pasó. */
function seguimiento(iso: string | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  const hoy = new Date();
  const dias = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86400000);
  const hora = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const texto =
    dias === 0 ? `Hoy ${hora}` : dias === 1 ? "Mañana" : dias === -1 ? "Ayer" : new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d).replace(".", "");
  return { texto, vencido: d.getTime() < Date.now() };
}

export function EstadoLead({ estado }: { estado: string }) {
  return <span className={`chip ${TONO_CHIP[TONO_LEAD[estado] ?? "neutro"]}`}>{ESTADO_LABEL[estado] ?? estado}</span>;
}

/**
 * Lista de leads: tabla densa en escritorio, filas compactas en móvil.
 * En modo selección la fila marca/desmarca en vez de abrir el lead.
 */
export function TablaLeads({
  leads,
  usuariosPorId,
  proximos,
  seleccionable,
  seleccion,
  onToggle,
}: {
  leads: Lead[];
  usuariosPorId: Record<string, Usuario>;
  proximos: Record<string, string>;
  seleccionable: boolean;
  seleccion: Set<string>;
  onToggle: (id: string) => void;
}) {
  const casilla = (id: string) =>
    seleccionable ? (
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
          seleccion.has(id) ? "border-ink bg-ink text-canvas" : "border-line bg-surface"
        }`}
      >
        {seleccion.has(id) ? "✓" : ""}
      </span>
    ) : null;

  const Fila = ({ lead, children, className }: { lead: Lead; children: React.ReactNode; className: string }) =>
    seleccionable ? (
      <button type="button" onClick={() => onToggle(lead.id)} aria-pressed={seleccion.has(lead.id)} className={`${className} w-full text-left`}>
        {children}
      </button>
    ) : (
      <Link href={`/leads/${lead.id}`} className={className}>
        {children}
      </Link>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Escritorio */}
      <div className="hidden grid-cols-[minmax(0,1.6fr)_120px_100px_140px_120px_minmax(0,1fr)] gap-3 border-b border-line px-4 py-2 text-xs text-ink3 md:grid">
        <span>Negocio</span>
        <span>Estado</span>
        <span className="text-right">Valor</span>
        <span>Responsable</span>
        <span>Seguimiento</span>
        <span>Ciudad · nicho</span>
      </div>
      <ul className="divide-y divide-line">
        {leads.map((lead) => {
          const asignado = lead.asignado_a ? usuariosPorId[lead.asignado_a] : null;
          const seg = seguimiento(proximos[lead.id]);
          const lugar = [lead.ciudad, lead.nicho].filter(Boolean).join(" · ");
          const activo = seleccion.has(lead.id);
          return (
            <li key={lead.id} className={activo ? "bg-brand-light/60" : ""}>
              <Fila
                lead={lead}
                className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-0.5 px-4 py-2.5 text-sm hover:bg-mute/40 md:grid-cols-[minmax(0,1.6fr)_120px_100px_140px_120px_minmax(0,1fr)]"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {casilla(lead.id)}
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink group-hover:underline">{lead.negocio || "Sin negocio"}</span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-ink3">
                      <span className="truncate">{lead.nombre_contacto || "Sin contacto"}</span>
                      {lead.telefono ? <PhoneIndicator telefono={lead.telefono} /> : null}
                    </span>
                  </span>
                </span>
                <span className="justify-self-end md:justify-self-start">
                  <EstadoLead estado={lead.estado} />
                </span>
                {/* Móvil: segunda línea con valor, responsable y seguimiento */}
                <span className="col-span-2 flex flex-wrap gap-x-2 text-xs text-ink3 md:hidden">
                  {lead.valor != null ? <span className="font-medium text-ink2">{formatEuros(lead.valor)}</span> : null}
                  {asignado ? <span>{asignado.nombre}</span> : null}
                  {seg ? <span className={seg.vencido ? TONO_TEXTO.peligro : ""}>Seguimiento {seg.texto.toLowerCase()}</span> : null}
                </span>
                <span className="hidden text-right tabular-nums text-ink md:block">{lead.valor != null ? formatEuros(lead.valor) : <span className="text-ink3">—</span>}</span>
                <span className="hidden min-w-0 items-center gap-1.5 text-ink2 md:flex">
                  {asignado ? (
                    <>
                      <Avatar nombre={asignado.nombre} size="sm" />
                      <span className="truncate">{asignado.nombre}</span>
                    </>
                  ) : (
                    <span className="text-ink3">Sin asignar</span>
                  )}
                </span>
                <span className={`hidden text-sm md:block ${seg?.vencido ? `font-medium ${TONO_TEXTO.peligro}` : "text-ink2"}`}>{seg ? seg.texto : <span className="text-ink3">—</span>}</span>
                <span className="hidden truncate text-ink3 md:block">{lugar || "—"}</span>
              </Fila>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
