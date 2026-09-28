"use client";

import { useEffect, useState } from "react";
import { crearCuenta, crearMarca, listarCuentas, listarMarcas } from "@/lib/data/cuentas";
import type { Cuenta, Marca } from "@/lib/types";
import { TIPO_CUENTA_LABEL } from "@/lib/trabajo";

const NUEVA = "__nueva__";

/** Elige de dónde viene el trabajo (cuenta) y, opcionalmente, para qué marca.
 * Ambas se pueden crear al vuelo sin salir del formulario. */
export function CuentaMarcaSelector({
  cuentaId,
  marcaId,
  onChange,
}: {
  cuentaId: string | null;
  marcaId: string | null;
  onChange: (v: { cuenta_id: string | null; marca_id: string | null }) => void;
}) {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [creando, setCreando] = useState<"cuenta" | "marca" | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarCuentas(), listarMarcas()])
      .then(([c, m]) => {
        setCuentas(c);
        setMarcas(m);
      })
      .catch(() => {});
  }, []);

  const marcasDeCuenta = marcas.filter((m) => m.cuenta_id === cuentaId);

  async function confirmarNueva() {
    const nombre = nombreNuevo.trim();
    if (!nombre || guardando) return;
    setGuardando(true);
    setError(null);
    try {
      if (creando === "cuenta") {
        const c = await crearCuenta({ nombre });
        setCuentas((prev) => [...prev, c].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        onChange({ cuenta_id: c.id, marca_id: null });
      } else if (creando === "marca" && cuentaId) {
        const m = await crearMarca({ cuenta_id: cuentaId, nombre });
        setMarcas((prev) => [...prev, m]);
        onChange({ cuenta_id: cuentaId, marca_id: m.id });
      }
      setCreando(null);
      setNombreNuevo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se ha podido crear.");
    } finally {
      setGuardando(false);
    }
  }

  if (creando) {
    return (
      <div>
        <span className="mb-1 block text-xs font-medium text-ink2">{creando === "cuenta" ? "Nueva cuenta" : "Nueva marca"}</span>
        <div className="flex gap-2">
          <input
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmarNueva();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setCreando(null);
              }
            }}
            placeholder={creando === "cuenta" ? "Ej: Fer" : "Ej: Segurma"}
            className="input"
          />
          <button type="button" onClick={confirmarNueva} disabled={guardando} className="btn-primary shrink-0">
            Crear
          </button>
          <button type="button" onClick={() => setCreando(null)} className="btn-ghost shrink-0">
            ×
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink2">Cuenta</span>
        <select
          value={cuentaId ?? ""}
          onChange={(e) => {
            if (e.target.value === NUEVA) return setCreando("cuenta");
            onChange({ cuenta_id: e.target.value || null, marca_id: null });
          }}
          className="input"
        >
          <option value="">Sin cuenta</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.tipo !== "intermediario" ? ` · ${TIPO_CUENTA_LABEL[c.tipo]}` : ""}
            </option>
          ))}
          <option value={NUEVA}>+ Nueva cuenta…</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink2">Marca</span>
        <select
          value={marcaId ?? ""}
          disabled={!cuentaId}
          onChange={(e) => {
            if (e.target.value === NUEVA) return setCreando("marca");
            onChange({ cuenta_id: cuentaId, marca_id: e.target.value || null });
          }}
          className="input disabled:opacity-50"
        >
          <option value="">{cuentaId ? "Sin marca" : "Elige cuenta"}</option>
          {marcasDeCuenta.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
          {cuentaId ? <option value={NUEVA}>+ Nueva marca…</option> : null}
        </select>
      </label>
    </div>
  );
}
