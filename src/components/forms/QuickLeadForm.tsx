"use client";

import { useState } from "react";
import { ESTADOS, ESTADO_LABEL, ORIGENES, ORIGEN_LABEL } from "@/lib/constants";
import { esTelefonoFijoEspanol } from "@/lib/phone";
import type { LeadInsert, Usuario } from "@/lib/types";

export function QuickLeadForm({
  usuarios,
  usuarioActualId,
  onSubmit,
  onCancelar,
}: {
  usuarios: Usuario[];
  usuarioActualId: string;
  onSubmit: (valores: LeadInsert) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [negocio, setNegocio] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [asignadoA, setAsignadoA] = useState(usuarioActualId);
  const [origen, setOrigen] = useState("referido_personal");
  const [referidoPor, setReferidoPor] = useState("");
  const [estado, setEstado] = useState("pendiente");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esFijo = esTelefonoFijoEspanol(telefono);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await onSubmit({
        negocio,
        nombre_contacto: contacto,
        telefono,
        asignado_a: asignadoA || undefined,
        origen,
        referido_por: referidoPor || undefined,
        estado,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar el lead.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Negocio</span>
        <input value={negocio} onChange={(e) => setNegocio(e.target.value)} className="input" autoFocus />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Contacto</span>
        <input value={contacto} onChange={(e) => setContacto(e.target.value)} className="input" />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Teléfono</span>
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input" inputMode="tel" />
        {esFijo ? <p className="mt-1.5 text-xs font-medium text-amber-700">Teléfono fijo · no WhatsApp.</p> : null}
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Referido por</span>
        <input
          value={referidoPor}
          onChange={(e) => setReferidoPor(e.target.value)}
          className="input"
          placeholder="Si viene de un referido"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Origen</span>
          <select value={origen} onChange={(e) => setOrigen(e.target.value)} className="input">
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {ORIGEN_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-500">Estado</span>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} className="input">
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-500">Responsable</span>
        <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)} className="input">
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </label>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="mt-2 flex gap-3">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-slate-200 py-3.5 text-base font-medium text-slate-600">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="flex-1 rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
          {enviando ? "Guardando…" : "Guardar y continuar"}
        </button>
      </div>
    </form>
  );
}
