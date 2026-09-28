"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { descargarDocumento, urlFirmada } from "@/lib/data/documentos";
import { CATEGORIA_DOCUMENTO_LABEL, formatTamano, GRUPO_LABEL, grupoDeMime, previsualizable } from "@/lib/documentos";
import { formatFechaHora } from "@/lib/dates";
import type { DocumentoContexto } from "@/lib/types";
import { Modal } from "../Modal";
import { IconoArchivo } from "./IconoArchivo";
import { relacionPrincipal } from "./contexto";

/**
 * Vista previa dentro de la app con una signed URL de 5 minutos (se pide al
 * abrir; nunca se guarda). PDF, imágenes, MP4 y texto; el resto, información y descarga.
 */
export function VisorDocumento({ doc, onCerrar }: { doc: DocumentoContexto; onCerrar: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [texto, setTexto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tipo = previsualizable(doc.mime_type);
  const rel = relacionPrincipal(doc);

  useEffect(() => {
    let vivo = true;
    if (!tipo) return;
    urlFirmada(doc, "ver")
      .then(async (u) => {
        if (!vivo) return;
        if (tipo === "texto") {
          const r = await fetch(u);
          if (!r.ok) throw new Error("No se ha podido leer el archivo.");
          const t = await r.text();
          if (vivo) setTexto(t.length > 200_000 ? `${t.slice(0, 200_000)}\n…` : t);
        }
        if (vivo) setUrl(u);
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : "No se ha podido abrir el archivo."));
    return () => {
      vivo = false;
    };
  }, [doc, tipo]);

  async function abrirPestana() {
    try {
      window.open(await urlFirmada(doc, "ver"), "_blank", "noopener");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido abrir el archivo.");
    }
  }

  return (
    <Modal titulo={doc.nombre} onClose={onCerrar} ancho="max-w-4xl">
      <div className="-mt-2 mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink3">
        <span>{CATEGORIA_DOCUMENTO_LABEL[doc.categoria]}</span>
        <span>{doc.nombre_archivo}</span>
        <span>{formatTamano(doc.tamano)}</span>
        <span>{formatFechaHora(doc.created_at)}</span>
        {rel ? (
          <Link href={rel.href} onClick={onCerrar} className="text-ink2 hover:text-ink hover:underline">
            {rel.etiqueta}
          </Link>
        ) : null}
        <span className="ml-auto flex gap-2">
          {tipo ? (
            <button onClick={abrirPestana} className="btn-ghost py-1 text-xs">
              Abrir en pestaña
            </button>
          ) : null}
          <button
            onClick={() => descargarDocumento(doc).catch((e) => setError(e instanceof Error ? e.message : "No se ha podido descargar."))}
            className="btn-secondary py-1 text-xs"
          >
            Descargar
          </button>
        </span>
      </div>
      {doc.descripcion ? <p className="mb-3 whitespace-pre-line text-sm text-ink2">{doc.descripcion}</p> : null}

      {error ? <p className="rounded-xl border border-line px-4 py-10 text-center text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      {!error && tipo && !url ? <div className="skeleton h-[60vh] w-full rounded-xl" /> : null}

      {!error && url ? (
        <div className="overflow-hidden rounded-xl border border-line bg-mute/40" data-testid="visor-contenido">
          {tipo === "pdf" ? <iframe src={url} title={doc.nombre} className="h-[70vh] w-full bg-white" /> : null}
          {tipo === "imagen" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={doc.nombre} className="mx-auto max-h-[70vh] w-auto object-contain" />
          ) : null}
          {tipo === "video" ? <video src={url} controls className="mx-auto max-h-[70vh] w-full" /> : null}
          {tipo === "texto" ? <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap p-4 font-mono text-xs text-ink">{texto}</pre> : null}
        </div>
      ) : null}

      {!tipo ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-line px-6 py-10 text-center">
          <IconoArchivo mime={doc.mime_type} nombre={doc.nombre_archivo} grande />
          <p className="text-sm text-ink2">
            {GRUPO_LABEL[grupoDeMime(doc.mime_type) as keyof typeof GRUPO_LABEL] ?? "Archivo"} · sin vista previa en la app.
          </p>
          <button onClick={() => descargarDocumento(doc)} className="btn-primary">
            Descargar {doc.nombre_archivo}
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
