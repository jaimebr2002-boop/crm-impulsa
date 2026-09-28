"use client";

import { useState } from "react";
import type { EstadoTarea, TareaConRelaciones, TareaUpdate } from "@/lib/types";
import { ESTADOS_TAREA, ESTADO_TAREA_LABEL } from "@/lib/trabajo";
import { Modal } from "../Modal";
import { TareaForm } from "../forms/TareaForm";
import { Segmentado } from "../ui/Cabecera";

export function TareaEditarModal({
  tarea,
  onCerrar,
  onGuardar,
  onEliminar,
}: {
  tarea: TareaConRelaciones;
  onCerrar: () => void;
  onGuardar: (t: TareaConRelaciones, cambios: TareaUpdate) => Promise<unknown>;
  onEliminar: (t: TareaConRelaciones) => void;
}) {
  const [estado, setEstado] = useState<EstadoTarea>(tarea.estado);
  const [confirmando, setConfirmando] = useState(false);

  return (
    <Modal titulo="Tarea" onClose={onCerrar} ancho="max-w-lg">
      <div className="mb-4 overflow-x-auto">
        <Segmentado
          opciones={ESTADOS_TAREA.map((e) => ({ id: e, label: ESTADO_TAREA_LABEL[e] }))}
          valor={estado}
          onChange={setEstado}
        />
      </div>
      <TareaForm
        botonTexto="Guardar"
        valoresIniciales={{
          titulo: tarea.titulo,
          descripcion: tarea.descripcion,
          fecha_limite: tarea.fecha_limite,
          prioridad: tarea.prioridad,
          proyecto_id: tarea.proyecto_id,
          responsable_id: tarea.responsable_id,
        }}
        onCancelar={onCerrar}
        onSubmit={async (v) => {
          await onGuardar(tarea, { ...v, estado });
          onCerrar();
        }}
      />
      <div className="mt-4 border-t border-line pt-3">
        {confirmando ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink2">¿Eliminar esta tarea?</span>
            <span className="flex gap-2">
              <button onClick={() => setConfirmando(false)} className="btn-ghost">
                No
              </button>
              <button
                onClick={() => {
                  onEliminar(tarea);
                  onCerrar();
                }}
                className="btn-danger"
              >
                Eliminar
              </button>
            </span>
          </div>
        ) : (
          <button onClick={() => setConfirmando(true)} className="text-sm text-red-600 hover:underline dark:text-red-400">
            Eliminar tarea
          </button>
        )}
      </div>
    </Modal>
  );
}
