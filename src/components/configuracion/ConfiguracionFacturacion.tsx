"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { faltanDatosEmisor, guardarAjustes, obtenerAjustes } from "@/lib/data/ajustes";
import { limpiarHuerfanos, objetosHuerfanos } from "@/lib/data/documentos";
import type { AjustesFacturacion } from "@/lib/types";
import { DatosFiscalesForm, type CampoFiscal } from "../forms/DatosFiscalesForm";

const CAMPOS_EMISOR: CampoFiscal[] = [
  { campo: "nombre", label: "Nombre y apellidos o razón social", placeholder: "Como autónomo, tu nombre completo", ancho: "completo" },
  { campo: "nif", label: "NIF", placeholder: "12345678Z", ancho: "medio" },
  { campo: "email", label: "Email", ancho: "medio", tipo: "email" },
  { campo: "direccion", label: "Dirección", ancho: "completo" },
  { campo: "codigo_postal", label: "Código postal", ancho: "tercio" },
  { campo: "ciudad", label: "Ciudad", ancho: "tercio" },
  { campo: "provincia", label: "Provincia", ancho: "tercio" },
  { campo: "pais", label: "País", ancho: "medio" },
  { campo: "telefono", label: "Teléfono", ancho: "medio" },
  { campo: "iban", label: "IBAN (opcional, para el pago por transferencia)", placeholder: "ES00 0000 0000 0000 0000 0000", ancho: "completo" },
  {
    campo: "texto_legal",
    label: "Texto al pie (opcional)",
    placeholder: "Forma de pago, exenciones de IVA, inscripción…",
    ancho: "completo",
    tipo: "textarea",
  },
];

function Seccion({ id, titulo, descripcion, children }: { id?: string; titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink3">{titulo}</h2>
      {descripcion ? <p className="mb-3 text-sm text-ink3">{descripcion}</p> : null}
      <div className="rounded-2xl border border-line bg-surface p-5">{children}</div>
    </section>
  );
}

/** Configuración solo admin: emisor de las facturas, preferencias y almacenamiento. */
export function ConfiguracionFacturacion() {
  const { avisar } = useApp();
  const [ajustes, setAjustes] = useState<AjustesFacturacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [huerfanos, setHuerfanos] = useState<string[] | null>(null);
  const [iva, setIva] = useState("21");
  const [irpf, setIrpf] = useState("7");
  const [dias, setDias] = useState("30");
  const [guardandoPref, setGuardandoPref] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const a = await obtenerAjustes();
      setAjustes(a);
      if (a) {
        setIva(String(Number(a.iva_pct_defecto)));
        setIrpf(String(Number(a.irpf_pct_defecto)));
        setDias(String(a.dias_vencimiento));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar los ajustes.");
    }
    objetosHuerfanos()
      .then((h) => setHuerfanos(h.map((x) => x.name)))
      .catch(() => setHuerfanos(null));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!ajustes) return <div className="skeleton h-64 w-full rounded-2xl" />;

  const falta = faltanDatosEmisor(ajustes);

  return (
    <div className="flex flex-col gap-8">
      <Seccion
        id="facturacion"
        titulo="Datos de facturación"
        descripcion="Emisor de tus facturas: aparecen en cada PDF. Como autónomo basta con tu nombre completo y NIF."
      >
        {falta.length ? (
          <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
            Para generar PDFs falta: {falta.join(", ")}.
          </p>
        ) : null}
        <DatosFiscalesForm
          key={ajustes.updated_at}
          campos={CAMPOS_EMISOR}
          inicial={ajustes as unknown as Record<string, string | null>}
          botonTexto="Guardar datos"
          onSubmit={async (v) => {
            const limpio = {
              ...v,
              nif: v.nif?.toUpperCase().replace(/\s+/g, "") ?? null,
              iban: v.iban?.toUpperCase().replace(/\s+/g, "") ?? null,
              pais: v.pais ?? "España",
            };
            setAjustes(await guardarAjustes(limpio));
            avisar("Datos de facturación guardados");
          }}
        />
      </Seccion>

      <Seccion titulo="Preferencias de facturación" descripcion="Valores con los que empieza cada factura nueva (se pueden cambiar en cada una).">
        <form
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setGuardandoPref(true);
            try {
              setAjustes(
                await guardarAjustes({
                  iva_pct_defecto: Number(iva.replace(",", ".")),
                  irpf_pct_defecto: Number(irpf.replace(",", ".")),
                  dias_vencimiento: Math.round(Number(dias)),
                })
              );
              avisar("Preferencias guardadas");
            } catch (err) {
              avisar(err instanceof Error ? err.message : "No se han podido guardar.", { tono: "error" });
            } finally {
              setGuardandoPref(false);
            }
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink2">IVA por defecto (%)</span>
            <input value={iva} onChange={(e) => setIva(e.target.value)} inputMode="decimal" className="input" aria-label="IVA por defecto" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink2">IRPF por defecto (%)</span>
            <input value={irpf} onChange={(e) => setIrpf(e.target.value)} inputMode="decimal" className="input" aria-label="IRPF por defecto" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink2">Vencimiento (días)</span>
            <input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className="input" aria-label="Días de vencimiento" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink2">Moneda</span>
            <input value="EUR (€)" disabled className="input opacity-60" />
          </label>
          <p className="col-span-2 text-xs text-ink3 sm:col-span-3">
            Numeración automática AAAA-NNN por año (se asigna al emitir). Puedes poner un número a mano en cada factura.
          </p>
          <div className="col-span-2 flex justify-end sm:col-span-1">
            <button type="submit" disabled={guardandoPref} className="btn-secondary">
              {guardandoPref ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </Seccion>

      <Seccion titulo="Almacenamiento" descripcion="Los archivos están en un espacio privado de Supabase Storage; solo tú puedes abrirlos.">
        {huerfanos === null ? (
          <p className="text-sm text-ink3">No se ha podido comprobar el almacenamiento.</p>
        ) : huerfanos.length === 0 ? (
          <p className="text-sm text-ink2">Todo en orden: no hay archivos sin documento.</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink2">
              {huerfanos.length} archivo{huerfanos.length === 1 ? "" : "s"} sin documento (una subida o un borrado que no terminó).
            </p>
            <button
              onClick={async () => {
                try {
                  const n = await limpiarHuerfanos(huerfanos);
                  avisar(`${n} archivo${n === 1 ? "" : "s"} eliminado${n === 1 ? "" : "s"}`);
                  cargar();
                } catch (e) {
                  avisar(e instanceof Error ? e.message : "No se han podido limpiar.", { tono: "error" });
                }
              }}
              className="btn-secondary"
            >
              Limpiar
            </button>
          </div>
        )}
      </Seccion>
    </div>
  );
}
