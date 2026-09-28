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
} & DatosFiscalesCuenta;

/** Datos de facturación opcionales del receptor (0011). */
export type DatosFiscalesCuenta = {
  fiscal_nombre?: string | null;
  fiscal_nif?: string | null;
  fiscal_direccion?: string | null;
  fiscal_codigo_postal?: string | null;
  fiscal_ciudad?: string | null;
  fiscal_provincia?: string | null;
  fiscal_pais?: string | null;
  email_facturacion?: string | null;
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

// ============================================================
// Company OS — finanzas (migración 0010)
// ============================================================

export type EstadoFactura = "borrador" | "emitida" | "cancelada";
/** Estado visible, derivado en BD (vista facturas_estado). */
export type EstadoCobro = "borrador" | "pendiente" | "parcial" | "cobrada" | "vencida" | "cancelada";
export type MetodoCobro = "transferencia" | "tarjeta" | "efectivo" | "bizum" | "domiciliacion" | "otro";
export type CategoriaGasto =
  | "software"
  | "hardware"
  | "publicidad"
  | "transporte"
  | "comida"
  | "gestoria"
  | "formacion"
  | "oficina"
  | "otros";
export type Periodicidad = "mensual" | "trimestral" | "anual";

export type Factura = {
  id: string;
  numero: string | null;
  cuenta_id: string;
  estado: EstadoFactura;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  iva_pct: number;
  irpf_pct: number;
  base: number;
  iva: number;
  irpf: number;
  total: number;
  moneda: string;
  enviada_en: string | null;
  notas: string | null;
  pdf_path: string | null;
  pdf_huella?: string | null;
  pdf_generado_en?: string | null;
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** sin_pdf · actualizado · desactualizado (la factura cambió después de generar el PDF). */
export type EstadoPdf = "sin_pdf" | "actualizado" | "desactualizado";

export type FacturaEstado = Factura & {
  pdf_estado?: EstadoPdf;
  cobrado: number;
  pendiente: number;
  estado_cobro: EstadoCobro;
  vencida: boolean;
  ultimo_cobro: string | null;
};

export type FacturaConCuenta = FacturaEstado & { cuenta: Pick<Cuenta, "id" | "nombre"> | null };

export type FacturaLinea = {
  id: string;
  factura_id: string;
  proyecto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  importe: number;
  orden: number;
};

export type FacturaLineaConProyecto = FacturaLinea & { proyecto: Pick<Proyecto, "id" | "nombre"> | null };

/** Línea tal como se envía a guardar_factura. */
export type LineaBorrador = {
  proyecto_id: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
};

export type Cobro = {
  id: string;
  factura_id: string;
  fecha: string;
  importe: number;
  metodo: MetodoCobro;
  referencia: string | null;
  notas: string | null;
  created_at: string;
};

export type CobroConFactura = Cobro & { factura: { id: string; numero: string | null; cuenta_id: string } | null };

export type Gasto = {
  id: string;
  concepto: string;
  fecha: string;
  importe: number;
  categoria: CategoriaGasto;
  proveedor: string | null;
  cuenta_id: string | null;
  proyecto_id: string | null;
  suscripcion_id: string | null;
  deducible: boolean;
  notas: string | null;
  justificante_path: string | null;
  created_at: string;
  updated_at: string;
};

export type Suscripcion = {
  id: string;
  nombre: string;
  proveedor: string | null;
  categoria: CategoriaGasto;
  importe: number;
  periodicidad: Periodicidad;
  fecha_inicio: string;
  proxima_renovacion: string;
  activa: boolean;
  notas: string | null;
  created_at: string;
  updated_at: string;
};

/** Por proyecto (sin IVA). facturado/cobrado = solo emitidas; en_borrador = líneas en borradores (no es facturado). */
export type ProyectoFacturacion = {
  proyecto_id: string;
  facturas: number;
  facturado: number;
  cobrado: number;
  en_borrador: number;
  borradores: string[];
};

// ---------- Documentos (Fase 4) ----------

export type CategoriaDocumento =
  | "factura"
  | "justificante"
  | "contrato"
  | "propuesta"
  | "briefing"
  | "informe"
  | "guion"
  | "creativo"
  | "recurso"
  | "otro";

export type Documento = {
  id: string;
  nombre: string;
  nombre_archivo: string;
  storage_path: string;
  mime_type: string;
  tamano: number;
  categoria: CategoriaDocumento;
  descripcion: string | null;
  cuenta_id: string | null;
  marca_id: string | null;
  proyecto_id: string | null;
  factura_id: string | null;
  gasto_id: string | null;
  origen: "subida" | "generado";
  creado_por: string | null;
  created_at: string;
  updated_at: string;
};

/** Documento con su contexto deducido (vista documentos_contexto). */
export type DocumentoContexto = Documento & {
  ref_cuenta_id: string | null;
  ref_marca_id: string | null;
  ref_proyecto_id: string | null;
  cuenta_nombre: string | null;
  marca_nombre: string | null;
  proyecto_nombre: string | null;
  factura_numero: string | null;
  gasto_concepto: string | null;
};

/** Relación directa de un documento (como máximo una). */
export type RelacionDocumento = { tipo: "cuenta" | "marca" | "proyecto" | "factura" | "gasto"; id: string; etiqueta?: string };

export type AjustesFacturacion = {
  nombre: string | null;
  nif: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string;
  email: string | null;
  telefono: string | null;
  iban: string | null;
  texto_legal: string | null;
  iva_pct_defecto: number;
  irpf_pct_defecto: number;
  dias_vencimiento: number;
  updated_at: string;
};
