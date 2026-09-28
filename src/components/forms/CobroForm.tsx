"use client";

import { useEffect, useState } from "react";
import { listarFacturas, registrarCobro } from "@/lib/data/finanzas";
import { hoyYMD } from "@/lib/dates";
import { aCentimos, deCentimos, eur, METODOS_COBRO, METODO_COBRO_LABEL } from "@/lib/finanzas";
import type { FacturaConCuenta, MetodoCobro } from "@/lib/types";

/** Registrar un cobro (total o parcial). Sin factura previa, deja elegir entre las pendientes. */
export function CobroForm({
  facturaInicial,
  facturaId,
  onGuardado,
  onCancelar,
}: {
  facturaInicial?: FacturaConCuenta;
  facturaId?: string;
  onGuardado: (factura: FacturaConCuenta) => void;
  onCancelar?: () => void;
}) {
  const [pendientes, setPendientes] = useState<FacturaConCuenta[]>(facturaInicial ? [facturaInicial] : []);
  const [seleccion, setSeleccion] = useState(facturaInicial?.id ?? facturaId ?? "");
  const [importe, setImporte] = useState<string>(facturaInicial ? String(facturaInicial.pendiente) : "");
  const [fecha, setFecha] = useState(hoyYMD());
  const [metodo, setMetodo] = useState<MetodoCobro>("transferencia");
  const [referencia, setReferencia] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (facturaInicial) return;
    listarFacturas()
      .then((fs) => {
        const conPendiente = fs.filter((f) => f.estado === "emitida" && aCentimos(f.pendiente) > 0);
        setPendientes(conPendiente);
        const inicial = conPendiente.find((f) => f.id === facturaId);
        if (inicial) setImporte(String(inicial.pendiente));
      })
      .catch(() => {});
  }, [facturaInicial, facturaId]);

  const factura = pendientes.find((f) => f.id === seleccion);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!factura) return setError("Elige la factura.");
    const c = aCentimos(importe);
    if (c <= 0) return setError("El importe debe ser mayor que 0.");
    if (c > aCentimos(factura.pendiente)) return setError(`Supera lo pendiente (${eur(factura.pendiente)}).`);
    setEnviando(true);
    setError(null);
    try {
      await registrarCobro({ factura_id: factura.id, fecha, importe: deCentimos(c), metodo, referencia: referencia.trim() || null });
      onGuardado(factura);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido registrar el cobro.");
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4">
      {facturaInicial ? (
        <p className="text-sm text-ink2">
          Factura <strong className="text-ink">{facturaInicial.numero}</strong> · {facturaInicial.cuenta?.nombre} · pendiente{" "}
          <strong className="text-ink">{eur(facturaInicial.pendiente)}</strong>
        </p>
      ) : (
        <label className="block">
          <span className="field-label">Factura</span>
          <select
            value={seleccion}
            onChange={(e) => {
              setSeleccion(e.target.value);
              const f = pendientes.find((x) => x.id === e.target.value);
              if (f) setImporte(String(f.pendiente));
            }}
            className="input"
            autoFocus
          >
            <option value="">{pendientes.length ? "Elige una factura pendiente…" : "No hay facturas pendientes"}</option>
            {pendientes.map((f) => (
              <option key={f.id} value={f.id}>
                {f.numero} · {f.cuenta?.nombre} · pendiente {eur(f.pendiente)}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Importe (€)</span>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            className="input tabular-nums"
            autoFocus={!!facturaInicial}
          />
        </label>
        <label className="block">
          <span className="field-label">Fecha</span>
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="input" />
        </label>
      </div>
      {factura ? (
        <div className="-mt-2 flex gap-1.5 text-xs">
          <button type="button" onClick={() => setImporte(String(factura.pendiente))} className="rounded-md border border-line px-1.5 py-0.5 text-ink2 hover:bg-mute">
            Todo lo pendiente
          </button>
          <button
            type="button"
            onClick={() => setImporte(String(deCentimos(Math.round(aCentimos(factura.pendiente) / 2))))}
            className="rounded-md border border-line px-1.5 py-0.5 text-ink2 hover:bg-mute"
          >
            La mitad
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="field-label">Método</span>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoCobro)} className="input">
            {METODOS_COBRO.map((m) => (
              <option key={m} value={m}>
                {METODO_COBRO_LABEL[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Referencia</span>
          <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" className="input" />
        </label>
      </div>

      {error ? <p className="field-error">{error}</p> : null}
      <div className="flex justify-end gap-2">
        {onCancelar ? (
          <button type="button" onClick={onCancelar} className="btn-ghost">
            Cancelar
          </button>
        ) : null}
        <button type="submit" disabled={enviando} className="btn-primary px-4">
          {enviando ? "Registrando…" : "Registrar cobro"}
        </button>
      </div>
    </form>
  );
}
