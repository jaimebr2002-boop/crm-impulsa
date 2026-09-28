import { extensionDe, grupoDeMime } from "@/lib/documentos";

const COLOR: Record<string, string> = {
  pdf: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-500/10 dark:border-red-500/30",
  imagen: "text-violet-700 bg-violet-50 border-violet-200 dark:text-violet-300 dark:bg-violet-500/10 dark:border-violet-500/30",
  video: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-500/10 dark:border-amber-500/30",
  documento: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-500/10 dark:border-sky-500/30",
  presentacion: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-500/10 dark:border-orange-500/30",
  hoja: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-500/10 dark:border-emerald-500/30",
};

/** Icono compacto con la extensión (PDF, JPG, DOCX…), coloreado por tipo. */
export function IconoArchivo({ mime, nombre, grande = false }: { mime: string; nombre: string; grande?: boolean }) {
  const ext = (extensionDe(nombre) || "?").slice(0, 4).toUpperCase();
  const color = COLOR[grupoDeMime(mime)] ?? "text-ink2 bg-mute border-line";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-md border font-semibold tracking-tight ${color} ${
        grande ? "h-12 w-10 text-[11px]" : "h-8 w-7 text-[9px]"
      }`}
    >
      {ext}
    </span>
  );
}
