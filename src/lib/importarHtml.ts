import { SINONIMOS_CAMPOS, filaDesdeCampos, type FilaImportada } from "./importar";

const ETIQUETAS_CAMPO = Object.keys(SINONIMOS_CAMPOS);

/**
 * Extrae leads de un HTML exportado desde herramientas anteriores.
 * Soporta dos formatos habituales, sin asumir una estructura fija:
 *  1) Una tabla <table> con cabecera (exportación típica de hoja de cálculo).
 *  2) Bloques repetidos con pares "Campo: valor" en su texto (fichas/listas).
 * Si no se reconoce ninguno, devuelve una lista vacía.
 */
export function parsearHtmlLeads(html: string): FilaImportada[] {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const desdeTabla = parsearDesdeTabla(doc);
  if (desdeTabla.length > 0) return desdeTabla;

  return parsearDesdeBloques(doc);
}

function textoCelda(celda: Element): string {
  return (celda.textContent ?? "").replace(/\s+/g, " ").trim();
}

function parsearDesdeTabla(doc: Document): FilaImportada[] {
  const tabla = doc.querySelector("table");
  if (!tabla) return [];

  const filasHtml = Array.from(tabla.querySelectorAll("tr"));
  if (filasHtml.length < 2) return [];

  const celdasCabecera = Array.from(filasHtml[0].querySelectorAll("th, td"));
  const claves = celdasCabecera.map((c) => SINONIMOS_CAMPOS[textoCelda(c).toLowerCase()] ?? null);

  if (claves.every((c) => c === null)) return [];

  const filas: FilaImportada[] = [];
  for (let i = 1; i < filasHtml.length; i++) {
    const celdas = Array.from(filasHtml[i].querySelectorAll("td, th"));
    if (celdas.length === 0) continue;

    const fila: Record<string, string> = {};
    claves.forEach((clave, idx) => {
      if (clave) fila[clave] = textoCelda(celdas[idx] ?? tabla.ownerDocument.createElement("td"));
    });
    filas.push(filaDesdeCampos(fila));
  }

  return filas;
}

/**
 * Busca bloques repetidos (misma clase entre hermanos, ≥2 apariciones) cuyo
 * texto contenga pares "Campo: valor" reconocibles.
 */
function parsearDesdeBloques(doc: Document): FilaImportada[] {
  const candidatos = encontrarBloquesRepetidos(doc.body);
  const filas: FilaImportada[] = [];

  for (const bloque of candidatos) {
    const campos = extraerCamposDeTexto(bloque.textContent ?? "");
    if (Object.keys(campos).length === 0) continue;
    filas.push(filaDesdeCampos(campos));
  }

  return filas;
}

function encontrarBloquesRepetidos(raiz: Element | null): Element[] {
  if (!raiz) return [];

  const gruposPorClase = new Map<string, Element[]>();
  const todos = raiz.querySelectorAll<HTMLElement>("[class]");

  for (const el of Array.from(todos)) {
    const clave = `${el.tagName}.${el.className}`;
    if (!gruposPorClase.has(clave)) gruposPorClase.set(clave, []);
    gruposPorClase.get(clave)!.push(el);
  }

  let mejorGrupo: Element[] = [];
  for (const grupo of gruposPorClase.values()) {
    if (grupo.length >= 2 && grupo.length > mejorGrupo.length) {
      // Evita elegir un contenedor demasiado grande (ej. <body> completo) como "fila".
      const textoPromedio = grupo.reduce((acc, el) => acc + (el.textContent?.length ?? 0), 0) / grupo.length;
      if (textoPromedio < 2000) mejorGrupo = grupo;
    }
  }

  return mejorGrupo;
}

function extraerCamposDeTexto(texto: string): Record<string, string> {
  const campos: Record<string, string> = {};
  const lineas = texto
    .split(/\n|(?=(?:[A-ZÁÉÍÓÚÑ][a-záéíóúñ_]+:))/)
    .map((l) => l.trim())
    .filter(Boolean);

  const patronEtiqueta = new RegExp(`^(${ETIQUETAS_CAMPO.join("|")})\\s*[:\\-]\\s*(.+)$`, "i");

  for (const linea of lineas) {
    const match = linea.match(patronEtiqueta);
    if (!match) continue;
    const clave = SINONIMOS_CAMPOS[match[1].toLowerCase()];
    const valor = match[2].trim();
    if (clave && valor) campos[clave] = valor;
  }

  return campos;
}
