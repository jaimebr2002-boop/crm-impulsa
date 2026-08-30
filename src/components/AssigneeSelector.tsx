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
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
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
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-medium text-slate-900 disabled:opacity-60"
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
