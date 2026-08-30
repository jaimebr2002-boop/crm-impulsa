export function Sparkline({
  valores,
  className,
  color = "currentColor",
}: {
  valores: number[];
  className?: string;
  color?: string;
}) {
  if (valores.length < 2) return null;

  const w = 100;
  const h = 32;
  const max = Math.max(...valores, 1);
  const min = Math.min(...valores, 0);
  const rango = max - min || 1;

  const puntos = valores.map((v, i) => {
    const x = (i / (valores.length - 1)) * w;
    const y = h - ((v - min) / rango) * h;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const area = `M0,${h} L${puntos.join(" L")} L${w},${h} Z`;
  const linea = `M${puntos.join(" L")}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className}>
      <path d={area} fill={color} opacity={0.12} />
      <path d={linea} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
