export const SINONIMOS_CAMPOS: Record<string, string> = {
  negocio: "negocio",
  empresa: "negocio",
  contacto: "nombre_contacto",
  nombre_contacto: "nombre_contacto",
  nombre: "nombre_contacto",
  telefono: "telefono",
  "teléfono": "telefono",
  phone: "telefono",
  email: "email",
  correo: "email",
  "e-mail": "email",
  enlace_demo: "enlace_demo",
  demo: "enlace_demo",
  link_demo: "enlace_demo",
  enlace: "enlace_demo",
  segmento: "segmento",
  nota: "nota",
  notas: "nota",
  nota_cualitativa: "nota",
  ciudad: "ciudad",
  nicho: "nicho",
  canal: "canal",
  origen: "origen",
  oferta: "oferta",
  estado: "estado",
  referido_por: "referido_por",
  referido: "referido_por",
};

export type FilaImportada = {
  negocio: string;
  nombre_contacto: string;
  telefono: string;
  email: string;
  enlace_demo: string;
  segmento: string;
  nota: string;
  ciudad: string;
  nicho: string;
  valida: boolean;
};

/** Construye una fila normalizada a partir de un mapa campo→valor ya traducido con SINONIMOS_CAMPOS. */
export function filaDesdeCampos(fila: Record<string, string>): FilaImportada {
  return {
    negocio: fila.negocio ?? "",
    nombre_contacto: fila.nombre_contacto ?? "",
    telefono: fila.telefono ?? "",
    email: fila.email ?? "",
    enlace_demo: fila.enlace_demo ?? "",
    segmento: fila.segmento ?? "",
    nota: fila.nota ?? "",
    ciudad: fila.ciudad ?? "",
    nicho: fila.nicho ?? "",
    valida: Boolean(fila.negocio || fila.nombre_contacto || fila.telefono || fila.email),
  };
}

function detectarDelimitador(primeraLinea: string): string {
  if (primeraLinea.includes("\t")) return "\t";
  if (primeraLinea.includes(";")) return ";";
  return ",";
}

function parsearLinea(linea: string, delimitador: string): string[] {
  const campos: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i++) {
    const char = linea[i];
    if (char === '"') {
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i++;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (char === delimitador && !entreComillas) {
      campos.push(actual.trim());
      actual = "";
    } else {
      actual += char;
    }
  }
  campos.push(actual.trim());
  return campos;
}

export function parsearImportacion(texto: string): FilaImportada[] {
  const lineas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lineas.length === 0) return [];

  const delimitador = detectarDelimitador(lineas[0]);
  const cabeceras = parsearLinea(lineas[0], delimitador).map((h) => h.trim().toLowerCase());
  const claves = cabeceras.map((h) => SINONIMOS_CAMPOS[h] ?? null);

  const filas: FilaImportada[] = [];
  for (let i = 1; i < lineas.length; i++) {
    const valores = parsearLinea(lineas[i], delimitador);
    const fila: Record<string, string> = {};
    claves.forEach((clave, idx) => {
      if (clave) fila[clave] = (valores[idx] ?? "").trim();
    });
    filas.push(filaDesdeCampos(fila));
  }

  return filas;
}
