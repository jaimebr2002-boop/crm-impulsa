"use client";

import { useMemo, useState } from "react";
import type { EventoConLead } from "@/lib/types";
import { addDias, inicioSemana, isMismoDia, startOfDay } from "@/lib/dates";
import { EventCard } from "./EventCard";
import { EmptyState } from "./EmptyState";

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const DIAS_SEMANA_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function CalendarViewMes({
  fechaReferencia,
  eventos,
  onToggleCompletada,
}: {
  fechaReferencia: Date;
  eventos: EventoConLead[];
  onToggleCompletada: (id: string, completada: boolean) => Promise<void>;
}) {
  const hoy = new Date();
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date>(
    isMismoDia(hoy, fechaReferencia) ? startOfDay(hoy) : startOfDay(fechaReferencia)
  );

  const primerDiaMes = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), 1);
  const inicioGrid = inicioSemana(primerDiaMes);
  const celdas = Array.from({ length: 42 }, (_, i) => addDias(inicioGrid, i));

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoConLead[]>();
    for (const ev of eventos) {
      const clave = startOfDay(new Date(ev.fecha_hora)).toDateString();
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(ev);
    }
    return mapa;
  }, [eventos]);

  const eventosDelDia = (eventosPorDia.get(diaSeleccionado.toDateString()) ?? []).sort(
    (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
  );

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-ink3">
        {DIAS_SEMANA.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {celdas.map((dia) => {
          const enMes = dia.getMonth() === fechaReferencia.getMonth();
          const eventosDia = eventosPorDia.get(dia.toDateString()) ?? [];
          const seleccionado = isMismoDia(dia, diaSeleccionado);
          const esHoy = isMismoDia(dia, hoy);
          const hayVencido = eventosDia.some((e) => !e.completada && new Date(e.fecha_hora) < hoy && !isMismoDia(dia, hoy));

          return (
            <button
              key={dia.toISOString()}
              onClick={() => setDiaSeleccionado(startOfDay(dia))}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm ${
                seleccionado ? "bg-brand text-white" : enMes ? "text-ink hover:bg-mute" : "text-ink3"
              }`}
            >
              <span className={esHoy && !seleccionado ? "font-bold text-brand-dark" : ""}>{dia.getDate()}</span>
              {eventosDia.length > 0 ? (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                    seleccionado ? "bg-surface" : hayVencido ? "bg-red-500" : "bg-brand"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">
          {new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(diaSeleccionado)}
        </h3>
        {eventosDelDia.length === 0 ? (
          <EmptyState titulo="Sin eventos este día" />
        ) : (
          <div className="flex flex-col gap-2">
            {eventosDelDia.map((ev) => (
              <EventCard key={ev.id} evento={ev} mostrarLead onToggleCompletada={onToggleCompletada} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CalendarViewSemana({
  fechaReferencia,
  eventos,
  onToggleCompletada,
}: {
  fechaReferencia: Date;
  eventos: EventoConLead[];
  onToggleCompletada: (id: string, completada: boolean) => Promise<void>;
}) {
  const hoy = new Date();
  const inicio = inicioSemana(fechaReferencia);
  const dias = Array.from({ length: 7 }, (_, i) => addDias(inicio, i));

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoConLead[]>();
    for (const ev of eventos) {
      const clave = startOfDay(new Date(ev.fecha_hora)).toDateString();
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(ev);
    }
    return mapa;
  }, [eventos]);

  return (
    <div className="flex flex-col gap-5">
      {dias.map((dia, i) => {
        const eventosDia = (eventosPorDia.get(dia.toDateString()) ?? []).sort(
          (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime()
        );
        const esHoy = isMismoDia(dia, hoy);
        return (
          <div key={dia.toISOString()}>
            <div className="mb-2 flex items-baseline gap-2">
              <span className={`text-sm font-semibold ${esHoy ? "text-brand-dark" : "text-ink"}`}>
                {DIAS_SEMANA_LARGO[i]}
              </span>
              <span className="text-xs text-ink3">
                {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(dia)}
              </span>
              {esHoy ? <span className="rounded-full bg-brand-light px-2 py-0.5 text-[10px] font-semibold text-brand-dark">Hoy</span> : null}
            </div>
            {eventosDia.length === 0 ? (
              <p className="text-xs text-ink3">Sin eventos</p>
            ) : (
              <div className="flex flex-col gap-2">
                {eventosDia.map((ev) => (
                  <EventCard key={ev.id} evento={ev} mostrarLead onToggleCompletada={onToggleCompletada} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
