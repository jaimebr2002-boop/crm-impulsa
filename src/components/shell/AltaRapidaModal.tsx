"use client";

import { useApp } from "@/context/AppContext";
import { crearProyecto } from "@/lib/data/proyectos";
import { crearTarea } from "@/lib/data/tareas";
import { Modal } from "../Modal";
import { ProyectoForm } from "../forms/ProyectoForm";
import { TareaForm } from "../forms/TareaForm";

/** Alta rápida global: se abre desde "+ Añadir", la paleta o cualquier
 * pantalla con `abrirAlta(...)`. */
export function AltaRapidaModal() {
  const { altaRapida, cerrarAlta, notificarCambio, avisar } = useApp();
  if (!altaRapida) return null;

  if (altaRapida.tipo === "proyecto") {
    return (
      <Modal titulo="Nuevo proyecto" onClose={cerrarAlta} ancho="max-w-lg">
        <ProyectoForm
          valoresIniciales={altaRapida.valores}
          onCancelar={cerrarAlta}
          onSubmit={async (v) => {
            const p = await crearProyecto(v);
            cerrarAlta();
            notificarCambio();
            avisar(`Proyecto «${p.nombre}» creado`, { enlace: { href: `/proyectos/${p.id}`, texto: "Abrir" } });
          }}
        />
      </Modal>
    );
  }

  return (
    <Modal titulo="Nueva tarea" onClose={cerrarAlta} ancho="max-w-lg">
      <TareaForm
        valoresIniciales={altaRapida.valores}
        ocultarProyecto={!!altaRapida.valores?.proyecto_id}
        onCancelar={cerrarAlta}
        onSubmit={async (v) => {
          await crearTarea(v);
          cerrarAlta();
          notificarCambio();
          avisar("Tarea creada");
        }}
      />
    </Modal>
  );
}
