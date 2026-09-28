"use client";

import { useEffect, type ReactNode } from "react";

export function Modal({
  titulo,
  onClose,
  children,
  ancho = "max-w-md",
}: {
  titulo: string;
  onClose: () => void;
  children: ReactNode;
  ancho?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`max-h-[90dvh] w-full ${ancho} overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-2xl md:rounded-2xl md:pb-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-lg p-1 text-xl leading-none text-ink3 hover:bg-mute">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
