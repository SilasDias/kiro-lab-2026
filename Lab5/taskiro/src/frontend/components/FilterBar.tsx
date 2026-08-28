/**
 * FilterBar — the prototype's filter bar (Requirement 5).
 *
 * Reproduces the prototype's `index.html` filter row: a "Prioridade" label
 * followed by the priority pills "Todas" / "Alta" / "Média" / "Baixa", and a
 * right-aligned group with a sort control and the "Limpar concluídas" action.
 *
 * Behavior (ported from the prototype, theming via OKLCH tokens only — R14.3/14.7):
 *  - Priority pills set the active priority filter; the selected pill carries the
 *    brand active styling and "Todas" clears the filter (R5.1, R5.2). State lives
 *    in `DataContext` (`priorityFilter` / `setPriorityFilter`).
 *  - The sort control cycles due → priority → title → due via `cycleSort`
 *    (`DataContext`) and shows the current mode's label "Ordenar: Prazo /
 *    Prioridade / Título" (R5.3). An info toast mirrors the prototype's
 *    "Ordenação atualizada." feedback (R11.4).
 *  - "Limpar concluídas" triggers a confirmation when at least one completed task
 *    exists (R5.7) and otherwise shows an info toast "Não há tarefas concluídas."
 *    (R5.10). The ConfirmDialog itself is owned by a sibling task (11.9); this
 *    component requests it through `onRequestClearCompleted`, passing the
 *    completed-task count so the dialog can render the prototype's message.
 */

import { ArrowDownUp, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { useData, type PriorityFilter } from '@/state/DataContext';
import type { SortMode } from '@/lib/logic';

/** Priority pills in the prototype's left-to-right order with their pt-BR labels. */
const PRIORITY_FILTERS: ReadonlyArray<{ value: PriorityFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

/** Sort-control label per mode (prototype's `sortOptions` labels). */
const SORT_LABELS: Record<SortMode, string> = {
  due: 'Ordenar: Prazo',
  priority: 'Ordenar: Prioridade',
  title: 'Ordenar: Título',
};

export interface FilterBarProps {
  /**
   * Invoked when "Limpar concluídas" is activated while at least one completed
   * task exists. The parent opens the ConfirmDialog (task 11.9) using the
   * provided completed-task count to render "Remover N tarefa(s) concluída(s)?".
   */
  onRequestClearCompleted?: (completedCount: number) => void;
}

export function FilterBar({ onRequestClearCompleted }: FilterBarProps) {
  const { tasks, priorityFilter, setPriorityFilter, sort, cycleSort } = useData();

  const handleSort = () => {
    cycleSort();
    // Mirror the prototype's feedback when the sort mode changes (R11.4).
    toast.info('Ordenação atualizada.');
  };

  const handleClearCompleted = () => {
    const completedCount = tasks.filter((t) => t.done).length;
    if (completedCount === 0) {
      // No completed tasks: info toast, no confirmation, no changes (R5.10).
      toast.info('Não há tarefas concluídas.');
      return;
    }
    // At least one completed task: request confirmation before removing (R5.7).
    onRequestClearCompleted?.(completedCount);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-card px-4 py-3 sm:px-6">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
        Prioridade
      </span>

      {/* Priority filter pills (R5.1, R5.2) */}
      {PRIORITY_FILTERS.map(({ value, label }) => {
        const active = priorityFilter === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setPriorityFilter(value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              active
                ? 'border-brand-600 bg-brand-600 text-primary-foreground'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {label}
          </button>
        );
      })}

      <div className="ml-auto flex items-center gap-2">
        {/* Sort cycle control with current-mode label (R5.3) */}
        <button
          type="button"
          onClick={handleSort}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          <span>{SORT_LABELS[sort]}</span>
        </button>

        {/* Clear completed: confirm when present, info toast when none (R5.7, R5.10) */}
        <button
          type="button"
          onClick={handleClearCompleted}
          className="flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-medium text-destructive transition hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Limpar concluídas</span>
        </button>
      </div>
    </div>
  );
}
