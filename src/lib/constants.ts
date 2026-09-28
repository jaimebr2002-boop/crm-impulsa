import { TONO_CHIP, TONO_LEAD, TONO_PUNTO } from "./tonos";
import { formatDinero } from "./formato";
import type { CanalContacto, EstadoLead, OrigenLead, SegmentoLead } from "./types";

// Orden del pipeline. Los valores guardados no cambian ("cerrado",
// "descartado"); solo su etiqueta visible pasa a Ganado / Perdido.
export const ESTADOS: EstadoLead[] = [
  "pendiente",
  "contactado",
  "no contesta",
  "respondido",
  "interesado",
  "reunión",
  "cerrado",
  "descartado",
];

export const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  respondido: "Respondido",
  interesado: "Interesado",
  reunión: "Reunión",
  cerrado: "Ganado",
  descartado: "Perdido",
  "no contesta": "No contesta",
};

// Estilo de cada estado: derivado de la semántica común (lib/tonos.ts).
export const ESTADO_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(TONO_LEAD).map(([e, t]) => [e, TONO_CHIP[t]])
);

// Estados que siguen vivos en el pipeline: su valor cuenta como "en juego".
export const ESTADOS_ABIERTOS = new Set(["pendiente", "contactado", "respondido", "interesado", "reunión", "no contesta"]);

// Punto de color de cada columna del tablero Kanban.
export const ESTADO_ACENTO: Record<string, string> = Object.fromEntries(
  Object.entries(TONO_LEAD).map(([e, t]) => [e, TONO_PUNTO[t]])
);

/** Importe redondeado (valor de leads y proyectos): "4.000 €". Mismo formato que Finanzas. */
export function formatEuros(valor: number | string | null | undefined): string {
  return formatDinero(valor, false);
}

/** Suma el valor de una lista de leads, ignorando los que no lo tienen. */
export function sumarValor(leads: { valor: number | string | null }[]): number {
  return leads.reduce((total, l) => total + (Number(l.valor) || 0), 0);
}

export const ORIGENES: OrigenLead[] = ["pipeline_automatico", "referido_personal", "reactivacion_web"];

export const ORIGEN_LABEL: Record<string, string> = {
  pipeline_automatico: "Pipeline automático",
  referido_personal: "Referido personal",
  reactivacion_web: "Reactivación web",
};

export const SEGMENTOS: SegmentoLead[] = ["caliente", "timing", "frio", "ghost", "off"];

export const SEGMENTO_LABEL: Record<string, string> = {
  caliente: "Caliente",
  timing: "Timing",
  frio: "Frío",
  ghost: "Ghost",
  off: "Off",
};

export const SEGMENTO_COLOR: Record<string, string> = {
  caliente: TONO_CHIP.atencion,
  timing: TONO_CHIP.info,
  frio: TONO_CHIP.neutro,
  ghost: TONO_CHIP.inactivo,
  off: TONO_CHIP.inactivo,
};

export const CANALES: CanalContacto[] = ["llamada", "whatsapp", "instagram", "email", "linkedin"];

export const CANAL_LABEL: Record<string, string> = {
  llamada: "Llamada",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  email: "Email",
  linkedin: "LinkedIn",
  nota: "Nota",
};

// Resultados típicos de una llamada — usados en el registro rápido.
export const RESULTADOS_LLAMADA = [
  "Contactado",
  "No contesta",
  "Buzón de voz",
  "Interesado",
  "No interesado",
  "Volver a llamar",
  "Número erróneo",
  "Cerrado",
] as const;
