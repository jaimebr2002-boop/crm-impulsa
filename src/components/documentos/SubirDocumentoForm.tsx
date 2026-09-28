"use client";

import { useEffect, useRef, useState } from "react";
import { subirDocumento } from "@/lib/data/documentos";
import { listarCuentas, listarMarcas } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import { listarFacturas, listarGastos } from "@/lib/data/finanzas";
import {
  ACCEPT_INPUT,
  CATEGORIAS_DOCUMENTO,
  CATEGORIA_DOCUMENTO_LABEL,
  categoriaSugerida,
  formatTamano,
  nombreVisibleDe,
  RELACION_LABEL,
  TIPOS_LEGIBLES,
  TIPOS_PERMITIDOS,
  extensionDe,
  TAMANO_MAXIMO,
} from "@/lib/documentos";
import { eur } from "@/lib/finanzas";
import { formatYMDCorta } from "@/lib/dates";
import { contextoDeProyecto } from "@/lib/trabajo";
import type { CategoriaDocumento, Documento, RelacionDocumento } from "@/lib/types";
import { IconoArchivo } from "./IconoArchivo";
import { ZonaSoltar } from "./ZonaSoltar";

type Opcion = { id: string; etiqueta: string };
type TipoRelacion = RelacionDocumento["tipo"];

async function cargarOpciones(tipo: TipoRelacion): Promise<Opcion[]> {
  switch (tipo) {
    case "cuenta":
      return (await listarCuentas()).map((c) => ({ id: c.id, etiqueta: c.nombre }));
    case "marca":
      return (await listarMarcas()).map((m) => ({ id: m.id, etiqueta: m.nombre }));
    case "proyecto":
      return (await listarProyectos()).map((p) => ({ id: p.id, etiqueta: contextoDeProyecto(p) }));
    case "factura":
      return (await listarFacturas())
        .filter((f) => f.estado !== "cancelada")
        .map((f) => ({ id: f.id, etiqueta: `${f.numero ?? "Borrador"} · ${f.cuenta?.nombre ?? ""} · ${eur(f.total)}` }));
    case "gasto":
      return (await listarGastos())
        .slice(0, 200)
        .map((g) => ({ id: g.id, etiqueta: `${g.concepto} · ${eur(g.importe)} · ${formatYMDCorta(g.fecha)}` }));
  }
}

/**
 * Subir documento: archivo → nombre → categoría → relación (opcional) → guardar.
 * La descripción y la relación se despliegan solo si hacen falta.
 */
