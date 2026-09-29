"use client";

import { useEffect, useState } from "react";
import { listarProyectos } from "@/lib/data/proyectos";
import { useApp } from "@/context/AppContext";
import type { EstadoProyecto, Prioridad, Proyecto, ProyectoInsert, TipoProyecto } from "@/lib/types";
import {
  ESTADOS_PROYECTO,
  ESTADO_PROYECTO_LABEL,
  PRIORIDADES,
  PRIORIDAD_LABEL,
  TIPOS_PROYECTO,
  TIPO_PROYECTO_LABEL,
} from "@/lib/trabajo";
import { CuentaMarcaSelector } from "./CuentaMarcaSelector";

export type ProyectoFormValores = ProyectoInsert;

export function ProyectoForm({
  valoresIniciales,
  onSubmit,
  onCancelar,
  botonTexto = "Crear proyecto",
  proyectoId,
  tieneSubproyectos = false,
}: {
  valoresIniciales?: Partial<ProyectoFormValores>;
  onSubmit: (v: ProyectoFormValores) => Promise<void>;
  onCancelar?: () => void;
  botonTexto?: string;
  /** Id del proyecto en edición (para no ofrecerlo como su propio padre). */
  proyectoId?: string;
  /** Un proyecto con subproyectos no puede ser a su vez subproyecto. */
  tieneSubproyectos?: boolean;
}) {
  const { usuarios } = useApp();
  const esEdicion = !!valoresIniciales?.nombre;
  const [v, setV] = useState<ProyectoFormValores>({
    nombre: "",
    tipo: "otro",
    estado: "pendiente",
    prioridad: "normal",
    cuenta_id: null,
    marca_id: null,
    fecha_inicio: null,
    fecha_entrega: null,
    importe: null,
    descripcion: null,
    ...valoresIniciales,
  });
  const [masDetalles, setMasDetalles] = useState(esEdicion || !!valoresIniciales?.proyecto_padre_id);
  const [posiblesPadres, setPosiblesPadres] = useState<Pick<Proyecto, "id" | "nombre" | "cuenta_id" | "proyecto_padre_id">[]>([]);

  useEffect(() => {
    if (!masDetalles || tieneSubproyectos) return;
    listarProyectos()
      .then((ps) => setPosiblesPadres(ps.filter((p) => !p.proyecto_padre_id && p.id !== proyectoId)))
      .catch(() => {});
  }, [masDetalles, tieneSubproyectos, proyectoId]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ProyectoFormValores>(k: K, valor: ProyectoFormValores[K]) {
    setV((prev) => ({ ...prev, [k]: valor }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!v.nombre.trim()) return setError("Ponle un nombre al proyecto.");
    setEnviando(true);
    setError(null);
    try {
      const payload: ProyectoFormValores = { ...v, nombre: v.nombre.trim(), descripcion: v.descripcion?.trim() || null };
      // Sin responsable elegido se omite el campo: la base de datos asigna a quien lo crea.
      if (!payload.responsable_id) delete payload.responsable_id;
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input
        autoFocus
        value={v.nombre}
        onChange={(e) => set("nombre", e.target.value)}
        placeholder="Nombre del proyecto (ej: Segurma — Vídeo 3)"
        className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink3"
      />

      <CuentaMarcaSelector
        cuentaId={v.cuenta_id ?? null}
        marcaId={v.marca_id ?? null}
        onChange={({ cuenta_id, marca_id }) => setV((p) => ({ ...p, cuenta_id, marca_id }))}
      />

      <div className="grid grid-cols-2 gap-3">
        <Campo label="Tipo">
          <select value={v.tipo} onChange={(e) => set("tipo", e.target.value as TipoProyecto)} className="input">
            {TIPOS_PROYECTO.map((t) => (
              <option key={t} value={t}>
                {TIPO_PROYECTO_LABEL[t]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Prioridad">
          <select value={v.prioridad} onChange={(e) => set("prioridad", e.target.value as Prioridad)} className="input">
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDAD_LABEL[p]}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Entrega">
          <input
            type="date"
            value={v.fecha_entrega ?? ""}
            onChange={(e) => set("fecha_entrega", e.target.value || null)}
            className="input"
          />
        </Campo>
        <Campo label="Importe (€)">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={v.importe ?? ""}
            onChange={(e) => set("importe", e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
            placeholder="Sin valorar"
            className="input"
          />
          <span className="mt-1 block text-[11px] text-ink3">Déjalo vacío si no hay precio acordado; 0 € significa cero real.</span>
        </Campo>
      </div>

      {masDetalles ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Estado">
              <select value={v.estado} onChange={(e) => set("estado", e.target.value as EstadoProyecto)} className="input">
                {ESTADOS_PROYECTO.map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_PROYECTO_LABEL[s]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="Inicio">
              <input
                type="date"
                value={v.fecha_inicio ?? ""}
                onChange={(e) => set("fecha_inicio", e.target.value || null)}
                className="input"
              />
            </Campo>
          </div>
          {usuarios.length > 1 ? (
            <Campo label="Responsable">
              <select
                value={v.responsable_id ?? ""}
                onChange={(e) => set("responsable_id", e.target.value || null)}
                className="input"
              >
                <option value="">Yo</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          ) : null}
          {!tieneSubproyectos ? (
            <Campo label="Forma parte de">
              <select
                value={v.proyecto_padre_id ?? ""}
                onChange={(e) => set("proyecto_padre_id", e.target.value || null)}
                className="input"
              >
                <option value="">Ningún proyecto (independiente)</option>
                {posiblesPadres
                  .filter((p) => !v.cuenta_id || p.cuenta_id === v.cuenta_id || p.id === v.proyecto_padre_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
              </select>
              <span className="mt-1 block text-[11px] text-ink3">
                Para agrupar piezas de una campaña. Pon el importe donde lo factures (en la campaña o en cada pieza), no en ambos, para no contarlo dos veces.
              </span>
            </Campo>
          ) : null}
          <Campo label="Descripción">
            <textarea
              value={v.descripcion ?? ""}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={3}
              placeholder="Qué hay que hacer, briefing, contexto…"
              className="input resize-y"
            />
          </Campo>
        </>
      ) : (
        <button type="button" onClick={() => setMasDetalles(true)} className="self-start text-sm font-medium text-ink2 hover:text-ink">
          + Más detalles
        </button>
      )}

      {error ? <p className="field-error">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-1">
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

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

/** Solo las columnas editables (el proyecto cargado trae además joins y metadatos). */
export function valoresDesdeProyecto(p: ProyectoFormValores & Record<string, unknown>): ProyectoFormValores {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion ?? null,
    cuenta_id: p.cuenta_id ?? null,
    marca_id: p.marca_id ?? null,
    tipo: p.tipo,
    estado: p.estado,
    prioridad: p.prioridad,
    responsable_id: p.responsable_id ?? null,
    fecha_inicio: p.fecha_inicio ?? null,
    fecha_entrega: p.fecha_entrega ?? null,
    importe: p.importe ?? null,
    proyecto_padre_id: p.proyecto_padre_id ?? null,
  };
}
