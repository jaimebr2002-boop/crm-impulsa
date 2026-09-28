"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listarUsuarios } from "@/lib/data/usuarios";
import type { TareaInsert, Usuario } from "@/lib/types";
import { useUsuario } from "./UsuarioContext";

export type Aviso = { id: number; texto: string; tono?: "ok" | "error"; enlace?: { href: string; texto: string } };

export type AltaRapida =
  | { tipo: "proyecto"; valores?: { cuenta_id?: string | null; marca_id?: string | null; proyecto_padre_id?: string | null } }
  | {
      tipo: "tarea";
      valores?: Partial<Pick<TareaInsert, "proyecto_id" | "lead_id" | "fecha_limite">>;
      /** Limita el selector de proyecto a los de esta cuenta. */
      cuentaId?: string;
    }
  | { tipo: "cuenta" }
  | { tipo: "marca"; cuentaId?: string }
  | { tipo: "evento"; valores?: { fecha?: string; cuenta_id?: string | null; proyecto_id?: string | null } };

/** Dónde está el usuario: lo fija cada ficha para que "+ Añadir" y la paleta
 * ofrezcan acciones con sentido en ese sitio. */
export type ContextoPantalla =
  | { tipo: "cuenta"; id: string; nombre: string }
  | { tipo: "marca"; id: string; nombre: string; cuentaId: string }
  | { tipo: "proyecto"; id: string; nombre: string; cuentaId: string | null; marcaId: string | null; esSubproyecto: boolean };

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
  contexto: ContextoPantalla | null;
  setContexto: (c: ContextoPantalla | null) => void;
  /** Petición de abrir una pestaña de la ficha actual (p. ej. "notas" desde + Añadir). */
  pestanaPedida: { tab: string; n: number } | null;
  pedirPestana: (tab: string) => void;
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
  const [contexto, setContexto] = useState<ContextoPantalla | null>(null);
  const [pestanaPedida, setPestanaPedida] = useState<{ tab: string; n: number } | null>(null);
  const pedirPestana = useCallback((tab: string) => setPestanaPedida({ tab, n: Date.now() }), []);

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
        contexto,
        setContexto,
        pestanaPedida,
        pedirPestana,
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

/** Fija el contexto de pantalla mientras la ficha está montada. */
export function useContextoPantalla(c: ContextoPantalla | null) {
  const { setContexto } = useApp();
  const clave = c ? JSON.stringify(c) : "";
  useEffect(() => {
    setContexto(c);
    return () => setContexto(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, setContexto]);
}

/** Ejecuta `abrir(tab)` cuando alguien pide una pestaña (desde + Añadir). */
export function usePestanaPedida(abrir: (tab: string) => void) {
  const { pestanaPedida } = useApp();
  useEffect(() => {
    if (pestanaPedida) abrir(pestanaPedida.tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestanaPedida]);
}
