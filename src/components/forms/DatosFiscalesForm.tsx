"use client";

import { useState } from "react";

export type CampoFiscal = { campo: string; label: string; placeholder?: string; ancho?: "completo" | "medio" | "tercio"; tipo?: string };

/**
 * Formulario compacto de datos fiscales (emisor en Configuración o receptor en
 * una cuenta). Todos opcionales en la base de datos; el PDF exige los mínimos.
 */
export function DatosFiscalesForm({
  campos,
  inicial,
  botonTexto = "Guardar",
  onSubmit,
  onCancelar,
}: {
  campos: CampoFiscal[];
  inicial: Record<string, string | number | null | undefined>;
  botonTexto?: string;
  onSubmit: (valores: Record<string, string | null>) => Promise<void>;
  onCancelar?: () => void;
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.campo, inicial[c.campo] == null ? "" : String(inicial[c.campo])]))
  );
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await onSubmit(Object.fromEntries(Object.entries(valores).map(([k, v]) => [k, v.trim() || null])));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
    } finally {
      setEnviando(false);
    }
  }

  const span = { completo: "col-span-6", medio: "col-span-6 sm:col-span-3", tercio: "col-span-6 sm:col-span-2" };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <div className="grid grid-cols-6 gap-3">
        {campos.map((c) => (
          <label key={c.campo} className={`block ${span[c.ancho ?? "medio"]}`}>
            <span className="mb-1 block text-xs font-medium text-ink2">{c.label}</span>
            {c.tipo === "textarea" ? (
              <textarea
                value={valores[c.campo]}
                onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))}
                placeholder={c.placeholder}
                rows={2}
                className="input resize-y"
              />
            ) : (
              <input
                type={c.tipo ?? "text"}
                value={valores[c.campo]}
                onChange={(e) => setValores((v) => ({ ...v, [c.campo]: e.target.value }))}
                placeholder={c.placeholder}
                className="input"
              />
            )}
          </label>
        ))}
      </div>
      {error ? <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="btn-ghost">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="btn-primary px-4">
          {enviando ? "Guardando…" : botonTexto}
        </button>
      </div>
    </form>
  );
}

export const CAMPOS_FISCALES_CUENTA: CampoFiscal[] = [
  { campo: "fiscal_nombre", label: "Nombre fiscal", placeholder: "Razón social o nombre completo", ancho: "completo" },
  { campo: "fiscal_nif", label: "NIF / CIF", placeholder: "B12345678", ancho: "medio" },
  { campo: "email_facturacion", label: "Email de facturación", placeholder: "facturas@…", ancho: "medio", tipo: "email" },
  { campo: "fiscal_direccion", label: "Dirección", ancho: "completo" },
  { campo: "fiscal_codigo_postal", label: "Código postal", ancho: "tercio" },
  { campo: "fiscal_ciudad", label: "Ciudad", ancho: "tercio" },
  { campo: "fiscal_provincia", label: "Provincia", ancho: "tercio" },
  { campo: "fiscal_pais", label: "País", placeholder: "España", ancho: "medio" },
];

/** Qué falta de un receptor para poder emitir el PDF de su factura. */
export function faltanDatosReceptor(c: Record<string, unknown> | null | undefined): string[] {
  const falta: string[] = [];
  if (!String(c?.fiscal_nif ?? "").trim()) falta.push("NIF/CIF");
  if (!String(c?.fiscal_direccion ?? "").trim()) falta.push("dirección");
  if (!String(c?.fiscal_codigo_postal ?? "").trim() || !String(c?.fiscal_ciudad ?? "").trim()) falta.push("código postal y ciudad");
  return falta;
}
