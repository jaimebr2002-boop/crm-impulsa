import type { EstadoProyecto, EstadoTarea, Prioridad, TipoCuenta, TipoProyecto } from "./types";

// ---------- Proyectos ----------

export const ESTADOS_PROYECTO: EstadoProyecto[] = [
  "pendiente",
  "preparado",
  "en_progreso",
  "esperando",
  "revision",
  "entregado",
  "cancelado",
];

export const ESTADO_PROYECTO_LABEL: Record<EstadoProyecto, string> = {
  pendiente: "Pendiente",
  preparado: "Preparado",
  en_progreso: "En progreso",
  esperando: "Esperando",
  revision: "Revisión",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Punto de color de cada estado (mismo lenguaje que Linear: un punto, no un chip de color). */
export const ESTADO_PROYECTO_PUNTO: Record<EstadoProyecto, string> = {
  pendiente: "bg-ink3",
  preparado: "bg-sky-400",
  en_progreso: "bg-blue-500",
  esperando: "bg-amber-500",
  revision: "bg-violet-500",
  entregado: "bg-emerald-500",
  cancelado: "bg-red-400",
};

/** Estados en los que un proyecto sigue "vivo". */
export const ESTADOS_PROYECTO_ACTIVOS = new Set<EstadoProyecto>(["pendiente", "preparado", "en_progreso", "esperando", "revision"]);

/** Columnas del Kanban: "preparado" se muestra junto a "pendiente" y "cancelado" queda fuera. */
export const COLUMNAS_KANBAN_PROYECTO: { estado: EstadoProyecto; incluye: EstadoProyecto[] }[] = [
  { estado: "pendiente", incluye: ["pendiente", "preparado"] },
  { estado: "en_progreso", incluye: ["en_progreso"] },
  { estado: "esperando", incluye: ["esperando"] },
  { estado: "revision", incluye: ["revision"] },
  { estado: "entregado", incluye: ["entregado"] },
];

export const TIPOS_PROYECTO: TipoProyecto[] = [
  "video",
  "campana",
  "creativo",
  "anuncio",
  "contenido",
  "web",
  "app",
  "automatizacion",
  "tecnico",
  "revision",
  "otro",
];

export const TIPO_PROYECTO_LABEL: Record<TipoProyecto, string> = {
  video: "Vídeo",
  campana: "Campaña",
  creativo: "Creativo",
  web: "Web",
  app: "App",
  automatizacion: "Automatización",
  anuncio: "Anuncio",
  tecnico: "Técnico",
  contenido: "Contenido",
  revision: "Revisión",
  otro: "Otro",
};

// ---------- Prioridad (proyectos y tareas) ----------

export const PRIORIDADES: Prioridad[] = ["urgente", "alta", "normal", "baja"];

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  urgente: "Urgente",
  alta: "Alta",
  normal: "Normal",
  baja: "Baja",
};

export const PRIORIDAD_ORDEN: Record<Prioridad, number> = { urgente: 0, alta: 1, normal: 2, baja: 3 };

export const PRIORIDAD_COLOR: Record<Prioridad, string> = {
  urgente: "text-red-600 dark:text-red-400",
  alta: "text-orange-600 dark:text-orange-400",
  normal: "text-ink3",
  baja: "text-ink3",
};

// ---------- Tareas ----------

export const ESTADOS_TAREA: EstadoTarea[] = ["pendiente", "en_progreso", "esperando", "completada"];

export const ESTADO_TAREA_LABEL: Record<EstadoTarea, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  esperando: "Esperando",
  completada: "Completada",
};

export const ESTADO_TAREA_PUNTO: Record<EstadoTarea, string> = {
  pendiente: "bg-ink3",
  en_progreso: "bg-blue-500",
  esperando: "bg-amber-500",
  completada: "bg-emerald-500",
};

// ---------- Cuentas ----------

export const TIPOS_CUENTA: TipoCuenta[] = ["intermediario", "cliente_directo", "interno"];

export const TIPO_CUENTA_LABEL: Record<TipoCuenta, string> = {
  intermediario: "Intermediario",
  cliente_directo: "Cliente directo",
  interno: "Interno",
};
