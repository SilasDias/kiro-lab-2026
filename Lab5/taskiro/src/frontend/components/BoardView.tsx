/**
 * BoardView — the `board` (Kanban) Layout (R6.2, R6.3, R6.5).
 *
 * Renders exactly three columns — "A fazer" (`todo`), "Em progresso" (`doing`),
 * and "Concluído" (`done`) — each with a count equal to the number of filtered
 * Tasks placed in that column. Placement is delegated to the pure-logic
 * `boardColumns`, which puts every done Task in "Concluído" regardless of its
 * `status`, and every not-done Task in the column matching its `status`
 * (R6.3). A column with no filtered Tasks shows the "Vazio" placeholder (R6.5).
 *
 * Reproduces the prototype's `renderBoard`: the `#boardView` grid
 * (`grid-cols-1 md:grid-cols-3 gap-4`), the per-column header with its lucide
 * icon + accent, the count pill, and the `min-h-[120px]` body. Accent colors
 * use OKLCH theme tokens only (R14.3, R14.7): slate for `todo`, brand for
 * `doing`, and the emerald priority token for `done`.
 */

import { CheckCircle2, Circle, Loader } from "lucide-react";
import type { ComponentType } from "react";

import { TaskCard } from "@/components/TaskCard";
import { useData } from "@/state/DataContext";
import { boardColumns, type Status, type Task } from "@/lib/logic";

interface ColumnMeta {
  key: Status;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  accent: string;
}

/**
 * The three Kanban columns in prototype order, with their pt-BR labels,
 * lucide-react icons, and tokenized accent classes.
 */
const COLUMNS: ColumnMeta[] = [
  { key: "todo", label: "A fazer", Icon: Circle, accent: "text-slate-500" },
  { key: "doing", label: "Em progresso", Icon: Loader, accent: "text-brand-600" },
  {
    key: "done",
    label: "Concluído",
    Icon: CheckCircle2,
    accent: "text-priority-low",
  },
];

export interface BoardViewProps {
  /**
   * The filtered tasks to partition into columns. Defaults to the active
   * `visibleTasks` from `DataContext` when omitted.
   */
  tasks?: Task[];
  /** Forwarded to each `TaskCard` to open the edit dialog (shell wiring). */
  onEdit?: (task: Task) => void;
  /** Forwarded to each `TaskCard` to request deletion (shell wiring). */
  onDelete?: (task: Task) => void;
}

export function BoardView({ tasks, onEdit, onDelete }: BoardViewProps) {
  const data = useData();
  const list = tasks ?? data.visibleTasks;
  const columns = boardColumns(list);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map(({ key, label, Icon, accent }) => {
        const items = columns[key];
        return (
          <div
            key={key}
            className="flex flex-col rounded-xl border border-slate-200 bg-slate-50"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <Icon className={`h-4 w-4 ${accent}`} />
              <h3 className="text-sm font-semibold text-slate-700">{label}</h3>
              <span className="ml-auto rounded-full border border-slate-200 bg-card px-2 py-0.5 text-xs text-slate-500">
                {items.length}
              </span>
            </div>
            <div className="min-h-[120px] flex-1 space-y-3 p-3">
              {items.length > 0 ? (
                items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">Vazio</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default BoardView;
