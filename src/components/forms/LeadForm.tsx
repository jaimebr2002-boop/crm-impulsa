"use client";

import { useState } from "react";
import { CANALES, CANAL_LABEL, ESTADOS, ESTADO_LABEL, ORIGENES, ORIGEN_LABEL, SEGMENTOS, SEGMENTO_LABEL } from "@/lib/constants";
import { esTelefonoFijoEspanol } from "@/lib/phone";
import type { LeadInsert, Usuario } from "@/lib/types";

export type LeadFormValores = LeadInsert;

type Props = {
  usuarios: Usuario[];
  usuarioActualId: string;
  puedeAsignar: boolean;
  valoresIniciales?: LeadFormValores;
  onSubmit: (valores: LeadFormValores) => Promise<void>;
  botonTexto?: string;
  onCancelar?: () => void;
};

const VACIO: LeadFormValores = {
  nombre_contacto: "",
  negocio: "",
  telefono: "",
  nicho: "",
  ciudad: "",
  canal: "",
  referido_por: "",
  origen: "",
  segmento: "",
  oferta: "",
  estado: "pendiente",
  asignado_a: "",
  email: "",
  enlace_demo: "",
};

export function LeadForm({
  usuarios,
  usuarioActualId,
  puedeAsignar,
  valoresIniciales,
  onSubmit,
  botonTexto = "Guardar lead",
  onCancelar,
}: Props) {
  const [valores, setValores] = useState<LeadFormValores>({ ...VACIO, ...valoresIniciales });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esFijo = esTelefonoFijoEspanol(valores.telefono);
  const advertenciaWhatsapp = esFijo && valores.canal === "whatsapp";

  function set<K extends keyof LeadFormValores>(campo: K, valor: LeadFormValores[K]) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const payload: LeadFormValores = { ...valores };
      // Un comercial solo trabaja sobre sus propios leads: se fuerza aquí
      // igual que lo exige la política RLS de INSERT/UPDATE en Supabase.
      if (!puedeAsignar) {
        payload.asignado_a = usuarioActualId;
      } else if (!payload.asignado_a) {
        delete payload.asignado_a;
      }
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar el lead.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Campo label="Negocio">
        <input
          value={valores.negocio ?? ""}
          onChange={(e) => set("negocio", e.target.value)}
          className="input"
          placeholder="Nombre del negocio"
        />
      </Campo>

      <Campo label="Nombre de contacto">
        <input
          value={valores.nombre_contacto ?? ""}
          onChange={(e) => set("nombre_contacto", e.target.value)}
          className="input"
          placeholder="Persona de contacto"
        />
      </Campo>

      <Campo label="Teléfono">
        <input
          value={valores.telefono ?? ""}
          onChange={(e) => set("telefono", e.target.value)}
          className="input"
          placeholder="600 000 000"
          inputMode="tel"
        />
        {esFijo ? (
          <p className="mt-1.5 text-xs font-medium text-amber-700">Teléfono fijo · no puede recibir WhatsApp.</p>
        ) : null}
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Nicho">
          <input value={valores.nicho ?? ""} onChange={(e) => set("nicho", e.target.value)} className="input" />
        </Campo>
        <Campo label="Ciudad">
          <input value={valores.ciudad ?? ""} onChange={(e) => set("ciudad", e.target.value)} className="input" />
        </Campo>
      </div>

      <Campo label="Referido por" nota="Quién ha presentado o recomendado el contacto">
        <input
          value={valores.referido_por ?? ""}
          onChange={(e) => set("referido_por", e.target.value)}
          className="input"
          placeholder="Ej: tu tío Carlos"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Canal">
          <select value={valores.canal ?? ""} onChange={(e) => set("canal", e.target.value)} className="input">
            <option value="">Sin especificar</option>
            {CANALES.map((c) => (
              <option key={c} value={c}>
                {CANAL_LABEL[c]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Origen">
          <select value={valores.origen ?? ""} onChange={(e) => set("origen", e.target.value)} className="input">
            <option value="">Sin especificar</option>
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {ORIGEN_LABEL[o]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {advertenciaWhatsapp ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Este teléfono es fijo y no puede recibir WhatsApp. Considera cambiar el canal a llamada.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Segmento">
          <select value={valores.segmento ?? ""} onChange={(e) => set("segmento", e.target.value)} className="input">
            <option value="">Sin especificar</option>
            {SEGMENTOS.map((s) => (
              <option key={s} value={s}>
                {SEGMENTO_LABEL[s]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Estado">
          <select value={valores.estado ?? "pendiente"} onChange={(e) => set("estado", e.target.value)} className="input">
            {ESTADOS.map((estado) => (
              <option key={estado} value={estado}>
                {ESTADO_LABEL[estado]}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo label="Oferta">
        <input value={valores.oferta ?? ""} onChange={(e) => set("oferta", e.target.value)} className="input" />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Email">
          <input value={valores.email ?? ""} onChange={(e) => set("email", e.target.value)} className="input" type="email" />
        </Campo>
        <Campo label="Enlace de demo">
          <input value={valores.enlace_demo ?? ""} onChange={(e) => set("enlace_demo", e.target.value)} className="input" />
        </Campo>
      </div>

      {puedeAsignar ? (
        <Campo label="Responsable">
          <select value={valores.asignado_a ?? ""} onChange={(e) => set("asignado_a", e.target.value)} className="input">
            <option value="">Sin asignar</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </Campo>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="mt-2 flex gap-3">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="flex-1 rounded-xl border border-slate-200 py-3.5 text-base font-medium text-slate-600">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="flex-1 rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-60">
          {enviando ? "Guardando…" : botonTexto}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, nota, children }: { label: string; nota?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
      {nota ? <span className="mt-1 block text-[11px] text-slate-400">{nota}</span> : null}
    </label>
  );
}
