"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { listarCuentas } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import type { Cuenta, ProyectoConRelaciones } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { ActividadPaginada } from "@/components/trabajo/ActividadPaginada";
import { Cabecera, Segmentado } from "@/components/ui/Cabecera";

type Tipo = "todo" | "proyectos" | "tareas" | "ventas" | "cuentas" | "finanzas" | "documentos";

const ENTIDADES: Record<Tipo, string[] | undefined> = {
  todo: undefined,
  proyectos: ["proyecto", "evento"],
  tareas: ["tarea"],
  ventas: ["lead"],
  cuentas: ["cuenta", "marca"],
  finanzas: ["factura", "cobro", "gasto", "suscripcion"],
  documentos: ["documento"],
};

export default function ActividadPage() {
  return (
    <SoloAdmin>
      <Actividad />
    </SoloAdmin>
  );
}

function Actividad() {
  const { versionDatos } = useApp();
  const [tipo, setTipo] = useState<Tipo>("todo");
  const [cuentaId, setCuentaId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);

  useEffect(() => {
    Promise.all([listarCuentas(), listarProyectos()])
      .then(([c, p]) => {
        setCuentas(c);
        setProyectos(p);
      })
      .catch(() => {});
  }, []);

  // Clave estable: cambia solo cuando cambia algún filtro (o se crea algo desde la shell).
  const filtro = useMemo(
    () => ({
      entidades: ENTIDADES[tipo],
      cuentaId: cuentaId || undefined,
      proyectoId: proyectoId || undefined,
      _v: versionDatos,
    }),
    [tipo, cuentaId, proyectoId, versionDatos]
  );

  const proyectosDeCuenta = cuentaId ? proyectos.filter((p) => p.cuenta_id === cuentaId) : proyectos;

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 md:px-8">
      <Cabecera titulo="Actividad" subtitulo="Qué ha pasado en tu negocio, de lo más reciente a lo más antiguo." />

      <div className="mb-4 flex flex-col gap-2">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Segmentado
            opciones={[
              { id: "todo", label: "Todo" },
              { id: "proyectos", label: "Proyectos" },
              { id: "tareas", label: "Tareas" },
              { id: "ventas", label: "Ventas" },
              { id: "cuentas", label: "Cuentas" },
              { id: "finanzas", label: "Finanzas" },
              { id: "documentos", label: "Documentos" },
            ]}
            valor={tipo}
            onChange={setTipo}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          <select
            value={cuentaId}
            onChange={(e) => {
              setCuentaId(e.target.value);
              setProyectoId("");
            }}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
            aria-label="Filtrar por cuenta"
          >
            <option value="">Todas las cuentas</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select
            value={proyectoId}
            onChange={(e) => setProyectoId(e.target.value)}
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink"
            aria-label="Filtrar por proyecto"
          >
            <option value="">Todos los proyectos</option>
            {proyectosDeCuenta.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface px-4 py-2">
        <ActividadPaginada
          filtro={filtro}
          vacio="Nada con estos filtros. Aquí aparecerá cada proyecto, tarea, lead o cuenta que cambie."
        />
      </div>
    </div>
  );
}
