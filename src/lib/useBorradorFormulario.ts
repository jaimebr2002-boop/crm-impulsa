"use client";

import { useEffect, useState } from "react";

const PREFIJO = "crm-impulsa:borrador:";

/**
 * Estado de formulario respaldado en localStorage bajo una clave estable
 * (`storageKey`), para que lo escrito no se pierda si el usuario cambia de
 * pestaña, minimiza la ventana o cierra el navegador antes de guardar.
 *
 * `valorInicial` solo se usa si no hay ya un borrador guardado bajo esa
 * clave — así una edición interrumpida se restaura tal cual se dejó, en
 * vez de perderse frente a los datos frescos del servidor.
 *
 * Se lee de localStorage en el propio inicializador de useState (no en un
 * efecto) para que el primer render ya muestre el borrador restaurado, sin
 * parpadeo de campos vacíos.
 */
export function useBorradorFormulario<T extends object>(storageKey: string, valorInicial: T) {
  const clave = PREFIJO + storageKey;

  const [valores, setValores] = useState<T>(() => {
    if (typeof window === "undefined") return valorInicial;
    try {
      const guardado = window.localStorage.getItem(clave);
      if (guardado) return { ...valorInicial, ...JSON.parse(guardado) } as T;
    } catch {
      // Borrador corrupto o localStorage no disponible: se ignora y se
      // arranca con los valores iniciales, sin romper el formulario.
    }
    return valorInicial;
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(clave, JSON.stringify(valores));
    } catch {
      // localStorage lleno, en modo privado, etc.: el formulario sigue
      // funcionando con normalidad, simplemente sin persistencia.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, valores]);

  function limpiarBorrador() {
    try {
      window.localStorage.removeItem(clave);
    } catch {
      // no-op
    }
  }

  return [valores, setValores, limpiarBorrador] as const;
}
