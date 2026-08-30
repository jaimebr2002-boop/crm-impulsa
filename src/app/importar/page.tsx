"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parsearImportacion, type FilaImportada } from "@/lib/importar";
import { parsearHtmlLeads } from "@/lib/importarHtml";
import { crearLead } from "@/lib/data/leads";
import { crearInteraccion } from "@/lib/data/interacciones";
import { listarUsuarios } from "@/lib/data/usuarios";
import { useUsuario } from "@/context/UsuarioContext";
import type { Usuario } from "@/lib/types";

const EJEMPLO = `negocio\tcontacto\ttelefono\temail\tenlace_demo\tsegmento\tnota
Clínica Dental Sonrisa\tAna Pérez\t610123456\tana@clinica.es\thttps://demo.impulsa.studio/sonrisa\tcaliente\tMuy interesada, pidió precio final`;

type Modo = "csv" | "html";

export default function ImportarPage() {
  const router = useRouter();
  const { usuarioActual, esAdmin } = useUsuario();
  const [modo, setModo] = useState<Modo>("csv");
  const [texto, setTexto] = useState("");
  const [nombreArchivoHtml, setNombreArchivoHtml] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaImportada[] | null>(null);
  const [importando, setImportando] = useState(false);
  const [progreso, setProgreso] = useState(0);
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [asignadoA, setAsignadoA] = useState("");
  const inputArchivoCsv = useRef<HTMLInputElement>(null);
  const inputArchivoHtml = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listarUsuarios().then(setUsuarios).catch(() => {});
  }, []);

  function previsualizarCsv() {
    setError(null);
    setResultado(null);
    const parseado = parsearImportacion(texto);
    if (parseado.length === 0) {
      setError("No se ha detectado ningún registro. Comprueba que has pegado la cabecera y al menos una fila.");
      setFilas(null);
      return;
    }
    setFilas(parseado);
  }

  function cargarArchivoHtml(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setResultado(null);
    setNombreArchivoHtml(archivo.name);
    const lector = new FileReader();
    lector.onload = () => {
      const html = String(lector.result ?? "");
      const parseado = parsearHtmlLeads(html);
      if (parseado.length === 0) {
        setError(
          "No se ha reconocido ninguna tabla ni bloque de datos en este HTML. Prueba con otro archivo o utiliza la importación CSV/TSV."
        );
        setFilas(null);
        return;
      }
      setFilas(parseado);
    };
    lector.readAsText(archivo);
  }

  async function confirmarImportacion() {
    if (!filas || !usuarioActual) return;
    const validas = filas.filter((f) => f.valida);
    // Un comercial nunca puede importar leads a nombre de otro: se fuerza su
    // propio id igual que exige la política RLS de INSERT en Supabase.
    const responsable = esAdmin ? asignadoA || undefined : usuarioActual.id;
    setImportando(true);
    setProgreso(0);
    setError(null);
    try {
      let creados = 0;
      for (const fila of validas) {
        const lead = await crearLead({
          negocio: fila.negocio || null,
          nombre_contacto: fila.nombre_contacto || null,
          telefono: fila.telefono || null,
          email: fila.email || null,
          enlace_demo: fila.enlace_demo || null,
          segmento: fila.segmento || null,
          ciudad: fila.ciudad || null,
          nicho: fila.nicho || null,
          origen: "reactivacion_web",
          estado: "pendiente",
          asignado_a: responsable,
        });
        if (fila.nota) {
          await crearInteraccion({
            lead_id: lead.id,
            usuario_id: usuarioActual?.id ?? null,
            canal: "nota",
            nota: fila.nota,
          });
        }
        creados++;
        setProgreso(creados);
      }
      setResultado(`Se han importado ${creados} leads con origen "Reactivación web".`);
      setFilas(null);
      setTexto("");
      setNombreArchivoHtml(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La importación se ha detenido por un error.");
    } finally {
      setImportando(false);
    }
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

  const validas = filas?.filter((f) => f.valida).length ?? 0;
  const invalidas = filas ? filas.length - validas : 0;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-6 md:px-8">
      <button onClick={() => router.back()} className="mb-4 text-sm font-medium text-slate-400">
        ← Volver
      </button>
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Importar leads históricos</h1>
      <p className="mb-5 text-sm text-slate-500">
        No se inventa ningún dato: solo se guarda lo que traiga la importación.
      </p>

      {!filas ? (
        <>
          <div className="mb-5 flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => cambiarModo("csv")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                modo === "csv" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"
              }`}
            >
              CSV / TSV
            </button>
            <button
              onClick={() => cambiarModo("html")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                modo === "html" ? "bg-white text-slate-900 shadow-card" : "text-slate-500"
              }`}
            >
              Archivo HTML
            </button>
          </div>

          {modo === "csv" ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Datos a importar</span>
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
              <p className="mt-2 text-xs text-slate-400">
                Cabeceras reconocidas: negocio, contacto/nombre_contacto, telefono, email, enlace_demo/demo, segmento,
                nota, ciudad, nicho.
              </p>

              {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
              {resultado ? <p className="mt-3 text-sm font-medium text-emerald-600">{resultado}</p> : null}

              <button
                onClick={previsualizarCsv}
                disabled={!texto.trim()}
                className="mt-5 w-full rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-50"
              >
                Previsualizar
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => inputArchivoHtml.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-10 text-center"
              >
                <span className="text-sm font-semibold text-brand-dark">
                  {nombreArchivoHtml ? nombreArchivoHtml : "Seleccionar archivo HTML"}
                </span>
                <span className="text-xs text-slate-400">Exportación de una herramienta anterior (.html)</span>
              </button>
              <input ref={inputArchivoHtml} type="file" accept=".html,.htm" className="hidden" onChange={cargarArchivoHtml} />
              <p className="mt-2 text-xs text-slate-400">
                Se reconocen tablas HTML con cabecera y bloques repetidos con pares &quot;Campo: valor&quot; (negocio,
                contacto, teléfono, email, segmento, nota, enlace_demo, ciudad, nicho).
              </p>

              {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
              {resultado ? <p className="mt-3 text-sm font-medium text-emerald-600">{resultado}</p> : null}
            </>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex gap-3">
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <p className="text-2xl font-semibold text-slate-900">{validas}</p>
              <p className="text-xs text-slate-500">Registros válidos</p>
            </div>
            <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 text-center">
              <p className={`text-2xl font-semibold ${invalidas > 0 ? "text-amber-600" : "text-slate-900"}`}>{invalidas}</p>
              <p className="text-xs text-slate-500">Sin datos suficientes</p>
            </div>
          </div>

          {esAdmin ? (
            <label className="mb-4 block">
              <span className="mb-1 block text-xs font-medium text-slate-500">Asignar los leads importados a</span>
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
            <p className="mb-4 text-xs text-slate-400">Los leads importados quedarán asignados a ti.</p>
          )}

          <div className="max-h-96 overflow-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2">Negocio</th>
                  <th className="px-3 py-2">Contacto</th>
                  <th className="px-3 py-2">Teléfono</th>
                  <th className="px-3 py-2">Segmento</th>
                  <th className="px-3 py-2">Nota</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={i} className={`border-t border-slate-100 ${!f.valida ? "bg-amber-50/60" : ""}`}>
                    <td className="max-w-[9rem] truncate px-3 py-2">{f.negocio || "—"}</td>
                    <td className="max-w-[7rem] truncate px-3 py-2">{f.nombre_contacto || "—"}</td>
                    <td className="px-3 py-2">{f.telefono || "—"}</td>
                    <td className="px-3 py-2">{f.segmento || "—"}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2">{f.nota || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error ? <p className="mt-3 text-sm font-medium text-red-600">{error}</p> : null}
          {importando ? <p className="mt-3 text-sm text-slate-500">Importando {progreso}/{validas}…</p> : null}

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => setFilas(null)}
              disabled={importando}
              className="flex-1 rounded-xl border border-slate-200 py-3.5 text-base font-medium text-slate-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={confirmarImportacion}
              disabled={importando || validas === 0}
              className="flex-1 rounded-xl bg-brand py-3.5 text-base font-semibold text-white disabled:opacity-50"
            >
              {importando ? "Importando…" : `Importar ${validas} leads`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
