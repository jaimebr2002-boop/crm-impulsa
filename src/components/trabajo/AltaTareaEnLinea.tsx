"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { IconMas } from "../Icons";

/** Alta de tareas encadenada: escribir + Enter, sin abrir ningún modal. */
export function AltaTareaEnLinea({ onCrear, placeholder = "Añadir tarea y pulsar Enter" }: { onCrear: (titulo: string) => Promise<void>; placeholder?: string }) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const { avisar } = useApp();

  async function enviar() {
    const titulo = texto.trim();
    if (!titulo || enviando) return;
    setEnviando(true);
    try {
      await onCrear(titulo);
      setTexto("");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido crear la tarea.", { tono: "error" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-3 py-2 focus-within:border-solid focus-within:border-brand">
      <IconMas className="h-4 w-4 shrink-0 text-ink3" />
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            enviar();
          }
        }}
        disabled={enviando}
        placeholder={placeholder}
        className="w-full bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-ink3"
      />
    </div>
  );
}

