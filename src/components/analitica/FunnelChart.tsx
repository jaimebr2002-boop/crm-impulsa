export type EtapaFunnel = { clave: string; etiqueta: string; valor: number };

export function FunnelChart({ etapas }: { etapas: EtapaFunnel[] }) {
  const max = Math.max(...etapas.map((e) => e.valor), 1);

  return (
    <div className="flex flex-col gap-2">
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
                  <span className="text-brand-dark dark:text-brand">↳ {conversion}% del anterior</span>
                ) : null}
                <span className="font-display font-bold text-ink">{etapa.valor}</span>
              </span>
            </div>
            <div className="h-8 w-full overflow-hidden rounded-lg bg-mute">
              <div
                className="flex h-full items-center justify-end rounded-lg bg-brand-gradient pr-2 transition-all duration-500"
                style={{ width: `${anchoPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
