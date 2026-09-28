"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { convertirLeadEnProyecto, listarProyectosDeLead } from "@/lib/data/proyectos";
import { ESTADO_PROYECTO_LABEL, TIPOS_PROYECTO, TIPO_PROYECTO_LABEL } from "@/lib/trabajo";
import type { Lead, Proyecto, TipoProyecto } from "@/lib/types";
import { Modal } from "../Modal";
import { IconFlecha, IconProyectos } from "../Icons";

/** Bloque de la ficha del lead (solo admin): proyectos ya creados a partir de
 * él y, si está ganado, el botón para convertirlo en proyecto. El lead y todo
 * su historial se conservan intactos. */
export function ConvertirLead({ lead }: { lead: Lead }) {
  const router = useRouter();
  const { avisar } = useApp();
  const [proyectos, setProyectos] = useState<Pick<Proyecto, "id" | "nombre" | "estado">[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState(lead.negocio || lead.nombre_contacto || "");
  const [tipo, setTipo] = useState<TipoProyecto>("web");
  const [entrega, setEntrega] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarProyectosDeLead(lead.id).then(setProyectos).catch(() => {});
  }, [lead.id]);

  const ganado = lead.estado === "cerrado";
  if (!ganado && proyectos.length === 0) return null;

  async function convertir(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Ponle un nombre al proyecto.");
    setEnviando(true);
    setError(null);
    try {
      const p = await convertirLeadEnProyecto(lead, { nombre: nombre.trim(), tipo, fecha_entrega: entrega || null });
      avisar("Proyecto creado a partir del lead");
      router.push(`/proyectos/${p.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido crear el proyecto.");
      setEnviando(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/25 dark:bg-emerald-500/10">
      {proyectos.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Proyectos de este cliente</p>
          {proyectos.map((p) => (
            <Link key={p.id} href={`/proyectos/${p.id}`} className="flex items-center gap-2 text-sm text-ink hover:underline">
              <IconProyectos className="h-4 w-4 text-ink3" />
              <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
              <span className="text-xs text-ink3">{ESTADO_PROYECTO_LABEL[p.estado]}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-emerald-900 dark:text-emerald-200">
          <strong>Lead ganado.</strong> Crea el proyecto para empezar a trabajar; el historial del lead se conserva.
        </p>
      )}
      {ganado ? (
        <button onClick={() => setAbierto(true)} className="btn-primary mt-3">
          {proyectos.length ? "Nuevo proyecto para este cliente" : "Convertir en proyecto"}
          <IconFlecha className="h-4 w-4" />
        </button>
      ) : null}

      {abierto ? (
        <Modal titulo="Convertir en proyecto" onClose={() => setAbierto(false)}>
          <form onSubmit={convertir} className="flex flex-col gap-4">
            <p className="text-sm text-ink2">
              Se creará (o reutilizará) la cuenta de cliente <strong className="text-ink">{lead.negocio || lead.nombre_contacto}</strong> y un
              proyecto enlazado a este lead{lead.valor != null ? " con su valor como importe" : ""}.
            </p>
            <label className="block">
              <span className="field-label">Nombre del proyecto</span>
              <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} className="input" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="field-label">Tipo</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoProyecto)} className="input">
                  {TIPOS_PROYECTO.map((t) => (
                    <option key={t} value={t}>
                      {TIPO_PROYECTO_LABEL[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="field-label">Entrega</span>
                <input type="date" value={entrega} onChange={(e) => setEntrega(e.target.value)} className="input" />
              </label>
            </div>
            {error ? <p className="field-error">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAbierto(false)} className="btn-ghost">
                Cancelar
              </button>
              <button type="submit" disabled={enviando} className="btn-primary px-4">
                {enviando ? "Creando…" : "Crear proyecto"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
