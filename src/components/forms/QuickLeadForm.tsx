"use client";

import { useState } from "react";
import { ESTADOS, ESTADO_LABEL, ORIGENES, ORIGEN_LABEL } from "@/lib/constants";
import { esTelefonoFijoEspanol } from "@/lib/phone";
import { useBorradorFormulario } from "@/lib/useBorradorFormulario";
import type { LeadInsert, Usuario } from "@/lib/types";

type CamposRapidos = {
  negocio: string;
  contacto: string;
  telefono: string;
  asignadoA: string;
  origen: string;
  referidoPor: string;
  estado: string;
};

export function QuickLeadForm({
  usuarios,
  usuarioActualId,
  puedeAsignar,
  draftKey,
  onSubmit,
  onCancelar,
}: {
  usuarios: Usuario[];
  usuarioActualId: string;
  puedeAsignar: boolean;
  /** Clave única del borrador, para no mezclarlo con el de la alta completa. */
  draftKey: string;
  onSubmit: (valores: LeadInsert) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [campos, setCampos, limpiarBorrador] = useBorradorFormulario<CamposRapidos>(draftKey, {
    negocio: "",
    contacto: "",
    telefono: "",
    asignadoA: usuarioActualId,
    origen: "referido_personal",
    referidoPor: "",
    estado: "pendiente",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { negocio, contacto, telefono, asignadoA, origen, referidoPor, estado } = campos;
  function set<K extends keyof CamposRapidos>(campo: K, valor: CamposRapidos[K]) {
    setCampos((c) => ({ ...c, [campo]: valor }));
  }

  const esFijo = esTelefonoFijoEspanol(telefono);

  function cancelar() {
    limpiarBorrador();
    onCancelar?.();
  }

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
        // Un comercial nunca envía asignado_a distinto de sí mismo: RLS lo
        // rechazaría igualmente, pero ni se lo ofrecemos en la interfaz.
        asignado_a: puedeAsignar ? asignadoA || undefined : usuarioActualId,
        origen,
        referido_por: referidoPor || undefined,
        estado,
      });
      // El lead ya está guardado: el borrador temporal deja de tener sentido.
      limpiarBorrador();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar el lead.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="block">
        <span className="field-label">Negocio</span>
        <input value={negocio} onChange={(e) => set("negocio", e.target.value)} className="input" autoFocus />
      </label>

      <label className="block">
        <span className="field-label">Contacto</span>
        <input value={contacto} onChange={(e) => set("contacto", e.target.value)} className="input" />
      </label>

      <label className="block">
        <span className="field-label">Teléfono</span>
        <input value={telefono} onChange={(e) => set("telefono", e.target.value)} className="input" inputMode="tel" />
        {esFijo ? <p className="mt-1.5 text-xs font-medium text-amber-700">Teléfono fijo · no WhatsApp.</p> : null}
      </label>

      <label className="block">
        <span className="field-label">Referido por</span>
        <input
          value={referidoPor}
          onChange={(e) => set("referidoPor", e.target.value)}
          className="input"
          placeholder="Si viene de un referido"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Origen</span>
          <select value={origen} onChange={(e) => set("origen", e.target.value)} className="input">
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {ORIGEN_LABEL[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Estado</span>
          <select value={estado} onChange={(e) => set("estado", e.target.value)} className="input">
            {ESTADOS.map((e) => (
              <option key={e} value={e}>
                {ESTADO_LABEL[e]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {puedeAsignar ? (
        <label className="block">
          <span className="field-label">Responsable</span>
          <select value={asignadoA} onChange={(e) => set("asignadoA", e.target.value)} className="input">
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? <p className="field-error">{error}</p> : null}

      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={cancelar} className="btn-ghost">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="btn-primary px-4">
          {enviando ? "Guardando…" : "Guardar y continuar"}
        </button>
      </div>
    </form>
  );
}
