/** "De parte de…" en la ficha del lead: una línea destacada, no una tarjeta. */
export function ReferralBanner({ referidoPor }: { referidoPor: string | null | undefined }) {
  if (!referidoPor) return null;
  return (
    <p className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm">
      <span className="t-eyebrow">De parte de</span>
      <span className="font-medium text-ink">{referidoPor}</span>
    </p>
  );
}
