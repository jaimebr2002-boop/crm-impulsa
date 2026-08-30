export function LoadingState({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-slate-400">
      <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
      <span>{texto}</span>
    </div>
  );
}
