export function ErrorState({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-6 py-10 text-center">
      <p className="text-sm font-medium text-red-700">{mensaje}</p>
      {onReintentar ? (
        <button
          onClick={onReintentar}
          className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white active:bg-red-700"
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
