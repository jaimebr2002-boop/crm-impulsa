export type EtapaFunnel = { clave: string; etiqueta: string; valor: number };

export function FunnelChart({ etapas }: { etapas: EtapaFunnel[] }) {
  const max = Math.max(...etapas.map((e) => e.valor), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {etapas.map((etapa, i) => {
        const anchoPct = Math.max((etapa.valor / max) * 100, etapa.valor > 0 ? 6 : 3);
        const anterior = i > 0 ? etapas[i - 1].valor : null;
        const conversion = anterior && anterior > 0 ? Math.round((etapa.valor / anterior) * 100) : null;

        return (
          <div key={etapa.clave}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-medium text-ink2">{etapa.etiqueta}</span>
              <span className="flex items-center gap-2">
                {conversion !== null ? (
                  <span className="text-ink3">{conversion} % del anterior</span>
                ) : null}
                <span className="w-8 text-right font-medium tabular-nums text-ink">{etapa.valor}</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-mute">
              <div
                className={`h-full rounded-full ${etapa.clave === "cerrado" ? "bg-emerald-500" : "bg-ink/70"}`}
                style={{ width: `${anchoPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
