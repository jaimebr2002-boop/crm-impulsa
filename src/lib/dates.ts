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

// ---------- Fechas sin hora (columnas `date`: YYYY-MM-DD) ----------
// Se tratan siempre como fecha local: new Date("2026-10-03") sería medianoche
// UTC y en España mostraría el día anterior a ciertas horas.

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function aYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function hoyYMD(): string {
  return aYMD(new Date());
}

export function ymdADate(ymd: string): Date {
  const [a, m, d] = ymd.split("-").map(Number);
  return new Date(a, m - 1, d);
}

export function sumarDiasYMD(ymd: string, dias: number): string {
  return aYMD(addDias(ymdADate(ymd), dias));
}

/** Días desde hoy hasta la fecha (negativo = pasada). */
export function diasHasta(ymd: string): number {
  return Math.round((ymdADate(ymd).getTime() - startOfDay(new Date()).getTime()) / 86_400_000);
}

export function formatYMDCorta(ymd: string | null | undefined): string {
  if (!ymd) return "";
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(ymdADate(ymd)).replace(".", "");
}

/** "Hoy", "Mañana", "Ayer", "Lun 6", "12 oct"… para fechas límite. */
export function formatYMDRelativa(ymd: string | null | undefined): string {
  if (!ymd) return "";
  const dias = diasHasta(ymd);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  if (dias === -1) return "Ayer";
  if (dias > 1 && dias < 7) {
    const txt = new Intl.DateTimeFormat("es-ES", { weekday: "short", day: "numeric" }).format(ymdADate(ymd)).replace(".", "");
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }
  return formatYMDCorta(ymd);
}

/** Hace cuánto (para feeds de actividad): "ahora", "hace 5 min", "hace 3 h", "ayer", "12 oct". */
export function formatHaceCuanto(iso: string): string {
  const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (seg < 60) return "ahora";
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86_400) return `hace ${Math.floor(seg / 3600)} h`;
  const dias = Math.round((startOfDay(new Date()).getTime() - startOfDay(new Date(iso)).getTime()) / 86_400_000);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} d`;
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(new Date(iso)).replace(".", "");
}
