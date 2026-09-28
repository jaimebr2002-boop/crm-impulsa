import { supabase } from "@/lib/supabase";
import {
  BUCKET_DOCUMENTOS,
  categoriasQueCoinciden,
  COLUMNA_RELACION,
  mimesDeGrupo,
  nombreSeguro,
  SEGUNDOS_URL_DESCARGA,
  SEGUNDOS_URL_VER,
  validarArchivo,
  type GrupoArchivo,
} from "@/lib/documentos";
import type { CategoriaDocumento, Documento, DocumentoContexto, RelacionDocumento } from "@/lib/types";
import { terminoBusquedaSeguro, traerTodo } from "./paginar";

// Documentos = metadatos en la tabla `documentos` + archivo en Storage (bucket
// privado). RLS y las políticas de Storage limitan todo a admin; aquí solo se
// ordenan las operaciones para no dejar filas sin archivo:
//   subir:     archivo → fila (si la fila falla, se borra el archivo)
//   reemplazar: archivo nuevo → actualizar fila → borrar el anterior
//   eliminar:  fila → archivo (si el archivo no se puede borrar queda como
//              huérfano, sin fila visible, y Configuración lo limpia)

const VISTA = "documentos_contexto";

export type FiltroDocumentos = {
  texto?: string;
  categoria?: CategoriaDocumento;
  cuentaId?: string;
  proyectoIds?: string[];
  facturaIds?: string[];
  gastoId?: string;
  grupo?: GrupoArchivo;
  desde?: string;
  hasta?: string;
  limite?: number;
};

/** Filtro OR de texto sobre nombre, archivo y contexto (cuenta, marca, proyecto, factura, gasto) + categorías. */
function filtroTexto(texto: string): string | null {
  const t = terminoBusquedaSeguro(texto);
  if (t.length < 2) return null;
  const p = `%${t}%`;
  const campos = ["nombre", "nombre_archivo", "descripcion", "cuenta_nombre", "marca_nombre", "proyecto_nombre", "factura_numero", "gasto_concepto"];
  const partes = campos.map((c) => `${c}.ilike.${p}`);
  const cats = categoriasQueCoinciden(t);
  if (cats.length) partes.push(`categoria.in.(${cats.join(",")})`);
  return partes.join(",");
}

export async function listarDocumentos(filtro: FiltroDocumentos = {}): Promise<DocumentoContexto[]> {
  const construir = (a: number, b: number) => {
    let q = supabase.from(VISTA).select("*").order("created_at", { ascending: false }).order("id").range(a, b);
    const texto = filtro.texto ? filtroTexto(filtro.texto) : null;
    if (texto) q = q.or(texto);
    if (filtro.categoria) q = q.eq("categoria", filtro.categoria);
    if (filtro.cuentaId) q = q.eq("ref_cuenta_id", filtro.cuentaId);
    if (filtro.gastoId) q = q.eq("gasto_id", filtro.gastoId);
    if (filtro.grupo) q = q.in("mime_type", mimesDeGrupo(filtro.grupo));
    if (filtro.desde) q = q.gte("created_at", filtro.desde);
    if (filtro.hasta) q = q.lt("created_at", filtro.hasta);
    // Proyecto(s) y/o facturas que los incluyen: un OR entre ambas relaciones.
    const ors: string[] = [];
    if (filtro.proyectoIds?.length) ors.push(`ref_proyecto_id.in.(${filtro.proyectoIds.join(",")})`);
    if (filtro.facturaIds?.length) ors.push(`factura_id.in.(${filtro.facturaIds.join(",")})`);
    if (ors.length) q = q.or(ors.join(","));
    return q.returns<DocumentoContexto[]>();
  };
  if (filtro.limite) {
    const { data, error } = await construir(0, filtro.limite - 1);
    if (error) throw new Error(error.message);
    return data ?? [];
  }
  return traerTodo<DocumentoContexto>(construir);
}

export async function obtenerDocumento(id: string): Promise<DocumentoContexto | null> {
  const { data, error } = await supabase.from(VISTA).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DocumentoContexto | null) ?? null;
}

/** Documentos de un proyecto: los suyos, los de sus subproyectos y gastos, y los de las facturas que lo incluyen. */
export async function documentosDeProyecto(proyectoIds: string[]): Promise<DocumentoContexto[]> {
  if (!proyectoIds.length) return [];
  const { data, error } = await supabase.from("factura_lineas").select("factura_id").in("proyecto_id", proyectoIds);
  if (error) throw new Error(error.message);
  const facturaIds = Array.from(new Set((data ?? []).map((l) => l.factura_id as string)));
  return listarDocumentos({ proyectoIds, facturaIds });
}

