const STORAGE_KEY = "crm-impulsa:usuario-id";

export function getUsuarioIdGuardado(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function guardarUsuarioId(id: string): void {
  window.localStorage.setItem(STORAGE_KEY, id);
}

export function borrarUsuarioGuardado(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
