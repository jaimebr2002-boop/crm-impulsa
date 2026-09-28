"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import {
  IconCalendario,
  IconCheck,
  IconCuenta,
  IconDocumento,
  IconEnlace,
  IconFinanzas,
  IconLeads,
  IconRecibo,
  IconProyectos,
  IconSeguimientos,
  IconTareas,
} from "../Icons";

type Opcion = {
  id: string;
  label: string;
  icon: (p: { className?: string }) => ReactNode;
  accion: () => void;
  /** Texto en la command palette si "Nuevo: …" no suena natural. */
  enPaleta?: string;
};

/** Opciones de "+ Añadir": primero las propias del sitio donde estás (cuenta,
 * marca, proyecto o factura) y después las generales. Finanzas y documentos
 * son solo para admin. */
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
      { id: "c-factura", label: "Factura", icon: IconFinanzas, accion: () => abrirAlta({ tipo: "factura", cuentaId: contexto.id }) },
      {
        id: "c-documento",
        label: "Documento",
        icon: IconDocumento,
        accion: () => abrirAlta({ tipo: "documento", relacion: { tipo: "cuenta", id: contexto.id, etiqueta: contexto.nombre }, relacionFija: true }),
      },
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
      {
        id: "p-factura",
        label: "Añadir a factura",
        icon: IconFinanzas,
        accion: () => abrirAlta({ tipo: "factura", cuentaId: contexto.cuentaId ?? undefined, proyectoIds: [contexto.id] }),
      },
      {
        id: "p-gasto",
        label: "Gasto",
        icon: IconRecibo,
        accion: () => abrirAlta({ tipo: "gasto", valores: { proyecto_id: contexto.id, cuenta_id: contexto.cuentaId ?? undefined } }),
      },
      {
        id: "p-archivo",
        label: "Archivo",
        icon: IconDocumento,
        accion: () => abrirAlta({ tipo: "documento", relacion: { tipo: "proyecto", id: contexto.id, etiqueta: contexto.nombre }, relacionFija: true }),
      },
      { id: "p-enlace", label: "Enlace", icon: IconEnlace, accion: () => pedirPestana("enlaces") },
      { id: "p-nota", label: "Nota", icon: IconSeguimientos, accion: () => pedirPestana("notas") }
    );
  } else if (esAdmin && contexto?.tipo === "factura") {
    if (contexto.pendiente > 0)
      propias.push({ id: "f-cobro", label: "Registrar cobro", icon: IconCheck, accion: () => abrirAlta({ tipo: "cobro", facturaId: contexto.id }) });
    propias.push(
      { id: "f-pdf", label: "Generar PDF", icon: IconDocumento, accion: () => pedirPestana("generar-pdf") },
      {
        id: "f-documento",
        label: "Adjuntar documento",
        icon: IconDocumento,
        accion: () => abrirAlta({ tipo: "documento", relacion: { tipo: "factura", id: contexto.id, etiqueta: contexto.nombre }, relacionFija: true }),
      }
    );
  }

  const generales: Opcion[] = [];
  if (esAdmin) generales.push({ id: "proyecto", label: "Proyecto", icon: IconProyectos, accion: () => abrirAlta({ tipo: "proyecto" }) });
  generales.push({ id: "tarea", label: "Tarea", icon: IconTareas, accion: () => abrirAlta({ tipo: "tarea" }) });
  generales.push({ id: "lead", label: "Lead", icon: IconLeads, accion: () => router.push("/leads/nuevo") });
  if (esAdmin) {
    generales.push(
      { id: "factura", label: "Factura", icon: IconFinanzas, accion: () => abrirAlta({ tipo: "factura" }), enPaleta: "Crear factura" },
      { id: "gasto", label: "Gasto", icon: IconRecibo, accion: () => abrirAlta({ tipo: "gasto" }), enPaleta: "Registrar gasto" },
      { id: "cobro", label: "Cobro", icon: IconCheck, accion: () => abrirAlta({ tipo: "cobro" }), enPaleta: "Registrar cobro" },
      { id: "documento", label: "Documento", icon: IconDocumento, accion: () => abrirAlta({ tipo: "documento" }), enPaleta: "Subir documento" },
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
