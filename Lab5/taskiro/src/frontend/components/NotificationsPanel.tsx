/**
 * NotificationsPanel — the notifications popover (Requirement 10).
 *
 * Reproduces the prototype's `#notifPanel` (a fixed `top-16 right-4 w-80`
 * card) using the shadcn/ui Popover (`components/ui/popover.tsx`, R12.2). The
 * panel is *controlled* by `DataContext.notificationsOpen`, which the Header's
 * bell button toggles — this component owns no trigger of its own, so the
 * existing bell in `Header.tsx` remains the single toggle. A `PopoverAnchor`
 * pinned at the top-right corner positions the content where the prototype
 * placed the panel.
 *
 * Behavior:
 *  - Toggle open/close is driven by `notificationsOpen` / `setNotificationsOpen`
 *    (R10.1, R10.2). Radix dismissal (click-outside, Escape) routes through
 *    `onOpenChange` so the panel closes correctly (R12.5, R12.6).
 *  - Opening the panel closes other context-managed overlays — the task dialog
 *    and the mobile sidebar — within the same tick (R10.1). This runs from an
 *    effect on `notificationsOpen` so it fires no matter how the panel was
 *    opened (bell click or otherwise). Sibling Radix overlays (the user menu)
 *    self-dismiss on outside interaction.
 *  - Notifications render most-recent-first via `DataContext.orderedNotifications`
 *    (computed with `sortNotifications` from `logic.ts`), each with its text, a
 *    relative-time label derived from its ISO timestamp, and a read/unread dot
 *    plus a tinted row background for unread items (R10.3).
 *  - When the user has no notifications, an empty-state message is shown (R10.4).
 *  - "Marcar todas como lidas" calls `DataContext.markAllNotificationsRead`,
 *    which persists via the API and optimistically flips every notification to
 *    read; the bell's unread indicator (driven by `hasUnread`) clears as a
 *    result (R10.5, R10.6). On failure the context reverts to the prior
 *    read/unread state and this component surfaces an error toast (R10.7).
 *
 * All colors come from the OKLCH-backed theme utilities (brand/slate), never
 * raw literals (Requirements 14.3, 14.7).
 */

import { useEffect } from "react";
import { BellOff } from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { hasUnread } from "@/lib/logic";
import { useData } from "@/state/DataContext";

/**
 * Format the elapsed time since an ISO-8601 timestamp as a pt-BR relative
 * label (R10.3), mirroring the prototype's phrasing ("há 10 min", "há 1 h").
 * The label is derived at render from the stored timestamp rather than being
 * pre-rendered, matching the design's refinement of the notification model.
 */
function relativeTime(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `há ${weeks} sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} ${months > 1 ? "meses" : "mês"}`;
  const years = Math.floor(days / 365);
  return `há ${years} ${years > 1 ? "anos" : "ano"}`;
}

export interface NotificationsPanelProps {
  className?: string;
}

export function NotificationsPanel({ className }: NotificationsPanelProps) {
  const {
    notifications,
    orderedNotifications,
    notificationsOpen,
    setNotificationsOpen,
    setTaskDialogOpen,
    setSidebarOpen,
    markAllNotificationsRead,
  } = useData();

  // R10.1: opening the panel closes other context-managed overlays. Running
  // this from an effect keeps it correct regardless of how the panel was
  // opened (the Header bell toggles `notificationsOpen` directly).
  useEffect(() => {
    if (notificationsOpen) {
      setTaskDialogOpen(false);
      setSidebarOpen(false);
    }
  }, [notificationsOpen, setTaskDialogOpen, setSidebarOpen]);

  const showUnread = hasUnread(notifications);
  const isEmpty = orderedNotifications.length === 0;
  // Captured once per render; the panel re-renders on open so the labels are
  // fresh each time it is shown.
  const now = Date.now();

  async function handleMarkAll() {
    try {
      await markAllNotificationsRead();
      toast.success("Notificações marcadas como lidas.");
    } catch {
      // The context already reverted the optimistic read flip (R10.7); surface
      // the failure to the user.
      toast.error("Não foi possível atualizar as notificações.");
    }
  }

  return (
    <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
      {/* Anchor pinned where the prototype fixed the panel (top-16 right-4). It
          carries no size and ignores pointer events so it never intercepts
          clicks on the header (R12.3). */}
      <PopoverAnchor asChild>
        <span
          aria-hidden="true"
          className="pointer-events-none fixed right-4 top-16 h-0 w-0"
        />
      </PopoverAnchor>

      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "w-80 overflow-hidden rounded-xl border border-slate-200 bg-card p-0 shadow-xl",
          className,
        )}
        aria-label="Notificações"
      >
        {/* Header: title + "Marcar todas como lidas" (R1.12, R10.5) */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-800">Notificações</h3>
          {!isEmpty && (
            <button
              type="button"
              onClick={handleMarkAll}
              disabled={!showUnread}
              className="text-xs font-medium text-brand-600 transition hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {isEmpty ? (
          /* Empty state (R10.4) */
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <BellOff className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">Nenhuma notificação</p>
          </div>
        ) : (
          /* Most-recent-first list with read/unread indicator (R10.3) */
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {orderedNotifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3",
                  n.read ? "" : "bg-brand-50/40",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-1 h-2 w-2 shrink-0 rounded-full",
                    n.read ? "bg-slate-300" : "bg-brand-500",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700">{n.text}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {relativeTime(n.time, now)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
