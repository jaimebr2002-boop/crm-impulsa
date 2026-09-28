"use client";

import { useApp } from "@/context/AppContext";
import { crearCuenta, crearMarca } from "@/lib/data/cuentas";
import { crearEvento } from "@/lib/data/eventos";
import { crearProyecto } from "@/lib/data/proyectos";
import { crearTarea } from "@/lib/data/tareas";
import { Modal } from "../Modal";
import { ProyectoForm } from "../forms/ProyectoForm";
import { TareaForm } from "../forms/TareaForm";
import { CuentaForm } from "../forms/CuentaForm";
import { MarcaForm } from "../forms/MarcaForm";
import { EventoGenericoForm } from "../forms/EventoGenericoForm";

/** Alta rápida global: se abre desde "+ Añadir", la paleta o cualquier
 * pantalla con `abrirAlta(...)`. */
export function AltaRapidaModal() {
  const { altaRapida: alta, cerrarAlta, notificarCambio, avisar } = useApp();
  if (!alta) return null;

  const hecho = (texto: string, enlace?: { href: string; texto: string }) => {
    cerrarAlta();
    notificarCambio();
    avisar(texto, enlace ? { enlace } : undefined);
  };

  switch (alta.tipo) {
    case "proyecto":
      return (
        <Modal titulo={alta.valores?.proyecto_padre_id ? "Nuevo subproyecto" : "Nuevo proyecto"} onClose={cerrarAlta} ancho="max-w-lg">
          <ProyectoForm
            valoresIniciales={alta.valores}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const p = await crearProyecto(v);
              hecho(`Proyecto «${p.nombre}» creado`, { href: `/proyectos/${p.id}`, texto: "Abrir" });
            }}
          />
        </Modal>
      );
    case "tarea":
      return (
        <Modal titulo="Nueva tarea" onClose={cerrarAlta} ancho="max-w-lg">
          <TareaForm
            valoresIniciales={alta.valores}
            ocultarProyecto={!!alta.valores?.proyecto_id}
            cuentaId={alta.cuentaId}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              await crearTarea(v);
              hecho("Tarea creada");
            }}
          />
        </Modal>
      );
    case "cuenta":
      return (
        <Modal titulo="Nueva cuenta" onClose={cerrarAlta}>
          <CuentaForm
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const c = await crearCuenta(v);
              hecho(`Cuenta «${c.nombre}» creada`, { href: `/cuentas/${c.id}`, texto: "Abrir" });
            }}
          />
        </Modal>
      );
    case "marca":
      return (
        <Modal titulo="Nueva marca" onClose={cerrarAlta}>
          <MarcaForm
            inicial={alta.cuentaId ? { cuenta_id: alta.cuentaId } : undefined}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              const m = await crearMarca(v);
              hecho(`Marca «${m.nombre}» creada`, { href: `/marcas/${m.id}`, texto: "Abrir" });
            }}
          />
        </Modal>
      );
    case "evento":
      return (
        <Modal titulo="Nueva reunión o evento" onClose={cerrarAlta} ancho="max-w-lg">
          <EventoGenericoForm
            inicial={alta.valores}
            onCancelar={cerrarAlta}
            onSubmit={async (v) => {
              await crearEvento(v);
              hecho("Añadido al calendario", { href: "/calendario", texto: "Ver" });
            }}
          />
        </Modal>
      );
  }
}
