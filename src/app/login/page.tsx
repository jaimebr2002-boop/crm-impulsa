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
      router.replace("/hoy");
      router.refresh();
    } finally {
      setEnviando(false);
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

        <form onSubmit={handleSubmit} className="glass-strong flex flex-col gap-4 rounded-2xl p-6 shadow-glass dark:shadow-glass-dark">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink2">Email</span>
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
            <span className="mb-1 block text-xs font-medium text-ink2">Contraseña</span>
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

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full rounded-xl bg-brand-gradient py-3.5 text-base font-semibold text-brand-ink shadow-lg shadow-brand/30 disabled:opacity-60"
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
