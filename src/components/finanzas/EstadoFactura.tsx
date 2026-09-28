import { ESTADO_COBRO_ESTILO, ESTADO_COBRO_LABEL } from "@/lib/finanzas";
import type { FacturaEstado } from "@/lib/types";

/** Estado de cobro derivado en BD. Una parcial ya vencida se marca además como vencida. */
export function EstadoFacturaChip({ factura }: { factura: Pick<FacturaEstado, "estado_cobro" | "vencida"> }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`chip ${ESTADO_COBRO_ESTILO[factura.estado_cobro]}`}>{ESTADO_COBRO_LABEL[factura.estado_cobro]}</span>
      {factura.vencida && factura.estado_cobro === "parcial" ? (
        <span className={`chip ${ESTADO_COBRO_ESTILO.vencida}`}>Vencida</span>
      ) : null}
    </span>
  );
}
