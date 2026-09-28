import Link from "next/link";
import type { ReactNode } from "react";
import { IconFlecha } from "../Icons";

/** Panel con cabecera fina: título, contador opcional y un enlace o acción. */
export function Panel({
  titulo,
  contador,
  enlace,
  accion,
  tono,
  className = "",
  children,
}: {
  titulo: string;
  contador?: number;
  enlace?: { href: string; texto: string };
  accion?: { texto: string; onClick: () => void };
  tono?: "alerta";
  className?: string;
  children: ReactNode;
}) {
  const extremo = enlace ? (
    <Link href={enlace.href} className="flex items-center gap-1 text-xs text-ink3 hover:text-ink">
      {enlace.texto}
      <IconFlecha className="h-3 w-3" />
    </Link>
  ) : accion ? (
    <button onClick={accion.onClick} className="flex items-center gap-1 text-xs text-ink3 hover:text-ink">
      {accion.texto}
      <IconFlecha className="h-3 w-3" />
    </button>
  ) : null;
  return (
    <section className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
          {tono === "alerta" ? <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> : null}
          {titulo}
          {contador ? <span className="text-xs font-normal text-ink3">{contador}</span> : null}
        </h2>
        {extremo}
      </header>
      {children}
    </section>
  );
}
