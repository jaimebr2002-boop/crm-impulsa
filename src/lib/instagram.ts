/**
 * Normaliza un usuario/handle de Instagram a un formato consistente: sin
 * espacios, sin URL de perfil pegada por error, siempre con un único "@"
 * delante. Cadena vacía se mantiene vacía (campo opcional).
 */
export function normalizarInstagram(valor: string | null | undefined): string {
  if (!valor) return "";
  let v = valor.trim();
  if (!v) return "";
  v = v.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  v = v.replace(/\/+$/, "");
  v = v.replace(/^@+/, "");
  if (!v) return "";
  return `@${v}`;
}

export function instagramHref(instagram: string | null | undefined): string {
  if (!instagram) return "";
  const handle = instagram.trim().replace(/^@+/, "");
  if (!handle) return "";
  return `https://instagram.com/${handle}`;
}
