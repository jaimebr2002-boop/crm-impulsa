"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppContext";
import { useUsuario } from "@/context/UsuarioContext";
import { buscarGlobal, type ResultadoBusqueda } from "@/lib/data/busqueda";
import { gruposVisibles } from "@/lib/navegacion";
import { IconBuscar, IconCalendario, IconCuenta, IconDocumento, IconFinanzas, IconFlecha, IconLeads, IconProyectos, IconRecibo, IconTareas } from "../Icons";
import { useOpcionesAnadir } from "./OpcionesAnadir";

type Item = {
  id: string;
  grupo: string;
  titulo: string;
  subtitulo?: string;
  icon: (p: { className?: string }) => ReactNode;
  ejecutar: () => void;
};

const ICONO_RESULTADO: Record<ResultadoBusqueda["tipo"], Item["icon"]> = {
  proyecto: IconProyectos,
  cuenta: IconCuenta,
  marca: IconCuenta,
  tarea: IconTareas,
  lead: IconLeads,
  factura: IconFinanzas,
  gasto: IconRecibo,
  suscripcion: IconCalendario,
  documento: IconDocumento,
};

const GRUPO_RESULTADO: Record<ResultadoBusqueda["tipo"], string> = {
  proyecto: "Proyectos",
  cuenta: "Cuentas",
  marca: "Marcas",
  tarea: "Tareas",
  lead: "Leads",
  factura: "Facturas",
  gasto: "Gastos",
  suscripcion: "Suscripciones",
  documento: "Documentos",
};
const ORDEN_GRUPOS: ResultadoBusqueda["tipo"][] = ["cuenta", "marca", "proyecto", "tarea", "factura", "documento", "lead", "gasto", "suscripcion"];

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CommandPalette() {
  const { paletaAbierta, setPaletaAbierta } = useApp();
  const { contexto, propias, generales } = useOpcionesAnadir();
  const { esAdmin } = useUsuario();
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusqueda[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [indice, setIndice] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);

  const cerrar = () => setPaletaAbierta(false);

  useEffect(() => {
    if (paletaAbierta) {
      setTexto("");
      setResultados([]);
      setIndice(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [paletaAbierta]);

  // Búsqueda en base de datos con una pequeña pausa entre teclas.
  useEffect(() => {
    if (!paletaAbierta) return;
    const t = texto.trim();
    if (t.length < 2) {
      setResultados([]);
      setBuscando(false);
      return;
    }
    setBuscando(true);
    let vigente = true;
    const timer = setTimeout(() => {
      buscarGlobal(t)
        .then((r) => vigente && setResultados(r))
        .catch(() => vigente && setResultados([]))
        .finally(() => vigente && setBuscando(false));
    }, 180);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [texto, paletaAbierta]);

  const items = useMemo<Item[]>(() => {
    const q = normalizar(texto.trim());
    const ir = (href: string) => () => {
      cerrar();
      router.push(href);
    };

    // Mismas acciones que "+ Añadir": primero las del sitio donde estás.
    const acciones: Item[] = [
      ...propias.map((o) => ({
        id: `a-${o.id}`,
        grupo: `Crear en ${contexto}`,
        titulo: `${o.label}`,
        icon: o.icon,
        ejecutar: () => {
          cerrar();
          o.accion();
        },
      })),
      ...generales.map((o) => ({
        id: `a-${o.id}`,
        grupo: "Crear",
        titulo: o.enPaleta ?? `Nuevo: ${o.label.toLowerCase()}`,
        icon: o.icon,
        ejecutar: () => {
          cerrar();
          o.accion();
        },
      })),
    ];

    const paginas: Item[] = gruposVisibles(esAdmin).flatMap((g) =>
      g.items.map((it) => ({
        id: `p-${it.href}`,
        grupo: "Ir a",
        titulo: it.label,
        subtitulo: g.titulo ?? undefined,
        icon: it.icon,
        ejecutar: ir(it.href),
      }))
    );

    const coincide = (i: Item) => !q || normalizar(`${i.titulo} ${i.subtitulo ?? ""}`).includes(q);
    const ordenados = [...resultados].sort((a, b) => ORDEN_GRUPOS.indexOf(a.tipo) - ORDEN_GRUPOS.indexOf(b.tipo));
    const encontrados: Item[] = ordenados.map((r) => ({
      id: `r-${r.tipo}-${r.id}`,
      grupo: GRUPO_RESULTADO[r.tipo],
      titulo: r.titulo,
      subtitulo: r.subtitulo,
      icon: ICONO_RESULTADO[r.tipo],
      ejecutar: ir(r.href),
    }));

    // Con texto, primero lo encontrado en datos; sin texto, crear e ir a.
    return q
      ? [...encontrados, ...acciones.filter(coincide), ...paginas.filter(coincide)]
      : [...acciones, ...paginas];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, resultados, esAdmin, contexto, propias.length]);

  useEffect(() => setIndice(0), [items.length, texto]);

  useEffect(() => {
    listaRef.current?.querySelector(`[data-indice="${indice}"]`)?.scrollIntoView({ block: "nearest" });
  }, [indice]);

  if (!paletaAbierta) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndice((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndice((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[indice]?.ejecutar();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar();
    }
  }

  let grupoAnterior = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-3 pt-[12dvh]" onClick={cerrar}>
      <div
        role="dialog"
        aria-label="Buscar y ejecutar"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <IconBuscar className="h-4 w-4 shrink-0 text-ink3" />
          <input
            ref={inputRef}
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Busca proyectos, tareas, leads… o escribe una acción"
            className="h-12 w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-ink3"
            aria-autocomplete="list"
          />
          {buscando ? <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand" /> : null}
          <span className="kbd hidden sm:inline">Esc</span>
        </div>

        <div ref={listaRef} className="max-h-[55dvh] overflow-y-auto p-1.5" role="listbox">
          {items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink3">
              {buscando ? "Buscando…" : texto.trim().length < 2 ? "Escribe al menos 2 letras" : "Sin resultados"}
            </p>
          ) : null}
          {items.map((item, i) => {
            const cabecera = item.grupo !== grupoAnterior ? item.grupo : null;
            grupoAnterior = item.grupo;
            const Icon = item.icon;
            const activo = i === indice;
            return (
              <div key={item.id}>
                {cabecera ? <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-ink3">{cabecera}</p> : null}
                <button
                  type="button"
                  data-indice={i}
                  role="option"
                  aria-selected={activo}
                  onMouseMove={() => setIndice(i)}
                  onClick={item.ejecutar}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm ${
                    activo ? "bg-mute text-ink" : "text-ink2"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-ink3" />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-ink">{item.titulo}</span>
                    {item.subtitulo ? <span className="ml-2 text-xs text-ink3">{item.subtitulo}</span> : null}
                  </span>
                  {activo ? <IconFlecha className="h-3.5 w-3.5 shrink-0 text-ink3" /> : null}
                </button>
              </div>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-ink3 sm:flex">
          <span><span className="kbd">↑</span> <span className="kbd">↓</span> moverse</span>
          <span><span className="kbd">↵</span> abrir</span>
          <span><span className="kbd">⌘K</span> abrir/cerrar</span>
        </div>
      </div>
    </div>
  );
}