// ---------- Subida ----------

export type Progreso = (fraccion: number) => void;

const SB_URL = process.env.NEXT_PUBLIC_SB_URL || "https://placeholder.supabase.co";
const SB_ANON = process.env.NEXT_PUBLIC_SB_ANON_KEY || "placeholder-anon-key";

const rutaCodificada = (ruta: string) => ruta.split("/").map(encodeURIComponent).join("/");

/**
 * Sube el binario a Storage con XMLHttpRequest para poder mostrar el progreso
 * (supabase-js no lo expone). Mismo endpoint y cabeceras que supabase-js.
 */
async function subirObjeto(ruta: string, archivo: Blob, mime: string, onProgreso?: Progreso): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Tu sesión ha caducado. Vuelve a entrar.");
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${SB_URL}/storage/v1/object/${BUCKET_DOCUMENTOS}/${rutaCodificada(ruta)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", SB_ANON);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("content-type", mime);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgreso?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let detalle = "";
      try {
        const j = JSON.parse(xhr.responseText);
        detalle = j.message || j.error || "";
      } catch {
        detalle = xhr.responseText;
      }
      reject(new Error(mensajeErrorStorage(xhr.status, detalle)));
    };
    xhr.onerror = () => reject(new Error("No se pudo subir el archivo (conexión interrumpida). Tu documento no se ha guardado."));
    xhr.send(archivo);
  });
}

function mensajeErrorStorage(status: number, detalle: string): string {
  const d = detalle.toLowerCase();
  if (status === 413 || d.includes("size") || d.includes("too large")) return "El archivo supera el tamaño máximo permitido. Tu documento no se ha guardado.";
  if (d.includes("mime") || d.includes("invalid_mime_type") || d.includes("not supported")) return "Storage no admite este tipo de archivo. Tu documento no se ha guardado.";
  if (status === 401 || status === 403 || d.includes("row-level security") || d.includes("unauthorized"))
    return "No tienes permiso para subir documentos.";
  return `No se pudo subir el archivo${detalle ? ` (${detalle})` : ""}. Tu documento no se ha guardado.`;
}

async function borrarObjetos(rutas: string[]): Promise<boolean> {
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove(rutas);
  // Storage no da error si la política impide borrar: devuelve la lista vacía.
  return !error && (data?.length ?? 0) === rutas.length;
}

export type DatosDocumento = {
  nombre: string;
  categoria: CategoriaDocumento;
  descripcion?: string | null;
  relacion: RelacionDocumento | null;
};

function columnasRelacion(relacion: RelacionDocumento | null) {
  const cols: Record<string, string | null> = { cuenta_id: null, marca_id: null, proyecto_id: null, factura_id: null, gasto_id: null };
  if (relacion) cols[COLUMNA_RELACION[relacion.tipo]] = relacion.id;
  return cols;
}

/** Valida, sube el archivo y crea la fila. Si algo falla no queda nada a medias. */
export async function subirDocumento(archivo: File, datos: DatosDocumento, onProgreso?: Progreso): Promise<Documento> {
  const { mime } = await validarArchivo(archivo);
  const id = crypto.randomUUID();
  const ruta = `${id}/${nombreSeguro(archivo.name)}`;
  await subirObjeto(ruta, archivo, mime, onProgreso);

  const { data, error } = await supabase
    .from("documentos")
    .insert({
      id,
      nombre: datos.nombre.trim(),
      nombre_archivo: archivo.name.slice(0, 255),
      storage_path: ruta,
      mime_type: mime,
      tamano: archivo.size,
      categoria: datos.categoria,
      descripcion: datos.descripcion?.trim() || null,
      ...columnasRelacion(datos.relacion),
    })
    .select()
    .single();
  if (error) {
    await borrarObjetos([ruta]);
    throw new Error(`No se pudo guardar el documento (${error.message}). El archivo no se ha conservado.`);
  }
  return data as Documento;
}

