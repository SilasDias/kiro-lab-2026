/**
 * TaskCard — the task card shown in the list view and inside board columns
 * (Requirement 7).
 *
 * Reproduces the prototype's `taskCardHTML` with full visual fidelity:
 *  - a circular completion toggle (filled brand when done, with a check icon)
 *    (R7.1);
 *  - the task title, struck through when done (R7.1, R7.4);
 *  - a priority chip via `PriorityBadge` (R2.8, R7.1);
 *  - the project color dot + name, omitted when the task has no project
 *    (R7.1, R7.3) — the dot color is per-record *data* applied via inline style
 *    (allowed exception to R14.3);
 *  - a due-date badge whose text/tone/icon come from `formatDue` (R7.1,
 *    R7.5–R7.9);
 *  - the description, shown only when non-empty (R7.2);
 *  - edit and delete controls that are hidden by default and revealed on hover
 *    (R7.10, R7.11).
 *
 * The completion toggle is optimistic (R7.12): `DataContext.toggleComplete`
 * applies the new done/status locally immediately and persists via the API. On
 * success a confirmation toast is shown (R7.13); on failure the context reverts
 * the task and this component shows an error toast (R7.14).
 *
 * All theme colors are referenced through OKLCH-backed Tailwind utilities
 * (`text-brand-600`, `text-slate-*`, `text-destructive`, `bg-brand-600`, ...);
 * no raw color literals are used (Requirements 14.3, 14.7).
 */

import { useState } from "react";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  Check,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { PriorityBadge } from "@/components/PriorityBadge";
import { cn } from "@/lib/utils";
import { formatDue, type DueTone, type Task } from "@/lib/logic";
import { useData } from "@/state/DataContext";
import type { Project } from "@/lib/api";

/**
 * Per-tone presentation for the due-date badge, mirroring the prototype's
 * `formatDue` `cls`/`icon` values but expressed through theme tokens:
 *   none     -> calendar,       text-slate-400              (no due date)
 *   overdue  -> calendar-x,     text-destructive font-medium (due before today)
 *   today    -> calendar-clock, text-brand-600 font-medium   (due today)
 *   tomorrow -> calendar,       text-slate-500               (due tomorrow)
 *   default  -> calendar,       text-slate-500               (any later date)
 */
const DUE_TONE_META: Record<DueTone, { icon: LucideIcon; className: string }> = {
  none: { icon: Calendar, className: "text-slate-400" },
  overdue: { icon: CalendarX, className: "text-destructive font-medium" },
  today: { icon: CalendarClock, className: "text-brand-600 font-medium" },
  tomorrow: { icon: Calendar, className: "text-slate-500" },
  default: { icon: Calendar, className: "text-slate-500" },
};

/** Today's date as a local ISO `YYYY-MM-DD` string (matches the prototype). */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export interface TaskCardProps {
  task: Task;
  /**
   * The project the task belongs to, if any. When omitted the card resolves the
   * project from `DataContext` using `task.project`; the dot + name are hidden
   * when the task has no project or the project is unknown (R7.3).
   */
  project?: Project | null;
  /** Open the edit dialog for this task (wired by the shell, task 11.6). */
  onEdit?: (task: Task) => void;
  /** Request deletion of this task (wired by the shell, task 11.9). */
  onDelete?: (task: Task) => void;
  className?: string;
}

export function TaskCard({
  task,
  project,
  onEdit,
  onDelete,
  className,
}: TaskCardProps) {
  const { projects, toggleComplete } = useData();
  const [toggling, setToggling] = useState(false);

  // Resolve the project record (prop wins; otherwise look it up by id) so the
  // color dot + name can be rendered (R7.1) or omitted when absent (R7.3).
  const resolvedProject =
    project ?? projects.find((p) => p.id === task.project) ?? null;

  const due = formatDue(task.due, todayIso());
  const dueMeta = DUE_TONE_META[due.tone];
  const DueIcon = dueMeta.icon;

  async function handleToggle() {
    if (toggling) return;
    setToggling(true);
    // The card's `task` reflects the pre-toggle state; the resulting done state
    // is its negation. This drives the toast variant (R7.13, R11.4).
    const willBeDone = !task.done;
    try {
      await toggleComplete(task.id);
      if (willBeDone) {
        toast.success("Tarefa concluída");
      } else {
        toast.info("Tarefa reaberta");
      }
    } catch {
      // DataContext already reverted the optimistic change (R7.14); surface the
      // failure to the user.
      toast.error("Não foi possível atualizar a tarefa");
    } finally {
      setToggling(false);
    }
  }

  return (
    <div
      className={cn(
        "task-card group flex items-start gap-3 rounded-xl border border-slate-200 bg-card p-4 transition hover:border-brand-300 hover:shadow-md",
        className,
      )}
      data-id={task.id}
    >
      {/* Circular completion toggle (R7.1, R7.12) */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling}
        aria-pressed={task.done}
        aria-label={task.done ? "Reabrir tarefa" : "Concluir tarefa"}
        title="Concluir"
        className={cn(
          "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition disabled:cursor-not-allowed disabled:opacity-60",
          task.done
            ? "border-brand-600 bg-brand-600 text-white"
            : "border-slate-300 hover:border-brand-500",
        )}
      >
        {task.done ? <Check className="h-3 w-3" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {/* Title — strikethrough when done (R7.4) */}
          <p
            className={cn(
              "flex-1 font-medium text-slate-800",
              task.done && "text-slate-400 line-through",
            )}
          >
            {task.title}
          </p>
          {/* Priority chip (R2.8, R7.1) */}
          <PriorityBadge priority={task.priority} className="shrink-0" />
        </div>

        {/* Description — only when non-empty (R7.2) */}
        {task.desc ? (
          <p
            className={cn(
              "mt-0.5 text-sm text-slate-500",
              task.done && "line-through",
            )}
          >
            {task.desc}
          </p>
        ) : null}

        <div className="mt-2 flex items-center gap-3 text-xs">
          {/* Project dot + name — omitted when no project (R7.3) */}
          {resolvedProject ? (
            <span className="inline-flex items-center gap-1.5 text-slate-500">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: resolvedProject.color }}
              />
              {resolvedProject.name}
            </span>
          ) : null}
          {/* Due-date badge (R7.1, R7.5–R7.9) */}
          <span className={cn("inline-flex items-center gap-1", dueMeta.className)}>
            <DueIcon className="h-3.5 w-3.5" />
            {due.text}
          </span>
        </div>
      </div>

      {/* Edit + delete — hidden by default, revealed on hover (R7.10, R7.11) */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={() => onEdit?.(task)}
          title="Editar"
          aria-label="Editar tarefa"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(task)}
          title="Excluir"
          aria-label="Excluir tarefa"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
