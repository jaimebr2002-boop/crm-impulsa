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
  titular_iban?: string | null;
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
  fecha_operacion?: string | null;
  fecha_vencimiento: string | null;
  ultimo_cobro?: string | null;
  estado_cobro?: "pendiente" | "parcial" | "cobrada" | "vencida" | "cancelada" | "borrador";
  texto_legal?: string | null;
  concepto_pago?: string | null;
  iva_pct: number | string;
  irpf_pct: number | string;
  base: number | string;
  iva: number | string;
  irpf: number | string;
  total: number | string;
  lineas: { concepto?: string | null; descripcion: string; cantidad: number | string; precio_unitario: number | string; importe: number | string }[];
};

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 50;
const NEGRO = rgb(0.07, 0.07, 0.07);
const GRIS = rgb(0.4, 0.4, 0.4);
const GRIS_CLARO = rgb(0.85, 0.85, 0.85);
const FONDO = rgb(0.96, 0.96, 0.96);

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

  // ----- Cabecera de factura -----
  escribir(pag, f.estado === "cancelada" ? "FACTURA ANULADA" : "FACTURA", MARGEN, altoPag - MARGEN - 4, { tam: 24, fuente: negrita });
  const meta: [string, string][] = [
    ["N.º factura", f.numero],
    ["Fecha expedición", fechaPdf(f.fecha_emision)],
    ...(f.fecha_operacion ? ([["Devengo", fechaPdf(f.fecha_operacion)]] as [string, string][]) : []),
    ...(f.fecha_vencimiento ? ([["Vencimiento", fechaPdf(f.fecha_vencimiento)]] as [string, string][]) : []),
  ];
  let ym = altoPag - MARGEN - 2;
  for (const [k, v] of meta) {
    escribir(pag, k, derecha - 130, ym, { tam: 8, color: GRIS });
    escribir(pag, v, derecha, ym, { fuente: negrita, alinear: "der" });
    ym -= 13;
  }
  const lineaCabecera = Math.min(altoPag - 100, ym - 10);
  pag.drawLine({ start: { x: MARGEN, y: lineaCabecera }, end: { x: derecha, y: lineaCabecera }, thickness: 1, color: NEGRO });

  // ----- Emisor / cliente en dos columnas -----
  let y = lineaCabecera - 18;
  const mitad = MARGEN + anchoUtil / 2 + 12;
  escribir(pag, "EMISOR", MARGEN, y, { tam: 7.5, fuente: negrita, color: GRIS });
  escribir(pag, "CLIENTE", mitad, y, { tam: 7.5, fuente: negrita, color: GRIS });
  y -= 15;
  escribir(pag, emisor.nombre, MARGEN, y, { tam: 10.5, fuente: negrita });
  escribir(pag, receptor.nombre, mitad, y, { tam: 10.5, fuente: negrita });
  y -= 13;
  const emisorLineas = [`NIF ${emisor.nif}`, emisor.direccion,
    [emisor.codigo_postal, emisor.ciudad, emisor.provincia && emisor.provincia !== emisor.ciudad ? `(${emisor.provincia})` : ""].filter(Boolean).join(" "),
    emisor.pais && emisor.pais !== "España" ? emisor.pais : "", emisor.email, emisor.telefono].filter((l): l is string => !!l);
  const clienteLineas = [receptor.nif ? `NIF/CIF ${receptor.nif}` : "", receptor.direccion ?? "",
    [receptor.codigo_postal, receptor.ciudad, receptor.provincia && receptor.provincia !== receptor.ciudad ? `(${receptor.provincia})` : ""].filter(Boolean).join(" "),
    receptor.pais && receptor.pais !== "España" ? receptor.pais : "", receptor.email ?? ""].filter((l): l is string => !!l);
  const yColumnas = y;
  for (const l of emisorLineas) { escribir(pag, l, MARGEN, y, { tam: 8.5, color: GRIS }); y -= 12; }
  let yCliente = yColumnas;
  for (const l of clienteLineas) { escribir(pag, l, mitad, yCliente, { tam: 8.5, color: GRIS }); yCliente -= 12; }
  y = Math.min(y, yCliente) - 12;

  // ----- Líneas -----
  const col = { cantidad: derecha - 205, precio: derecha - 100, importe: derecha };
  const anchoConcepto = col.cantidad - 40 - MARGEN - 8;
  const cabeceraTabla = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: MARGEN, y: yy - 6, width: anchoUtil, height: 20, color: FONDO });
    escribir(p, "CONCEPTO", MARGEN + 8, yy, { tam: 8, fuente: negrita, color: GRIS });
    escribir(p, "CANTIDAD", col.cantidad, yy, { tam: 8, fuente: negrita, color: GRIS, alinear: "der" });
    escribir(p, "PRECIO (€)", col.precio, yy, { tam: 8, fuente: negrita, color: GRIS, alinear: "der" });
    escribir(p, "IMPORTE (€)", col.importe - 8, yy, { tam: 8, fuente: negrita, color: GRIS, alinear: "der" });
    return yy - 24;
  };
  y = cabeceraTabla(pag, y - 22);

  for (const l of f.lineas) {
    const concepto = l.concepto?.trim() || l.descripcion;
    const descripcion = l.concepto?.trim() && l.concepto.trim() !== l.descripcion.trim() ? l.descripcion : "";
    const renglones = partir(concepto, normal, 9.5, anchoConcepto);
    // Alto de la fila: renglones + margen; el separador va por debajo de los descendentes.
    const descripciones = descripcion ? partir(descripcion, normal, 8, anchoConcepto) : [];
    const ultimo = (renglones.length - 1) * 12 + descripciones.length * 10;
    const alto = ultimo + 21;
    if (y - alto < 170) {
      pag = pdf.addPage(A4);
      paginas.push(pag);
      y = cabeceraTabla(pag, altoPag - MARGEN - 10);
    }
    renglones.forEach((r, i) => escribir(pag, r, MARGEN + 8, y - i * 12, { tam: 9.5 }));
    descripciones.forEach((r, i) => escribir(pag, r, MARGEN + 8, y - renglones.length * 12 - i * 10, { tam: 8, color: GRIS }));
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
  y -= 7;
  pag.drawRectangle({ x: xEtiqueta - 8, y: y - 7, width: derecha - xEtiqueta + 8, height: 34, color: NEGRO });
  escribir(pag, "TOTAL A PAGAR", xEtiqueta, y + 5, { tam: 10, fuente: negrita, color: rgb(1, 1, 1) });
  escribir(pag, importePdf(f.total), derecha - 8, y + 3, { tam: 14, fuente: negrita, color: rgb(1, 1, 1), alinear: "der" });

  // ----- Pago y texto legal (pie de la última página) -----
  if (f.estado !== "cancelada") {
    pag.drawRectangle({ x: MARGEN, y: 68, width: anchoUtil, height: 52, color: FONDO });
    pag.drawLine({ start: { x: MARGEN + 5, y: 72 }, end: { x: MARGEN + 5, y: 116 }, thickness: 2, color: NEGRO });
    escribir(pag, "DATOS DE PAGO", MARGEN + 16, 106, { tam: 7.5, fuente: negrita, color: GRIS });
    const datosPago = [
      emisor.iban ? `IBAN: ${emisor.iban.replace(/(.{4})/g, "$1 ").trim()}` : "",
      emisor.titular_iban ? `Titular: ${emisor.titular_iban}` : "",
      `Concepto: ${f.concepto_pago || `Factura ${f.numero}`}`,
      f.estado_cobro === "cobrada" && f.ultimo_cobro ? `Cobrada el ${fechaPdf(f.ultimo_cobro)}` : "",
    ].filter(Boolean);
    let yPago = 93;
    for (const dato of datosPago) { escribir(pag, dato, MARGEN + 16, yPago, { tam: 8.5 }); yPago -= 11; }
  }
  const textoLegal = f.estado === "cancelada"
    ? "Factura cancelada. Este documento no es exigible."
    : f.texto_legal?.trim() || emisor.texto_legal?.trim() || (Number(f.irpf_pct) > 0
      ? `Operación sujeta a IVA al tipo general del ${porcentajePdf(f.iva_pct)}. Se practica retención a cuenta del IRPF del ${porcentajePdf(f.irpf_pct)}.`
      : `Operación sujeta a IVA al tipo general del ${porcentajePdf(f.iva_pct)}. No se practica retención a cuenta del IRPF.`);
  const renglonesLegales = partir(textoLegal, normal, 7.5, anchoUtil);
  if (renglonesLegales.length > 4) {
    pag = pdf.addPage(A4);
    paginas.push(pag);
    pag.drawLine({ start: { x: MARGEN, y: altoPag - MARGEN }, end: { x: derecha, y: altoPag - MARGEN }, thickness: 1, color: NEGRO });
  }
  let yp = renglonesLegales.length > 4 ? altoPag - MARGEN - 22 : 52;
  for (const r of renglonesLegales) { escribir(pag, r, MARGEN, yp, { tam: 7.5, color: GRIS }); yp -= 10; }

  // Numeración de páginas.
  paginas.forEach((p, i) => {
    escribir(p, `Factura ${f.numero} · Página ${i + 1} de ${paginas.length}`, derecha, 28, { tam: 7.5, color: GRIS, alinear: "der" });
  });

  return pdf.save();
}
