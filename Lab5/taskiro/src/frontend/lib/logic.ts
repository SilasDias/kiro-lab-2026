/**
 * Pure logic module for TasKiro.
 *
 * This module contains the deterministic UI logic ported verbatim from the
 * single-file prototype (`index.html`). It has no React and no I/O, which makes
 * it the primary target of the property-based tests.
 *
 * Behavior preservation is the guiding principle: filtering, sorting, counts,
 * due-date formatting, board placement, and validation must match the prototype
 * exactly. See design.md "Pure Logic Module (`logic.ts`)".
 *
 * NOTE: This file is built up across several tasks. Task 2.1 contributes the
 * shared types and the four filtering functions. Sorting, counts, formatting,
 * and other helpers are appended by later tasks (2.5 / 2.11 / 2.14 / 2.21).
 */

// ---------- Shared types ----------

export type Priority = 'low' | 'medium' | 'high';
export type Status = 'todo' | 'doing' | 'done';
export type View = 'all' | 'today' | 'upcoming' | 'completed';
export type SortMode = 'due' | 'priority' | 'title';

export interface Task {
  id: string;
  title: string;
  desc: string;
  /** ISO 'YYYY-MM-DD' or null when no due date is set. */
  due: string | null;
  priority: Priority;
  /** Project id, or null when the task has no associated project. */
  project: string | null;
  status: Status;
  done: boolean;
}

// ---------- Filtering ----------

/**
 * View filtering (R1.1). `today`/`upcoming` compare against the `today`
 * reference date (ISO 'YYYY-MM-DD', start of day).
 *
 * Ported verbatim from the prototype's `getFilteredTasks` view switch:
 *   today     -> due === today && !done
 *   upcoming  -> due && due > today && !done
 *   completed -> done
 *   all       -> no filter
 */
export function filterByView(tasks: Task[], view: View, today: string): Task[] {
  switch (view) {
    case 'today':
      return tasks.filter((t) => t.due === today && !t.done);
    case 'upcoming':
      return tasks.filter((t) => t.due !== null && t.due > today && !t.done);
    case 'completed':
      return tasks.filter((t) => t.done);
    case 'all':
    default:
      return tasks;
  }
}

/**
 * Active project overrides view (R3.4, R1.1). When a project is active the
 * prototype filters tasks by that project, ignoring the view. A `null`
 * projectId is a no-op (returns the input unchanged).
 *
 * Ported verbatim from the prototype:
 *   list = list.filter(t => t.project === state.activeProject)
 */
export function filterByProject(tasks: Task[], projectId: string | null): Task[] {
  if (projectId === null) return tasks;
  return tasks.filter((t) => t.project === projectId);
}

/**
 * Case-insensitive substring on title|desc; empty/whitespace query is a no-op
 * (R1.5, R4.3, R4.4).
 *
 * Ported verbatim from the prototype:
 *   if (state.search.trim()) {
 *     const q = state.search.toLowerCase();
 *     list = list.filter(t => t.title.toLowerCase().includes(q) ||
 *                             (t.desc || '').toLowerCase().includes(q));
 *   }
 */
export function filterBySearch(tasks: Task[], query: string): Task[] {
  if (!query.trim()) return tasks;
  const q = query.toLowerCase();
  return tasks.filter(
    (t) => t.title.toLowerCase().includes(q) || (t.desc || '').toLowerCase().includes(q),
  );
}

/**
 * Priority filter; `'all'` is a no-op (R1.3, R5.2).
 *
 * Ported verbatim from the prototype:
 *   if (state.priorityFilter !== 'all')
 *     list = list.filter(t => t.priority === state.priorityFilter);
 */
export function filterByPriority(tasks: Task[], p: Priority | 'all'): Task[] {
  if (p === 'all') return tasks;
  return tasks.filter((t) => t.priority === p);
}

// ---------- Sorting ----------

/**
 * Priority ordering used by both the prototype and the sort comparator:
 * high (0) sorts before medium (1) before low (2).
 *
 * Ported verbatim from the prototype:
 *   const prioRank = { high: 0, medium: 1, low: 2 };
 */
