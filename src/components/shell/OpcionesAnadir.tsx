"use client";

import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { IconLeads, IconProyectos, IconTareas } from "../Icons";

type Opcion = { id: string; label: string; atajo?: string; icon: (p: { className?: string }) => React.ReactNode; accion: () => void };

/** Opciones del botón "+ Añadir". Ingresos, gastos y documentos se sumarán
 * aquí cuando existan esos módulos. */
export function useOpcionesAnadir(): Opcion[] {
  const { esAdmin } = useUsuario();
  const { abrirAlta } = useApp();
  const router = useRouter();

  const opciones: Opcion[] = [];
  if (esAdmin) opciones.push({ id: "proyecto", label: "Proyecto", icon: IconProyectos, accion: () => abrirAlta({ tipo: "proyecto" }) });
  opciones.push({ id: "tarea", label: "Tarea", icon: IconTareas, accion: () => abrirAlta({ tipo: "tarea" }) });
  opciones.push({ id: "lead", label: "Lead", icon: IconLeads, accion: () => router.push("/leads/nuevo") });
  return opciones;
}

export function ListaOpcionesAnadir({ onElegir }: { onElegir?: () => void }) {
  const opciones = useOpcionesAnadir();
  return (
    <div className="flex flex-col p-1">
      {opciones.map((o) => {
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
      })}
    </div>
  );
}
