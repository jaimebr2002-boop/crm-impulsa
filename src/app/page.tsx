import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

// Vista previa puramente decorativa del panel — sin cifras inventadas,
// solo bloques que sugieren la composición real de /hoy y /analitica.
function VistaPreviaPanel() {
  const barras = [100, 78, 62, 40, 24];
  return (
    <div className="flex overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_40px_80px_-30px_rgba(0,0,0,0.35)] dark:shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]">
      <div className="hidden w-40 shrink-0 flex-col gap-2 border-r border-line bg-mute p-4 sm:flex">
        <div className="mb-2 flex items-center gap-2">
          <Logo size={18} />
          <div className="h-2 w-16 rounded-full bg-ink3/30" />
        </div>
        <div className="h-7 w-full rounded-lg bg-brand-gradient" />
        <div className="h-7 w-full rounded-lg bg-surface" />
        <div className="h-7 w-full rounded-lg bg-surface" />
        <div className="h-7 w-full rounded-lg bg-surface" />
      </div>
      <div className="flex-1 p-5 sm:p-6">
        <div className="mb-4 h-3 w-28 rounded-full bg-ink3/30" />
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-3">
              <div className="mb-2 h-2 w-12 rounded-full bg-ink3/30" />
              <div className="h-4 w-10 rounded-full bg-ink2/40" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 h-2.5 w-24 rounded-full bg-ink3/30" />
          <div className="flex flex-col gap-2">
            {barras.map((ancho, i) => (
              <div key={i} className="h-2 rounded-full bg-mute">
                <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${ancho}%` }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas">
      <div className="blob-bg -left-32 -top-32 h-[480px] w-[480px]" style={{ background: "var(--blob1)" }} />
      <div className="blob-bg -bottom-40 -right-40 h-[560px] w-[560px]" style={{ background: "var(--blob2)" }} />

      <div className="relative z-10 flex min-h-dvh flex-col">
        <header className="flex items-center justify-between px-6 py-6 sm:px-12">
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="font-display text-lg font-bold tracking-tight text-ink">Impulsa CRM</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/30"
            >
              Iniciar sesión
            </Link>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center px-6 pb-16 pt-6 text-center sm:pt-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-semibold text-brand-dark backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-dark" />
            CRM interno de Impulsa Studio
          </div>

          <h1 className="mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl">
            Cada lead, llamada y seguimiento en{" "}
            <span className="bg-brand-gradient bg-clip-text text-transparent">un solo panel de cristal</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink2 sm:text-lg">
            El CRM de uso exclusivo para el equipo de Impulsa Studio: pipeline, seguimientos y analítica del proceso
            comercial, siempre con datos reales.
          </p>

          <Link
            href="/login"
            className="mt-8 rounded-xl bg-brand-gradient px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-brand/30"
          >
            Entrar al CRM →
          </Link>

          <div className="mt-14 w-full max-w-4xl">
            <VistaPreviaPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
