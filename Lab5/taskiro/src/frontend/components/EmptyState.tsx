/**
 * EmptyState — shown in place of the list/board views when the filtered set of
 * Tasks is empty (R6.4).
 *
 * Presents an icon, a message indicating there are no Tasks for the current
 * filters, and a "Nova tarefa" call-to-action that opens the task creation
 * dialog via the `onNewTask` callback supplied by the shell (the same handler
 * the header's "Nova tarefa" button uses).
 *
 * Reproduces the prototype's `#emptyState`: the centered `py-20` column, the
 * rounded `bg-brand-50` icon tile holding the `clipboard-list` lucide icon in
 * `text-brand-500`, the slate heading/subtext, and the primary CTA. All colors
 * use OKLCH theme tokens (R14.3, R14.7).
 */

import { ClipboardList, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

export interface EmptyStateProps {
  /**
   * Opens the task creation dialog. Wired by the shell to the same action as
   * the header "Nova tarefa" button.
   */
  onNewTask?: () => void;
}

export function EmptyState({ onNewTask }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-brand-50">
        <ClipboardList className="h-8 w-8 text-brand-500" />
      </div>
      <h3 className="font-semibold text-slate-700">Nenhuma tarefa por aqui</h3>
      <p className="mt-1 mb-4 text-sm text-slate-400">Crie sua primeira tarefa para começar.</p>
      <Button onClick={onNewTask}>
        <Plus className="h-4 w-4" />
        Nova tarefa
      </Button>
    </div>
  );
}

export default EmptyState;
