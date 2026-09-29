"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

const MENSAJES_ERROR: Record<string, string> = {
  "Invalid login credentials": "Email o contraseña incorrectos.",
  "Email not confirmed": "Confirma tu email antes de iniciar sesión.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [solicitandoRecuperacion, setSolicitandoRecuperacion] = useState(false);
  const [recuperacionEnviada, setRecuperacionEnviada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        setError(MENSAJES_ERROR[err.message] ?? "No se ha podido iniciar sesión. Inténtalo de nuevo.");
        return;
      }
      router.replace("/inicio");
      router.refresh();
    } finally {
      setEnviando(false);
    }
  }

  async function handleRecuperarPassword() {
    const correo = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(correo)) {
      setError("Escribe un email válido para enviarte el enlace de recuperación.");
      setRecuperacionEnviada(false);
      return;
    }

    if (solicitandoRecuperacion) return;
    setSolicitandoRecuperacion(true);
    setError(null);
    setRecuperacionEnviada(false);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(correo, {
        redirectTo: `${window.location.origin}/auth/callback?next=/actualizar-password`,
      });
      if (err) {
        if (/rate limit|too many requests|only request this after|over_email_send_rate_limit/i.test(err.message)) {
          setError("Has pedido varios enlaces seguidos. Revisa tu correo y usa el enlace más reciente; espera un minuto antes de solicitar otro.");
          return;
        }
        setError("No se ha podido enviar el enlace. Inténtalo de nuevo más tarde.");
        return;
      }
      // Supabase devuelve éxito aunque el email no pertenezca a una cuenta.
      setRecuperacionEnviada(true);
    } finally {
      setSolicitandoRecuperacion(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-canvas px-6">
      <div className="blob-bg -left-40 -top-40 h-[420px] w-[420px]" style={{ background: "var(--blob1)" }} />
      <div className="blob-bg -bottom-48 -right-32 h-[480px] w-[480px]" style={{ background: "var(--blob2)" }} />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={40} />
          <h1 className="mt-4 font-display text-2xl font-semibold text-ink">Bienvenido de nuevo</h1>
          <p className="mt-1 text-sm text-ink2">Accede a tu panel de Impulsa Studio</p>
        </div>

        <form onSubmit={handleSubmit} className="glass-strong flex flex-col gap-4 rounded-xl p-6 shadow-lg">
          <label className="block">
            <span className="field-label">Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="tu@impulsa.studio"
              required
              autoFocus
            />
          </label>

          <label className="block">
            <span className="field-label">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••"
              required
            />
          </label>

          <div className="-mt-2 text-right">
            <button
              type="button"
              onClick={handleRecuperarPassword}
              disabled={solicitandoRecuperacion}
              className="text-sm text-ink2 underline-offset-4 hover:text-ink hover:underline disabled:opacity-60"
            >
              {solicitandoRecuperacion ? "Enviando enlace…" : "¿Has olvidado tu contraseña?"}
            </button>
          </div>

          {recuperacionEnviada ? (
            <p className="text-sm text-emerald-600">
              Si ese email está registrado, recibirás un enlace para crear una contraseña nueva.
            </p>
          ) : null}

          {error ? <p className="field-error">{error}</p> : null}

          <button
            type="submit"
            disabled={enviando}
            className="btn-primary mt-2 w-full py-2.5"
          >
            {enviando ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>

        <div className="mt-6 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </div>
  );
}
