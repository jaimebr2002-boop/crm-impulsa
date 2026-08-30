import { Avatar } from "@/components/Avatar";

export type FilaEquipo = {
  usuarioId: string;
  nombre: string;
  leads: number;
  interacciones: number;
  llamadasContestadas: number;
  seguimientosCompletados: number;
  cerrados: number;
};

export function TeamTable({ filas }: { filas: FilaEquipo[] }) {
  if (filas.length === 0) {
    return <p className="py-8 text-center text-sm text-ink3">Sin actividad en este periodo.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="text-xs text-ink3">
            <th className="pb-2 font-medium">Agente</th>
            <th className="pb-2 font-medium">Leads</th>
            <th className="pb-2 font-medium">Interacciones</th>
            <th className="pb-2 font-medium">Llam. contestadas</th>
            <th className="pb-2 font-medium">Seguim. hechos</th>
            <th className="pb-2 font-medium">Cerrados</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.usuarioId} className="border-t border-line">
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <Avatar nombre={f.nombre} size="sm" />
                  <span className="font-medium text-ink">{f.nombre}</span>
                </div>
              </td>
              <td className="py-2.5 text-ink2">{f.leads}</td>
              <td className="py-2.5 text-ink2">{f.interacciones}</td>
              <td className="py-2.5 text-ink2">{f.llamadasContestadas}</td>
              <td className="py-2.5 text-ink2">{f.seguimientosCompletados}</td>
              <td className="py-2.5 font-medium text-emerald-600 dark:text-emerald-400">{f.cerrados}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
