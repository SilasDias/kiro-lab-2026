/**
 * PriorityBadge — the priority chip shown on a task card and elsewhere (R2.8,
 * R7.1).
 *
 * Reproduces the prototype's `PRIORITY` chip: a pill with a leading solid dot
 * and a pt-BR label (Alta / Média / Baixa). Color coding maps `high` → rose,
 * `medium` → amber, `low` → emerald, expressed exclusively through the priority
 * OKLCH theme tokens (`--priority-high/medium/low`) per Requirements 14.3/14.7
 * — never raw color literals. The subtle chip surface/border use opacity
 * modifiers of the same token.
 */

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Priority } from '@/lib/logic';

/**
 * Per-priority label and tokenized chip/dot classes. The class strings are
 * static (not interpolated) so Tailwind can detect them at build time.
 */
const PRIORITY_META: Record<Priority, { label: string; chip: string; dot: string }> = {
  high: {
    label: 'Alta',
    chip: 'bg-priority-high/10 text-priority-high border-priority-high/20',
    dot: 'bg-priority-high',
  },
  medium: {
    label: 'Média',
    chip: 'bg-priority-medium/10 text-priority-medium border-priority-medium/30',
    dot: 'bg-priority-medium',
  },
  low: {
    label: 'Baixa',
    chip: 'bg-priority-low/10 text-priority-low border-priority-low/20',
    dot: 'bg-priority-low',
  },
};

export interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const meta = PRIORITY_META[priority];
  return (
    <Badge
      variant="outline"
      className={cn('gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', meta.chip, className)}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  );
}
