import type { CanalContacto, EstadoLead, OrigenLead, SegmentoLead } from "./types";

export const ESTADOS: EstadoLead[] = [
  "pendiente",
  "contactado",
  "respondido",
  "interesado",
  "reunión",
  "cerrado",
  "descartado",
  "no contesta",
];

export const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  respondido: "Respondido",
  interesado: "Interesado",
  reunión: "Reunión",
  cerrado: "Cerrado",
  descartado: "Descartado",
  "no contesta": "No contesta",
};

// Colores de acento discretos, no arcoíris.
export const ESTADO_COLOR: Record<string, string> = {
  pendiente: "bg-slate-100 text-slate-700 border-slate-200",
  contactado: "bg-blue-50 text-blue-700 border-blue-200",
  respondido: "bg-cyan-50 text-cyan-700 border-cyan-200",
  interesado: "bg-amber-50 text-amber-800 border-amber-200",
  reunión: "bg-violet-50 text-violet-700 border-violet-200",
  cerrado: "bg-emerald-50 text-emerald-700 border-emerald-200",
  descartado: "bg-red-50 text-red-700 border-red-200",
  "no contesta": "bg-orange-50 text-orange-700 border-orange-200",
};

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
  caliente: "bg-red-50 text-red-700 border-red-200",
  timing: "bg-amber-50 text-amber-800 border-amber-200",
  frio: "bg-sky-50 text-sky-700 border-sky-200",
  ghost: "bg-slate-100 text-slate-500 border-slate-200",
  off: "bg-slate-100 text-slate-400 border-slate-200",
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
