"use client";

import { useEffect, useMemo, useState } from "react";
import { listarCuentas } from "@/lib/data/cuentas";
import { listarProyectos } from "@/lib/data/proyectos";
import { facturacionDeProyectos, guardarFactura, type CabeceraFactura } from "@/lib/data/finanzas";
import { obtenerAjustes } from "@/lib/data/ajustes";
import { hoyYMD } from "@/lib/dates";
import { aCentimos, calcularTotales, deCentimos, eur, repartoFacturacion, vencimientoPorDefecto } from "@/lib/finanzas";
import { contextoDeProyecto } from "@/lib/trabajo";
import type { Cuenta, LineaBorrador, ProyectoConRelaciones, ProyectoFacturacion } from "@/lib/types";
import { IconMas, IconPapelera } from "../Icons";

type LineaForm = LineaBorrador & { clave: string };

let contadorClaves = 0;
const nuevaClave = () => `l${++contadorClaves}`;

export type FacturaExistente = {
  id: string;
  estado: "borrador" | "emitida" | "cancelada";
  numero: string | null;
  cabecera: Omit<CabeceraFactura, "estado" | "numero">;
  lineas: LineaBorrador[];
};

/** Alta y edición rápida de facturas: cuenta, fechas, IVA/IRPF y líneas
 * (proyectos de la cuenta o conceptos manuales) con total en vivo. */
