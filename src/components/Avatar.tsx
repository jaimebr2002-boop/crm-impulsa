const PALETA = [
  "bg-brand-light text-brand-dark",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
];

function colorPara(texto: string) {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) % PALETA.length;
  return PALETA[Math.abs(hash) % PALETA.length];
}

export function Avatar({ nombre, size = "md" }: { nombre: string; size?: "sm" | "md" | "lg" }) {
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";
  const tamano = size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-14 w-14 text-xl" : "h-10 w-10 text-sm";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tamano} ${colorPara(nombre)}`}
    >
      {inicial}
    </span>
  );
}
