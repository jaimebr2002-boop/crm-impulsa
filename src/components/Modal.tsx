"use client";

import { useEffect, useRef, type ReactNode } from "react";

const ENFOCABLES = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal del sistema: Esc y clic fuera cierran, foco inicial dentro, foco
 * atrapado (Tab/Shift+Tab) y devuelto al elemento que lo abrió al cerrar.
 * En móvil se presenta como hoja inferior con safe area.
 */
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
  const caja = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const el = caja.current;
    // Foco inicial: el primer campo con autoFocus o el primer enfocable (que no sea el botón de cerrar).
    const t = setTimeout(() => {
      if (!el || el.contains(document.activeElement)) return;
      const lista = Array.from(el.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((x) => x.dataset.cerrar === undefined);
      (lista[0] ?? el).focus();
    }, 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        cerrar.current();
        return;
      }
      if (e.key !== "Tab" || !el) return;
      const lista = Array.from(el.querySelectorAll<HTMLElement>(ENFOCABLES)).filter((x) => x.offsetParent !== null);
      if (!lista.length) return;
      const primero = lista[0];
      const ultimo = lista[lista.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={onClose}>
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={`max-h-[90dvh] w-full ${ancho} overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] shadow-2xl outline-none md:rounded-xl md:pb-5`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-ink">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" data-cerrar className="-mr-1 rounded-md p-1.5 text-ink3 hover:bg-mute hover:text-ink">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
