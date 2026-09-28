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
      <span className="field-label">Estado</span>
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
        className="input font-medium"
      >
        {/* Estado antiguo sin equivalente (p. ej. "En negociación"): se muestra tal cual. */}
        {!(ESTADOS as readonly string[]).includes(value) ? <option value={value}>{value}</option> : null}
        {ESTADOS.map((estado) => (
          <option key={estado} value={estado}>
            {ESTADO_LABEL[estado]}
          </option>
        ))}
      </select>
    </label>
  );
}
