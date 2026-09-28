"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/context/AppContext";
import { actualizarSuscripcion, listarSuscripciones, registrarRenovacion } from "@/lib/data/finanzas";
import { diasHasta, formatYMDCorta, formatYMDRelativa } from "@/lib/dates";
import { CATEGORIA_GASTO_LABEL, costeAnual, costeFijo, eur, periodicidadCorta } from "@/lib/finanzas";
import type { Suscripcion } from "@/lib/types";
import { SoloAdmin } from "@/components/trabajo/SoloAdmin";
import { FinanzasNav } from "@/components/finanzas/FinanzasNav";
import { FilaKpis } from "@/components/trabajo/FilaKpis";
import { Cabecera } from "@/components/ui/Cabecera";
import { SkeletonLineas } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Modal } from "@/components/Modal";
import { SuscripcionForm } from "@/components/forms/SuscripcionForm";
import { IconMas } from "@/components/Icons";

export default function SuscripcionesPage() {
  return (
    <SoloAdmin>
      <Suscripciones />
    </SoloAdmin>
  );
}

function Suscripciones() {
  const { abrirAlta, versionDatos, avisar } = useApp();
  const [lista, setLista] = useState<Suscripcion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Suscripcion | null>(null);
  const [registrando, setRegistrando] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setLista(await listarSuscripciones());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se han podido cargar las suscripciones.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, versionDatos]);

  const activas = lista.filter((s) => s.activa);
  const coste = costeFijo(lista);
  const proximas = activas.filter((s) => diasHasta(s.proxima_renovacion) <= 30);

  async function registrar(s: Suscripcion) {
    setRegistrando(s.id);
    try {
      await registrarRenovacion(s.id);
      avisar(`Registrado ${eur(s.importe)} de ${s.nombre} (${formatYMDCorta(s.proxima_renovacion)})`, {
        enlace: { href: "/finanzas/gastos", texto: "Ver gastos" },
      });
      await cargar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "No se ha podido registrar.", { tono: "error" });
    } finally {
      setRegistrando(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 md:px-8">
      <Cabecera
        titulo="Finanzas"
        acciones={
          <button onClick={() => abrirAlta({ tipo: "suscripcion" })} className="btn-primary">
            <IconMas className="h-4 w-4" />
            Suscripción
          </button>
        }
      />
      <FinanzasNav />

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {cargando && !error ? <SkeletonLineas filas={5} /> : null}

      {!cargando && !error ? (
        <div className="flex flex-col gap-6">
          <FilaKpis
            columnas="md:grid-cols-3"
            kpis={[
              { etiqueta: "Coste fijo mensual (estimado)", valor: eur(coste.mensual), nota: `${activas.length} activa${activas.length === 1 ? "" : "s"}` },
              { etiqueta: "Coste fijo anual (estimado)", valor: eur(coste.anual), nota: "Si todo sigue igual 12 meses" },
              { etiqueta: "Renuevan en 30 días", valor: proximas.length, nota: proximas.length ? eur(proximas.reduce((t, s) => t + Number(s.importe), 0)) : undefined },
            ]}
          />

          {lista.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
              <p className="text-sm font-medium text-ink">Aún no hay suscripciones.</p>
              <p className="mt-1 max-w-sm text-sm text-ink3">
                ChatGPT, Claude, Vercel, dominios… Cada renovación se registra como gasto real con un clic.
              </p>
              <button onClick={() => abrirAlta({ tipo: "suscripcion" })} className="btn-primary mt-4">
                <IconMas className="h-4 w-4" />
                Añadir suscripción
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="hidden grid-cols-[1fr_110px_130px_150px_110px_170px] gap-3 border-b border-line px-4 py-2.5 text-xs text-ink3 md:grid">
                <span>Herramienta</span>
                <span>Categoría</span>
                <span className="text-right">Precio</span>
                <span>Próxima renovación</span>
                <span className="text-right">Coste anual</span>
                <span />
              </div>
              <div className="divide-y divide-line">
                {lista.map((s) => {
                  const d = diasHasta(s.proxima_renovacion);
                  const toca = s.activa && d <= 0;
                  return (
                    <div
                      key={s.id}
                      className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-sm md:grid-cols-[1fr_100px_120px_170px_100px_210px] ${
                        s.activa ? "" : "opacity-60"
                      }`}
                    >
                      <button onClick={() => setEditando(s)} className="min-w-0 text-left">
                        <span className="block truncate font-medium text-ink hover:underline">{s.nombre}</span>
                        <span className="block truncate text-xs text-ink3">{s.activa ? s.proveedor ?? "" : "Pausada"}</span>
                      </button>
                      <span className="hidden text-ink2 md:block">{CATEGORIA_GASTO_LABEL[s.categoria]}</span>
                      <span className="text-right font-medium tabular-nums text-ink">
                        {eur(s.importe)}
                        <span className="text-xs font-normal text-ink3">{periodicidadCorta(s.periodicidad)}</span>
                      </span>
                      <span className={`text-xs md:text-sm ${toca ? "font-medium text-amber-700 dark:text-amber-400" : "text-ink2"}`}>
                        {s.activa ? (
                          <>
                            {formatYMDRelativa(s.proxima_renovacion)}
                            {toca ? " · por registrar" : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span className="hidden text-right tabular-nums text-ink2 md:block">{eur(costeAnual(s))}</span>
                      <span className="col-span-2 flex justify-end gap-1 md:col-span-1">
                        {s.activa ? (
                          <button
                            onClick={() => registrar(s)}
                            disabled={registrando === s.id}
                            className={`whitespace-nowrap py-1 text-xs ${toca ? "btn-primary" : "btn-secondary"}`}
                            title={`Crea el gasto de ${eur(s.importe)} del ${formatYMDCorta(s.proxima_renovacion)} y pasa a la siguiente renovación`}
                          >
                            {registrando === s.id ? "Registrando…" : "Registrar periodo"}
                          </button>
                        ) : null}
                        <button
                          onClick={async () => {
                            try {
                              await actualizarSuscripcion(s.id, { activa: !s.activa });
                              avisar(s.activa ? "Suscripción pausada" : "Suscripción reactivada");
                              cargar();
                            } catch (e) {
                              avisar(e instanceof Error ? e.message : "No se ha podido guardar.", { tono: "error" });
                            }
                          }}
                          className="btn-ghost py-1 text-xs"
                        >
                          {s.activa ? "Pausar" : "Reactivar"}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-xs text-ink3">
            Una suscripción es una plantilla: no genera gastos sola. «Registrar periodo» crea el gasto real de esa renovación y avanza la
            fecha; los costes fijos son estimaciones a partir de las suscripciones activas.
          </p>
        </div>
      ) : null}

      {editando ? (
        <Modal titulo={`Editar ${editando.nombre}`} onClose={() => setEditando(null)}>
          <SuscripcionForm
            botonTexto="Guardar"
            inicial={editando}
            onCancelar={() => setEditando(null)}
            onSubmit={async (v) => {
              await actualizarSuscripcion(editando.id, v);
              setEditando(null);
              avisar("Suscripción actualizada");
              cargar();
            }}
          />
        </Modal>
      ) : null}
    </div>
  );
}
