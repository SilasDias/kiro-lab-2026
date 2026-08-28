/**
 * DataContext — application data (tasks, projects, notifications) and UI state
 * (view, activeProject, layout, priorityFilter, search, sort), plus the
 * mutation actions that persist through the API.
 *
 * Design "State Management": this context composes the pure `logic.ts`
 * functions to derive the visible task list, sidebar counts, and board columns;
 * it never re-implements that logic. Mutations persist via the API client.
 *
 * Optimistic completion toggle (Requirements 7.12–7.14): `toggleComplete`
 * applies `toggleDone` locally immediately, calls `api.updateTask`, and reverts
 * to the pre-toggle task on failure. Success/error toasts are the concern of
 * the presentation layer (tasks 11.x); actions resolve on success and throw the
 * typed API error on failure so components can surface the right toast.
 *
 * Any protected call that throws `UnauthorizedError` (401) triggers
 * `handleUnauthorized()` on the auth context, clearing local auth state
 * (R18.7).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  api,
  UnauthorizedError,
  type CreateProjectInput,
  type CreateTaskInput,
  type Notification,
  type Project,
  type UpdateTaskInput,
} from '../lib/api';
import {
  boardColumns,
  filterByPriority,
  filterByProject,
  filterBySearch,
  filterByView,
  nextSort,
  projectCount as countProjectTasks,
  sortNotifications,
  sortTasks,
  toggleDone,
  viewCounts,
  type Priority,
  type SortMode,
  type Status,
  type Task,
  type View,
} from '../lib/logic';
import { useAuth } from './AuthContext';

/** The display mode of the task area. */
export type Layout = 'list' | 'board';

/** The priority filter selection (`'all'` is the no-op default). */
export type PriorityFilter = Priority | 'all';

export interface DataContextValue {
  // --- Raw data ---
  tasks: Task[];
  projects: Project[];
  notifications: Notification[];

  // --- UI state ---
  view: View;
  activeProject: string | null;
  layout: Layout;
  priorityFilter: PriorityFilter;
  search: string;
  sort: SortMode;

  // --- Loading / error status ---
  loading: boolean;
  error: string | null;

  // --- Derived (composed from logic.ts) ---
  /** The sorted, filtered task list the user should see for the active state. */
  visibleTasks: Task[];
  /** Board partition (todo/doing/done) of the visible tasks (R6.2, R6.3). */
  board: Record<Status, Task[]>;
  /** Sidebar view counts over all tasks (R3.3). */
  counts: Record<View, number>;
  /** Tasks-per-project counts keyed by project id (R3.4). */
  projectCounts: Record<string, number>;
  /** Notifications ordered most-recent-first (R10.3). */
  orderedNotifications: Notification[];

  // --- Overlay / shell UI state (shared by Header, Sidebar, dialogs, panels) ---
  /** Whether the task create/edit dialog is open (R4.8, R8.1, R8.2). */
  taskDialogOpen: boolean;
  /** The task being edited, or null when the dialog is in create mode. */
  taskBeingEdited: Task | null;
  /** Whether the notifications panel is open (R4.6, R10.1, R10.2). */
  notificationsOpen: boolean;
  /** Whether the mobile off-canvas sidebar is open (R2.5–2.7, R4.9). */
  sidebarOpen: boolean;

  // --- UI state setters ---
  setView: (view: View) => void;
  setActiveProject: (projectId: string | null) => void;
  setLayout: (layout: Layout) => void;
  setPriorityFilter: (priority: PriorityFilter) => void;
  setSearch: (search: string) => void;
  /** Advance the sort mode through the fixed cycle due→priority→title→due. */
  cycleSort: () => void;
  /** Open the task dialog in create mode (R4.8, R8.1). */
  openCreateTask: () => void;
  /** Open the task dialog in edit mode for the given task (R8.2). */
  openEditTask: (task: Task) => void;
  /** Set the task dialog open flag (e.g. dialog `onOpenChange`). */
  setTaskDialogOpen: (open: boolean) => void;
  /** Set the notifications panel open flag (R10.1, R10.2). */
  setNotificationsOpen: (open: boolean) => void;
  /** Set the mobile sidebar open flag (R2.5–2.7, R4.9). */
  setSidebarOpen: (open: boolean) => void;

