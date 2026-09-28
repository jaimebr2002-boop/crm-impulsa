"use client";

import { useEffect, useState } from "react";
import { listarCuentas } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import { datetimeLocalToIso, hoyYMD, isoToDatetimeLocal } from "@/lib/dates";
import { ESTADOS_PROYECTO_ACTIVOS } from "@/lib/trabajo";
import type { Cuenta, Evento, Proyecto, TipoEvento } from "@/lib/types";

export type EventoGenericoValores = Pick<Evento, "titulo" | "tipo" | "fecha_hora" | "descripcion" | "cuenta_id" | "proyecto_id">;

/** Reuniones y eventos manuales del calendario (los seguimientos CRM se
 * siguen creando desde la ficha del lead). */
export function EventoGenericoForm({
  inicial,
  onSubmit,
  onCancelar,
  botonTexto = "Guardar",
}: {
  inicial?: Partial<EventoGenericoValores> & { fecha?: string };
  onSubmit: (v: EventoGenericoValores) => Promise<void>;
  onCancelar?: () => void;
  botonTexto?: string;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [tipo, setTipo] = useState<Exclude<TipoEvento, "seguimiento">>(inicial?.tipo === "evento" ? "evento" : "reunion");
  const [cuando, setCuando] = useState(
    inicial?.fecha_hora ? isoToDatetimeLocal(inicial.fecha_hora) : `${inicial?.fecha ?? hoyYMD()}T10:00`
  );
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [cuentaId, setCuentaId] = useState(inicial?.cuenta_id ?? "");
  const [proyectoId, setProyectoId] = useState(inicial?.proyecto_id ?? "");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [proyectos, setProyectos] = useState<Pick<Proyecto, "id" | "nombre" | "cuenta_id" | "estado">[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarCuentas(), listarProyectos()])
      .then(([c, p]) => {
        setCuentas(c);
        setProyectos(p.filter((x) => ESTADOS_PROYECTO_ACTIVOS.has(x.estado) || x.id === inicial?.proyecto_id));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return setError("Ponle un título.");
    if (!cuando) return setError("Elige fecha y hora.");
    setEnviando(true);
    setError(null);
    try {
      const proyecto = proyectos.find((p) => p.id === proyectoId);
      await onSubmit({
        titulo: titulo.trim(),
        tipo,
        fecha_hora: datetimeLocalToIso(cuando),
        descripcion: descripcion.trim() || null,
        proyecto_id: proyectoId || null,
        // Un evento de un proyecto pertenece también a la cuenta del proyecto.
        cuenta_id: cuentaId || proyecto?.cuenta_id || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido guardar.");
      setEnviando(false);
    }
  }

  const proyectosFiltrados = cuentaId ? proyectos.filter((p) => p.cuenta_id === cuentaId) : proyectos;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      <input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Reunión mensual con Fer"
        className="w-full border-0 bg-transparent p-0 text-lg font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink3"
      />
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "reunion" | "evento")} className="input">
            <option value="reunion">Reunión</option>
            <option value="evento">Evento</option>
          </select>
        </label>
        <label className="block">
          <span className="field-label">Cuándo</span>
          <input type="datetime-local" value={cuando} onChange={(e) => setCuando(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="field-label">Cuenta</span>
          <select
            value={cuentaId}
            onChange={(e) => {
              setCuentaId(e.target.value);
              setProyectoId("");
            }}
            className="input"
          >
            <option value="">Ninguna</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Proyecto</span>
          <select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className="input">
            <option value="">Ninguno</option>
            {proyectosFiltrados.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="field-label">Notas</span>
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="input resize-y" />
      </label>
      {error ? <p className="field-error">{error}</p> : null}
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
