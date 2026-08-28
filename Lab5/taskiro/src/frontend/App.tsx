/**
 * App.tsx — the TasKiro application shell composition (Requirements 2.3, 2.4,
 * 12.4).
 *
 * Provider tree: everything is wrapped in `AuthProvider` and `DataProvider`
 * (the data context depends on the auth context). The `Toaster` is mounted once
 * at the root so toasts work on both the login gate and the authenticated
 * shell.
 *
 * Login gate (Requirements 18.x): `AuthGate` reads the auth `status`. While a
 * persisted session is being restored it shows a loading screen; when signed
 * out it shows the `LoginScreen` (which calls `AuthContext.login`); when signed
 * in it renders the `AppShell`.
 *
 * Shell layout, matching the prototype exactly:
 *  - a fixed left `Sidebar` (`w-64` / 16rem; off-canvas `Sheet` below `lg`),
 *  - a `lg:ml-64` main column containing a sticky `Header` (`h-16` / 4rem),
 *    the `FilterBar`, and the main task area,
 *  - the task area renders `TaskList` for the `list` layout, `BoardView` for
 *    the `board` layout, and `EmptyState` when the filtered set is empty (R6.4).
 *
 * Overlays / singletons mounted once by the shell: `TaskDialog`,
 * `ProjectDialog`, `NotificationsPanel`, `UserMenu`, and a single
 * `ConfirmDialog` driven by `useConfirmDialog`. The confirm hook is wired into
 * `TaskCard`'s `onDelete` (task deletion, R1.10/R11) and `FilterBar`'s
 * `onRequestClearCompleted` ("Limpar concluídas", R1.6/R5.7/R11), per those
 * components' existing callback APIs. The `ProjectDialog` open handler is
 * threaded into `Sidebar`'s `onNewProject`.
 *
 * All colors come from the OKLCH theme utilities; icons are `lucide-react`.
 */
import { useState, type FormEvent } from 'react';
import { Loader2, LockKeyhole, LogIn, Mail } from 'lucide-react';

import { AuthProvider, useAuth } from '@/state/AuthContext';
import { DataProvider, useData } from '@/state/DataContext';

import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { TaskList } from '@/components/TaskList';
import { BoardView } from '@/components/BoardView';
import { EmptyState } from '@/components/EmptyState';
import { TaskDialog } from '@/components/TaskDialog';
import { ProjectDialog } from '@/components/ProjectDialog';
import { NotificationsPanel } from '@/components/NotificationsPanel';
import { UserMenu } from '@/components/UserMenu';
import { ConfirmDialog, useConfirmDialog } from '@/components/ConfirmDialog';
import { Toaster, toast } from '@/components/Toaster';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Task } from '@/lib/logic';

/** The TasKiro logo, sourced from the absolute kiro.dev URL (R3.1, R20.3). */
const LOGO_URL = 'https://kiro.dev/images/community/events/thumbnails/meetup2.svg';

/**
 * Loading screen shown while a persisted session is being re-validated against
 * `GET /api/me` (auth status `"loading"`).
 */
function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-foreground">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        <p className="text-sm">Carregando…</p>
      </div>
    </div>
  );
}

/**
 * Login gate (R18.x). Collects credentials and calls `AuthContext.login`, which
 * stores the token and switches the gate to the authenticated shell. On failure
 * the typed API error message is surfaced inline and via a toast.
 */
