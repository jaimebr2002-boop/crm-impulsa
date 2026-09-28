import type { Lead, Usuario } from "./types";
import { CANAL_LABEL, ESTADO_LABEL, ORIGEN_LABEL, SEGMENTO_LABEL } from "./constants";

const COLUMNAS: { cabecera: string; valor: (l: Lead, usuarios: Record<string, Usuario>) => unknown }[] = [
  { cabecera: "negocio", valor: (l) => l.negocio },
  { cabecera: "contacto", valor: (l) => l.nombre_contacto },
  { cabecera: "telefono", valor: (l) => l.telefono },
  { cabecera: "email", valor: (l) => l.email },
  { cabecera: "instagram", valor: (l) => l.instagram },
  { cabecera: "nicho", valor: (l) => l.nicho },
  { cabecera: "ciudad", valor: (l) => l.ciudad },
  { cabecera: "estado", valor: (l) => ESTADO_LABEL[l.estado] ?? l.estado },
  { cabecera: "segmento", valor: (l) => (l.segmento ? SEGMENTO_LABEL[l.segmento] ?? l.segmento : "") },
  { cabecera: "origen", valor: (l) => (l.origen ? ORIGEN_LABEL[l.origen] ?? l.origen : "") },
  { cabecera: "canal", valor: (l) => (l.canal ? CANAL_LABEL[l.canal] ?? l.canal : "") },
  { cabecera: "referido_por", valor: (l) => l.referido_por },
  { cabecera: "oferta", valor: (l) => l.oferta },
  // Coma decimal: el separador de campos es ";" para que Excel en español lo abra bien.
  { cabecera: "valor_eur", valor: (l) => (l.valor != null ? String(l.valor).replace(".", ",") : "") },
  { cabecera: "responsable", valor: (l, u) => (l.asignado_a ? u[l.asignado_a]?.nombre ?? "" : "") },
  { cabecera: "enlace_demo", valor: (l) => l.enlace_demo },
  { cabecera: "archivado", valor: (l) => (l.archivado ? "sí" : "") },
  { cabecera: "creado", valor: (l) => l.created_at?.slice(0, 10) },
  { cabecera: "actualizado", valor: (l) => l.updated_at?.slice(0, 10) },
];

function celda(v: unknown): string {
  let texto = v == null ? "" : String(v);
  // Evita inyección de fórmulas al abrir el CSV en Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(texto) && !/^[+-]?\d/.test(texto)) texto = `'${texto}`;
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function leadsACsv(leads: Lead[], usuarios: Record<string, Usuario>): string {
  const filas = [COLUMNAS.map((c) => c.cabecera).join(";")];
  for (const lead of leads) filas.push(COLUMNAS.map((c) => celda(c.valor(lead, usuarios))).join(";"));
  return filas.join("\r\n");
}

export function descargarCsv(nombreArchivo: string, contenido: string) {
  // BOM para que Excel detecte UTF-8 (tildes y eñes).
  const blob = new Blob(["﻿" + contenido], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
