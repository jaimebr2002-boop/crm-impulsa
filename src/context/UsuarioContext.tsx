"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { borrarUsuarioGuardado, getUsuarioIdGuardado, guardarUsuarioId } from "@/lib/user";
import type { Usuario } from "@/lib/types";

type UsuarioContextValue = {
  usuarios: Usuario[];
  usuarioActual: Usuario | null;
  cargando: boolean;
  error: string | null;
  esJaime: boolean;
  seleccionarUsuario: (id: string) => void;
  cambiarUsuario: () => void;
};

const UsuarioContext = createContext<UsuarioContextValue | undefined>(undefined);

export function UsuarioProvider({ children }: { children: ReactNode }) {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const { data, error: err } = await supabase.from("usuarios").select("id, nombre").order("nombre");
        if (!activo) return;
        if (err) throw err;

        const lista = data ?? [];
        setUsuarios(lista);

        const guardadoId = getUsuarioIdGuardado();
        const encontrado = lista.find((u) => u.id === guardadoId) ?? null;
        setUsuarioActual(encontrado);
        setCargando(false);
      } catch {
        if (!activo) return;
        setError("No se ha podido conectar con la base de datos. Revisa la configuración de Supabase en .env.local.");
        setCargando(false);
      }
    })();
    return () => {
      activo = false;
    };
  }, []);

  const seleccionarUsuario = useCallback(
    (id: string) => {
      const usuario = usuarios.find((u) => u.id === id) ?? null;
      if (!usuario) return;
      guardarUsuarioId(id);
      setUsuarioActual(usuario);
    },
    [usuarios]
  );

  const cambiarUsuario = useCallback(() => {
    borrarUsuarioGuardado();
    setUsuarioActual(null);
  }, []);

  const esJaime = usuarioActual?.nombre.trim().toLowerCase() === "jaime";

  return (
    <UsuarioContext.Provider
      value={{ usuarios, usuarioActual, cargando, error, esJaime, seleccionarUsuario, cambiarUsuario }}
    >
      {children}
    </UsuarioContext.Provider>
  );
}

export function useUsuario(): UsuarioContextValue {
  const ctx = useContext(UsuarioContext);
  if (!ctx) throw new Error("useUsuario debe usarse dentro de UsuarioProvider");
  return ctx;
}
