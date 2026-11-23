export interface RuntimeBadgeProps {
  label?: string;
}

export function RuntimeBadge({ label = "TLCE UI bridge ready" }: RuntimeBadgeProps) {
  return (
    <span class="inline-flex items-center gap-2 rounded-full border border-tlce-accent/40 bg-tlce-ink px-3 py-1 text-sm font-medium text-white shadow-lg">
      <span class="size-2 rounded-full bg-emerald-400" aria-hidden="true" />
      {label}
    </span>
  );
}
