"use client";

import Link from "next/link";
import { useUsuario } from "@/context/UsuarioContext";
import { useTheme } from "@/context/ThemeContext";
import { LoadingState } from "@/components/LoadingState";
import { IconChevron, IconAnalitica, IconImportar } from "@/components/Icons";
import { Avatar } from "@/components/Avatar";

const ROL_LABEL: Record<string, string> = {
  admin: "Administrador",
  comercial: "Comercial",
};

export default function PerfilPage() {
  const { usuarioActual, cargando, cerrarSesion } = useUsuario();
  const { tema, alternarTema } = useTheme();

  if (cargando || !usuarioActual) return <LoadingState />;

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-6 md:px-8">
      <h1 className="mb-5 font-display text-2xl font-bold text-ink">Perfil</h1>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar nombre={usuarioActual.nombre} size="lg" />
        <div>
          <p className="text-lg font-semibold text-ink">{usuarioActual.nombre}</p>
          <p className="text-sm text-ink2">{ROL_LABEL[usuarioActual.rol] ?? usuarioActual.rol}</p>
          <p className="text-xs text-ink3">{usuarioActual.email}</p>
        </div>
      </div>

      <div className="mb-6 overflow-hidden rounded-2xl border border-line bg-surface">
        <Link href="/analitica" className="flex items-center justify-between px-5 py-4 text-sm font-medium text-ink">
          <span className="flex items-center gap-2.5">
            <IconAnalitica className="h-4 w-4 text-ink3" />
            Analítica
          </span>
          <IconChevron className="h-4 w-4 text-ink3" />
        </Link>
        <Link
          href="/importar"
          className="flex items-center justify-between border-t border-line px-5 py-4 text-sm font-medium text-ink"
        >
          <span className="flex items-center gap-2.5">
            <IconImportar className="h-4 w-4 text-ink3" />
            Importar leads
          </span>
          <IconChevron className="h-4 w-4 text-ink3" />
        </Link>
        <button
          onClick={alternarTema}
          className="flex w-full items-center justify-between border-t border-line px-5 py-4 text-left text-sm font-medium text-ink"
        >
          Apariencia
          <span className="text-xs text-ink3">{tema === "dark" ? "Oscuro" : "Claro"}</span>
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <button
          onClick={cerrarSesion}
          className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-medium text-red-600"
        >
          Cerrar sesión
          <IconChevron className="h-4 w-4 text-red-300" />
        </button>
      </div>
    </div>
  );
}
