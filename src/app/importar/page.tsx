"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  parsearImportacion,
  camposDetectados,
  marcarDuplicados,
  type FilaImportada,
} from "@/lib/importar";
import { parsearHtmlLeads } from "@/lib/importarHtml";
import { crearLead, listarLeads } from "@/lib/data/leads";
import { crearInteraccion } from "@/lib/data/interacciones";
import { listarUsuarios } from "@/lib/data/usuarios";
import { useUsuario } from "@/context/UsuarioContext";
import { ORIGENES, ORIGEN_LABEL } from "@/lib/constants";
import { IconCheck, IconImportar } from "@/components/Icons";
import type { Usuario } from "@/lib/types";

const EJEMPLO = `negocio\tcontacto\ttelefono\temail\tenlace_demo\tsegmento\torigen\tnota
Clínica Dental Sonrisa\tAna Pérez\t610123456\tana@clinica.es\thttps://demo.impulsa.studio/sonrisa\tcaliente\treactivacion_web\tMuy interesada, pidió precio final`;

const ETIQUETA_CAMPO: Record<string, string> = {
  negocio: "Negocio",
  nombre_contacto: "Contacto",
  telefono: "Teléfono",
  email: "Email",
  ciudad: "Ciudad",
  nicho: "Nicho",
  canal: "Canal",
  referido_por: "Referido por",
  origen: "Origen",
  segmento: "Segmento",
  oferta: "Oferta",
  estado: "Estado",
  enlace_demo: "Enlace demo",
  nota: "Nota",
};

type Modo = "csv" | "html";

type ResultadoImportacion = {
  encontrados: number;
  importados: number;
  fallidos: number;
  duplicadosOmitidos: number;
  erroresDetalle: string[];
};

