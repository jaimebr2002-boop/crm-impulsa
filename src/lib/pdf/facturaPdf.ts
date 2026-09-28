import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

// PDF de factura A4 generado en el servidor con pdf-lib (sin capturas de HTML).
// Negro y grises: se lee perfectamente impreso en blanco y negro. El verde de
// marca solo aparece como una línea fina arriba (en gris claro al imprimir).
// Muestra EXACTAMENTE lo guardado en la factura: porcentajes y totales vienen
// de la base de datos, aquí no se recalcula nada.

export type DatosEmisor = {
  nombre: string;
  nif: string;
  direccion: string;
  codigo_postal: string;
  ciudad: string;
  provincia?: string | null;
  pais?: string | null;
  email?: string | null;
  telefono?: string | null;
  iban?: string | null;
  texto_legal?: string | null;
};

export type DatosReceptor = {
  nombre: string;
  nif?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  pais?: string | null;
  email?: string | null;
};

export type DatosFacturaPdf = {
  numero: string;
  estado: "emitida" | "cancelada";
  fecha_emision: string; // YYYY-MM-DD
  fecha_vencimiento: string | null;
  iva_pct: number | string;
  irpf_pct: number | string;
  base: number | string;
  iva: number | string;
  irpf: number | string;
  total: number | string;
  lineas: { descripcion: string; cantidad: number | string; precio_unitario: number | string; importe: number | string }[];
};

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 50;
const NEGRO = rgb(0.07, 0.07, 0.07);
const GRIS = rgb(0.4, 0.4, 0.4);
const GRIS_CLARO = rgb(0.85, 0.85, 0.85);
const FONDO = rgb(0.96, 0.96, 0.96);
const VERDE = rgb(0xaa / 255, 1, 0);

// ---------- Formato ----------

/** 1140 → "1.140,00 €" (con separador de miles siempre, como en una factura). */
export function importePdf(v: number | string): string {
  const n = Number(v);
  const signo = n < 0 ? "-" : "";
  const [ent, dec] = Math.abs(n).toFixed(2).split(".");
  return `${signo}${ent.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec} €`;
}

export function porcentajePdf(v: number | string): string {
  return `${String(Number(v)).replace(".", ",")} %`;
}

function fechaPdf(ymd: string | null): string {
  if (!ymd) return "";
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

function cantidadPdf(v: number | string): string {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}

// Las fuentes estándar de PDF solo codifican WinAnsi (latín occidental + €).
// Cualquier otro carácter (emojis, "−", "✓"…) se sustituye para no fallar.
const WIN_ANSI_EXTRA = new Set(Array.from("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"));
function texto(s: string | null | undefined): string {
  return Array.from((s ?? "").replace(/−/g, "-").replace(/\t/g, " "))
    .map((c) => {
      const code = c.codePointAt(0) ?? 0;
      if (c === "\n") return c;
      if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(c)) return c;
      return "?";
    })
    .join("");
}

/** Parte un texto en líneas que caben en `ancho`. */
function partir(s: string, fuente: PDFFont, tam: number, ancho: number): string[] {
  const lineas: string[] = [];
  for (const parrafo of texto(s).split("\n")) {
    let actual = "";
    for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (fuente.widthOfTextAtSize(prueba, tam) <= ancho) {
        actual = prueba;
        continue;
      }
      if (actual) lineas.push(actual);
      // Palabra más larga que la línea: se corta.
      let resto = palabra;
      while (fuente.widthOfTextAtSize(resto, tam) > ancho) {
        let i = resto.length;
        while (i > 1 && fuente.widthOfTextAtSize(resto.slice(0, i), tam) > ancho) i--;
        lineas.push(resto.slice(0, i));
        resto = resto.slice(i);
      }
      actual = resto;
    }
    lineas.push(actual);
  }
  return lineas.length ? lineas : [""];
}

// ---------- Documento ----------

