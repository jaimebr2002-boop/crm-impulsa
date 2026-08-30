import { esTelefonoFijoEspanol } from "@/lib/phone";
import { IconAlerta } from "./Icons";

export function PhoneIndicator({ telefono }: { telefono: string | null | undefined }) {
  if (!esTelefonoFijoEspanol(telefono)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
      <IconAlerta className="h-3.5 w-3.5" />
      Teléfono fijo · No WhatsApp
    </span>
  );
}
