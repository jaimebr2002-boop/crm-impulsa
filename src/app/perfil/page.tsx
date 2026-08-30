"use client";

import Link from "next/link";
import { useUsuario } from "@/context/UsuarioContext";
import { LoadingState } from "@/components/LoadingState";
import { IconChevron } from "@/components/Icons";
import { Avatar } from "@/components/Avatar";

export default function PerfilPage() {
  const { usuarioActual, cargando, cambiarUsuario } = useUsuario();

  if (cargando || !usuarioActual) return <LoadingState />;

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-6 md:px-8">
      <h1 className="mb-5 text-2xl font-semibold text-slate-900">Perfil</h1>

      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5">
        <Avatar nombre={usuarioActual.nombre} size="lg" />
        <div>
          <p className="text-lg font-semibold text-slate-900">{usuarioActual.nombre}</p>
          <p className="text-sm text-slate-500">Impulsa Studio</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <Link href="/importar" className="flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-700">
          Importar leads históricos
          <IconChevron className="h-4 w-4 text-slate-300" />
        </Link>
        <button
          onClick={cambiarUsuario}
          className="flex w-full items-center justify-between border-t border-slate-100 px-5 py-4 text-left text-sm font-medium text-red-600"
        >
          Cambiar de usuario
          <IconChevron className="h-4 w-4 text-red-300" />
        </button>
      </div>
    </div>
  );
}