export function SubirDocumentoForm({
  archivoInicial,
  relacionInicial = null,
  categoriaInicial,
  relacionFija = false,
  onGuardado,
  onCancelar,
}: {
  archivoInicial?: File;
  relacionInicial?: RelacionDocumento | null;
  categoriaInicial?: CategoriaDocumento;
  /** Si viene del contexto (proyecto, gasto…) no se ofrece cambiarla. */
  relacionFija?: boolean;
  onGuardado: (doc: Documento) => void;
  onCancelar?: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");
  const [categoria, setCategoria] = useState<CategoriaDocumento>(categoriaInicial ?? "otro");
  const [relacion, setRelacion] = useState<RelacionDocumento | null>(relacionInicial);
  const [tipoRelacion, setTipoRelacion] = useState<TipoRelacion>(relacionInicial?.tipo ?? "proyecto");
  const [verRelacion, setVerRelacion] = useState(false);
  const [opciones, setOpciones] = useState<Opcion[] | null>(null);
  const [descripcion, setDescripcion] = useState("");
  const [verDescripcion, setVerDescripcion] = useState(false);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function elegir(f: File | undefined) {
    if (!f) return;
    setError(null);
    const ext = extensionDe(f.name);
    // Aviso inmediato (la validación completa, con la firma del archivo, se hace al guardar).
    if (!TIPOS_PERMITIDOS[ext]) setError(`No se admiten archivos .${ext || "sin extensión"}. Tipos admitidos: ${TIPOS_LEGIBLES}.`);
    else if (f.size > TAMANO_MAXIMO) setError(`El archivo ocupa ${formatTamano(f.size)}. El máximo es ${formatTamano(TAMANO_MAXIMO)}.`);
    setArchivo(f);
    setNombre((n) => n || nombreVisibleDe(f.name));
    if (!categoriaInicial) setCategoria(categoriaSugerida(f.name, TIPOS_PERMITIDOS[ext]?.mime ?? null, relacion));
  }

  useEffect(() => {
    if (archivoInicial) elegir(archivoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [archivoInicial]);

  useEffect(() => {
    if (!verRelacion) return;
    setOpciones(null);
    let vivo = true;
    cargarOpciones(tipoRelacion)
      .then((o) => vivo && setOpciones(o))
      .catch(() => vivo && setOpciones([]));
    return () => {
      vivo = false;
    };
  }, [verRelacion, tipoRelacion]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!archivo || progreso !== null) return;
    if (!nombre.trim()) return setError("Pon un nombre al documento.");
    setError(null);
    setProgreso(0);
    try {
      const doc = await subirDocumento(archivo, { nombre, categoria, descripcion, relacion }, setProgreso);
      onGuardado(doc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo. Tu documento no se ha guardado.");
      setProgreso(null);
    }
  }

  const subiendo = progreso !== null;

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <input
        ref={input}
        type="file"
        accept={ACCEPT_INPUT}
        className="hidden"
        data-testid="input-archivo"
        onChange={(e) => {
          elegir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {archivo ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-mute/40 px-3 py-2.5">
          <IconoArchivo mime={TIPOS_PERMITIDOS[extensionDe(archivo.name)]?.mime ?? ""} nombre={archivo.name} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{archivo.name}</span>
            <span className="block text-xs text-ink3">{formatTamano(archivo.size)}</span>
          </span>
          {!subiendo ? (
            <button type="button" onClick={() => input.current?.click()} className="btn-ghost py-1 text-xs">
              Cambiar
            </button>
          ) : null}
        </div>
      ) : (
        <ZonaSoltar onArchivos={(fs) => elegir(fs[0])}>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed border-line px-4 py-8 text-center hover:bg-mute/40"
          >
            <span className="text-sm font-medium text-ink">Elige un archivo o arrástralo aquí</span>
            <span className="text-xs text-ink3">PDF, imágenes, Office, texto, CSV, ZIP o vídeo · máx. {formatTamano(TAMANO_MAXIMO)}</span>
          </button>
        </ZonaSoltar>
      )}

      {archivo ? (
        <>
          <label className="block">
            <span className="field-label">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} className="input" disabled={subiendo} />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink2">Categoría</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Categoría">
              {CATEGORIAS_DOCUMENTO.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={categoria === c}
                  disabled={subiendo}
                  onClick={() => setCategoria(c)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                    categoria === c ? "border-ink bg-ink text-canvas" : "border-line text-ink2 hover:bg-mute"
                  }`}
                >
                  {CATEGORIA_DOCUMENTO_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Relación: fija (desde el contexto), elegida o desplegable. */}
          {relacion && (relacionFija || !verRelacion) ? (
            <p className="flex items-center gap-2 text-sm text-ink2">
              <span className="text-xs text-ink3">{RELACION_LABEL[relacion.tipo]}</span>
              <span className="font-medium text-ink">{relacion.etiqueta ?? "seleccionado"}</span>
              {!relacionFija && !subiendo ? (
                <button type="button" onClick={() => setVerRelacion(true)} className="text-xs text-ink3 underline hover:text-ink">
                  Cambiar
                </button>
              ) : null}
            </p>
          ) : null}
          {!relacionFija && verRelacion ? (
            <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
              <div className="flex flex-wrap gap-1 text-xs">
                {(Object.keys(RELACION_LABEL) as TipoRelacion[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTipoRelacion(t);
                      setRelacion(null);
                    }}
                    className={`rounded-md px-2 py-1 font-medium ${tipoRelacion === t ? "bg-mute text-ink" : "text-ink3 hover:text-ink"}`}
                  >
                    {RELACION_LABEL[t]}
                  </button>
                ))}
              </div>
              <select
                aria-label={`Relacionar con ${RELACION_LABEL[tipoRelacion].toLowerCase()}`}
                value={relacion?.tipo === tipoRelacion ? relacion.id : ""}
                disabled={!opciones || subiendo}
                onChange={(e) => {
                  const o = opciones?.find((x) => x.id === e.target.value);
                  setRelacion(o ? { tipo: tipoRelacion, id: o.id, etiqueta: o.etiqueta } : null);
                  if (o && tipoRelacion === "gasto" && categoria === "otro") setCategoria("justificante");
                }}
                className="input"
              >
                <option value="">{opciones ? `Sin ${RELACION_LABEL[tipoRelacion].toLowerCase()}` : "Cargando…"}</option>
                {(opciones ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {verDescripcion ? (
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Descripción (opcional)"
              className="input resize-y"
              disabled={subiendo}
            />
          ) : null}
          {!subiendo ? (
            <div className="flex flex-wrap gap-3 text-sm font-medium text-ink2">
              {!relacionFija && !verRelacion && !relacion ? (
                <button type="button" onClick={() => setVerRelacion(true)} className="hover:text-ink">
                  + Relacionar con cuenta, proyecto, factura…
                </button>
              ) : null}
              {!verDescripcion ? (
                <button type="button" onClick={() => setVerDescripcion(true)} className="hover:text-ink">
                  + Descripción
                </button>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {subiendo ? (
        <div className="flex flex-col gap-1" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-mute" role="progressbar" aria-valuenow={Math.round((progreso ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-ink transition-[width]" style={{ width: `${Math.max((progreso ?? 0) * 100, 3)}%` }} />
          </div>
          <span className="text-xs text-ink3">{(progreso ?? 0) < 1 ? `Subiendo… ${Math.round((progreso ?? 0) * 100)} %` : "Guardando…"}</span>
        </div>
      ) : null}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="btn-ghost" disabled={subiendo}>
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={!archivo || subiendo} className="btn-primary px-4">
          {subiendo ? "Subiendo…" : "Guardar documento"}
        </button>
      </div>
    </form>
  );
}
