export type RolUsuario = "admin" | "comercial";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  rol: RolUsuario;
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

export type Evento = {
  id: string;
  lead_id: string;
  usuario_id: string | null;
  titulo: string;
  fecha_hora: string;
  completada: boolean;
  created_at: string;
  updated_at: string;
};

export type EventoInsert = Partial<Omit<Evento, "id" | "created_at" | "updated_at" | "completada">> & {
  lead_id: string;
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
