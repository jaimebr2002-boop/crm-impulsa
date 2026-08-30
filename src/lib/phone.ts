/**
 * En España, los números fijos empiezan por 8 o 9; los móviles por 6 o 7.
 * No pueden recibir WhatsApp. Esta función normaliza el prefijo internacional
 * (+34 / 0034) y espacios/guiones antes de comprobar el primer dígito.
 */
export function esTelefonoFijoEspanol(telefono: string | null | undefined): boolean {
  if (!telefono) return false;

  let normalizado = telefono.trim().replace(/[\s-]/g, "");
  normalizado = normalizado.replace(/^\+34/, "").replace(/^0034/, "");

  if (!/^\d{9}$/.test(normalizado)) return false;

  return normalizado[0] === "8" || normalizado[0] === "9";
}

export function telHref(telefono: string | null | undefined): string {
  if (!telefono) return "";
  return `tel:${telefono.trim().replace(/\s+/g, "")}`;
}

export function whatsappHref(telefono: string | null | undefined): string {
  if (!telefono) return "";
  let normalizado = telefono.trim().replace(/[\s-]/g, "");
  if (normalizado.startsWith("+")) {
    normalizado = normalizado.slice(1);
  } else if (normalizado.startsWith("0034")) {
    normalizado = normalizado.slice(2);
  } else if (/^\d{9}$/.test(normalizado)) {
    normalizado = `34${normalizado}`;
  }
  return `https://wa.me/${normalizado}`;
}
