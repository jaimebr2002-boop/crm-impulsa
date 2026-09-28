"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useUsuario } from "@/context/UsuarioContext";
import { LoadingState } from "../LoadingState";

/** Módulos de negocio: RLS ya impide leer los datos, esto solo evita que un
 * comercial aterrice en una pantalla vacía y lo lleva a su CRM. */
export function SoloAdmin({ children }: { children: ReactNode }) {
  const { esAdmin, cargando } = useUsuario();
  const router = useRouter();

  useEffect(() => {
    if (!cargando && !esAdmin) router.replace("/hoy");
  }, [cargando, esAdmin, router]);

  if (cargando || !esAdmin) return <LoadingState />;
  return <>{children}</>;
}
