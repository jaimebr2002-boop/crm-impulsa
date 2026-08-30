"use client";

import { useState } from "react";
import { addDias, startOfDay, endOfDay } from "@/lib/dates";

export type Periodo = { desde: Date; hasta: Date; etiqueta: string };

const OPCIONES = ["Hoy", "Ayer", "7 días", "30 días", "Este mes", "Mes anterior", "Personalizado"] as const;
type Opcion = (typeof OPCIONES)[number];

function calcularPeriodo(opcion: Opcion, personalizado?: { desde: string; hasta: string }): Periodo {
  const hoy = new Date();
  switch (opcion) {
    case "Hoy":
      return { desde: startOfDay(hoy), hasta: endOfDay(hoy), etiqueta: "Hoy" };
    case "Ayer": {
      const ayer = addDias(hoy, -1);
      return { desde: startOfDay(ayer), hasta: endOfDay(ayer), etiqueta: "Ayer" };
    }
    case "7 días":
      return { desde: startOfDay(addDias(hoy, -6)), hasta: endOfDay(hoy), etiqueta: "Últimos 7 días" };
    case "30 días":
      return { desde: startOfDay(addDias(hoy, -29)), hasta: endOfDay(hoy), etiqueta: "Últimos 30 días" };
    case "Este mes": {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: startOfDay(inicio), hasta: endOfDay(hoy), etiqueta: "Este mes" };
    }
    case "Mes anterior": {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
      return { desde: startOfDay(inicio), hasta: endOfDay(fin), etiqueta: "Mes anterior" };
    }
    case "Personalizado": {
      if (personalizado?.desde && personalizado?.hasta) {
        return {
          desde: startOfDay(new Date(personalizado.desde)),
          hasta: endOfDay(new Date(personalizado.hasta)),
          etiqueta: "Personalizado",
        };
      }
      return { desde: startOfDay(addDias(hoy, -6)), hasta: endOfDay(hoy), etiqueta: "Últimos 7 días" };
    }
  }
}

export function PeriodSelector({ onChange }: { onChange: (periodo: Periodo) => void }) {
  const [opcion, setOpcion] = useState<Opcion>("30 días");
  const [personalDesde, setPersonalDesde] = useState("");
  const [personalHasta, setPersonalHasta] = useState("");

  function elegir(nueva: Opcion) {
    setOpcion(nueva);
    if (nueva !== "Personalizado") {
      onChange(calcularPeriodo(nueva));
    } else if (personalDesde && personalHasta) {
      onChange(calcularPeriodo(nueva, { desde: personalDesde, hasta: personalHasta }));
    }
  }

  function aplicarPersonalizado() {
    if (!personalDesde || !personalHasta) return;
    onChange(calcularPeriodo("Personalizado", { desde: personalDesde, hasta: personalHasta }));
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {OPCIONES.map((o) => (
          <button
            key={o}
            onClick={() => elegir(o)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
              opcion === o ? "bg-brand text-white" : "border border-line bg-surface text-ink2 hover:text-ink"
            }`}
          >
            {o}
          </button>
        ))}
      </div>
      {opcion === "Personalizado" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={personalDesde}
            onChange={(e) => setPersonalDesde(e.target.value)}
            className="input w-auto text-xs"
          />
          <span className="text-xs text-ink3">a</span>
          <input
            type="date"
            value={personalHasta}
            onChange={(e) => setPersonalHasta(e.target.value)}
            className="input w-auto text-xs"
          />
          <button
            onClick={aplicarPersonalizado}
            className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white"
          >
            Aplicar
          </button>
        </div>
      ) : null}
    </div>
  );
}

export { calcularPeriodo };
