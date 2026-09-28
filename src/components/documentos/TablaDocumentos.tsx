"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { descargarDocumento, eliminarDocumento, reemplazarArchivo } from "@/lib/data/documentos";
import { ACCEPT_INPUT, CATEGORIA_DOCUMENTO_LABEL, formatTamano } from "@/lib/documentos";
import { formatFecha } from "@/lib/dates";
import type { DocumentoContexto } from "@/lib/types";
import { Modal } from "../Modal";
import { IconMasOpciones } from "../Icons";
import { IconoArchivo } from "./IconoArchivo";
import { VisorDocumento } from "./VisorDocumento";
import { relacionPrincipal } from "./contexto";

/**
 * Lista densa de documentos (tabla en escritorio, filas en móvil) con
 * ver · descargar · reemplazar · eliminar. Abrir o descargar no genera actividad.
 */
export function TablaDocumentos({
  documentos,
  onCambio,
  mostrarRelacion = true,
  vacio,
  abierto,
  onAbrir,
}: {
  documentos: DocumentoContexto[];
  onCambio: () => void;
  mostrarRelacion?: boolean;
  vacio?: ReactNode;
  /** Visor controlado desde fuera (p. ej. /documentos?ver=id). */
  abierto?: DocumentoContexto | null;
  onAbrir?: (d: DocumentoContexto | null) => void;
}) {
  const { avisar, notificarCambio } = useApp();
  const [visorLocal, setVisorLocal] = useState<DocumentoContexto | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<DocumentoContexto | null>(null);
  const [reemplazando, setReemplazando] = useState<{ doc: DocumentoContexto; progreso: number } | null>(null);
  const objetivoReemplazo = useRef<DocumentoContexto | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const visor = abierto !== undefined ? abierto : visorLocal;
  const abrir = (d: DocumentoContexto | null) => (onAbrir ? onAbrir(d) : setVisorLocal(d));

  const hecho = () => {
    onCambio();
    notificarCambio();
  };

  async function descargar(d: DocumentoContexto) {
    try {
      await descargarDocumento(d);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido descargar.", { tono: "error" });
    }
  }

  async function reemplazar(archivo: File) {
    const doc = objetivoReemplazo.current;
    if (!doc) return;
    setReemplazando({ doc, progreso: 0 });
    try {
      await reemplazarArchivo(doc, archivo, (p) => setReemplazando({ doc, progreso: p }));
      avisar(`Archivo de «${doc.nombre}» reemplazado`);
      hecho();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido reemplazar el archivo.", { tono: "error" });
    } finally {
      setReemplazando(null);
    }
  }

  async function eliminar(d: DocumentoContexto) {
    try {
      const { archivoBorrado } = await eliminarDocumento(d);
      setBorrando(null);
      avisar(archivoBorrado ? `«${d.nombre}» eliminado` : `«${d.nombre}» eliminado. El archivo no se pudo borrar ahora; queda para limpieza en Configuración.`);
      hecho();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido eliminar.", { tono: "error" });
    }
  }

  const acciones = (d: DocumentoContexto) => (
    <div className="relative">
      <button
        onClick={() => setMenu(menu === d.id ? null : d.id)}
        aria-label={`Acciones de ${d.nombre}`}
        aria-expanded={menu === d.id}
        className="rounded-md p-1.5 text-ink3 hover:bg-mute hover:text-ink"
      >
        <IconMasOpciones className="h-4 w-4" />
      </button>
      {menu === d.id ? (
        <>
          <button className="fixed inset-0 z-30 cursor-default" aria-hidden tabIndex={-1} onClick={() => setMenu(null)} />
          <div role="menu" className="absolute right-0 z-40 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-surface py-1 text-sm shadow-lg">
            {[
              { t: "Ver", f: () => abrir(d) },
              { t: "Descargar", f: () => descargar(d) },
              ...(d.origen === "subida"
                ? [
                    {
                      t: "Reemplazar archivo",
                      f: () => {
                        objetivoReemplazo.current = d;
                        input.current?.click();
                      },
                    },
                  ]
                : []),
              { t: "Eliminar", f: () => setBorrando(d), peligro: true },
            ].map((a) => (
              <button
                key={a.t}
                role="menuitem"
                onClick={() => {
                  setMenu(null);
                  a.f();
                }}
                className={`block w-full px-3 py-1.5 text-left hover:bg-mute ${"peligro" in a ? "text-red-600 dark:text-red-400" : "text-ink"}`}
              >
                {a.t}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );

  const relacion = (d: DocumentoContexto) => {
    const r = relacionPrincipal(d);
    if (!r) return <span className="text-ink3">—</span>;
    return (
      <span className="block min-w-0">
        <Link href={r.href} className="block truncate text-ink2 hover:text-ink hover:underline">
          {r.etiqueta}
        </Link>
        {r.secundaria ? <span className="block truncate text-xs text-ink3">{r.secundaria}</span> : null}
      </span>
    );
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept={ACCEPT_INPUT}
        className="hidden"
        data-testid="input-reemplazo"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) reemplazar(f);
        }}
      />

      {documentos.length === 0 ? (
        vacio ?? <p className="px-4 py-8 text-center text-sm text-ink3">Sin documentos.</p>
      ) : (
        <>
          {/* Escritorio */}
          <table className="hidden w-full table-fixed text-sm md:table">
            <colgroup>
              <col />
              <col className="w-28" />
              {mostrarRelacion ? <col className="w-52" /> : null}
              <col className="w-24" />
              <col className="w-20" />
              <col className="w-12" />
            </colgroup>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink3">
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-3 py-2 font-medium">Categoría</th>
                {mostrarRelacion ? <th className="px-3 py-2 font-medium">Relacionado con</th> : null}
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 text-right font-medium">Tamaño</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {documentos.map((d) => (
                <tr key={d.id} className="group border-b border-line last:border-0 hover:bg-mute/40">
                  <td className="px-4 py-2">
                    <button onClick={() => abrir(d)} className="flex w-full min-w-0 items-center gap-3 text-left">
                      <IconoArchivo mime={d.mime_type} nombre={d.nombre_archivo} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink group-hover:underline">{d.nombre}</span>
                        <span className="block truncate text-xs text-ink3">
                          {d.nombre_archivo}
                          {d.origen === "generado" ? " · generado" : ""}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-ink2">{CATEGORIA_DOCUMENTO_LABEL[d.categoria]}</td>
                  {mostrarRelacion ? <td className="px-3 py-2">{relacion(d)}</td> : null}
                  <td className="px-3 py-2 text-ink2">{formatFecha(d.created_at)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink3">{formatTamano(d.tamano)}</td>
                  <td className="px-2 py-2 text-right">{acciones(d)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Móvil */}
          <ul className="divide-y divide-line md:hidden">
            {documentos.map((d) => {
              const r = mostrarRelacion ? relacionPrincipal(d) : null;
              return (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                  <button onClick={() => abrir(d)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <IconoArchivo mime={d.mime_type} nombre={d.nombre_archivo} />
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-ink">{d.nombre}</span>
                      <span className="block truncate text-xs text-ink3">
                        {[CATEGORIA_DOCUMENTO_LABEL[d.categoria], r?.etiqueta, formatTamano(d.tamano)].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                  {acciones(d)}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {visor ? <VisorDocumento doc={visor} onCerrar={() => abrir(null)} /> : null}

      {reemplazando ? (
        <Modal titulo="Reemplazando archivo" onClose={() => {}}>
          <p className="mb-2 text-sm text-ink2">{reemplazando.doc.nombre}</p>
          <div className="h-1.5 overflow-hidden rounded-full bg-mute">
            <div className="h-full rounded-full bg-ink" style={{ width: `${Math.max(reemplazando.progreso * 100, 3)}%` }} />
          </div>
        </Modal>
      ) : null}

      {borrando ? (
        <Modal titulo="Eliminar documento" onClose={() => setBorrando(null)}>
          <p className="text-sm text-ink2">
            Se eliminará <strong className="text-ink">{borrando.nombre}</strong> y su archivo ({borrando.nombre_archivo}). No se puede deshacer.
            {borrando.factura_id && borrando.categoria === "factura" && borrando.origen === "generado" ? " La factura quedará sin PDF (podrás generarlo de nuevo)." : ""}
            {borrando.gasto_id && borrando.categoria === "justificante" ? " El gasto quedará sin justificante." : ""}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setBorrando(null)} className="btn-ghost">
              Volver
            </button>
            <button onClick={() => eliminar(borrando)} className="btn bg-red-600 text-white hover:bg-red-700">
              Eliminar
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
