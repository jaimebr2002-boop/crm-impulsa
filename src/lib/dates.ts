const TZ = "Europe/Madrid";

export function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatHora(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(new Date(iso));
}

export function formatFechaHora(iso: string | null | undefined): string {
  if (!iso) return "";
  return `${formatFecha(iso)} · ${formatHora(iso)}`;
}

export function formatFechaRelativa(iso: string | null | undefined): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  const hoy = new Date();
  const dias = Math.round((startOfDay(fecha).getTime() - startOfDay(hoy).getTime()) / 86_400_000);

  if (dias === 0) return `Hoy · ${formatHora(iso)}`;
  if (dias === 1) return `Mañana · ${formatHora(iso)}`;
  if (dias === -1) return `Ayer · ${formatHora(iso)}`;
  return formatFechaHora(iso);
}

export function startOfDay(d: Date): Date {
  const copia = new Date(d);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

export function endOfDay(d: Date): Date {
  const copia = new Date(d);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

export function isMismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDias(d: Date, n: number): Date {
  const copia = new Date(d);
  copia.setDate(copia.getDate() + n);
  return copia;
}

export function inicioSemana(d: Date): Date {
  const copia = startOfDay(d);
  const diaSemana = (copia.getDay() + 6) % 7; // lunes = 0
  return addDias(copia, -diaSemana);
}

/**
 * Convierte el valor de un <input type="datetime-local"> (hora local del
 * navegador, sin zona) a un ISO string con offset, listo para timestamptz.
 * Como los tres usuarios operan siempre desde España, la hora local del
 * navegador coincide con Europe/Madrid.
 */
export function datetimeLocalToIso(valor: string): string {
  return new Date(valor).toISOString();
}

/** Formatea un ISO a valor apto para <input type="datetime-local">. */
export function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}