const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Comparator producing the prototype's ordering for a given sort mode.
 *
 * Ported from the prototype's `list.sort((a, b) => { ... })`:
 *   priority -> prioRank[a.priority] - prioRank[b.priority]
 *   title    -> a.title.localeCompare(b.title)        (case-insensitive here, R5.6)
 *   due      -> undated last, then a.due.localeCompare(b.due)
 *
 * The due branch returns 0 when both tasks are undated so that the
 * surrounding stable sort preserves their relative order (R5.4); the
 * prototype relied on the engine's stable `Array.prototype.sort`.
 */
function compareTasks(a: Task, b: Task, mode: SortMode): number {
  if (mode === 'priority') {
    return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  }
  if (mode === 'title') {
    // Case-insensitive ascending by title (R5.6, Property 8).
    return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  }
  // mode === 'due': ascending due date, undated (null) tasks last.
  if (!a.due && !b.due) return 0;
  if (!a.due) return 1;
  if (!b.due) return -1;
  return a.due.localeCompare(b.due);
}

/**
 * Stable sort of tasks by the given mode (R1.4, R5.4, R5.5, R5.6, R6.1).
 *
 * - `'due'`: ascending due date with undated (`null`) tasks placed last.
 * - `'priority'`: high → medium → low, preserving relative order among equal
 *   priority (stable).
 * - `'title'`: case-insensitive ascending by title.
 *
 * Stability is guaranteed by decorating each task with its original index and
 * using that index as the tiebreaker, so equal elements keep their input
 * order. The input array is not mutated (a new array is returned), which is a
 * behavior-preserving refinement of the prototype's in-place `list.sort`.
 */
export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const cmp = compareTasks(a.task, b.task, mode);
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map((entry) => entry.task);
}

/**
 * Advance the sort mode through the fixed cycle (R1.4, R5.3):
 *   due → priority → title → due
 *
 * Ported verbatim from the prototype's `sortOptions` cycle:
 *   const next = sortOptions[(i + 1) % sortOptions.length];
 */
export function nextSort(mode: SortMode): SortMode {
  switch (mode) {
    case 'due':
      return 'priority';
    case 'priority':
      return 'title';
    case 'title':
    default:
      return 'due';
  }
}

// ---------- Counts ----------

/**
 * Sidebar view counts (R3.3, R6.2). Each count equals the size of the
 * corresponding `filterByView` result so the badges always match the
 * filtered list the user would see:
 *   all       -> total task count
 *   today     -> incomplete tasks due === today
 *   upcoming  -> incomplete tasks due > today
 *   completed -> done tasks
 *
 * Ported verbatim from the prototype's `updateCounts`:
 *   all: state.tasks.length,
 *   today: state.tasks.filter(t => t.due === iso(today) && !t.done).length,
 *   upcoming: state.tasks.filter(t => t.due && t.due > iso(today) && !t.done).length,
 *   completed: state.tasks.filter(t => t.done).length
 */
export function viewCounts(tasks: Task[], today: string): Record<View, number> {
  return {
    all: filterByView(tasks, 'all', today).length,
    today: filterByView(tasks, 'today', today).length,
    upcoming: filterByView(tasks, 'upcoming', today).length,
    completed: filterByView(tasks, 'completed', today).length,
  };
}

/**
 * Number of tasks referencing a given project (R3.3, R6.2).
 *
 * Ported verbatim from the prototype's project list badge:
 *   state.tasks.filter(t => t.project === p.id).length
 */
export function projectCount(tasks: Task[], projectId: string): number {
  return tasks.filter((t) => t.project === projectId).length;
}

// ---------- Board placement ----------

/**
 * Partition tasks into the three Kanban columns (R3.4, R6.3). Every done task
 * is placed in the `done` column regardless of its `status` field; non-done
 * tasks go into the column matching their `status`. The partition is total
 * (every task lands in exactly one column) and disjoint.
 *
 * Ported verbatim from the prototype's `renderBoard` column predicate:
 *   list.filter(t => (col.key === 'done' ? t.done : (!t.done && t.status === col.key)))
 */