export default function ImportarPage() {
  const router = useRouter();
  const { usuarioActual, esAdmin } = useUsuario();
  const [modo, setModo] = useState<Modo>("csv");
  const [texto, setTexto] = useState("");
  const [nombreArchivoHtml, setNombreArchivoHtml] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaImportada[] | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [asignadoA, setAsignadoA] = useState("");
  const [origenPorDefecto, setOrigenPorDefecto] = useState<string>("reactivacion_web");
  const [omitirDuplicados, setOmitirDuplicados] = useState(false);
  const inputArchivoCsv = useRef<HTMLInputElement>(null);
  const inputArchivoHtml = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  async function prepararPrevisualizacion(parseado: FilaImportada[]) {
    setPreparando(true);
    let final = parseado;
    try {
      // La comprobación de duplicados se hace contra los leads que el usuario
      // puede ver: RLS ya limita esto a "los suyos" si es comercial.
      const existentes = await listarLeads();
      final = marcarDuplicados(parseado, existentes);
    } catch {
      // Si falla la comprobación de duplicados no se bloquea la importación,
      // simplemente no se muestran avisos de posibles duplicados.
    }
    setFilas(final);
    setPreparando(false);
  }

  async function previsualizarCsv() {
    setError(null);
    setResultado(null);
    const parseado = parsearImportacion(texto);
    if (parseado.length === 0) {
      setError("No se ha detectado ningún registro. Comprueba que has pegado la cabecera y al menos una fila.");
      setFilas(null);
      return;
    }
    await prepararPrevisualizacion(parseado);
  }

  function cargarArchivoHtml(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setResultado(null);
    setNombreArchivoHtml(archivo.name);
    const lector = new FileReader();
    lector.onload = async () => {
      const html = String(lector.result ?? "");
      const parseado = parsearHtmlLeads(html);
      if (parseado.length === 0) {
        setError(
          "No se ha reconocido ninguna tabla ni bloque de datos en este HTML. Prueba con otro archivo o utiliza la importación CSV/TSV."
        );
        setFilas(null);
        return;
      }
      await prepararPrevisualizacion(parseado);
    };
    lector.readAsText(archivo);
  }

  async function confirmarImportacion() {
    if (!filas || !usuarioActual) return;
    const todasValidas = filas.filter((f) => f.valida);
    const duplicadosOmitidos = omitirDuplicados ? todasValidas.filter((f) => f.posibleDuplicado).length : 0;
    const aImportar = omitirDuplicados ? todasValidas.filter((f) => !f.posibleDuplicado) : todasValidas;

    // Un comercial nunca puede importar leads a nombre de otro: se fuerza su
    // propio id igual que exige la política RLS de INSERT en Supabase.
    const responsable = esAdmin ? asignadoA || undefined : usuarioActual.id;
    setImportando(true);
    setProgreso(0);
    setError(null);

    let creados = 0;
    let fallidos = 0;
    const erroresDetalle: string[] = [];

    for (const fila of aImportar) {
      try {
        const lead = await crearLead({
          negocio: fila.negocio || null,
          nombre_contacto: fila.nombre_contacto || null,
          telefono: fila.telefono || null,
          email: fila.email || null,
          enlace_demo: fila.enlace_demo || null,
          segmento: fila.segmento || null,
          ciudad: fila.ciudad || null,
          nicho: fila.nicho || null,
          canal: fila.canal || null,
          referido_por: fila.referido_por || null,
          oferta: fila.oferta || null,
          // Se respeta el origen/estado del archivo si lo trae; si no, se
          // aplica el origen elegido para esta importación (nunca se inventa).
          origen: fila.origen || origenPorDefecto,
          estado: fila.estado || "pendiente",
          asignado_a: responsable,
        });
        if (fila.nota) {
          await crearInteraccion({
            lead_id: lead.id,
            usuario_id: usuarioActual.id,
            canal: "nota",
            nota: fila.nota,
          });
        }
        creados++;
      } catch (err) {
        fallidos++;
        const etiqueta = fila.negocio || fila.nombre_contacto || fila.telefono || fila.email || "Fila sin identificar";
        erroresDetalle.push(`${etiqueta}: ${err instanceof Error ? err.message : "error desconocido"}`);
      }
      setProgreso(creados + fallidos);
    }

    setResultado({
      encontrados: filas.length,
      importados: creados,
      fallidos,
      duplicadosOmitidos,
      erroresDetalle,
    });
    setFilas(null);
    setTexto("");
    setNombreArchivoHtml(null);
    setImportando(false);
  }

  function cargarArchivoCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => setTexto(String(lector.result ?? ""));
    lector.readAsText(archivo);
  }

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setFilas(null);
    setError(null);
    setResultado(null);
  }

  function empezarOtraImportacion() {
    setResultado(null);
    setFilas(null);
    setTexto("");
    setNombreArchivoHtml(null);
    setOmitirDuplicados(false);
  }

  const validas = filas?.filter((f) => f.valida) ?? [];
  const invalidas = filas ? filas.length - validas.length : 0;
  const duplicadosEnValidas = validas.filter((f) => f.posibleDuplicado).length;
  const columnasDetectadas = filas ? camposDetectados(filas) : [];

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 md:px-8">
      <button onClick={() => router.back()} className="mb-4 text-sm font-medium text-ink3">
        ← Volver
      </button>

      {resultado ? (
        <div className="rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
            <IconCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-ink">Importación completada</h1>
          <p className="mt-1 text-sm text-ink2">Los leads importados ya están disponibles en el CRM.</p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-mute p-3">
              <p className="text-xl font-semibold text-ink">{resultado.encontrados}</p>
              <p className="text-[11px] text-ink2">Encontrados</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/15">
              <p className="text-xl font-semibold text-emerald-700 dark:text-emerald-300">{resultado.importados}</p>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">Importados</p>
            </div>
            <div className={`rounded-xl p-3 ${resultado.fallidos > 0 ? "bg-red-50 dark:bg-red-500/15" : "bg-mute"}`}>
              <p className={`text-xl font-semibold ${resultado.fallidos > 0 ? "text-red-700 dark:text-red-300" : "text-ink"}`}>
                {resultado.fallidos}
              </p>
              <p className={`text-[11px] ${resultado.fallidos > 0 ? "text-red-700/80 dark:text-red-300/80" : "text-ink2"}`}>
                Con errores
              </p>
            </div>
            <div className={`rounded-xl p-3 ${resultado.duplicadosOmitidos > 0 ? "bg-amber-50 dark:bg-amber-500/15" : "bg-mute"}`}>
              <p
                className={`text-xl font-semibold ${resultado.duplicadosOmitidos > 0 ? "text-amber-800 dark:text-amber-300" : "text-ink"}`}
              >
                {resultado.duplicadosOmitidos}
              </p>
              <p className={`text-[11px] ${resultado.duplicadosOmitidos > 0 ? "text-amber-800/80 dark:text-amber-300/80" : "text-ink2"}`}>
                Duplicados omitidos
              </p>
            </div>
          </div>

          {resultado.erroresDetalle.length > 0 ? (
            <details className="mt-4 rounded-xl border border-line bg-canvas p-3 text-left text-xs text-ink2">
              <summary className="cursor-pointer font-medium text-ink">Ver detalle de errores</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {resultado.erroresDetalle.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={empezarOtraImportacion}
              className="flex-1 rounded-xl border border-line py-3.5 text-base font-medium text-ink2"
            >
              Importar otro archivo
            </button>
            <Link
              href="/leads"
              className="flex-1 rounded-xl bg-brand-gradient py-3.5 text-center text-base font-semibold text-brand-ink"
            >
              Ver leads importados
            </Link>
          </div>
        </div>
      ) : !filas ? (
        <>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">Importar leads</h1>
          <p className="mb-5 text-sm text-ink2">
            No se inventa ningún dato: solo se guarda lo que traiga el archivo.
          </p>

          <div className="mb-5 flex rounded-xl bg-mute p-1">
            <button
              onClick={() => cambiarModo("csv")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                modo === "csv" ? "bg-surface text-ink shadow-card" : "text-ink2"
              }`}
            >
              CSV / TSV
            </button>
            <button
              onClick={() => cambiarModo("html")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                modo === "html" ? "bg-surface text-ink shadow-card" : "text-ink2"
              }`}
            >
              Archivo HTML
            </button>
          </div>

          {modo === "csv" ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-ink2">Datos a importar</span>
                <button onClick={() => inputArchivoCsv.current?.click()} className="text-xs font-semibold text-brand-dark">
                  Subir archivo CSV/TSV
                </button>
                <input ref={inputArchivoCsv} type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={cargarArchivoCsv} />
              </div>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={10}
                placeholder={EJEMPLO}
                className="input font-mono text-xs"
              />
              <p className="mt-2 text-xs text-ink3">
                Cabeceras reconocidas: negocio, contacto/nombre_contacto, telefono, email, enlace_demo/demo, segmento,
                origen, estado, canal, referido_por, oferta, nicho, ciudad, nota. Las columnas que falten se dejan
                vacías.
              </p>

              {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}

              <button
                onClick={previsualizarCsv}
                disabled={!texto.trim() || preparando}
                className="mt-5 w-full rounded-xl bg-brand-gradient py-3.5 text-base font-semibold text-brand-ink disabled:opacity-50"
              >
                {preparando ? "Analizando…" : "Previsualizar"}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => inputArchivoHtml.current?.click()}
                disabled={preparando}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface px-6 py-10 text-center disabled:opacity-60"
              >
                <IconImportar className="h-6 w-6 text-brand-dark" />
                <span className="text-sm font-semibold text-brand-dark">
                  {preparando ? "Analizando…" : nombreArchivoHtml ? nombreArchivoHtml : "Seleccionar archivo HTML"}
                </span>
                <span className="text-xs text-ink3">Exportación de una herramienta anterior (.html)</span>
              </button>
              <input ref={inputArchivoHtml} type="file" accept=".html,.htm" className="hidden" onChange={cargarArchivoHtml} />
              <p className="mt-2 text-xs text-ink3">
                Se reconocen tablas HTML con cabecera y bloques repetidos con pares &quot;Campo: valor&quot; (negocio,
                contacto, teléfono, email, origen, estado, canal, referido_por, oferta, segmento, nota, enlace_demo,
                ciudad, nicho).
              </p>

              {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
            </>
          )}
        </>
      ) : (
        <>
          <h1 className="mb-1 font-display text-2xl font-bold text-ink">
            Se {validas.length === 1 ? "ha" : "han"} encontrado {filas.length} lead{filas.length === 1 ? "" : "s"}
          </h1>
          {columnasDetectadas.length > 0 ? (
            <p className="mb-4 text-xs text-ink3">
              Columnas reconocidas: {columnasDetectadas.map((c) => ETIQUETA_CAMPO[c] ?? c).join(", ")}
            </p>
          ) : null}

          <div className="mb-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-line bg-surface p-3 text-center">
              <p className="font-display text-2xl font-bold text-ink">{validas.length}</p>
              <p className="text-[11px] text-ink2">Válidos</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3 text-center">
              <p className={`text-2xl font-semibold ${invalidas > 0 ? "text-amber-600" : "text-ink"}`}>{invalidas}</p>
              <p className="text-[11px] text-ink2">Con errores</p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3 text-center">
              <p className={`text-2xl font-semibold ${duplicadosEnValidas > 0 ? "text-amber-600" : "text-ink"}`}>
                {duplicadosEnValidas}
              </p>
              <p className="text-[11px] text-ink2">Posibles duplicados</p>
            </div>
          </div>

          {esAdmin ? (
            <label className="mb-3 block">
              <span className="mb-1 block text-xs font-medium text-ink2">Asignar los leads importados a</span>
              <select value={asignadoA} onChange={(e) => setAsignadoA(e.target.value)} className="input">
                <option value="">Sin asignar</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="mb-3 text-xs text-ink3">Los leads importados quedarán asignados a ti.</p>
          )}

          <label className="mb-4 block">
            <span className="mb-1 block text-xs font-medium text-ink2">
              Origen para las filas que no traen origen propio
            </span>
            <select value={origenPorDefecto} onChange={(e) => setOrigenPorDefecto(e.target.value)} className="input">
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {ORIGEN_LABEL[o]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-ink3">
              Si una fila ya trae su propio origen, se respeta tal cual.
            </span>
          </label>

          {duplicadosEnValidas > 0 ? (
            <label className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
              <input
                type="checkbox"
                checked={omitirDuplicados}
                onChange={(e) => setOmitirDuplicados(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Se han detectado {duplicadosEnValidas} posible{duplicadosEnValidas === 1 ? "" : "s"} duplicado
                {duplicadosEnValidas === 1 ? "" : "s"} (mismo teléfono o email que un lead existente, marcados abajo).
                Omitirlos de esta importación.
              </span>
            </label>
          ) : null}

          <div className="max-h-96 overflow-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-canvas text-ink2">
                <tr>
                  <th className="px-3 py-2">Negocio</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Segmento</th>
                  <th className="px-3 py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr
                    key={i}
                    className={`border-t border-line ${
                      !f.valida
                        ? "bg-amber-50/60 dark:bg-amber-500/10"
                        : f.posibleDuplicado
                          ? "bg-orange-50/60 dark:bg-orange-500/10"
                          : ""
                    }`}
                  >
                    <td className="max-w-[8rem] truncate px-3 py-2">
                      {f.negocio || "—"}
                      {f.posibleDuplicado ? (
                        <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                          duplicado
                        </span>
                      ) : null}
                    </td>
                    <td className="max-w-[7rem] truncate px-3 py-2">{f.nombre_contacto || "—"}</td>
                    <td className="px-3 py-2">{f.telefono || "—"}</td>
                    <td className="max-w-[8rem] truncate px-3 py-2">{f.email || "—"}</td>
                    <td className="px-3 py-2">{f.segmento || "—"}</td>
                    <td className="px-3 py-2">{f.origen ? ORIGEN_LABEL[f.origen] ?? f.origen : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
          {importando ? (
            <p className="mt-3 text-sm text-ink2">
              Importando {progreso}/{omitirDuplicados ? validas.length - duplicadosEnValidas : validas.length}…
            </p>
          ) : null}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setFilas(null)}
              disabled={importando}
              className="flex-1 rounded-xl border border-line py-3.5 text-base font-medium text-ink2 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarImportacion}
              disabled={importando || validas.length === 0}
              className="flex-1 rounded-xl bg-brand-gradient py-3.5 text-base font-semibold text-brand-ink disabled:opacity-50"
            >
              {importando
                ? "Importando…"
                : `Importar ${omitirDuplicados ? validas.length - duplicadosEnValidas : validas.length} leads`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
