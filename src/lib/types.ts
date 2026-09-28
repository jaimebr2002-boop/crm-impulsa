export type RolUsuario = "admin" | "comercial";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
  notificaciones_activas: boolean;
};

export type EstadoLead =
  | "pendiente"
  | "contactado"
  | "respondido"
  | "interesado"
  | "reunión"
  | "cerrado"
  | "descartado"
  | "no contesta";

export type OrigenLead = "pipeline_automatico" | "referido_personal" | "reactivacion_web";

export type SegmentoLead = "caliente" | "timing" | "frio" | "ghost" | "off";

export type CanalContacto = "llamada" | "whatsapp" | "instagram" | "email" | "linkedin";

export type Lead = {
  id: string;
  nombre_contacto: string | null;
  negocio: string | null;
  telefono: string | null;
  instagram: string | null;
  nicho: string | null;
  ciudad: string | null;
  canal: string | null;
  referido_por: string | null;
  origen: string | null;
  segmento: string | null;
  oferta: string | null;
  estado: string;
  proximo_contacto: string | null;
  asignado_a: string | null;
  email: string | null;
  enlace_demo: string | null;
  /** Importe en euros: estimado si está abierto, facturado si está cerrado. */
  valor: number | null;
  archivado: boolean;
  created_at: string;
  updated_at: string;
};

export type LeadInsert = Partial<Omit<Lead, "id" | "created_at" | "updated_at">>;
export type LeadUpdate = Partial<Omit<Lead, "id" | "created_at" | "updated_at">>;

export type Interaccion = {
  id: string;
  lead_id: string;
  usuario_id: string | null;
  fecha: string;
  canal: string | null;
  resultado: string | null;
  nota: string | null;
};

export type InteraccionInsert = Partial<Omit<Interaccion, "id" | "fecha">> & {
  lead_id: string;
};

export type TipoEvento = "seguimiento" | "reunion" | "evento";

export type Evento = {
  id: string;
  /** Obligatorio en seguimientos CRM; opcional en reuniones/eventos (0009). */
  lead_id: string | null;
  usuario_id: string | null;
  tipo: TipoEvento;
  descripcion: string | null;
  proyecto_id: string | null;
  cuenta_id: string | null;
  titulo: string;
  fecha_hora: string;
  completada: boolean;
  leida_en: string | null;
  created_at: string;
  updated_at: string;
};

export type EventoInsert = Partial<Omit<Evento, "id" | "created_at" | "updated_at" | "completada">> & {
  titulo: string;
  fecha_hora: string;
};

// Vistas enriquecidas usadas en la interfaz.
export type LeadConAsignado = Lead & {
  asignado?: Usuario | null;
};

export type EventoConLead = Evento & {
  lead: Pick<Lead, "id" | "negocio" | "nombre_contacto" | "telefono"> | null;
  usuario: Usuario | null;
};

// ============================================================
// Company OS — trabajo (migración 0008)
// ============================================================

export type TipoCuenta = "intermediario" | "cliente_directo" | "interno";

export type Cuenta = {
  id: string;
  nombre: string;
  tipo: TipoCuenta;
  email: string | null;
  telefono: string | null;
  notas: string | null;
  lead_id: string | null;
  archivada: boolean;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type Marca = {
  id: string;
  cuenta_id: string;
  nombre: string;
  web: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

export type EstadoProyecto = "pendiente" | "preparado" | "en_progreso" | "esperando" | "revision" | "entregado" | "cancelado";
export type Prioridad = "baja" | "normal" | "alta" | "urgente";
export type TipoProyecto =
  | "video"
  | "campana"
  | "creativo"
  | "web"
  | "app"
  | "automatizacion"
  | "anuncio"
  | "tecnico"
  | "contenido"
  | "revision"
  | "otro";

export type Proyecto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  cuenta_id: string | null;
  marca_id: string | null;
  lead_id: string | null;
  /** Proyecto contenedor (un solo nivel de subproyectos, 0009). */
  proyecto_padre_id: string | null;
  tipo: TipoProyecto;
  estado: EstadoProyecto;
  prioridad: Prioridad;
  responsable_id: string | null;
  fecha_inicio: string | null; // YYYY-MM-DD
  fecha_entrega: string | null; // YYYY-MM-DD
  entregado_en: string | null;
  importe: number | null;
  notas: string | null;
  archivado: boolean;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Proyecto con su cuenta y marca embebidas (select con joins). */
export type ProyectoConRelaciones = Proyecto & {
  cuenta: Pick<Cuenta, "id" | "nombre" | "tipo"> | null;
  marca: Pick<Marca, "id" | "nombre"> | null;
  padre: Pick<Proyecto, "id" | "nombre"> | null;
};

export type ProyectoInsert = Partial<Omit<Proyecto, "id" | "created_at" | "updated_at" | "entregado_en" | "creado_por">> & {
  nombre: string;
};
export type ProyectoUpdate = Partial<Omit<Proyecto, "id" | "created_at" | "updated_at" | "creado_por">>;

export type ProyectoEnlace = {
  id: string;
  proyecto_id: string;
  titulo: string;
  url: string;
  created_at: string;
};

export type EstadoTarea = "pendiente" | "en_progreso" | "esperando" | "completada";

export type Tarea = {
  id: string;
  titulo: string;
  descripcion: string | null;
  proyecto_id: string | null;
  lead_id: string | null;
  responsable_id: string | null;
  estado: EstadoTarea;
  prioridad: Prioridad;
  fecha_limite: string | null; // YYYY-MM-DD
  completada_en: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type TareaConRelaciones = Tarea & {
  proyecto:
    | (Pick<Proyecto, "id" | "nombre" | "cuenta_id" | "marca_id"> & {
        cuenta: Pick<Cuenta, "id" | "nombre"> | null;
        marca: Pick<Marca, "id" | "nombre"> | null;
      })
    | null;
  lead: Pick<Lead, "id" | "negocio" | "nombre_contacto"> | null;
};

export type TareaInsert = Partial<Omit<Tarea, "id" | "created_at" | "updated_at" | "completada_en" | "creado_por">> & {
  titulo: string;
};
export type TareaUpdate = Partial<Omit<Tarea, "id" | "created_at" | "updated_at" | "creado_por">>;

export type Actividad = {
  id: string;
  actor_id: string | null;
  entidad: string;
  entidad_id: string | null;
  accion: string;
  titulo: string | null;
  datos: Record<string, unknown>;
  cuenta_id: string | null;
  proyecto_id: string | null;
  created_at: string;
};
