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
      <span className="mb-1 block text-xs font-medium text-ink2">Estado</span>
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
        className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-base font-medium text-ink disabled:opacity-60"
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