export function boardColumns(tasks: Task[]): Record<Status, Task[]> {
  const columns: Record<Status, Task[]> = { todo: [], doing: [], done: [] };
  for (const t of tasks) {
    if (t.done) {
      columns.done.push(t);
    } else {
      columns[t.status].push(t);
    }
  }
  return columns;
}

// ---------- Due-date formatting ----------

/**
 * Semantic tone for a due-date badge. Components map these tokens to design
 * tokens / Tailwind classes; the pure logic stays free of presentation. The
 * mapping mirrors the prototype's `cls` values in `formatDue`:
 *   none     -> text-slate-400        (no due date)
 *   overdue  -> text-rose-600 ...      (due before today)
 *   today    -> text-brand-600 ...     (due today)
 *   tomorrow -> text-slate-500         (due tomorrow)
 *   default  -> text-slate-500         (any later date)
 */
export type DueTone = 'none' | 'overdue' | 'today' | 'tomorrow' | 'default';

/**
 * Due-date badge text + tone (R7.5–R7.9, R20.6, Property 11).
 *
 * Ported verbatim from the prototype's `formatDue`, with `today` supplied as an
 * ISO 'YYYY-MM-DD' string instead of relying on a module-level `Date`:
 *   - no due date           -> "Sem prazo"            (tone 'none')
 *   - due before today      -> "Atrasada (Nd)"        (tone 'overdue'),
 *                              N = whole days today − due
 *   - due === today         -> "Hoje"                 (tone 'today')
 *   - due === today + 1 day -> "Amanhã"               (tone 'tomorrow')
 *   - otherwise             -> localized pt-BR
 *                              day-and-month            (tone 'default')
 *
 * Date math matches the prototype exactly: both dates are parsed at local
 * midnight (`new Date(iso + 'T00:00:00')`) and the day delta is
 * `Math.round((due − today) / 86400000)`, and the localized fallback uses
 * `toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })`.
 */
export function formatDue(due: string | null, today: string): { text: string; tone: DueTone } {
  if (!due) return { text: 'Sem prazo', tone: 'none' };
  const d = new Date(due + 'T00:00:00');
  const t = new Date(today + 'T00:00:00');
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff < 0) return { text: `Atrasada (${Math.abs(diff)}d)`, tone: 'overdue' };
  if (diff === 0) return { text: 'Hoje', tone: 'today' };
  if (diff === 1) return { text: 'Amanhã', tone: 'tomorrow' };
  const fmt = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return { text: fmt, tone: 'default' };
}

// ---------- Avatar initials ----------

/**
 * Derive uppercase avatar initials from a display name (R3.6, Property 14).
 *
 * Takes the first character of the first two whitespace-separated word parts
 * (e.g. "Ana Silva" -> "AS"); a single word yields its first character. The
 * result is always uppercased. Empty/whitespace-only input yields "".
 *
 * This is the canonical implementation; `utils.ts` re-exports it.
 */
export function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

// ---------- Validation ----------

/**
 * Title validation (R1.9, R8.4, Property 17): true when the trimmed title has
 * length between 1 and 200 inclusive. Empty/whitespace-only strings are
 * rejected, matching the prototype's `value.trim()` guard before save.
 */
export function isValidTitle(s: string): boolean {
  const len = s.trim().length;
  return len >= 1 && len <= 200;
}

/**
 * Project-name validation (R9.3, Property 18): true when the trimmed name has
 * length between 1 and 100 inclusive. Empty/whitespace-only names are
 * rejected, matching the prototype's `if (!name) return;` guard.
 */
export function isValidProjectName(s: string): boolean {
  const len = s.trim().length;
  return len >= 1 && len <= 100;
}

// ---------- Mutation helpers ----------

/**
 * Clear completed (R1.6, R5.8, Property 13): keep only not-done tasks,
 * preserving their relative order. The input array is not mutated.
 *
 * Ported from the prototype's "Limpar concluídas" action:
 *   state.tasks = state.tasks.filter(t => !t.done);
 */
export function removeCompleted(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done);
}

/**
 * Completion toggle (R7.12, Property 12): returns a new Task with `done`
 * flipped and `status` made consistent — 'done' when the result is done,
 * 'todo' when it is not. The input task is not mutated.
 *
 * Ported verbatim from the prototype's toggle handler:
 *   task.done = !task.done;
 *   task.status = task.done ? 'done' : 'todo';
 */
