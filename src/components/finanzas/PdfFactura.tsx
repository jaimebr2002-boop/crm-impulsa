"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { descargarDocumento, generarPdfFactura, listarDocumentos, type ResultadoPdf } from "@/lib/data/documentos";
import { formatFechaHora } from "@/lib/dates";
import { formatTamano } from "@/lib/documentos";
import type { DocumentoContexto, FacturaConCuenta } from "@/lib/types";
import { Panel } from "../ui/Panel";
import { IconoArchivo } from "../documentos/IconoArchivo";
import { VisorDocumento } from "../documentos/VisorDocumento";

/**
 * PDF de la factura: generar, ver, descargar y regenerar. Si la factura cambia
 * después de generarlo (huella distinta), se avisa de forma visible y se pide
 * regenerar: el PDF guardado nunca se presenta como vigente si no coincide.
 */
export function PdfFactura({ factura, onCambio, pedido }: { factura: FacturaConCuenta; onCambio: () => void; pedido?: number }) {
  const { avisar, notificarCambio } = useApp();
  const [doc, setDoc] = useState<DocumentoContexto | null>(null);
  const [generando, setGenerando] = useState(false);
  const [bloqueo, setBloqueo] = useState<Extract<ResultadoPdf, { ok: false }> | null>(null);
  const [viendo, setViendo] = useState(false);

  const cargarDoc = useCallback(async () => {
    if (!factura.pdf_path) return setDoc(null);
    const docs = await listarDocumentos({ facturaIds: [factura.id] }).catch(() => []);
    setDoc(docs.find((d) => d.storage_path === factura.pdf_path) ?? null);
  }, [factura.id, factura.pdf_path]);

  useEffect(() => {
    cargarDoc();
  }, [cargarDoc]);

  const generar = useCallback(async () => {
    if (generando || factura.estado === "borrador") return;
    setGenerando(true);
    setBloqueo(null);
    const r = await generarPdfFactura(factura.id);
    setGenerando(false);
    if (!r.ok) {
      if (r.faltanEmisor?.length || r.faltanReceptor?.length) setBloqueo(r);
      else avisar(r.error, { tono: "error" });
      return;
    }
    avisar(r.regenerado ? "PDF regenerado" : "PDF generado");
    notificarCambio();
    onCambio();
  }, [generando, factura.id, factura.estado, avisar, notificarCambio, onCambio]);

  // "Generar PDF" desde + Añadir / ⌘K.
  useEffect(() => {
    if (pedido) generar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedido]);

  const estado = factura.pdf_estado ?? (factura.pdf_path ? "actualizado" : "sin_pdf");

  return (
    <Panel titulo="PDF" tono={estado === "desactualizado" ? "alerta" : undefined}>
      <div className="flex flex-col gap-3 px-4 py-3 text-sm" data-testid="panel-pdf">
        {factura.estado === "borrador" ? (
          <p className="text-ink3">Emite la factura para poder generar su PDF.</p>
        ) : estado === "sin_pdf" ? (
          <>
            <p className="text-ink3">Aún no hay PDF de esta factura.</p>
            <button onClick={generar} disabled={generando} className="btn-primary justify-center">
              {generando ? "Generando…" : "Generar PDF"}
            </button>
          </>
        ) : (
          <>
            {estado === "desactualizado" ? (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                La factura ha cambiado después de generar el PDF: el PDF guardado ya no coincide. Regenéralo antes de enviarlo.
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <IconoArchivo mime="application/pdf" nombre={doc?.nombre_archivo ?? "factura.pdf"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{doc?.nombre_archivo ?? `factura-${factura.numero}.pdf`}</span>
                <span className="block text-xs text-ink3">
                  {factura.pdf_generado_en ? `Generado ${formatFechaHora(factura.pdf_generado_en)}` : ""}
                  {doc ? ` · ${formatTamano(doc.tamano)}` : ""}
                </span>
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setViendo(true)} disabled={!doc} className="btn-secondary py-1 text-xs">
                Ver PDF
              </button>
              <button
                onClick={() => doc && descargarDocumento(doc).catch((e) => avisar(e instanceof Error ? e.message : "No se ha podido descargar.", { tono: "error" }))}
                disabled={!doc}
                className="btn-secondary py-1 text-xs"
              >
                Descargar
              </button>
              <button onClick={generar} disabled={generando} className={`py-1 text-xs ${estado === "desactualizado" ? "btn-primary" : "btn-ghost"}`}>
                {generando ? "Generando…" : "Regenerar"}
              </button>
            </div>
          </>
        )}

        {bloqueo ? (
          <div className="rounded-lg border border-line bg-mute/50 px-3 py-2 text-xs text-ink2" role="alert">
            {bloqueo.faltanEmisor?.length ? (
              <p>
                <strong className="text-ink">Configura tus datos de facturación antes de generar el PDF.</strong> Falta: {bloqueo.faltanEmisor.join(", ")}.{" "}
                <Link href="/perfil#facturacion" className="font-medium text-ink underline">
                  Ir a Configuración
                </Link>
              </p>
            ) : null}
            {bloqueo.faltanReceptor?.length ? (
              <p className={bloqueo.faltanEmisor?.length ? "mt-1" : ""}>
                <strong className="text-ink">Faltan datos de facturación de {factura.cuenta?.nombre}:</strong> {bloqueo.faltanReceptor.join(", ")}.{" "}
                <Link href={`/cuentas/${factura.cuenta_id}?tab=finanzas`} className="font-medium text-ink underline">
                  Completar
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      {viendo && doc ? <VisorDocumento doc={doc} onCerrar={() => setViendo(false)} /> : null}
    </Panel>
  );
}
