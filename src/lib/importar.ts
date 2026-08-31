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
  canal: string;
  origen: string;
  estado: string;
  referido_por: string;
  oferta: string;
  valida: boolean;
  posibleDuplicado: boolean;
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
    canal: fila.canal ?? "",
    origen: fila.origen ?? "",
    estado: fila.estado ?? "",
    referido_por: fila.referido_por ?? "",
    oferta: fila.oferta ?? "",
    valida: Boolean(fila.negocio || fila.nombre_contacto || fila.telefono || fila.email),
    posibleDuplicado: false,
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

/** Qué campos de FilaImportada tienen valor en al menos una fila — para mostrar qué se ha reconocido del archivo. */
export function camposDetectados(filas: FilaImportada[]): (keyof FilaImportada)[] {
  const campos: (keyof FilaImportada)[] = [
    "negocio",
    "nombre_contacto",
    "telefono",
    "email",
    "ciudad",
    "nicho",
    "canal",
    "referido_por",
    "origen",
    "segmento",
    "oferta",
    "estado",
    "enlace_demo",
    "nota",
  ];
  return campos.filter((campo) => filas.some((f) => String(f[campo]).trim().length > 0));
}

function normalizarTelefono(telefono: string): string {
  return telefono.trim().replace(/[\s-]/g, "").replace(/^\+34/, "").replace(/^0034/, "");
}

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Marca cada fila con posibleDuplicado si su teléfono o email coincide con un
 * lead ya existente en Supabase, o con otra fila anterior del mismo archivo.
 * No excluye ni modifica nada: solo informa, la decisión es del usuario.
 */
export function marcarDuplicados(
  filas: FilaImportada[],
  existentes: { telefono: string | null; email: string | null }[]
): FilaImportada[] {
  const telefonosExistentes = new Set(
    existentes.map((e) => (e.telefono ? normalizarTelefono(e.telefono) : "")).filter(Boolean)
  );
  const emailsExistentes = new Set(
    existentes.map((e) => (e.email ? normalizarEmail(e.email) : "")).filter(Boolean)
  );
  const vistosEnArchivo = new Set<string>();

  return filas.map((fila) => {
    const tel = fila.telefono ? normalizarTelefono(fila.telefono) : "";
    const email = fila.email ? normalizarEmail(fila.email) : "";

    let posibleDuplicado = false;
    if (tel && (telefonosExistentes.has(tel) || vistosEnArchivo.has(`tel:${tel}`))) posibleDuplicado = true;
    if (email && (emailsExistentes.has(email) || vistosEnArchivo.has(`email:${email}`))) posibleDuplicado = true;

    if (tel) vistosEnArchivo.add(`tel:${tel}`);
    if (email) vistosEnArchivo.add(`email:${email}`);

    return { ...fila, posibleDuplicado };
  });
}
