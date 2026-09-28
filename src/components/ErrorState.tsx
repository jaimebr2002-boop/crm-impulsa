/**
 * Error de carga: frase humana y reintentar. El detalle técnico no se muestra
 * (queda en la consola); si el mensaje ya es humano (empieza por "No se…"), se usa tal cual.
 */
export function ErrorState({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  const humano = /^(No |Esta |Ese |Tu |Faltan |Configura )/.test(mensaje);
  if (!humano && typeof console !== "undefined") console.error(mensaje);
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-xl border border-line bg-surface px-6 py-10 text-center">
      <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400">
        !
      </span>
      <div>
        <p className="text-sm font-medium text-ink">{humano ? mensaje : "No se ha podido cargar esta información."}</p>
        <p className="mt-0.5 text-xs text-ink3">Comprueba la conexión y vuelve a intentarlo.</p>
      </div>
      {onReintentar ? (
        <button onClick={onReintentar} className="btn-secondary">
          Reintentar
        </button>
      ) : null}
    </div>
  );
}