export function toggleDone(t: Task): Task {
  const done = !t.done;
  return { ...t, done, status: done ? 'done' : 'todo' };
}

// ---------- Notifications ----------

/**
 * A user notification. Ported from the prototype's notification records, with
 * the design's refinement that `time` is a round-trippable ISO-8601 timestamp
 * (R17.4) rather than the prototype's pre-rendered "há 10 min" label — the
 * relative-time label is derived at render from this timestamp (R10.3).
 */
export interface Notification {
  id: string;
  text: string;
  /** ISO-8601 timestamp (e.g. '2024-05-01T12:30:00.000Z'). */
  time: string;
  read: boolean;
}

/**
 * Bell unread indicator predicate (R4.6, R4.7, R10.6, Property 15): true iff at
 * least one notification is unread. After every notification is marked read the
 * result is false, hiding the indicator.
 *
 * Ported verbatim from the prototype's `renderNotifications`:
 *   const hasUnread = state.notifications.some(n => !n.read);
 */
export function hasUnread(notifications: Notification[]): boolean {
  return notifications.some((n) => !n.read);
}

/**
 * Order notifications most-recent-first (R10.3, Property 16): sorted by `time`
 * descending. The sort is stable (notifications sharing a timestamp keep their
 * input order) and non-mutating (a new array is returned).
 *
 * Timestamps are compared by their parsed epoch milliseconds so any valid
 * ISO-8601 representation orders correctly; the original index is the
 * tiebreaker to guarantee stability.
 */
export function sortNotifications(notifications: Notification[]): Notification[] {
  return notifications
    .map((notification, index) => ({ notification, index }))
    .sort((a, b) => {
      const ta = new Date(a.notification.time).getTime();
      const tb = new Date(b.notification.time).getTime();
      if (tb !== ta) return tb - ta; // descending: most recent first
      return a.index - b.index; // stable tiebreak
    })
    .map((entry) => entry.notification);
}

// ---------- Single active selection ----------

/**
 * Generic single-selection predicate (Property 19). A candidate is active iff
 * it strictly equals the current selection. Used for the project dialog's color
 * swatches, where the active swatch is the one whose color equals the selected
 * color.
 *
 * Ported from the prototype's color picker:
 *   col === state.selectedColor
 */
export function isActive<T>(currentSelection: T, candidate: T): boolean {
  return currentSelection === candidate;
}

/**
 * Decorate each item with an `active` flag computed from a predicate, without
 * mutating the input (Property 19). When `predicate` matches exactly one item
 * (e.g. `isActive(selectedColor, color)` over a swatch list that contains the
 * selected color), exactly one entry is marked active.
 */
export function markSingleActive<T>(
  items: T[],
  predicate: (item: T) => boolean,
): Array<{ item: T; active: boolean }> {
  return items.map((item) => ({ item, active: predicate(item) }));
}

/**
 * A navigation target in the sidebar: either a Menu view or a Project entry.
 */
export type NavItem = { kind: 'view'; view: View } | { kind: 'project'; project: string };

/**
 * The current navigation selection. An active project overrides the view
 * (matching `filterByProject` / the prototype), so when `activeProject` is set
 * the highlighted item is that project; otherwise it is the current view.
 */
export interface NavSelection {
  view: View;
  activeProject: string | null;
}

/**
 * Single active navigation item predicate across Views and Projects (R3.7,
 * R9.1, R9.2, Property 19). Exactly one item carries the active style:
 *
 * - When a project is active, only the matching project item is active and no
 *   view item is.
 * - When no project is active, only the matching view item is active and no
 *   project item is.
 *
 * Ported verbatim from the prototype's `setActiveNav`:
 *   nav-item active  -> !state.activeProject && b.dataset.view === state.view
 *   project-item act -> state.activeProject === b.dataset.project
 */
export function isNavItemActive(selection: NavSelection, item: NavItem): boolean {
  if (selection.activeProject !== null) {
    return item.kind === 'project' && item.project === selection.activeProject;
  }
  return item.kind === 'view' && item.view === selection.view;
}