  // --- Data actions (persist via the API) ---
  /** Reload tasks, projects, and notifications from the API. */
  reload: () => Promise<void>;
  createTask: (input: CreateTaskInput) => Promise<Task>;
  updateTask: (id: string, patch: UpdateTaskInput) => Promise<Task>;
  deleteTask: (id: string) => Promise<void>;
  /** Optimistic completion toggle that reverts on API failure (R7.12–7.14). */
  toggleComplete: (id: string) => Promise<Task>;
  /** Remove all completed tasks (deletes each done task via the API). */
  clearCompleted: () => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  markAllNotificationsRead: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Today's date as a local ISO `YYYY-MM-DD` string (matches the prototype). */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const { user, handleUnauthorized } = useAuth();

  // Raw data
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // UI state
  const [view, setView] = useState<View>('all');
  const [activeProject, setActiveProjectState] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>('list');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState<string>('');
  const [sort, setSort] = useState<SortMode>('due');

  // Overlay / shell UI state
  const [taskDialogOpen, setTaskDialogOpen] = useState<boolean>(false);
  const [taskBeingEdited, setTaskBeingEdited] = useState<Task | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  // Status
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Run a protected API call, routing 401s to the auth context (local logout)
   * and re-throwing so the caller can react (revert optimistic state, toast).
   */
  const guard = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          handleUnauthorized();
        }
        throw err;
      }
    },
    [handleUnauthorized],
  );

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [t, p, n] = await guard(() =>
        Promise.all([api.listTasks(), api.listProjects(), api.listNotifications()]),
      );
      setTasks(t);
      setProjects(p);
      setNotifications(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar dados');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [guard]);

  // Load data when authenticated; clear it when signed out.
  useEffect(() => {
    if (user === null) {
      setTasks([]);
      setProjects([]);
      setNotifications([]);
      setActiveProjectState(null);
      setView('all');
      setError(null);
      setTaskDialogOpen(false);
      setTaskBeingEdited(null);
      setNotificationsOpen(false);
      setSidebarOpen(false);
      return;
    }
    void reload().catch(() => {
      // Error is captured in `error` state; swallow here to avoid an unhandled
      // rejection from the effect.
    });
  }, [user, reload]);

  // --- UI state setters ---

  const setActiveProject = useCallback((projectId: string | null) => {
    setActiveProjectState(projectId);
  }, []);

  const cycleSort = useCallback(() => {
    setSort((current) => nextSort(current));
  }, []);

  // --- Overlay open helpers ---

  const openCreateTask = useCallback(() => {
    setTaskBeingEdited(null);
    setTaskDialogOpen(true);
  }, []);

  const openEditTask = useCallback((task: Task) => {
    setTaskBeingEdited(task);
    setTaskDialogOpen(true);
  }, []);

  // --- Data actions ---

  const createTask = useCallback(
    async (input: CreateTaskInput): Promise<Task> => {
      const created = await guard(() => api.createTask(input));
      setTasks((prev) => [...prev, created]);
      return created;
    },
    [guard],
  );

  const updateTask = useCallback(
    async (id: string, patch: UpdateTaskInput): Promise<Task> => {
      const updated = await guard(() => api.updateTask(id, patch));
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    [guard],
  );

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      await guard(() => api.deleteTask(id));
      setTasks((prev) => prev.filter((t) => t.id !== id));
    },
    [guard],
  );

  /**
   * Optimistic completion toggle (R7.12–7.14): flip done/status locally first
   * via `toggleDone`, then persist. On failure, restore the exact pre-toggle
   * task and re-throw so the UI shows an error toast.
   */
  const toggleComplete = useCallback(
    async (id: string): Promise<Task> => {
      const previous = tasks.find((t) => t.id === id);
      if (!previous) {
        throw new Error(`Tarefa não encontrada: ${id}`);
      }
      const optimistic = toggleDone(previous);
      // Apply locally immediately (R7.12).
      setTasks((prev) => prev.map((t) => (t.id === id ? optimistic : t)));
      try {
        const saved = await api.updateTask(id, {
          done: optimistic.done,
          status: optimistic.status,
        });
        // Reconcile with the server's authoritative copy.
        setTasks((prev) => prev.map((t) => (t.id === id ? saved : t)));
        return saved;
      } catch (err) {
        // Revert to the pre-toggle state (R7.14).
        setTasks((prev) => prev.map((t) => (t.id === id ? previous : t)));
        if (err instanceof UnauthorizedError) {
          handleUnauthorized();
        }
        throw err;
      }
    },
    [tasks, handleUnauthorized],
  );

  const clearCompleted = useCallback(async (): Promise<void> => {
    const completed = tasks.filter((t) => t.done);
    if (completed.length === 0) return;
    await guard(() => Promise.all(completed.map((t) => api.deleteTask(t.id))));
    const removedIds = new Set(completed.map((t) => t.id));
    setTasks((prev) => prev.filter((t) => !removedIds.has(t.id)));
  }, [tasks, guard]);

  const createProject = useCallback(
    async (input: CreateProjectInput): Promise<Project> => {
      const created = await guard(() => api.createProject(input));
      setProjects((prev) => [...prev, created]);
      return created;
    },
    [guard],
  );

  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    // Snapshot for revert on failure (R10.7).
    const previous = notifications;
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      setNotifications(previous);
      if (err instanceof UnauthorizedError) {
        handleUnauthorized();
      }
      throw err;
    }
  }, [notifications, handleUnauthorized]);

  // --- Derived state (composed from logic.ts) ---

  const today = todayIso();

  const visibleTasks = useMemo<Task[]>(() => {
    // An active project overrides the view (prototype behavior, R3.4).
    const base =
      activeProject !== null
        ? filterByProject(tasks, activeProject)
        : filterByView(tasks, view, today);
    const searched = filterBySearch(base, search);
    const filtered = filterByPriority(searched, priorityFilter);
    return sortTasks(filtered, sort);
  }, [tasks, activeProject, view, today, search, priorityFilter, sort]);

  const board = useMemo<Record<Status, Task[]>>(() => boardColumns(visibleTasks), [visibleTasks]);

  const counts = useMemo<Record<View, number>>(() => viewCounts(tasks, today), [tasks, today]);

  const projectCounts = useMemo<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    for (const p of projects) {
      result[p.id] = countProjectTasks(tasks, p.id);
    }
    return result;
  }, [projects, tasks]);

  const orderedNotifications = useMemo<Notification[]>(
    () => sortNotifications(notifications),
    [notifications],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      tasks,
      projects,
      notifications,
      view,
      activeProject,
      layout,
      priorityFilter,
      search,
      sort,
      loading,
      error,
      visibleTasks,
      board,
      counts,
      projectCounts,
      orderedNotifications,
      taskDialogOpen,
      taskBeingEdited,
      notificationsOpen,
      sidebarOpen,
      setView,
      setActiveProject,
      setLayout,
      setPriorityFilter,
      setSearch,
      cycleSort,
      openCreateTask,
      openEditTask,
      setTaskDialogOpen,
      setNotificationsOpen,
      setSidebarOpen,
      reload,
      createTask,
      updateTask,
      deleteTask,
      toggleComplete,
      clearCompleted,
      createProject,
      markAllNotificationsRead,
    }),
    [
      tasks,
      projects,
      notifications,
      view,
      activeProject,
      layout,
      priorityFilter,
      search,
      sort,
      loading,
      error,
      visibleTasks,
      board,
      counts,
      projectCounts,
      orderedNotifications,
      taskDialogOpen,
      taskBeingEdited,
      notificationsOpen,
      sidebarOpen,
      setActiveProject,
      cycleSort,
      openCreateTask,
      openEditTask,
      reload,
      createTask,
      updateTask,
      deleteTask,
      toggleComplete,
      clearCompleted,
      createProject,
      markAllNotificationsRead,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Access the data context. Throws if used outside a `DataProvider`. */
export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (ctx === null) {
    throw new Error('useData must be used within a DataProvider');
  }
  return ctx;
}
