"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LoadingState } from "@/components/LoadingState";

export default function ActualizarPasswordPage() {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const [sesionValida, setSesionValida] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    // El cliente de Supabase procesa el token del enlace de invitación/recuperación
    // (va en el fragmento #, nunca llega al servidor) y crea la sesión automáticamente.
    supabase.auth.getSession().then(({ data }) => {
      setSesionValida(Boolean(data.session));
      setListo(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError("No se ha podido guardar la contraseña. Vuelve a solicitar el enlace de invitación.");
        return;
      }
      setExito(true);
      setTimeout(() => {
        router.replace("/inicio");
        router.refresh();
      }, 1200);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-brand-light px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark">Impulsa Studio</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Crea tu contraseña</h1>
          <p className="mt-1 text-sm text-ink2">Es la única vez que la necesitarás introducir aquí</p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
          {!listo ? (
            <LoadingState texto="Comprobando enlace…" />
          ) : !sesionValida ? (
            <div className="space-y-3">
              <p className="field-error">
                Este enlace no es válido o ha caducado. Vuelve a solicitar uno desde el inicio de sesión.
              </p>
              <a href="/login" className="text-sm text-brand-dark underline underline-offset-4">
                Volver al inicio de sesión
              </a>
            </div>
          ) : exito ? (
            <p className="text-sm font-medium text-emerald-600">Contraseña guardada. Entrando…</p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="block">
                <span className="field-label">Nueva contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Mínimo 8 caracteres"
                  required
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="field-label">Confirmar contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmar}
                  onChange={(e) => setConfirmar(e.target.value)}
                  className="input"
                  required
                />
              </label>

              {error ? <p className="field-error">{error}</p> : null}

              <button
                type="submit"
                disabled={enviando}
                className="btn-primary mt-2 w-full py-2.5"
              >
                {enviando ? "Guardando…" : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
