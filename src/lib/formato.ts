// Formato de presentación centralizado (dinero y números). Siempre estilo
// español: 1.140,00 € — con separador de miles también en cifras de 4 dígitos
// (Intl es-ES lo omite en 1140; en una herramienta financiera confunde).

function agrupar(entero: string): string {
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** 1140 → "1.140,00 €" · con decimales = false → "1.140 €". */
export function formatDinero(valor: number | string | null | undefined, decimales = true): string {
  const n = Number(valor ?? 0);
  const v = Number.isFinite(n) ? n : 0;
  const signo = v < 0 ? "−" : "";
  const abs = Math.abs(v);
  if (!decimales) return `${signo}${agrupar(String(Math.round(abs)))} €`;
  const [ent, dec] = abs.toFixed(2).split(".");
  return `${signo}${agrupar(ent)},${dec} €`;
}

/** 1234 → "1.234" */
export function formatNumero(valor: number): string {
  return agrupar(String(Math.round(valor)));
}

/** 0.253 → "25 %" */
export function formatPorcentaje(fraccion: number, decimales = 0): string {
  return `${(fraccion * 100).toFixed(decimales).replace(".", ",")} %`;
}
