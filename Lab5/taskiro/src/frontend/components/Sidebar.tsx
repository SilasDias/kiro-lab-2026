/**
 * Sidebar — the fixed left navigation panel (Requirements 2.3, 2.5–2.7, 3.x).
 *
 * Visual fidelity to the prototype (`index.html` `<aside id="sidebar">`):
 *   - fixed, `w-64` (16rem) white panel with a slate border (R2.3, R3.1)
 *   - header: the TasKiro logo (kiro.dev absolute URL), product name, and the
 *     "Gerenciador de tarefas" subtitle (R3.1)
 *   - Menu section: the four Views with live counts (R3.2, R3.3)
 *   - Projetos section: each project's color dot, name, and task count, plus a
 *     "Novo projeto" button (R3.4, R3.5)
 *   - user footer: avatar initials, display name, email, chevron (R3.6)
 *
 * Active-state styling is applied to exactly the selected View or Project via
 * the pure `isNavItemActive` helper (R3.7); selecting any item clears the
 * others. Selecting a View or Project closes the mobile sidebar (R3.8).
 *
 * Mobile off-canvas behavior (< 1024px, R2.5–2.7): the same content is rendered
 * inside a shadcn `Sheet` sliding in from the left with a slate-900/40 dim;
 * clicking the dim overlay (or pressing Escape) closes it. On `lg` and up the
 * Sheet is hidden and the fixed `aside` is shown.
 *
 * Theme is applied exclusively through OKLCH CSS-variable utilities (R14.7);
 * the only literal color is each project's stored `color`, applied as an inline
 * style on its dot (the documented data-color exception).
 */

import {
  CalendarClock,
  CheckCheck,
  ChevronUp,
  LayoutList,
  Plus,
  Sun,
  type LucideIcon,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import { isNavItemActive, type View } from "@/lib/logic";
import { useAuth } from "@/state/AuthContext";
import { useData } from "@/state/DataContext";

/** The TasKiro logo, sourced from the absolute kiro.dev URL (R3.1, R20.3). */
const LOGO_URL =
  "https://kiro.dev/images/community/events/thumbnails/meetup2.svg";

/** The four Menu Views with their pt-BR labels and prototype icons (R3.2). */
const VIEWS: ReadonlyArray<{ view: View; label: string; icon: LucideIcon }> = [
  { view: "all", label: "Todas as tarefas", icon: LayoutList },
  { view: "today", label: "Hoje", icon: Sun },
  { view: "upcoming", label: "Próximas", icon: CalendarClock },
  { view: "completed", label: "Concluídas", icon: CheckCheck },
];

export interface SidebarProps {
  /** Whether the mobile (off-canvas) sidebar is open (< 1024px). */
  mobileOpen?: boolean;
  /** Called to open/close the mobile sidebar (overlay click, Escape, select). */
  onMobileOpenChange?: (open: boolean) => void;
  /** Open the "Novo projeto" dialog (wired by the app shell, task 11.7/12.1). */
  onNewProject?: () => void;
  /** Open the user menu from the footer (wired by the app shell, task 11.10). */
  onOpenUserMenu?: () => void;
}

/**
 * The shared sidebar body, rendered both in the fixed desktop `aside` and
 * inside the mobile `Sheet`. `onNavigate` is invoked after a View/Project
 * selection so the mobile sheet can close itself (R3.8).
 */
function SidebarContent({
  onNavigate,
  onNewProject,
  onOpenUserMenu,
}: {
  onNavigate?: () => void;
  onNewProject?: () => void;
  onOpenUserMenu?: () => void;
}) {
  const { user } = useAuth();
  const {
    view,
    activeProject,
    counts,
    projects,
    projectCounts,
    setView,
    setActiveProject,
  } = useData();

  const selection = { view, activeProject };

  const handleSelectView = (next: View) => {
    setActiveProject(null);
    setView(next);
    onNavigate?.();
  };

  const handleSelectProject = (projectId: string) => {
    setActiveProject(projectId);
    onNavigate?.();
  };

  const displayName = user?.displayName ?? "";
  const email = user?.email ?? "";

  return (
    <div className="flex h-full flex-col">
      {/* Logo / branding (R3.1) */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-5">
        <img
          src={LOGO_URL}
          alt="Logo TasKiro"
          className="h-9 w-9 rounded-lg object-contain"
        />
        <div className="leading-tight">
          <p className="text-lg font-extrabold tracking-tight text-slate-900">
            TasKiro
          </p>
          <p className="text-[11px] font-medium text-slate-400">
            Gerenciador de tarefas
          </p>
        </div>
      </div>

      {/* Navigation (R3.2–R3.5) */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Menu section */}
        <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </p>
        {VIEWS.map(({ view: v, label, icon: Icon }) => {
          const active = isNavItemActive(selection, { kind: "view", view: v });
          return (
            <button
              key={v}
              type="button"
              data-view={v}
              aria-current={active ? "page" : undefined}
              onClick={() => handleSelectView(v)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-brand-50 text-brand-700"
                  : "text-slate-600 hover:bg-slate-100",
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              <span>{label}</span>
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {counts[v]}
              </span>
            </button>
          );
        })}

        {/* Projetos section (R3.4) */}
        <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Projetos
        </p>
        <div className="space-y-1">
          {projects.map((project) => {
            const active = isNavItemActive(selection, {
              kind: "project",
              project: project.id,
            });
            return (
              <button
                key={project.id}
                type="button"
                data-project={project.id}
                aria-current={active ? "page" : undefined}
                onClick={() => handleSelectProject(project.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: project.color }}
                />
                <span className="flex-1 truncate text-left">
                  {project.name}
                </span>
                <span className="text-xs text-slate-400">
                  {projectCounts[project.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Novo projeto (R3.5) */}
        <button
          type="button"
          onClick={() => onNewProject?.()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
        >
          <Plus className="h-[18px] w-[18px]" />
          <span>Novo projeto</span>
        </button>
      </nav>

      {/* User footer (R3.6) */}
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <button
          type="button"
          onClick={() => onOpenUserMenu?.()}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-100"
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-brand-600 text-sm font-semibold text-white">
              {initials(displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="flex-1 text-left leading-tight">
            <span className="block text-sm font-semibold text-slate-800">
              {displayName}
            </span>
            <span className="block text-xs text-slate-400">{email}</span>
          </span>
          <ChevronUp className="h-4 w-4 text-slate-400" />
        </button>
      </div>
    </div>
  );
}

/**
 * The Sidebar: a fixed `w-64` panel on `lg` and up, and an off-canvas `Sheet`
 * overlay below `lg` (R2.3, R2.5–2.7, R3.x).
 */
export function Sidebar({
  mobileOpen = false,
  onMobileOpenChange,
  onNewProject,
  onOpenUserMenu,
}: SidebarProps) {
  return (
    <>
      {/* Desktop: fixed left panel (R2.3, R3.1). Off-canvas below lg. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <SidebarContent
          onNewProject={onNewProject}
          onOpenUserMenu={onOpenUserMenu}
        />
      </aside>

      {/* Mobile: off-canvas Sheet with a slate-900/40 dim (R2.5–2.7). */}
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="left"
          showClose={false}
          overlayClassName="bg-slate-900/40 lg:hidden"
          className="w-64 gap-0 border-sidebar-border bg-sidebar p-0 lg:hidden"
        >
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SheetDescription className="sr-only">
            Navegue entre as visões e os projetos do TasKiro.
          </SheetDescription>
          <SidebarContent
            onNavigate={() => onMobileOpenChange?.(false)}
            onNewProject={onNewProject}
            onOpenUserMenu={onOpenUserMenu}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
