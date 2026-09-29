import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

// Plantilla A4 ajustada a las facturas históricas de Impulsa Studio.
// Se muestran exactamente las cifras almacenadas; aquí no se recalcula nada.

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

const A4: [number, number] = [595.92, 842.88];
const NEGRO = rgb(0.102, 0.102, 0.102);
const GRIS = rgb(0.267, 0.267, 0.267);
const GRIS_TEXTO = rgb(0.533, 0.533, 0.533);
const GRIS_ETIQUETA = rgb(0.333, 0.333, 0.333);
const GRIS_CLARO = rgb(0.867, 0.867, 0.867);
const FONDO_CABECERA = rgb(0.957, 0.957, 0.957);
const FONDO_PAGO = rgb(0.98, 0.98, 0.98);
const ROJO_IRPF = rgb(0.702, 0.149, 0.118);
const X_IZQUIERDA = 51.75;
const X_DERECHA = 545.25;
const ANCHO = X_DERECHA - X_IZQUIERDA;

/** Nombre estable para la descarga, sin perder nombre ni apellidos. */
export function nombreArchivoFactura(numero: string, nombreCliente: string): string {
  const seguro = (valor: string) =>
    valor.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return `factura_${seguro(numero)}_${seguro(nombreCliente)}.pdf`;
}
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
  const paginas: PDFPage[] = [pdf.addPage(A4)];
  let pag = paginas[0];

  // `top` sigue las coordenadas de las facturas originales (origen arriba).
  const escribir = (p: PDFPage, s: string, x: number, top: number, o: { tam?: number; fuente?: PDFFont; color?: ReturnType<typeof rgb>; alinear?: "izq" | "der" } = {}) => {
    const tam = o.tam ?? 9;
    const fuente = o.fuente ?? normal;
    const t = texto(s);
    const ancho = fuente.widthOfTextAtSize(t, tam);
    const y = altoPag - top - fuente.heightAtSize(tam);
    p.drawText(t, { x: o.alinear === "der" ? x - ancho : x, y, size: tam, font: fuente, color: o.color ?? NEGRO });
  };
  const rect = (p: PDFPage, x: number, top: number, width: number, height: number, color: ReturnType<typeof rgb>) =>
    p.drawRectangle({ x, y: altoPag - top - height, width, height, color });
  const linea = (p: PDFPage, x1: number, x2: number, top: number, height: number, color: ReturnType<typeof rgb>) =>
    rect(p, x1, top, x2 - x1, height, color);
  const wrap = (s: string, font: PDFFont, size: number, width: number) => partir(s, font, size, width);
  const fechaEmisionEtiqueta = "Fecha emisión:";

  // ----- Cabecera histórica: título izquierdo, datos alineados a la derecha -----
  escribir(pag, f.estado === "cancelada" ? "FACTURA ANULADA" : "FACTURA", 51.75, 56, { tam: 26, fuente: negrita });
  const meta: [string, string][] = [
    ["N.º factura:", f.numero],
    [fechaEmisionEtiqueta, fechaPdf(f.fecha_emision)],
    ...(f.fecha_operacion ? ([["Fecha de operación (devengo):", fechaPdf(f.fecha_operacion)]] as [string, string][]) : []),
    ...(f.fecha_vencimiento ? ([["Vencimiento:", fechaPdf(f.fecha_vencimiento)]] as [string, string][]) : []),
  ];
  let metaTop = 53.2;
  for (const [label, value] of meta) {
    escribir(pag, label, 492.4, metaTop, { tam: 10, fuente: negrita, alinear: "der" });
    escribir(pag, value, X_DERECHA, metaTop, { tam: 10, alinear: "der" });
    metaTop += 16.85;
  }
  const metaCount = meta.length;
  const lineaCabeceraTop = 75.75 + metaCount * 12.75;
  linea(pag, X_IZQUIERDA, X_DERECHA, lineaCabeceraTop, 1.5, NEGRO);

  // ----- Emisor / cliente en dos columnas -----
  const partyTop = lineaCabeceraTop + 23.8;
  const xCliente = 309.75;
  escribir(pag, "EMISOR", X_IZQUIERDA, partyTop, { tam: 8.5, fuente: negrita, color: rgb(0.467, 0.467, 0.467) });
  escribir(pag, "CLIENTE", xCliente, partyTop, { tam: 8.5, fuente: negrita, color: rgb(0.467, 0.467, 0.467) });
  escribir(pag, emisor.nombre, X_IZQUIERDA, partyTop + 18.3, { tam: 11.5, fuente: negrita });
  escribir(pag, receptor.nombre, xCliente, partyTop + 18.3, { tam: 11.5, fuente: negrita });
  const postal = (cp: string, ciudad: string, provincia?: string | null) => `${cp} ${ciudad}${provincia && provincia !== ciudad ? `, ${provincia}` : ""}`;
  const lineaEmisor = [
    `NIF: ${emisor.nif}`,
    emisor.direccion,
    postal(emisor.codigo_postal, emisor.ciudad, emisor.provincia),
  ];
  const lineaCliente = [
    receptor.nif ? `NIF: ${receptor.nif}` : "",
    receptor.direccion ?? "",
    postal(receptor.codigo_postal ?? "", receptor.ciudad ?? "", receptor.provincia),
  ].filter((s): s is string => Boolean(s));
  lineaEmisor.forEach((s, i) => escribir(pag, s, X_IZQUIERDA, partyTop + 38.1 + i * 14.25, { tam: 9.5, color: GRIS }));
  lineaCliente.forEach((s, i) => escribir(pag, s, xCliente, partyTop + 38.1 + i * 14.25, { tam: 9.5, color: GRIS }));

  // ----- Líneas -----
  const tablaLabelTop = partyTop + 112.5;
  const tablaTop = tablaLabelTop - 8.8;
  const columnas = [X_IZQUIERDA, 311.25, 380.25, 462.75, X_DERECHA];
  for (let i = 0; i < columnas.length - 1; i++) rect(pag, columnas[i], tablaTop, columnas[i + 1] - columnas[i], 27.75, FONDO_CABECERA);
  escribir(pag, "CONCEPTO", 60.75, tablaLabelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333) });
  escribir(pag, "CANTIDAD", 370.4, tablaLabelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333), alinear: "der" });
  escribir(pag, "PRECIO (€)", 452.9, tablaLabelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333), alinear: "der" });
  escribir(pag, "IMPORTE (€)", 535.4, tablaLabelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333), alinear: "der" });

  const anchoConcepto = 238;
  const col = { cantidad: 370.4, precio: 453.7, importe: 536.2 };
  let rowTop = tablaLabelTop + 29.4;
  let ultimaFilaTop = rowTop;
  const cabeceraContinuacion = () => {
    const top = 72;
    const labelTop = top + 8.8;
    for (let i = 0; i < columnas.length - 1; i++) rect(pag, columnas[i], top, columnas[i + 1] - columnas[i], 27.75, FONDO_CABECERA);
    escribir(pag, "CONCEPTO", 60.75, labelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333) });
    escribir(pag, "CANTIDAD", 370.4, labelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333), alinear: "der" });
    escribir(pag, "PRECIO (€)", 452.9, labelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333), alinear: "der" });
    escribir(pag, "IMPORTE (€)", 535.4, labelTop, { tam: 8.5, fuente: negrita, color: rgb(0.333, 0.333, 0.333), alinear: "der" });
    rowTop = labelTop + 29.4;
  };

  for (const l of f.lineas) {
    const concepto = l.concepto?.trim() || l.descripcion;
    const descripcion = l.concepto?.trim() && l.concepto.trim() !== l.descripcion.trim() ? l.descripcion : "";
    const conceptos = wrap(concepto, normal, 10, anchoConcepto);
    const descripciones = descripcion ? wrap(descripcion, normal, 8.5, anchoConcepto) : [];
    const altoFila = conceptos.length * 15.6 + descripciones.length * 12 + 20.45;
    const limiteFila = paginas.length === 1 ? 535 : 410;
    if (rowTop + altoFila > limiteFila) {
      pag = pdf.addPage(A4);
      paginas.push(pag);
      cabeceraContinuacion();
    }
    conceptos.forEach((s, i) => escribir(pag, s, 60.75, rowTop + i * 15.6, { tam: 10 }));
    descripciones.forEach((s, i) => escribir(pag, s, 60.75, rowTop + conceptos.length * 15.6 + i * 12, { tam: 8.5, color: GRIS_TEXTO }));
    escribir(pag, cantidadPdf(l.cantidad), col.cantidad, rowTop, { tam: 10, alinear: "der" });
    escribir(pag, importePdf(l.precio_unitario).replace(" €", ""), col.precio, rowTop, { tam: 10, alinear: "der" });
    escribir(pag, importePdf(l.importe).replace(" €", ""), col.importe, rowTop, { tam: 10, alinear: "der" });
    const lastLineTop = descripciones.length
      ? rowTop + conceptos.length * 15.6 + (descripciones.length - 1) * 12
      : rowTop + (conceptos.length - 1) * 15.6;
    ultimaFilaTop = lastLineTop + 20.45;
    linea(pag, X_IZQUIERDA, X_DERECHA, ultimaFilaTop, 0.75, rgb(0.933, 0.933, 0.933));
    rowTop = ultimaFilaTop + 12;
  }

  // ----- Totales: regla fina y caja negra como las facturas originales -----
  const tieneIrpf = Number(f.irpf_pct) > 0 || Number(f.irpf) > 0;
  const xTotal = tieneIrpf ? 258.75 : 273.75;
  const xEtiqueta = xTotal + 9.25;
  linea(pag, xTotal + 15, X_DERECHA, ultimaFilaTop + 18.75, 0.75, GRIS_CLARO);
  let totalTop = ultimaFilaTop + 28.45;
  const filaTotal = (label: string, value: string, color = NEGRO) => {
    escribir(pag, label, xEtiqueta, totalTop, { tam: 10, color });
    escribir(pag, value, X_DERECHA - 9, totalTop, { tam: 10, color, alinear: "der" });
    totalTop += 23.25;
  };
  filaTotal("Base imponible", importePdf(f.base));
  filaTotal(`IVA (${porcentajePdf(f.iva_pct)})`, `+ ${importePdf(f.iva)}`);
  if (tieneIrpf) filaTotal(`Retención IRPF (${porcentajePdf(f.irpf_pct)})`, `- ${importePdf(f.irpf)}`, ROJO_IRPF);
  const cajaTotalTop = totalTop + 0.8;
  rect(pag, xTotal, cajaTotalTop, X_DERECHA - xTotal, 35.25, NEGRO);
  escribir(pag, "TOTAL A PAGAR", xEtiqueta, cajaTotalTop + 10.85, { tam: 12, fuente: negrita, color: rgb(1, 1, 1) });
  escribir(pag, importePdf(f.total), X_DERECHA - 9, cajaTotalTop + 10.85, { tam: 12, fuente: negrita, color: rgb(1, 1, 1), alinear: "der" });

  // ----- Caja gris de pago -----
  const pagoTop = cajaTotalTop + 62.25;
  const pagoAltura = 99;
  if (f.estado !== "cancelada") {
    rect(pag, X_IZQUIERDA, pagoTop, ANCHO, pagoAltura, FONDO_PAGO);
    rect(pag, X_IZQUIERDA, pagoTop, 2.25, pagoAltura, NEGRO);
    escribir(pag, "DATOS DE PAGO", 67.5, pagoTop + 12.85, { tam: 9, fuente: negrita, color: GRIS_ETIQUETA });
    escribir(pag, "Transferencia bancaria a:", 67.5, pagoTop + 30.4, { tam: 9.5 });
    const iban = emisor.iban ? emisor.iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim() : "";
    if (iban) escribir(pag, iban, 67.5, pagoTop + 44, { tam: 11, fuente: await pdf.embedFont(StandardFonts.CourierBold) });
    if (emisor.titular_iban) escribir(pag, `Titular: ${emisor.titular_iban}`, 67.5, pagoTop + 60.4, { tam: 9.5 });
    escribir(pag, `Concepto: ${f.concepto_pago?.trim() || `Factura ${f.numero}`}${f.estado_cobro === "cobrada" && f.ultimo_cobro ? ` — Cobrada el ${fechaPdf(f.ultimo_cobro)}` : ""}`, 67.5, pagoTop + 73.9, { tam: 9.5 });
  }

  // Las cláusulas proceden de la plantilla que aparece en las facturas 001–003.
  const legalIrpf = `Operación sujeta a IVA al tipo general del ${porcentajePdf(f.iva_pct)}. Se practica retención a cuenta del IRPF del ${porcentajePdf(f.irpf_pct)}, tipo reducido aplicable al período de inicio de actividad profesional y los dos siguientes (art. 101.5.d LIRPF y art. 95.1 del Reglamento del IRPF), comunicado al pagador conforme a dicho artículo.`;
  const legalSinIrpf = `Operación sujeta a IVA al tipo general del ${porcentajePdf(f.iva_pct)}. No se practica retención a cuenta del IRPF por tratarse de un destinatario que no actúa en condición de empresario o profesional (art. 76 del Reglamento del IRPF).`;
  const legalPrivacidad = "Factura emitida conforme al Real Decreto 1619/2012, por el que se aprueba el Reglamento de obligaciones de facturación. Los datos personales recogidos se tratan conforme al RGPD (UE) 2016/679 y la LOPDGDD 3/2018. Puede ejercer sus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad dirigiéndose al emisor en el domicilio indicado en esta factura.";
  const legalDevengo = f.fecha_operacion
    ? `Fecha de operación (devengo del IVA): ${fechaPdf(f.fecha_operacion)}. Fecha de expedición: ${fechaPdf(f.fecha_emision)}, dentro del plazo legal para operaciones entre empresarios/profesionales (art. 11 del Reglamento de facturación, RD 1619/2012).`
    : "";
  const legalCustom = f.texto_legal?.trim() || emisor.texto_legal?.trim();
  const bloquesLegales = [f.estado === "cancelada" ? "Factura anulada. Este documento no es exigible." : legalCustom || (tieneIrpf ? legalIrpf : legalSinIrpf), legalDevengo, legalPrivacidad].filter(Boolean);
  let legalTop = pagoTop + pagoAltura + 43.2;
  linea(pag, X_IZQUIERDA, X_DERECHA, legalTop - 13, 0.75, rgb(0.898, 0.898, 0.898));
  for (const bloque of bloquesLegales) {
    for (const r of wrap(bloque, normal, 8, ANCHO)) {
      if (legalTop > altoPag - 40) {
        pag = pdf.addPage(A4);
        paginas.push(pag);
        legalTop = 58;
        linea(pag, X_IZQUIERDA, X_DERECHA, 50, 0.75, rgb(0.898, 0.898, 0.898));
      }
      escribir(pag, r, X_IZQUIERDA, legalTop, { tam: 8, color: GRIS_TEXTO });
      legalTop += 12;
    }
  }

  // El formato histórico no muestra contador de página en facturas de una hoja.
  if (paginas.length > 1) {
    paginas.forEach((p, i) => escribir(p, `Factura ${f.numero} · Página ${i + 1} de ${paginas.length}`, X_DERECHA, altoPag - 28, { tam: 7.5, color: GRIS_TEXTO, alinear: "der" }));
  }

  return pdf.save();
}
