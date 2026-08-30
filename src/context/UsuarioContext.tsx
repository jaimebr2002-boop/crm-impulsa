"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Usuario } from "@/lib/types";

type UsuarioContextValue = {
  usuarioActual: Usuario | null;
  cargando: boolean;
  error: string | null;
  esAdmin: boolean;
  cerrarSesion: () => Promise<void>;
};

const UsuarioContext = createContext<UsuarioContextValue | undefined>(undefined);

export function UsuarioProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [usuarioActual, setUsuarioActual] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarPerfil = useCallback(async (userId: string) => {
    const { data, error: err } = await supabase
      .from("usuarios")
      .select("id, nombre, email, rol")
      .eq("id", userId)
      .maybeSingle();
    if (err) {
      setError("No se ha podido cargar tu perfil. Contacta con el administrador.");
      setUsuarioActual(null);
      return;
    }
    setUsuarioActual(data);
    setError(data ? null : "Tu cuenta no tiene un perfil asociado en el CRM. Contacta con el administrador.");
  }, []);

  useEffect(() => {
    let activo = true;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!activo) return;
      if (session?.user) {
        await cargarPerfil(session.user.id);
      }
      if (activo) setCargando(false);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_evento, session) => {
      if (!activo) return;
      if (session?.user) {
        setCargando(true);
        await cargarPerfil(session.user.id);
        setCargando(false);
      } else {
        setUsuarioActual(null);
        setCargando(false);
      }
    });

    return () => {
      activo = false;
      listener.subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
    setUsuarioActual(null);
    router.push("/login");
  }, [router]);

  const esAdmin = usuarioActual?.rol === "admin";

  return (
    <UsuarioContext.Provider value={{ usuarioActual, cargando, error, esAdmin, cerrarSesion }}>
      {children}
    </UsuarioContext.Provider>
  );
}

export function useUsuario(): UsuarioContextValue {
  const ctx = useContext(UsuarioContext);
  if (!ctx) throw new Error("useUsuario debe usarse dentro de UsuarioProvider");
  return ctx;
}
