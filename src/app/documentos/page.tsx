"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { listarDocumentos, obtenerDocumento } from "@/lib/data/documentos";
import { listarCuentas } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import { CATEGORIAS_DOCUMENTO, CATEGORIA_DOCUMENTO_LABEL, formatTamano, GRUPO_LABEL, type GrupoArchivo } from "@/lib/documentos";
import { aYMD, addDias } from "@/lib/dates";
import { contextoDeProyecto } from "@/lib/trabajo";
import type { CategoriaDocumento, Cuenta, DocumentoContexto, ProyectoConRelaciones } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { Cabecera } from "@/components/ui/Cabecera";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { TablaDocumentos } from "@/components/documentos/TablaDocumentos";
import { ZonaSoltar } from "@/components/documentos/ZonaSoltar";
import { IconMas } from "@/components/Icons";
import { CampoBusqueda, SELECT_TOOLBAR } from "@/components/ui/CampoBusqueda";

type Fecha = "" | "7" | "30" | "365";

export default function DocumentosPage() {
  return (
    <SoloAdmin>
      <Suspense fallback={null}>
        <Documentos />
      </Suspense>
    </SoloAdmin>
  );
}

function Documentos() {
  const { abrirAlta, versionDatos, avisar } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const verId = params.get("ver");

  const [docs, setDocs] = useState<DocumentoContexto[]>([]);
  const [texto, setTexto] = useState(params.get("q") ?? "");
  const [busqueda, setBusqueda] = useState(texto);
  const [categoria, setCategoria] = useState<CategoriaDocumento | "">((params.get("categoria") as CategoriaDocumento) || "");
  const [cuentaId, setCuentaId] = useState("");
  const [proyectoId, setProyectoId] = useState("");
  const [grupo, setGrupo] = useState<GrupoArchivo | "">("");
  const [fecha, setFecha] = useState<Fecha>("");
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);
  const [abierto, setAbierto] = useState<DocumentoContexto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Búsqueda en el servidor (ILIKE sobre nombre y contexto), con un pequeño retardo al teclear.
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(texto), 250);
    return () => clearTimeout(t);
  }, [texto]);

  useEffect(() => {
    Promise.all([listarCuentas(), listarProyectos()])
      .then(([c, p]) => {
        setCuentas(c);
        setProyectos(p);
      })
      .catch(() => {});
  }, []);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setDocs(
        await listarDocumentos({
          texto: busqueda || undefined,
          categoria: categoria || undefined,
          cuentaId: cuentaId || undefined,
          proyectoIds: proyectoId ? [proyectoId, ...proyectos.filter((p) => p.proyecto_padre_id === proyectoId).map((p) => p.id)] : undefined,
          grupo: grupo || undefined,
          desde: fecha ? aYMD(addDias(new Date(), -Number(fecha))) : undefined,
        })
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar los documentos.");
    } finally {
      setCargando(false);
    }
  }, [busqueda, categoria, cuentaId, proyectoId, grupo, fecha, proyectos]);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  // ?ver=id abre el documento (desde ⌘K, avisos o enlaces).
  useEffect(() => {
    if (!verId) return setAbierto(null);
    const enLista = docs.find((d) => d.id === verId);
    if (enLista) return setAbierto(enLista);
    obtenerDocumento(verId)
      .then((d) => {
        if (d) setAbierto(d);
        else avisar("Ese documento ya no existe.", { tono: "error" });
      })
      .catch(() => {});
  }, [verId, docs, avisar]);

  const abrir = (d: DocumentoContexto | null) => {
    setAbierto(d);
    router.replace(d ? `/documentos?ver=${d.id}` : "/documentos", { scroll: false });
  };

  const proyectosFiltro = useMemo(() => (cuentaId ? proyectos.filter((p) => p.cuenta_id === cuentaId) : proyectos), [proyectos, cuentaId]);
  const hayFiltros = !!(busqueda || categoria || cuentaId || proyectoId || grupo || fecha);
  const total = docs.reduce((t, d) => t + Number(d.tamano), 0);

  const subir = (archivos: File[]) => {
    if (archivos.length > 1) avisar("Se sube un archivo cada vez: abro el primero.");
    abrirAlta({ tipo: "documento", archivo: archivos[0] });
  };

  const select = SELECT_TOOLBAR;

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Documentos"
        subtitulo="Contratos, briefs, guiones, facturas y justificantes, en un solo sitio."
        acciones={
          <button onClick={() => abrirAlta({ tipo: "documento" })} className="btn-primary">
            <IconMas className="h-4 w-4" />
            Documento
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2">
        <CampoBusqueda valor={texto} onChange={setTexto} placeholder="Buscar por nombre, cuenta, proyecto, categoría…" etiqueta="Buscar documentos" className="md:max-w-md" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
          <select aria-label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaDocumento | "")} className={select}>
            <option value="">Todas las categorías</option>
            {CATEGORIAS_DOCUMENTO.map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_DOCUMENTO_LABEL[c]}
              </option>
            ))}
          </select>
          <select
            aria-label="Cuenta"
            value={cuentaId}
            onChange={(e) => {
              setCuentaId(e.target.value);
              setProyectoId("");
            }}
            className={select}
          >
            <option value="">Todas las cuentas</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <select aria-label="Proyecto" value={proyectoId} onChange={(e) => setProyectoId(e.target.value)} className={`${select} max-w-[14rem]`}>
            <option value="">Todos los proyectos</option>
            {proyectosFiltro.map((p) => (
              <option key={p.id} value={p.id}>
                {contextoDeProyecto(p)}
              </option>
            ))}
          </select>
          <select aria-label="Tipo de archivo" value={grupo} onChange={(e) => setGrupo(e.target.value as GrupoArchivo | "")} className={select}>
            <option value="">Todos los tipos</option>
            {(Object.keys(GRUPO_LABEL) as GrupoArchivo[]).map((g) => (
              <option key={g} value={g}>
                {GRUPO_LABEL[g]}
              </option>
            ))}
          </select>
          <select aria-label="Fecha" value={fecha} onChange={(e) => setFecha(e.target.value as Fecha)} className={select}>
            <option value="">Cualquier fecha</option>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="365">Último año</option>
          </select>
          {hayFiltros ? (
            <button
              onClick={() => {
                setTexto("");
                setCategoria("");
                setCuentaId("");
                setProyectoId("");
                setGrupo("");
                setFecha("");
              }}
              className="btn-ghost shrink-0 py-1 text-xs"
            >
              Quitar filtros
            </button>
          ) : null}
        </div>
      </div>

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={6} alto="h-11" /> : null}

      {!cargando && !error ? (
        <ZonaSoltar onArchivos={subir} className="pb-16">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <TablaDocumentos
              documentos={docs}
              onCambio={cargar}
              abierto={abierto}
              onAbrir={abrir}
              vacio={
                <div className="flex flex-col items-center px-6 py-14 text-center">
                  <p className="text-sm font-medium text-ink">{hayFiltros ? "Nada con estos filtros." : "Aún no hay documentos."}</p>
                  <p className="mt-1 max-w-sm text-sm text-ink3">Arrastra un archivo aquí o súbelo con el botón. Puedes relacionarlo con una cuenta, proyecto, factura o gasto.</p>
                  <button onClick={() => abrirAlta({ tipo: "documento" })} className="btn-secondary mt-4">
                    <IconMas className="h-4 w-4" />
                    Subir documento
                  </button>
                </div>
              }
            />
          </div>
          {docs.length ? (
            <p className="mt-2 text-xs text-ink3">
              {docs.length} documento{docs.length === 1 ? "" : "s"} · {formatTamano(total)}
              <span className="hidden md:inline"> · Arrastra archivos sobre la lista para subirlos.</span>
            </p>
          ) : null}
        </ZonaSoltar>
      ) : null}
    </div>
  );
}
