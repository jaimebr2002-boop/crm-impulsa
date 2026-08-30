export function ReferralBanner({ referidoPor }: { referidoPor: string | null | undefined }) {
  if (!referidoPor) return null;
  return (
    <div className="rounded-2xl border border-brand/30 bg-brand-light px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-dark">De parte de</p>
      <p className="mt-0.5 text-base font-medium text-ink">{referidoPor}</p>
    </div>
  );
}
