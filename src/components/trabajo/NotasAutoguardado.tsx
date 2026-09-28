"use client";

import { useEffect, useRef, useState } from "react";

/** Notas libres con guardado automático al dejar de escribir. */
export function NotasAutoguardado({
  inicial,
  onGuardar,
  placeholder = "Apuntes, feedback del cliente, ideas… (credenciales no: usa un gestor de contraseñas)",
}: {
  inicial: string;
  onGuardar: (notas: string) => Promise<void>;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState(inicial);
  const [estado, setEstado] = useState<"guardado" | "pendiente" | "guardando" | "error">("guardado");
  const ultimo = useRef(inicial);
  const guardarRef = useRef(onGuardar);
  guardarRef.current = onGuardar;

  useEffect(() => {
    if (texto === ultimo.current) return;
    setEstado("pendiente");
    const t = setTimeout(async () => {
      setEstado("guardando");
      try {
        await guardarRef.current(texto);
        ultimo.current = texto;
        setEstado("guardado");
      } catch {
        setEstado("error");
      }
    }, 800);
    return () => clearTimeout(t);
  }, [texto]);

  const etiqueta = { guardado: "Guardado", pendiente: "Sin guardar…", guardando: "Guardando…", error: "Error al guardar" }[estado];

  return (
    <div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="min-h-[320px] w-full resize-y rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink outline-none focus:border-brand"
      />
      <p className={`mt-1 text-right text-xs ${estado === "error" ? "text-red-600" : "text-ink3"}`}>
        {etiqueta}
      </p>
    </div>
  );
}