/** Sustituye el archivo manteniendo nombre, categoría y relaciones. */
export async function reemplazarArchivo(doc: Documento, archivo: File, onProgreso?: Progreso): Promise<Documento> {
  const { mime } = await validarArchivo(archivo);
  let ruta = `${doc.id}/${nombreSeguro(archivo.name)}`;
  if (ruta === doc.storage_path) ruta = `${doc.id}/${Date.now().toString(36)}-${nombreSeguro(archivo.name)}`;
  await subirObjeto(ruta, archivo, mime, onProgreso);

  const { data, error } = await supabase
    .from("documentos")
    .update({ storage_path: ruta, nombre_archivo: archivo.name.slice(0, 255), mime_type: mime, tamano: archivo.size })
    .eq("id", doc.id)
    .select()
    .single();
  if (error) {
    await borrarObjetos([ruta]);
    throw new Error(`No se pudo reemplazar el archivo (${error.message}). Se mantiene el anterior.`);
  }
  // El anterior ya no lo referencia ninguna fila; si no se puede borrar, queda como huérfano limpiable.
  await borrarObjetos([doc.storage_path]);
  return data as Documento;
}

export async function actualizarDocumento(
  id: string,
  cambios: Partial<Pick<DatosDocumento, "nombre" | "categoria" | "descripcion">> & { relacion?: RelacionDocumento | null }
): Promise<Documento> {
  const { relacion, ...resto } = cambios;
  const payload: Record<string, unknown> = { ...resto };
  if (relacion !== undefined) Object.assign(payload, columnasRelacion(relacion));
  const { data, error } = await supabase.from("documentos").update(payload).eq("id", id).select().single();
  if (error) throw new Error(error.message);
  return data as Documento;
}

/**
 * Elimina la fila y después el archivo. Devuelve false si el archivo no se pudo
 * borrar (queda como huérfano sin fila, visible en Configuración → Almacenamiento).
 */
export async function eliminarDocumento(doc: Pick<Documento, "id" | "storage_path">): Promise<{ archivoBorrado: boolean }> {
  const { data, error } = await supabase.from("documentos").delete().eq("id", doc.id).select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("No se ha podido eliminar el documento.");
  return { archivoBorrado: await borrarObjetos([doc.storage_path]) };
}

// ---------- Acceso a archivos (signed URLs) ----------

/** URL temporal para ver (5 min) o descargar (1 min, con el nombre original). Nunca se guarda. */
export async function urlFirmada(doc: Pick<Documento, "storage_path" | "nombre_archivo">, modo: "ver" | "descargar"): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .createSignedUrl(
      doc.storage_path,
      modo === "ver" ? SEGUNDOS_URL_VER : SEGUNDOS_URL_DESCARGA,
      modo === "descargar" ? { download: doc.nombre_archivo } : undefined
    );
  if (error || !data?.signedUrl) throw new Error("No se ha podido abrir el archivo. Puede que ya no exista.");
  return data.signedUrl;
}

export async function descargarDocumento(doc: Pick<Documento, "storage_path" | "nombre_archivo">) {
  const url = await urlFirmada(doc, "descargar");
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------- Mantenimiento ----------

export async function objetosHuerfanos(): Promise<{ name: string; created_at: string }[]> {
  const { data, error } = await supabase.rpc("documentos_objetos_huerfanos");
  if (error) throw new Error(error.message);
  return (data ?? []) as { name: string; created_at: string }[];
}

export async function limpiarHuerfanos(rutas: string[]): Promise<number> {
  if (!rutas.length) return 0;
  const { data, error } = await supabase.storage.from(BUCKET_DOCUMENTOS).remove(rutas);
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

/** Cuántos gastos del año no tienen justificante y cuántas facturas emitidas no tienen PDF (o lo tienen desactualizado). */
export async function pendientesDocumentales(desdeAnio: string): Promise<{ gastosSinJustificante: number; facturasSinPdf: number; pdfDesactualizados: number }> {
  const [g, f, d] = await Promise.all([
    supabase.from("gastos").select("id", { count: "exact", head: true }).is("justificante_path", null).gte("fecha", desdeAnio).gt("importe", 0),
    supabase.from("facturas_estado").select("id", { count: "exact", head: true }).eq("estado", "emitida").eq("pdf_estado", "sin_pdf"),
    supabase.from("facturas_estado").select("id", { count: "exact", head: true }).neq("estado", "borrador").eq("pdf_estado", "desactualizado"),
  ]);
  const err = g.error || f.error || d.error;
  if (err) throw new Error(err.message);
  return { gastosSinJustificante: g.count ?? 0, facturasSinPdf: f.count ?? 0, pdfDesactualizados: d.count ?? 0 };
}
