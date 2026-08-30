"use client";

import { useTheme } from "@/context/ThemeContext";

function IconSol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`stroke-current ${className ?? ""}`}>
      <circle cx="12" cy="12" r="4.2" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.4 4.4l1.5 1.5M18 18l1.5 1.5M2.5 12h2.2M19.3 12h2.2M4.4 19.6l1.5-1.5M18 6l1.5-1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLuna({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth={1.8} className={`stroke-current ${className ?? ""}`}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { tema, alternarTema } = useTheme();
  const esOscuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={alternarTema}
      aria-label={esOscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`relative flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink2 transition-colors hover:text-brand-dark ${className ?? ""}`}
    >
      {esOscuro ? <IconSol className="h-4 w-4" /> : <IconLuna className="h-4 w-4" />}
    </button>
  );
}