function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('ana@taskiro.app');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // On success the auth status flips to "authenticated" and the gate
      // swaps in the shell — nothing more to do here.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Não foi possível entrar.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-card p-8 shadow-sm">
        {/* Branding (R3.1) */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={LOGO_URL} alt="Logo TasKiro" className="h-12 w-12 rounded-xl object-contain" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-900">TasKiro</h1>
            <p className="text-xs font-medium text-slate-400">Gerenciador de tarefas</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700">
              E-mail
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700">
              Senha
            </label>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-9"
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-brand-600 font-semibold text-white hover:bg-brand-700"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}

/**
 * The authenticated application shell: the fixed sidebar, the `lg:ml-64` main
 * column (sticky header + filter bar + task area), and all mounted overlays.
 */
function AppShell() {
  const {
    layout,
    visibleTasks,
    sidebarOpen,
    setSidebarOpen,
    openCreateTask,
    openEditTask,
    deleteTask,
    clearCompleted,
  } = useData();

  // The "Novo projeto" dialog open state lives here and is threaded into the
  // Sidebar's `onNewProject` callback.
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);

  // A single shared confirmation dialog wired into the two guarded actions.
  const { confirm, dialogProps } = useConfirmDialog();

  /** Guard task deletion behind the confirm dialog (R1.10, R11). */
  const handleDeleteTask = (task: Task) => {
    confirm({
      title: 'Excluir tarefa?',
      description: `A tarefa "${task.title}" será removida permanentemente.`,
      confirmLabel: 'Excluir',
      destructive: true,
      onConfirm: async () => {
        try {
          await deleteTask(task.id);
          // Task deletion uses the error (rose) toast variant (R11.4).
          toast.error('Tarefa excluída');
        } catch {
          toast.error('Não foi possível excluir a tarefa');
        }
      },
    });
  };

  /** Guard "Limpar concluídas" behind the confirm dialog (R1.6, R5.7, R11). */
  const handleRequestClearCompleted = (completedCount: number) => {
    const plural = completedCount > 1;
    confirm({
      title: 'Limpar concluídas?',
      description: `Remover ${completedCount} tarefa${plural ? 's' : ''} concluída${
        plural ? 's' : ''
      }?`,
      confirmLabel: 'Limpar',
      destructive: true,
      onConfirm: async () => {
        try {
          await clearCompleted();
          // Completed-clear success uses the success (emerald) variant (R11.4).
          toast.success('Tarefas concluídas removidas.');
        } catch {
          toast.error('Não foi possível limpar as tarefas.');
        }
      },
    });
  };

  const isEmpty = visibleTasks.length === 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Fixed left sidebar (w-64); off-canvas Sheet below lg (R2.3, R2.5–2.7). */}
      <Sidebar
        mobileOpen={sidebarOpen}
        onMobileOpenChange={setSidebarOpen}
        onNewProject={() => setProjectDialogOpen(true)}
      />

      {/* Main column offset by the sidebar width on lg and up (R2.3). */}
      <div className="flex min-h-screen flex-col lg:ml-64">
        {/* Sticky header (h-16) stays fixed while content scrolls (R2.4, R12.4). */}
        <Header />
        <FilterBar onRequestClearCompleted={handleRequestClearCompleted} />

        {/* Main task area: list / board / empty state. */}
        <main className="flex-1 px-4 py-5 sm:px-6">
          {isEmpty ? (
            <EmptyState onNewTask={openCreateTask} />
          ) : layout === 'list' ? (
            <TaskList onEdit={openEditTask} onDelete={handleDeleteTask} />
          ) : (
            <BoardView onEdit={openEditTask} onDelete={handleDeleteTask} />
          )}
        </main>
      </div>

      {/* Account menu (R1.13, R3.6, R18.7): a self-triggering DropdownMenu with
          "Meu perfil" / "Configurações" / "Sair". Pinned over the desktop
          sidebar's footer region so it is the single functional account control
          (the Sidebar renders the same footer beneath it). */}
      <div className="fixed bottom-0 left-0 z-40 hidden w-64 border-t border-sidebar-border bg-sidebar p-3 lg:block">
        <UserMenu />
      </div>

      {/* Overlays / singletons mounted once for the whole shell. */}
      <TaskDialog />
      <ProjectDialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen} />
      <NotificationsPanel />
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

/**
 * Auth gate: route between the loading screen, the login screen, and the
 * authenticated shell based on the auth status.
 */
function AuthGate() {
  const { status, isAuthenticated } = useAuth();

  if (status === 'loading') return <LoadingScreen />;
  if (!isAuthenticated) return <LoginScreen />;
  return <AppShell />;
}

/**
 * Application root: wrap the gate in the auth and data providers and mount the
 * Toaster once so toasts work everywhere (Requirement 11.4–11.6).
 */
export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <AuthGate />
        <Toaster />
      </DataProvider>
    </AuthProvider>
  );
}
