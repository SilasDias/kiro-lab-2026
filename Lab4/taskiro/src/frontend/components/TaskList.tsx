/**
 * TaskList — the `list` Layout (R6.1).
 *
 * Renders the filtered set of Tasks as a single column of `TaskCard`s, ordered
 * according to the active sort mode. The ordering is already applied upstream:
 * `DataContext.visibleTasks` runs the pure-logic pipeline
 * (`filterByView`/`filterByProject`/`filterBySearch`/`filterByPriority` →
 * `sortTasks`), so this component simply maps the list it receives without
 * re-sorting.
 *
 * Reproduces the prototype's `#listView` container
 * (`max-w-4xl mx-auto space-y-3`) and its `renderList(list)` mapping of each
 * task to a card.
 */

import { TaskCard } from "@/components/TaskCard";
import { useData } from "@/state/DataContext";
import type { Task } from "@/lib/logic";

export interface TaskListProps {
  /**
   * The ordered, filtered tasks to render. Defaults to the active
   * `visibleTasks` from `DataContext` when omitted, so the component can be
   * dropped into the shell without prop wiring.
   */
  tasks?: Task[];
  /** Forwarded to each `TaskCard` to open the edit dialog (shell wiring). */
  onEdit?: (task: Task) => void;
  /** Forwarded to each `TaskCard` to request deletion (shell wiring). */
  onDelete?: (task: Task) => void;
}

export function TaskList({ tasks, onEdit, onDelete }: TaskListProps) {
  const data = useData();
  const list = tasks ?? data.visibleTasks;

  return (
    <div className="mx-auto max-w-4xl space-y-3">
      {list.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

export default TaskList;