export async function crearPdfFactura(f: DatosFacturaPdf, emisor: DatosEmisor, receptor: DatosReceptor): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Factura ${f.numero}`);
  pdf.setAuthor(texto(emisor.nombre));
  pdf.setSubject(`Factura ${f.numero} · ${texto(receptor.nombre)}`);
  pdf.setCreator("Impulsa Company OS");
  pdf.setProducer("pdf-lib");
  pdf.setLanguage("es-ES");

  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [anchoPag, altoPag] = A4;
  const derecha = anchoPag - MARGEN;
  const anchoUtil = anchoPag - MARGEN * 2;

  const paginas: PDFPage[] = [];
  let pag = pdf.addPage(A4);
  paginas.push(pag);

  const escribir = (p: PDFPage, s: string, x: number, y: number, o: { tam?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb>; alinear?: "izq" | "der" } = {}) => {
    const tam = o.tam ?? 9;
    const fuente = o.fuente ?? normal;
    const t = texto(s);
    const ancho = fuente.widthOfTextAtSize(t, tam);
    p.drawText(t, { x: o.alinear === "der" ? x - ancho : x, y, size: tam, font: fuente, color: o.color ?? NEGRO });
  };

  // Línea de marca, muy fina.
  pag.drawRectangle({ x: 0, y: altoPag - 4, width: anchoPag, height: 4, color: VERDE });

  // ----- Cabecera: emisor (izquierda) y datos de la factura (derecha) -----
  let y = altoPag - MARGEN - 8;
  escribir(pag, emisor.nombre, MARGEN, y, { tam: 12, fuente: negrita });
  const lineasEmisor = [
    `NIF ${emisor.nif}`,
    emisor.direccion,
    [emisor.codigo_postal, emisor.ciudad, emisor.provincia && emisor.provincia !== emisor.ciudad ? `(${emisor.provincia})` : ""].filter(Boolean).join(" "),
    emisor.pais && emisor.pais !== "España" ? emisor.pais : "",
    [emisor.email, emisor.telefono].filter(Boolean).join(" · "),
  ].filter(Boolean);
  let ye = y - 15;
  for (const l of lineasEmisor) {
    escribir(pag, l, MARGEN, ye, { color: GRIS });
    ye -= 12;
  }

  escribir(pag, f.estado === "cancelada" ? "FACTURA ANULADA" : "FACTURA", derecha, y + 2, { tam: f.estado === "cancelada" ? 16 : 20, fuente: negrita, alinear: "der" });
  const meta: [string, string][] = [
    ["Número", f.numero],
    ["Fecha", fechaPdf(f.fecha_emision)],
    ...(f.fecha_vencimiento ? ([["Vencimiento", fechaPdf(f.fecha_vencimiento)]] as [string, string][]) : []),
  ];
  let ym = y - 20;
  for (const [k, v] of meta) {
    escribir(pag, k, derecha - 110, ym, { color: GRIS });
    escribir(pag, v, derecha, ym, { fuente: negrita, alinear: "der" });
    ym -= 13;
  }
  if (f.estado === "cancelada") {
    escribir(pag, "Esta factura ha sido anulada y no es exigible.", derecha, ym - 2, { tam: 8, color: GRIS, alinear: "der" });
    ym -= 12;
  }

  // ----- Destinatario -----
  y = Math.min(ye, ym) - 22;
  pag.drawLine({ start: { x: MARGEN, y: y + 12 }, end: { x: derecha, y: y + 12 }, thickness: 0.5, color: GRIS_CLARO });
  escribir(pag, "FACTURAR A", MARGEN, y - 4, { tam: 7.5, fuente: negrita, color: GRIS });
  y -= 19;
  escribir(pag, receptor.nombre, MARGEN, y, { tam: 10.5, fuente: negrita });
  y -= 13;
  for (const l of [
    receptor.nif ? `NIF/CIF ${receptor.nif}` : "",
    receptor.direccion ?? "",
    [receptor.codigo_postal, receptor.ciudad, receptor.provincia && receptor.provincia !== receptor.ciudad ? `(${receptor.provincia})` : ""].filter(Boolean).join(" "),
    receptor.pais && receptor.pais !== "España" ? receptor.pais : "",
    receptor.email ?? "",
  ].filter(Boolean)) {
    escribir(pag, l, MARGEN, y, { color: GRIS });
    y -= 12;
  }

  // ----- Líneas -----
  const col = { cantidad: derecha - 190, precio: derecha - 85, importe: derecha };
  const anchoConcepto = col.cantidad - 40 - MARGEN - 8;
  const cabeceraTabla = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: MARGEN, y: yy - 6, width: anchoUtil, height: 20, color: FONDO });
    escribir(p, "Concepto", MARGEN + 8, yy, { tam: 8, fuente: negrita, color: GRIS });
    escribir(p, "Cant.", col.cantidad, yy, { tam: 8, fuente: negrita, color: GRIS, alinear: "der" });
    escribir(p, "Precio", col.precio, yy, { tam: 8, fuente: negrita, color: GRIS, alinear: "der" });
    escribir(p, "Importe", col.importe - 8, yy, { tam: 8, fuente: negrita, color: GRIS, alinear: "der" });
    return yy - 24;
  };
  y = cabeceraTabla(pag, y - 22);

  for (const l of f.lineas) {
    const renglones = partir(l.descripcion, normal, 9.5, anchoConcepto);
    // Alto de la fila: renglones + margen; el separador va por debajo de los descendentes.
    const ultimo = (renglones.length - 1) * 12;
    const alto = ultimo + 21;
    if (y - alto < 170) {
      pag = pdf.addPage(A4);
      paginas.push(pag);
      y = cabeceraTabla(pag, altoPag - MARGEN - 10);
    }
    renglones.forEach((r, i) => escribir(pag, r, MARGEN + 8, y - i * 12, { tam: 9.5 }));
    escribir(pag, cantidadPdf(l.cantidad), col.cantidad, y, { tam: 9.5, alinear: "der" });
    escribir(pag, importePdf(l.precio_unitario), col.precio, y, { tam: 9.5, alinear: "der" });
    escribir(pag, importePdf(l.importe), col.importe - 8, y, { tam: 9.5, alinear: "der" });
    const separador = y - ultimo - 7;
    pag.drawLine({ start: { x: MARGEN, y: separador }, end: { x: derecha, y: separador }, thickness: 0.4, color: GRIS_CLARO });
    y -= alto;
  }

  // ----- Totales -----
  if (y < 200) {
    pag = pdf.addPage(A4);
    paginas.push(pag);
    y = altoPag - MARGEN - 10;
  }
  y -= 12;
  const xEtiqueta = derecha - 200;
  const filaTotal = (k: string, v: string) => {
    escribir(pag, k, xEtiqueta, y, { color: GRIS });
    escribir(pag, v, derecha - 8, y, { alinear: "der" });
    y -= 15;
  };
  filaTotal("Base imponible", importePdf(f.base));
  filaTotal(`IVA ${porcentajePdf(f.iva_pct)}`, importePdf(f.iva));
  if (Number(f.irpf_pct) > 0 || Number(f.irpf) > 0) filaTotal(`Retención IRPF ${porcentajePdf(f.irpf_pct)}`, `-${importePdf(f.irpf)}`);
  pag.drawLine({ start: { x: xEtiqueta, y: y + 9 }, end: { x: derecha, y: y + 9 }, thickness: 1, color: NEGRO });
  y -= 6;
  escribir(pag, "TOTAL", xEtiqueta, y, { tam: 11, fuente: negrita });
  escribir(pag, importePdf(f.total), derecha - 8, y, { tam: 13, fuente: negrita, alinear: "der" });

  // ----- Pago y texto legal (pie de la última página) -----
  let yp = 110;
  const pie: string[] = [];
  // En una factura anulada no se indica forma de pago.
  if (emisor.iban && f.estado !== "cancelada") pie.push(`Forma de pago: transferencia bancaria a ${emisor.iban.replace(/(.{4})/g, "$1 ").trim()}${f.fecha_vencimiento ? `, antes del ${fechaPdf(f.fecha_vencimiento)}` : ""}.`);
  if (emisor.texto_legal) pie.push(emisor.texto_legal);
  if (pie.length) {
    pag.drawLine({ start: { x: MARGEN, y: yp + 16 }, end: { x: derecha, y: yp + 16 }, thickness: 0.5, color: GRIS_CLARO });
    for (const bloque of pie)
      for (const r of partir(bloque, normal, 8, anchoUtil)) {
        if (yp < 40) break;
        escribir(pag, r, MARGEN, yp, { tam: 8, color: GRIS });
        yp -= 11;
      }
  }

  // Numeración de páginas.
  paginas.forEach((p, i) => {
    escribir(p, `Factura ${f.numero} · Página ${i + 1} de ${paginas.length}`, derecha, 28, { tam: 7.5, color: GRIS, alinear: "der" });
  });

  return pdf.save();
}
