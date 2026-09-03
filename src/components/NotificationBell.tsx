"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { EventoConLead } from "@/lib/types";
import { formatFechaRelativa } from "@/lib/dates";
import { IconCampana } from "./Icons";

export function NotificationBell({
  eventos,
  onAbrir,
  onMarcarLeida,
  onMarcarTodas,
  abrirHaciaArriba = false,
}: {
  eventos: EventoConLead[];
  onAbrir?: (id: string) => void;
  onMarcarLeida: (id: string) => void;
  onMarcarTodas: () => void;
  /** El dock de escritorio vive al fondo de la pantalla: el panel debe abrirse hacia arriba para no salirse del viewport. */
  abrirHaciaArriba?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onClickFuera);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickFuera);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const total = eventos.length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink2 transition-colors hover:text-brand-dark"
      >
        <IconCampana className="h-4 w-4" />
        {total > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {total > 9 ? "9+" : total}
          </span>
        ) : null}
      </button>

      {abierto ? (
        <div
          className={`absolute right-0 z-30 max-h-[70dvh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-glass dark:shadow-glass-dark ${
            abrirHaciaArriba ? "bottom-14" : "top-11"
          }`}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold text-ink">Notificaciones</p>
            {total > 0 ? (
              <button
                type="button"
                onClick={onMarcarTodas}
                className="text-xs font-medium text-brand-dark hover:underline"
              >
                Marcar todas como leídas
              </button>
            ) : null}
          </div>

          {total === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-ink3">Sin pendientes por ahora.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {eventos.map((ev) => (
                <Link
                  key={ev.id}
                  href={ev.lead?.id ? `/leads/${ev.lead.id}` : "/hoy"}
                  onClick={() => {
                    onMarcarLeida(ev.id);
                    onAbrir?.(ev.id);
                    setAbierto(false);
                  }}
                  className="rounded-xl px-2 py-2 text-sm hover:bg-mute"
                >
                  <p className="font-medium text-ink">{ev.lead?.negocio || ev.lead?.nombre_contacto || "Lead"}</p>
                  <p className="text-xs text-ink2">{ev.titulo}</p>
                  <p className="mt-0.5 text-xs font-semibold text-red-600">{formatFechaRelativa(ev.fecha_hora)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
