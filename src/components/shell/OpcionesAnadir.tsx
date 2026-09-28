"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { IconCalendario, IconCuenta, IconEnlace, IconLeads, IconProyectos, IconSeguimientos, IconTareas } from "../Icons";

type Opcion = { id: string; label: string; icon: (p: { className?: string }) => ReactNode; accion: () => void };

/** Opciones de "+ Añadir": primero las propias del sitio donde estás (cuenta,
 * marca o proyecto) y después las generales. Ingresos, gastos y documentos
 * se sumarán cuando existan esos módulos. */
export function useOpcionesAnadir(): { contexto: string | null; propias: Opcion[]; generales: Opcion[] } {
  const { esAdmin } = useUsuario();
  const { abrirAlta, contexto, pedirPestana } = useApp();
  const router = useRouter();

  const propias: Opcion[] = [];
  if (esAdmin && contexto?.tipo === "cuenta") {
    propias.push(
      { id: "c-proyecto", label: "Proyecto", icon: IconProyectos, accion: () => abrirAlta({ tipo: "proyecto", valores: { cuenta_id: contexto.id } }) },
      { id: "c-tarea", label: "Tarea", icon: IconTareas, accion: () => abrirAlta({ tipo: "tarea", cuentaId: contexto.id }) },
      { id: "c-marca", label: "Marca", icon: IconCuenta, accion: () => abrirAlta({ tipo: "marca", cuentaId: contexto.id }) },
      { id: "c-reunion", label: "Reunión", icon: IconCalendario, accion: () => abrirAlta({ tipo: "evento", valores: { cuenta_id: contexto.id } }) },
      { id: "c-nota", label: "Nota", icon: IconSeguimientos, accion: () => pedirPestana("notas") }
    );
  } else if (esAdmin && contexto?.tipo === "marca") {
    propias.push(
      {
        id: "m-proyecto",
        label: "Proyecto",
        icon: IconProyectos,
        accion: () => abrirAlta({ tipo: "proyecto", valores: { cuenta_id: contexto.cuentaId, marca_id: contexto.id } }),
      },
      { id: "m-tarea", label: "Tarea", icon: IconTareas, accion: () => abrirAlta({ tipo: "tarea", cuentaId: contexto.cuentaId }) }
    );
  } else if (esAdmin && contexto?.tipo === "proyecto") {
    propias.push({
      id: "p-tarea",
      label: "Tarea",
      icon: IconTareas,
      accion: () => abrirAlta({ tipo: "tarea", valores: { proyecto_id: contexto.id } }),
    });
    if (!contexto.esSubproyecto) {
      propias.push({
        id: "p-sub",
        label: "Subproyecto",
        icon: IconProyectos,
        accion: () => abrirAlta({ tipo: "proyecto", valores: { proyecto_padre_id: contexto.id } }),
      });
    }
    propias.push(
      { id: "p-enlace", label: "Enlace", icon: IconEnlace, accion: () => pedirPestana("enlaces") },
      { id: "p-nota", label: "Nota", icon: IconSeguimientos, accion: () => pedirPestana("notas") }
    );
  }

  const generales: Opcion[] = [];
  if (esAdmin) generales.push({ id: "proyecto", label: "Proyecto", icon: IconProyectos, accion: () => abrirAlta({ tipo: "proyecto" }) });
  generales.push({ id: "tarea", label: "Tarea", icon: IconTareas, accion: () => abrirAlta({ tipo: "tarea" }) });
  generales.push({ id: "lead", label: "Lead", icon: IconLeads, accion: () => router.push("/leads/nuevo") });
  if (esAdmin) {
    generales.push(
      { id: "cuenta", label: "Cuenta", icon: IconCuenta, accion: () => abrirAlta({ tipo: "cuenta" }) },
      { id: "reunion", label: "Reunión o evento", icon: IconCalendario, accion: () => abrirAlta({ tipo: "evento" }) }
    );
  }

  return { contexto: propias.length && contexto ? contexto.nombre : null, propias, generales };
}

export function ListaOpcionesAnadir({ onElegir }: { onElegir?: () => void }) {
  const { contexto, propias, generales } = useOpcionesAnadir();

  const boton = (o: Opcion) => {
    const Icon = o.icon;
    return (
      <button
        key={o.id}
        type="button"
        onClick={() => {
          onElegir?.();
          o.accion();
        }}
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink hover:bg-mute"
      >
        <Icon className="h-4 w-4 text-ink2" />
        {o.label}
      </button>
    );
  };

  return (
    <div className="flex flex-col p-1">
      {propias.length ? (
        <>
          <p className="truncate px-2.5 pb-1 pt-1.5 text-[11px] font-medium text-ink3">En {contexto}</p>
          {propias.map(boton)}
          <div className="my-1 h-px bg-line" />
          <p className="px-2.5 pb-1 pt-1 text-[11px] font-medium text-ink3">General</p>
        </>
      ) : null}
      {generales.map(boton)}
    </div>
  );
}
