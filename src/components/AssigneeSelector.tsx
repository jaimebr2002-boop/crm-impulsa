"use client";

import { useState } from "react";
import type { Usuario } from "@/lib/types";

export function AssigneeSelector({
  usuarios,
  value,
  onChange,
  label = "Responsable",
}: {
  usuarios: Usuario[];
  value: string | null;
  onChange: (usuarioId: string) => Promise<void> | void;
  label?: string;
}) {
  const [guardando, setGuardando] = useState(false);

  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <select
        value={value ?? ""}
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
        <option value="" disabled>
          Sin asignar
        </option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
