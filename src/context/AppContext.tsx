"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listarUsuarios } from "@/lib/data/usuarios";
import type { TareaInsert, Usuario } from "@/lib/types";
import { useUsuario } from "./UsuarioContext";

export type Aviso = { id: number; texto: string; tono?: "ok" | "error"; enlace?: { href: string; texto: string } };

export type TipoAltaRapida = "proyecto" | "tarea";

export type AltaRapida =
  | { tipo: "proyecto"; valores?: { cuenta_id?: string } }
  | { tipo: "tarea"; valores?: Partial<Pick<TareaInsert, "proyecto_id" | "lead_id" | "fecha_limite">> };

type AppContextValue = {
  usuarios: Usuario[];
  usuariosPorId: Record<string, Usuario>;
  /** Paleta de comandos (⌘K). */
  paletaAbierta: boolean;
  setPaletaAbierta: (abierta: boolean) => void;
  /** Modal de alta rápida (proyecto / tarea) abierto desde cualquier sitio. */
  altaRapida: AltaRapida | null;
  abrirAlta: (alta: AltaRapida) => void;
  cerrarAlta: () => void;
  /** Se incrementa cada vez que algo se crea desde la shell: las páginas lo
   * usan como dependencia para recargar sus datos. */
  versionDatos: number;
  notificarCambio: () => void;
  /** Toast breve de confirmación o error. */
  aviso: Aviso | null;
  avisar: (texto: string, opciones?: Omit<Aviso, "id" | "texto">) => void;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { usuarioActual } = useUsuario();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [paletaAbierta, setPaletaAbierta] = useState(false);
  const [altaRapida, setAltaRapida] = useState<AltaRapida | null>(null);
  const [versionDatos, setVersionDatos] = useState(0);
  const [aviso, setAviso] = useState<Aviso | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), aviso.enlace ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const avisar = useCallback((texto: string, opciones?: Omit<Aviso, "id" | "texto">) => {
    setAviso({ id: Date.now(), texto, ...opciones });
  }, []);

  // La lista de usuarios cambia rarísima vez: se pide una sola vez por sesión.
  useEffect(() => {
    if (!usuarioActual) return;
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, [usuarioActual]);

  // ⌘K / Ctrl+K abre la paleta desde cualquier pantalla.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAbierta((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const usuariosPorId = useMemo(() => {
    const m: Record<string, Usuario> = {};
    for (const u of usuarios) m[u.id] = u;
    return m;
  }, [usuarios]);

  const abrirAlta = useCallback((alta: AltaRapida) => {
    setPaletaAbierta(false);
    setAltaRapida(alta);
  }, []);
  const cerrarAlta = useCallback(() => setAltaRapida(null), []);
  const notificarCambio = useCallback(() => setVersionDatos((v) => v + 1), []);

  return (
    <AppContext.Provider
      value={{
        usuarios,
        usuariosPorId,
        paletaAbierta,
        setPaletaAbierta,
        altaRapida,
        abrirAlta,
        cerrarAlta,
        versionDatos,
        notificarCambio,
        aviso,
        avisar,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp debe usarse dentro de AppProvider");
  return ctx;
}
