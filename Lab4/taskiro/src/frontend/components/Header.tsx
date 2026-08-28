/**
 * Header — sticky top bar (`h-16`) reproducing the prototype's header
 * (`index.html`).
 *
 * Layout & fidelity (Requirements 2.3, 2.4): a `sticky top-0 h-16` bar with a
 * translucent backdrop and bottom border that stays fixed while the main
 * content scrolls. Geometry, spacing, iconography, and pt-BR copy mirror the
 * prototype; all colors come from the OKLCH theme variables (brand/slate
 * utilities), never literals (Requirements 14.3, 14.7).
 *
 * Controls:
 *  - View title + subtitle, updating with the active View/Project (R4.1, R4.2).
 *  - Search input filtering tasks by case-insensitive substring on
 *    title/description (R4.3, R4.4) — the filtering itself lives in `logic.ts`
 *    via `DataContext`; here we only bind the query.
 *  - Layout toggle (list/board) indicating the active layout (R4.5).
 *  - Notifications bell showing the unread indicator while any notification is
 *    unread, hidden once all are read (R4.6, R4.7); clicking toggles the
 *    notifications panel open state.
 *  - "Nova tarefa" button opening the task creation dialog (R4.8).
 *  - A sidebar toggle shown below 1024px (`lg:hidden`) (R4.9).
 *
 * Per task scope, the TaskDialog and NotificationsPanel are implemented
 * separately; this component only triggers their shared open state on
 * `DataContext`.
 */

import { Bell, Columns3, List, Menu, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { hasUnread, type View } from "@/lib/logic";
import { useData } from "@/state/DataContext";

/** View → header title (ported verbatim from the prototype's `setViewTitle`). */
const VIEW_TITLES: Record<View, string> = {
  all: "Todas as tarefas",
  today: "Hoje",
  upcoming: "Próximas",
  completed: "Concluídas",
};

/** View → header subtitle (ported verbatim from the prototype's `setViewTitle`). */
const VIEW_SUBTITLES: Record<View, string> = {
  all: "Gerencie tudo em um só lugar",
  today: "Foque no que importa hoje",
  upcoming: "Planeje seus próximos dias",
  completed: "Tudo que você já finalizou",
};

export function Header() {
  const {
    view,
    activeProject,
    projects,
    layout,
    search,
    notifications,
    setSearch,
    setLayout,
    openCreateTask,
    notificationsOpen,
    setNotificationsOpen,
    setSidebarOpen,
  } = useData();

  // Title/subtitle: an active project overrides the view (R4.1, R4.2),
  // matching the prototype's `setViewTitle`.
  let title: string;
  let subtitle: string;
  if (activeProject !== null) {
    const project = projects.find((p) => p.id === activeProject);
    title = project ? project.name : "Projeto";
    subtitle = "Tarefas do projeto";
  } else {
    title = VIEW_TITLES[view];
    subtitle = VIEW_SUBTITLES[view];
  }

  const showUnread = hasUnread(notifications);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-card/90 px-4 backdrop-blur sm:px-6">
      {/* Mobile sidebar toggle (< 1024px) — R4.9, R2.5–2.7 */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
        className="-ml-1 rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* View title + subtitle (R4.1, R4.2) */}
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold leading-tight text-slate-900">
          {title}
        </h1>
        <p className="hidden truncate text-xs text-slate-400 sm:block">
          {subtitle}
        </p>
      </div>

      {/* Search (R4.3, R4.4) */}
      <div className="relative ml-auto hidden md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tarefas..."
          aria-label="Buscar tarefas"
          className="h-9 w-56 rounded-lg border-transparent bg-slate-100 pl-9 pr-3 text-sm focus-visible:bg-card lg:w-72"
        />
      </div>

      {/* Layout toggle list/board (R4.5) */}
      <div className="ml-auto hidden items-center rounded-lg bg-slate-100 p-0.5 sm:flex md:ml-0">
        <button
          type="button"
          onClick={() => setLayout("list")}
          title="Lista"
          aria-label="Visualização em lista"
          aria-pressed={layout === "list"}
          className={cn(
            "rounded-md p-1.5 transition",
            layout === "list"
              ? "bg-card text-brand-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <List className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setLayout("board")}
          title="Quadro"
          aria-label="Visualização em quadro"
          aria-pressed={layout === "board"}
          className={cn(
            "rounded-md p-1.5 transition",
            layout === "board"
              ? "bg-card text-brand-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Columns3 className="h-4 w-4" />
        </button>
      </div>

      {/* Notifications bell with unread indicator (R4.6, R4.7) */}
      <button
        type="button"
        onClick={() => setNotificationsOpen(!notificationsOpen)}
        aria-label="Notificações"
        aria-expanded={notificationsOpen}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {showUnread && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-priority-high"
          />
        )}
      </button>

      {/* Nova tarefa (R4.8) */}
      <Button
        onClick={openCreateTask}
        className="rounded-lg bg-brand-600 px-3 font-semibold text-white shadow-sm hover:bg-brand-700 sm:px-4"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Nova tarefa</span>
      </Button>
    </header>
  );
}