export function FacturaForm({
  cuentaInicial,
  proyectosIniciales = [],
  existente,
  onGuardada,
  onCancelar,
}: {
  cuentaInicial?: string;
  /** Proyectos que entran ya como líneas (p. ej. "Añadir a factura" desde un proyecto). */
  proyectosIniciales?: string[];
  existente?: FacturaExistente;
  onGuardada: (id: string, estado: "borrador" | "emitida") => void;
  onCancelar?: () => void;
}) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoConRelaciones[]>([]);
  const [facturacion, setFacturacion] = useState<Record<string, ProyectoFacturacion>>({});
  const [cuentaId, setCuentaId] = useState(existente?.cabecera.cuenta_id ?? cuentaInicial ?? "");
  const [emision, setEmision] = useState(existente?.cabecera.fecha_emision ?? hoyYMD());
  const [vencimiento, setVencimiento] = useState<string>(existente ? existente.cabecera.fecha_vencimiento ?? "" : vencimientoPorDefecto());
  const [ivaPct, setIvaPct] = useState(existente?.cabecera.iva_pct ?? 21);
  const [irpfPct, setIrpfPct] = useState(existente?.cabecera.irpf_pct ?? 7);
  const [notas, setNotas] = useState(existente?.cabecera.notas ?? "");
  const [numeroManual, setNumeroManual] = useState(false);
  const [numero, setNumero] = useState("");
  const [lineas, setLineas] = useState<LineaForm[]>(
    existente ? existente.lineas.map((l) => ({ ...l, clave: nuevaClave() })) : []
  );
  const [precargados, setPrecargados] = useState(false);
  const [enviando, setEnviando] = useState<"borrador" | "emitida" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarCuentas(), listarProyectos(), facturacionDeProyectos()])
      .then(([c, p, f]) => {
        setCuentas(c);
        setProyectos(p.filter((x) => x.estado !== "cancelado"));
        setFacturacion(f);
      })
      .catch(() => {});
    // Factura nueva: IVA, IRPF y vencimiento por defecto de Configuración.
    if (!existente)
      obtenerAjustes()
        .then((a) => {
          if (!a) return;
          setIvaPct(Number(a.iva_pct_defecto));
          setIrpfPct(Number(a.irpf_pct_defecto));
          setVencimiento(a.dias_vencimiento > 0 ? vencimientoPorDefecto(hoyYMD(), a.dias_vencimiento) : "");
        })
        .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si se edita un borrador, sus propias líneas no cuentan como "en otro borrador".
  const propioBorrador = useMemo(() => {
    const m: Record<string, number> = {};
    if (existente?.estado === "borrador")
      for (const l of existente.lineas)
        if (l.proyecto_id) m[l.proyecto_id] = (m[l.proyecto_id] ?? 0) + aCentimos(l.cantidad) * aCentimos(l.precio_unitario) / 100;
    return m;
  }, [existente]);

  /** Reparto del proyecto (facturado, en otros borradores y lo que falta por preparar). */
  const reparto = (p: ProyectoConRelaciones) => {
    const f = facturacion[p.id];
    const enBorrador = deCentimos(Math.max(aCentimos(f?.en_borrador ?? 0) - Math.round(propioBorrador[p.id] ?? 0), 0));
    return repartoFacturacion(p, f ? { ...f, en_borrador: enBorrador } : undefined);
  };
  /** Lo que queda por facturar de un proyecto (sin contar lo ya preparado en otro borrador). */
  const porFacturar = (p: ProyectoConRelaciones) => (p.importe == null ? null : reparto(p).porPreparar);

  // "Añadir a factura" desde un proyecto: entra como primera línea con lo pendiente.
  useEffect(() => {
    if (precargados || existente || proyectosIniciales.length === 0 || proyectos.length === 0) return;
    const nuevas = proyectosIniciales
      .map((id) => proyectos.find((p) => p.id === id))
      .filter((p): p is ProyectoConRelaciones => !!p)
      .map((p) => lineaDeProyecto(p));
    if (!cuentaId && nuevas.length) {
      const p = proyectos.find((x) => x.id === proyectosIniciales[0]);
      if (p?.cuenta_id) setCuentaId(p.cuenta_id);
    }
    setLineas(nuevas);
    setPrecargados(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proyectos, facturacion]);

  function lineaDeProyecto(p: ProyectoConRelaciones): LineaForm {
    return {
      clave: nuevaClave(),
      proyecto_id: p.id,
      descripcion: contextoDeProyecto(p),
      cantidad: 1,
      precio_unitario: porFacturar(p) ?? 0,
    };
  }

  const enLineas = new Set(lineas.map((l) => l.proyecto_id).filter(Boolean));
  const proyectosDisponibles = proyectos
    .filter((p) => p.cuenta_id === cuentaId && !enLineas.has(p.id))
    .sort((a, b) => (porFacturar(b) ?? 0) - (porFacturar(a) ?? 0));

  const totales = useMemo(() => calcularTotales(lineas, ivaPct, irpfPct), [lineas, ivaPct, irpfPct]);

  function cambiarLinea(clave: string, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));
  }

  async function guardar(estado: "borrador" | "emitida") {
    setError(null);
    if (!cuentaId) return setError("Elige la cuenta a la que facturas.");
    const validas = lineas.filter((l) => l.descripcion.trim());
    if (validas.length === 0) return setError("Añade al menos una línea con descripción.");
    if (validas.some((l) => !(Number(l.cantidad) > 0))) return setError("La cantidad de cada línea debe ser mayor que 0.");
    if (vencimiento && vencimiento < emision) return setError("El vencimiento no puede ser anterior a la emisión.");
    setEnviando(estado);
    try {
      const id = await guardarFactura(
        existente?.id ?? null,
        {
          cuenta_id: cuentaId,
          fecha_emision: emision,
          fecha_vencimiento: vencimiento || null,
          iva_pct: Number(ivaPct) || 0,
          irpf_pct: Number(irpfPct) || 0,
          notas: notas.trim() || null,
          numero: numeroManual ? numero.trim() || null : null,
          estado,
        },
        validas.map(({ proyecto_id, descripcion, cantidad, precio_unitario }) => ({
          proyecto_id,
          descripcion: descripcion.trim(),
          cantidad: Number(cantidad),
          precio_unitario: Number(precio_unitario) || 0,
        }))
      );
      onGuardada(id, estado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido guardar la factura.");
      setEnviando(null);
    }
  }

  const esEdicion = !!existente;
  const esBorrador = !existente || existente.estado === "borrador";

  return (
    <div className="flex flex-col gap-4">
      {/* Cabecera */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="col-span-2 block">
          <span className="field-label">Cuenta</span>
          <select
            value={cuentaId}
            onChange={(e) => {
              setCuentaId(e.target.value);
              // Las líneas de proyectos de otra cuenta dejan de tener sentido.
              setLineas((prev) => prev.filter((l) => !l.proyecto_id));
            }}
            className="input"
            autoFocus={!cuentaId}
          >
            <option value="">Elige…</option>
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Emisión</span>
          <input type="date" value={emision} onChange={(e) => setEmision(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="field-label">Vencimiento</span>
          <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className="input" />
        </label>
      </div>
      <div className="-mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink3">
        Vence a
        {[15, 30, 60].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setVencimiento(vencimientoPorDefecto(emision, d))}
            className={`rounded-md border px-1.5 py-0.5 ${
              vencimiento === vencimientoPorDefecto(emision, d) ? "border-ink bg-ink text-canvas" : "border-line hover:bg-mute"
            }`}
          >
            {d} días
          </button>
        ))}
        <button type="button" onClick={() => setVencimiento("")} className="rounded-md border border-line px-1.5 py-0.5 hover:bg-mute">
          Sin vencimiento
        </button>
      </div>

      {/* Líneas */}
      <div className="overflow-hidden rounded-xl border border-line">
        <div className="hidden grid-cols-[1fr_72px_110px_100px_32px] gap-2 border-b border-line bg-mute/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-ink3 md:grid">
          <span>Concepto</span>
          <span className="text-right">Cant.</span>
          <span className="text-right">Precio</span>
          <span className="text-right">Importe</span>
          <span />
        </div>
        {lineas.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-ink3">
            {cuentaId ? "Añade los proyectos que facturas o una línea manual." : "Elige primero la cuenta."}
          </p>
        ) : null}
        {lineas.map((l) => {
          const importe = calcularTotales([l], 0, 0).base;
          return (
            <div
              key={l.clave}
              className="grid grid-cols-[1fr_32px] gap-2 border-b border-line px-3 py-2 last:border-0 md:grid-cols-[1fr_72px_110px_100px_32px] md:items-center"
            >
              <div className="min-w-0">
                <input
                  value={l.descripcion}
                  onChange={(e) => cambiarLinea(l.clave, { descripcion: e.target.value })}
                  placeholder="Descripción"
                  aria-label="Descripción"
                  className="w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-ink hover:border-line focus:border-brand focus:outline-none"
                />
                {l.proyecto_id ? <span className="block px-1.5 text-[11px] text-ink3">Proyecto enlazado</span> : null}
              </div>
              <button
                type="button"
                onClick={() => setLineas((prev) => prev.filter((x) => x.clave !== l.clave))}
                aria-label="Quitar línea"
                className="row-span-2 self-start rounded-md p-1.5 text-ink3 hover:bg-mute hover:text-red-600 md:order-last md:row-span-1 md:self-center"
              >
                <IconPapelera className="h-4 w-4" />
              </button>
              <div className="col-span-1 grid grid-cols-3 gap-2 md:col-span-1 md:contents">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={l.cantidad}
                  onChange={(e) => cambiarLinea(l.clave, { cantidad: e.target.value === "" ? 0 : Number(e.target.value) })}
                  aria-label="Cantidad"
                  className="rounded-md border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  step="any"
                  value={l.precio_unitario}
                  onChange={(e) => cambiarLinea(l.clave, { precio_unitario: e.target.value === "" ? 0 : Number(e.target.value) })}
                  aria-label="Precio"
                  className="rounded-md border border-line bg-surface px-2 py-1 text-right text-sm tabular-nums"
                />
                <span className="self-center text-right text-sm font-medium tabular-nums text-ink">{eur(importe)}</span>
              </div>
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-mute/30 px-3 py-2">
          <select
            value=""
            disabled={!cuentaId || proyectosDisponibles.length === 0}
            onChange={(e) => {
              const p = proyectos.find((x) => x.id === e.target.value);
              if (p) setLineas((prev) => [...prev, lineaDeProyecto(p)]);
            }}
            className="max-w-full rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink disabled:opacity-50"
            aria-label="Añadir proyecto"
          >
            <option value="">{proyectosDisponibles.length || !cuentaId ? "+ Añadir proyecto…" : "Sin más proyectos en esta cuenta"}</option>
            {proyectosDisponibles.map((p) => {
              const pend = porFacturar(p);
              const r = reparto(p);
              return (
                <option key={p.id} value={p.id}>
                  {contextoDeProyecto(p)}
                  {pend != null ? ` — ${pend > 0 ? `${eur(pend)} por facturar` : r.enBorrador > 0 ? "ya en un borrador" : "ya facturado"}` : ""}
                  {pend != null && pend > 0 && r.enBorrador > 0 ? ` (${eur(r.enBorrador)} en borrador)` : ""}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            onClick={() => setLineas((prev) => [...prev, { clave: nuevaClave(), proyecto_id: null, descripcion: "", cantidad: 1, precio_unitario: 0 }])}
            className="btn-ghost py-1 text-sm"
          >
            <IconMas className="h-3.5 w-3.5" />
            Línea manual
          </button>
        </div>
      </div>

      {/* Totales */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2 text-sm md:max-w-xs">
          {numeroManual ? (
            <label className="block">
              <span className="field-label">Número</span>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="2026-015" className="input" />
            </label>
          ) : (
            <p className="text-xs text-ink3">
              {esEdicion && existente?.numero ? (
                <>Factura {existente.numero}</>
              ) : (
                <>
                  Número automático al emitir.{" "}
                  <button type="button" onClick={() => setNumeroManual(true)} className="underline hover:text-ink">
                    Poner número manual
                  </button>
                </>
              )}
            </p>
          )}
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Notas internas (opcional)"
            className="input resize-y text-sm"
          />
        </div>
        <dl className="grid min-w-[240px] grid-cols-[1fr_auto] gap-x-6 gap-y-1.5 text-sm">
          <dt className="text-ink2">Base imponible</dt>
          <dd className="text-right tabular-nums text-ink">{eur(totales.base)}</dd>
          <dt className="flex items-center gap-1 text-ink2">
            IVA
            <input
              type="number"
              step="any"
              min={0}
              max={100}
              value={ivaPct}
              onChange={(e) => setIvaPct(Number(e.target.value))}
              aria-label="IVA %"
              className="w-14 rounded border border-line bg-surface px-1 py-0.5 text-right text-xs tabular-nums"
            />
            %
          </dt>
          <dd className="text-right tabular-nums text-ink">+{eur(totales.iva)}</dd>
          <dt className="flex items-center gap-1 text-ink2">
            IRPF
            <input
              type="number"
              step="any"
              min={0}
              max={100}
              value={irpfPct}
              onChange={(e) => setIrpfPct(Number(e.target.value))}
              aria-label="IRPF %"
              className="w-14 rounded border border-line bg-surface px-1 py-0.5 text-right text-xs tabular-nums"
            />
            %
          </dt>
          <dd className="text-right tabular-nums text-ink">−{eur(totales.irpf)}</dd>
          <dt className="border-t border-line pt-1.5 font-semibold text-ink">Total</dt>
          <dd className="border-t border-line pt-1.5 text-right font-display text-lg font-bold tabular-nums text-ink" data-testid="total-factura">
            {eur(totales.total)}
          </dd>
        </dl>
      </div>

      {error ? <p className="field-error">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="btn-ghost">
            Cancelar
          </button>
        ) : null}
        {esBorrador ? (
          <button type="button" onClick={() => guardar("borrador")} disabled={!!enviando} className="btn-secondary">
            {enviando === "borrador" ? "Guardando…" : "Guardar borrador"}
          </button>
        ) : null}
        <button type="button" onClick={() => guardar("emitida")} disabled={!!enviando} className="btn-primary px-4">
          {enviando === "emitida" ? "Guardando…" : esEdicion && !esBorrador ? "Guardar cambios" : esEdicion ? "Emitir factura" : "Crear factura"}
        </button>
      </div>
    </div>
  );
}
