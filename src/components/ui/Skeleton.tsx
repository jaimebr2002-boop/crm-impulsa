/** Bloques de carga con la forma aproximada del contenido final. */
export function SkeletonLineas({ filas = 5, alto = "h-12" }: { filas?: number; alto?: string }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className={`skeleton ${alto}`} style={{ opacity: 1 - i * (0.6 / filas) }} />
      ))}
    </div>
  );
}

export function SkeletonTarjetas({ n = 4 }: { n?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface p-4">
          <div className="skeleton h-3 w-20" />
          <div className="skeleton mt-3 h-7 w-24" />
        </div>
      ))}
    </div>
  );
}
