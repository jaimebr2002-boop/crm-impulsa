"use client";

import { useState } from "react";
import { ESTADOS, ESTADO_LABEL } from "@/lib/constants";

export function LeadStatusSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (nuevoEstado: string) => Promise<void> | void;
}) {
  const [guardando, setGuardando] = useState(false);

  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">Estado</span>
      <select
        value={value}
        disabled={guardando}
        onChange={async (e) => {
          setGuardando(true);
          try {
            await onChange(e.target.value);
          } finally {
            setGuardando(false);
          }
        }}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-medium text-slate-900 disabled:opacity-60"
      >
        {ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {ESTADO_LABEL[estado]}
          </option>
        ))}
      </select>
    </label>
  );
}
