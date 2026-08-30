export function EmptyState({ titulo, descripcion }: { titulo: string; descripcion?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
      <p className="text-sm font-medium text-ink">{titulo}</p>
      {descripcion ? <p className="mt-1 text-sm text-ink3">{descripcion}</p> : null}
    </div>
  );
}
