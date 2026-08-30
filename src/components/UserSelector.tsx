"use client";

import { useUsuario } from "@/context/UsuarioContext";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { Avatar } from "./Avatar";

export function UserSelector() {
  const { usuarios, cargando, error, seleccionarUsuario } = useUsuario();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-light px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Impulsa Studio</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">¿Quién eres?</h1>
          <p className="mt-1 text-sm text-slate-500">Selecciona tu nombre para continuar</p>
        </div>

        {cargando ? <LoadingState /> : null}
        {error ? <ErrorState mensaje={error} /> : null}

        {!cargando && !error ? (
          <div className="flex flex-col gap-3">
            {usuarios.map((u) => (
              <button
                key={u.id}
                onClick={() => seleccionarUsuario(u.id)}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 text-left shadow-card active:scale-[0.99] active:bg-slate-50"
              >
                <span className="text-lg font-medium text-slate-900">{u.nombre}</span>
                <Avatar nombre={u.nombre} />
              </button>
            ))}
            {usuarios.length === 0 ? (
              <p className="text-center text-sm text-slate-400">
                No hay usuarios en la base de datos. Ejecuta el seed (supabase/seed.sql).
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
