"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { listarProyectos } from "@/lib/data/proyectos";
import { addDias, aYMD, hoyYMD, sumarDiasYMD } from "@/lib/dates";
import type { Prioridad, Proyecto, TareaInsert } from "@/lib/types";
import { ESTADOS_PROYECTO_ACTIVOS, PRIORIDADES, PRIORIDAD_LABEL } from "@/lib/trabajo";

export type TareaFormValores = TareaInsert;

function proximoViernes(): string {
  const hoy = new Date();
  const diasHastaViernes = (5 - hoy.getDay() + 7) % 7 || 7;
  return aYMD(addDias(hoy, diasHastaViernes));
}

export function TareaForm({
  valoresIniciales,
  onSubmit,
  onCancelar,
  botonTexto = "Crear tarea",
  ocultarProyecto = false,
  cuentaId,
}: {
  valoresIniciales?: Partial<TareaFormValores>;
  onSubmit: (v: TareaFormValores) => Promise<void>;
  onCancelar?: () => void;
  botonTexto?: string;
  ocultarProyecto?: boolean;
  /** Si se crea desde una cuenta: solo sus proyectos en el selector. */
  cuentaId?: string;
}) {
  const { usuarios } = useApp();
  const { esAdmin } = useUsuario();
  const [v, setV] = useState<TareaFormValores>({
    titulo: "",
    prioridad: "normal",
    fecha_limite: null,
    proyecto_id: null,
    descripcion: null,
    ...valoresIniciales,
  });
  const [proyectos, setProyectos] = useState<Pick<Proyecto, "id" | "nombre" | "estado" | "cuenta_id">[]>([]);
  const [masDetalles, setMasDetalles] = useState(!!valoresIniciales?.descripcion);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!esAdmin || ocultarProyecto) return;
    listarProyectos()
      .then((ps) =>
        setProyectos(
          ps.filter(
            (p) =>
              (ESTADOS_PROYECTO_ACTIVOS.has(p.estado) || p.id === v.proyecto_id) && (!cuentaId || p.cuenta_id === cuentaId)
          )
        )
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin, ocultarProyecto, cuentaId]);

  function set<K extends keyof TareaFormValores>(k: K, valor: TareaFormValores[K]) {
    setV((prev) => ({ ...prev, [k]: valor }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!v.titulo.trim()) return setError("Escribe qué hay que hacer.");
    setEnviando(true);
    setError(null);
    try {
      const payload: TareaFormValores = { ...v, titulo: v.titulo.trim(), descripcion: v.descripcion?.trim() || null };
      if (!payload.responsable_id) delete payload.responsable_id;
      await onSubmit(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
      setEnviando(false);
    }
  }

  const hoy = hoyYMD();
  const atajos = [
    { label: "Hoy", valor: hoy },
    { label: "Mañana", valor: sumarDiasYMD(hoy, 1) },
    { label: "Viernes", valor: proximoViernes() },
    { label: "Sin fecha", valor: null },
  ];

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input
        autoFocus
        value={v.titulo}
        onChange={(e) => set("titulo", e.target.value)}
        placeholder="¿Qué hay que hacer?"
        className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink3"
      />

      <div>
        <span className="mb-1.5 block text-xs font-medium text-ink2">Fecha límite</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {atajos.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => set("fecha_limite", a.valor)}
              className={`rounded-lg border px-2.5 py-1.5 text-sm ${
                v.fecha_limite === a.valor ? "border-ink bg-ink text-canvas" : "border-line text-ink2 hover:bg-mute"
              }`}
            >
              {a.label}
            </button>
          ))}
          <input
            type="date"
            value={v.fecha_limite ?? ""}
            onChange={(e) => set("fecha_limite", e.target.value || null)}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink2"
            aria-label="Otra fecha"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Prioridad</span>
          <select value={v.prioridad} onChange={(e) => set("prioridad", e.target.value as Prioridad)} className="input">
            {PRIORIDADES.map((p) => (
              <option key={p} value={p}>
                {PRIORIDAD_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        {esAdmin && !ocultarProyecto ? (
          <label className="block">
            <span className="field-label">Proyecto</span>
            <select value={v.proyecto_id ?? ""} onChange={(e) => set("proyecto_id", e.target.value || null)} className="input">
              <option value="">Sin proyecto</option>
              {proyectos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {masDetalles ? (
        <>
          {esAdmin && usuarios.length > 1 ? (
            <label className="block">
              <span className="field-label">Responsable</span>
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
            </label>
          ) : null}
          <label className="block">
            <span className="field-label">Notas</span>
            <textarea
              value={v.descripcion ?? ""}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={3}
              className="input resize-y"
            />
          </label>
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
