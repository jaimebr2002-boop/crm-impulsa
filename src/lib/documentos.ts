import type { CategoriaDocumento, RelacionDocumento } from "./types";

// Reglas de Documentos. La misma lista de tipos está en la migración 0011
// (bucket.allowed_mime_types, check de documentos.mime_type y política de
// Storage por extensión). Aquí además se comprueba la FIRMA real del archivo:
// un .pdf que no empieza por %PDF se rechaza aunque la extensión sea correcta.

export const BUCKET_DOCUMENTOS = "documentos";
export const TAMANO_MAXIMO = 50 * 1024 * 1024; // 50 MB (igual que el bucket)

/** Segundos de validez de las signed URLs: ver en la app / descargar. */
export const SEGUNDOS_URL_VER = 300;
export const SEGUNDOS_URL_DESCARGA = 60;

type Firma = "pdf" | "png" | "jpeg" | "gif" | "webp" | "isobmff" | "zip" | "texto";

type TipoPermitido = { mime: string; grupo: GrupoArchivo; firma: Firma };

export type GrupoArchivo = "pdf" | "imagen" | "documento" | "hoja" | "presentacion" | "texto" | "zip" | "video";

/** Extensión → tipo canónico. Lo que no está aquí no se puede subir. */
export const TIPOS_PERMITIDOS: Record<string, TipoPermitido> = {
  pdf: { mime: "application/pdf", grupo: "pdf", firma: "pdf" },
  png: { mime: "image/png", grupo: "imagen", firma: "png" },
  jpg: { mime: "image/jpeg", grupo: "imagen", firma: "jpeg" },
  jpeg: { mime: "image/jpeg", grupo: "imagen", firma: "jpeg" },
  webp: { mime: "image/webp", grupo: "imagen", firma: "webp" },
  gif: { mime: "image/gif", grupo: "imagen", firma: "gif" },
  heic: { mime: "image/heic", grupo: "imagen", firma: "isobmff" },
  heif: { mime: "image/heif", grupo: "imagen", firma: "isobmff" },
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", grupo: "documento", firma: "zip" },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", grupo: "hoja", firma: "zip" },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", grupo: "presentacion", firma: "zip" },
  odt: { mime: "application/vnd.oasis.opendocument.text", grupo: "documento", firma: "zip" },
  ods: { mime: "application/vnd.oasis.opendocument.spreadsheet", grupo: "hoja", firma: "zip" },
  txt: { mime: "text/plain", grupo: "texto", firma: "texto" },
  md: { mime: "text/markdown", grupo: "texto", firma: "texto" },
  csv: { mime: "text/csv", grupo: "hoja", firma: "texto" },
  zip: { mime: "application/zip", grupo: "zip", firma: "zip" },
  mp4: { mime: "video/mp4", grupo: "video", firma: "isobmff" },
  mov: { mime: "video/quicktime", grupo: "video", firma: "isobmff" },
};

export const ACCEPT_INPUT = Object.keys(TIPOS_PERMITIDOS)
  .map((e) => `.${e}`)
  .join(",");

export const TIPOS_LEGIBLES = "PDF, imágenes (JPG, PNG, WebP, HEIC), Word, Excel, PowerPoint, texto, CSV, ZIP y vídeo (MP4, MOV)";

const MIME_A_GRUPO: Record<string, GrupoArchivo> = Object.fromEntries(Object.values(TIPOS_PERMITIDOS).map((t) => [t.mime, t.grupo]));

export function grupoDeMime(mime: string): GrupoArchivo | "otro" {
  return MIME_A_GRUPO[mime] ?? "otro";
}

export const GRUPO_LABEL: Record<GrupoArchivo, string> = {
  pdf: "PDF",
  imagen: "Imagen",
  documento: "Documento",
  hoja: "Hoja de cálculo",
  presentacion: "Presentación",
  texto: "Texto",
  zip: "ZIP",
  video: "Vídeo",
};

/** MIME de cada grupo, para filtrar por tipo de archivo. */
export function mimesDeGrupo(grupo: GrupoArchivo): string[] {
  return Array.from(new Set(Object.values(TIPOS_PERMITIDOS).filter((t) => t.grupo === grupo).map((t) => t.mime)));
}

/** Se puede ver dentro de la app (el resto: información + descargar). */
export function previsualizable(mime: string): "pdf" | "imagen" | "video" | "texto" | null {
  if (mime === "application/pdf") return "pdf";
  // HEIC no lo muestran los navegadores (salvo Safari): se descarga.
  if (mime.startsWith("image/") && mime !== "image/heic" && mime !== "image/heif") return "imagen";
  if (mime === "video/mp4") return "video";
  if (mime === "text/plain" || mime === "text/markdown" || mime === "text/csv") return "texto";
  return null;
}

// ---------- Validación ----------

export function extensionDe(nombre: string): string {
  const i = nombre.lastIndexOf(".");
  return i > 0 ? nombre.slice(i + 1).toLowerCase() : "";
}

function empiezaPor(b: Uint8Array, bytes: number[], desde = 0) {
  return bytes.every((x, i) => b[desde + i] === x);
}
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

