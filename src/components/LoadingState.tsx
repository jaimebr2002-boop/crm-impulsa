/** Carga de página completa (arranque, redirección): esqueleto neutro, sin textos "Cargando…". */
export function LoadingState({ texto }: { texto?: string }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 md:px-8" aria-busy="true" aria-label={texto ?? "Cargando"}>
      <div className="skeleton mb-5 h-8 w-48" />
      <div className="skeleton mb-6 h-20 w-full rounded-xl" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-11 w-full" />
        ))}
      </div>
    </div>
  );
}