/** Comprueba los primeros bytes contra la firma esperada del tipo. */
export function firmaCoincide(b: Uint8Array, firma: Firma): boolean {
  switch (firma) {
    case "pdf": {
      // %PDF- dentro de los primeros 1024 bytes (algunos generadores añaden basura antes).
      const cab = String.fromCharCode(...Array.from(b.subarray(0, 1024)));
      return cab.includes("%PDF-");
    }
    case "png":
      return empiezaPor(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      return empiezaPor(b, [0xff, 0xd8, 0xff]);
    case "gif":
      return empiezaPor(b, ascii("GIF87a")) || empiezaPor(b, ascii("GIF89a"));
    case "webp":
      return empiezaPor(b, ascii("RIFF")) && empiezaPor(b, ascii("WEBP"), 8);
    case "isobmff":
      // MP4, MOV, HEIC: caja "ftyp" (o cajas QuickTime antiguas) en el byte 4.
      return ["ftyp", "moov", "wide", "mdat", "free", "skip"].some((c) => empiezaPor(b, ascii(c), 4));
    case "zip":
      return empiezaPor(b, [0x50, 0x4b, 0x03, 0x04]) || empiezaPor(b, [0x50, 0x4b, 0x05, 0x06]);
    case "texto":
      // Texto: sin bytes nulos en el principio del archivo (un binario los tiene).
      return !b.includes(0);
  }
}

export type ArchivoValidado = { mime: string; extension: string };

/** Valida tamaño, extensión y contenido. Lanza Error con un mensaje para el usuario. */
export async function validarArchivo(archivo: File): Promise<ArchivoValidado> {
  const extension = extensionDe(archivo.name);
  const tipo = TIPOS_PERMITIDOS[extension];
  if (!tipo) {
    throw new Error(
      extension
        ? `No se admiten archivos .${extension}. Tipos admitidos: ${TIPOS_LEGIBLES}.`
        : `El archivo no tiene extensión. Tipos admitidos: ${TIPOS_LEGIBLES}.`
    );
  }
  if (archivo.size === 0) throw new Error("El archivo está vacío.");
  if (archivo.size > TAMANO_MAXIMO) {
    throw new Error(`El archivo ocupa ${formatTamano(archivo.size)}. El máximo es ${formatTamano(TAMANO_MAXIMO)}.`);
  }
  const cabecera = new Uint8Array(await archivo.slice(0, 8192).arrayBuffer());
  if (!firmaCoincide(cabecera, tipo.firma)) {
    throw new Error(`El contenido no corresponde a un archivo .${extension}. Puede estar dañado o tener la extensión cambiada.`);
  }
  return { mime: tipo.mime, extension };
}

/** Nombre seguro para la ruta en Storage: sin acentos, espacios ni símbolos raros. */
export function nombreSeguro(nombre: string): string {
  const ext = extensionDe(nombre);
  const base = (ext ? nombre.slice(0, -(ext.length + 1)) : nombre)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return `${base || "archivo"}${ext ? `.${ext}` : ""}`;
}

/** "brief-segurma_v2.pdf" → "Brief segurma v2" (nombre visible sugerido). */
export function nombreVisibleDe(archivo: string): string {
  const ext = extensionDe(archivo);
  const base = (ext ? archivo.slice(0, -(ext.length + 1)) : archivo).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : archivo;
}

export function formatTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-ES", { maximumFractionDigits: 1 })} MB`;
}

// ---------- Categorías ----------

export const CATEGORIAS_DOCUMENTO: CategoriaDocumento[] = [
  "factura",
  "justificante",
  "contrato",
  "propuesta",
  "briefing",
  "informe",
  "guion",
  "creativo",
  "recurso",
  "otro",
];

export const CATEGORIA_DOCUMENTO_LABEL: Record<CategoriaDocumento, string> = {
  factura: "Factura",
  justificante: "Justificante",
  contrato: "Contrato",
  propuesta: "Propuesta",
  briefing: "Briefing",
  informe: "Informe",
  guion: "Guion",
  creativo: "Creativo",
  recurso: "Recurso",
  otro: "Otro",
};

/** Sugerencia de categoría por contexto y nombre de archivo (se puede cambiar). */
export function categoriaSugerida(nombre: string, mime: string | null, relacion: RelacionDocumento | null): CategoriaDocumento {
  if (relacion?.tipo === "gasto") return "justificante";
  const n = nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  const reglas: [RegExp, CategoriaDocumento][] = [
    [/factura|invoice/, "factura"],
    [/ticket|recibo|justificante|receipt/, "justificante"],
    [/contrato|contract/, "contrato"],
    [/propuesta|presupuesto|proposal/, "propuesta"],
    [/brief/, "briefing"],
    [/informe|report/, "informe"],
    [/guion|script/, "guion"],
  ];
  for (const [re, c] of reglas) if (re.test(n)) return c;
  if (relacion?.tipo === "factura") return "factura";
  if (mime && (mime.startsWith("image/") || mime.startsWith("video/"))) return "creativo";
  return "otro";
}

/** Categorías cuyo término de búsqueda coincide ("guion" → guion). */
export function categoriasQueCoinciden(texto: string): CategoriaDocumento[] {
  const t = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
  if (t.length < 3) return [];
  return CATEGORIAS_DOCUMENTO.filter((c) => {
    const l = CATEGORIA_DOCUMENTO_LABEL[c].toLowerCase();
    return l.startsWith(t) || t.startsWith(l);
  });
}

export const RELACION_LABEL: Record<RelacionDocumento["tipo"], string> = {
  cuenta: "Cuenta",
  marca: "Marca",
  proyecto: "Proyecto",
  factura: "Factura",
  gasto: "Gasto",
};

/** Columna de la tabla documentos para cada tipo de relación. */
export const COLUMNA_RELACION: Record<RelacionDocumento["tipo"], "cuenta_id" | "marca_id" | "proyecto_id" | "factura_id" | "gasto_id"> = {
  cuenta: "cuenta_id",
  marca: "marca_id",
  proyecto: "proyecto_id",
  factura: "factura_id",
  gasto: "gasto_id",
};
