/**
 * ConfirmDialog — the guarded-action confirmation modal (Requirement 11.1–11.3).
 *
 * Built on the shadcn/ui **AlertDialog** (Radix) primitive so focus and pointer
 * events are managed accessibly (design principle 4). It guards the two
 * destructive flows in TasKiro:
 *   - task deletion (R1.10, TaskCard `onDelete`), and
 *   - "Limpar concluídas" (R1.6, R5.8, FilterBar `onRequestClearCompleted`).
 *
 * Behavior (Requirement 11):
 *  - Renders a title, a descriptive message, a cancel control, and a confirm
 *    control before the action runs (R11.1).
 *  - Activating confirm performs `onConfirm` and closes the dialog (R11.2).
 *  - Cancelling via the cancel control, an overlay click, or the Escape key
 *    closes the dialog and leaves all task/project data unchanged — no mutation
 *    runs on any cancel path because mutations live only in `onConfirm` (R11.3).
 *
 * This is a *controlled* component: the owner holds `open` state and reacts to
 * `onOpenChange`. The companion `useConfirmDialog` hook below packages that
 * state so the application shell (task 12.1) can wire both call sites with a
 * single `confirm({ ... })` call.
 *
 * Theming is via OKLCH-backed tokens only (`bg-destructive`,
 * `text-destructive-foreground`, ...); no color literals (Requirements 14.3,
 * 14.7).
 */

import { useCallback, useState } from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * Content classes mirroring the shadcn `AlertDialogContent` wrapper. Composed
 * here directly (rather than via that wrapper) so we can pair the content with
 * an overlay that closes on click — Radix's `AlertDialog.Content` deliberately
 * omits `onInteractOutside`, so overlay-cancel (R11.3) is wired on the overlay.
 */
const CONTENT_CLASSES =
  'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg';

export interface ConfirmDialogProps {
  /** Whether the dialog is visible (controlled by the owner). */
  open: boolean;
  /**
   * Open-state change handler. Radix invokes this with `false` for every close
   * path (confirm, cancel control, overlay click, Escape), so the owner can
   * clear its open state. No data changes on cancel paths (R11.3).
   */
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "Excluir tarefa?" (R11.1). */
  title: string;
  /** Descriptive message explaining the consequence of confirming (R11.1). */
  description: string;
  /** Confirm control label. Defaults to "Confirmar". */
  confirmLabel?: string;
  /** Cancel control label. Defaults to "Cancelar". */
  cancelLabel?: string;
  /**
   * Style the confirm control as a destructive action (rose). Used for task
   * deletion and "Limpar concluídas".
   */
  destructive?: boolean;
  /**
   * The action to perform when the user confirms (R11.2). May be async; any
   * resulting success/error toast is the caller's concern (R11.4). The dialog
   * closes after invoking this regardless of outcome.
   */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = useCallback(() => {
    // Perform the guarded action (R11.2). Errors surface through the caller's
    // toast handling; the dialog still closes via Radix's default Action
    // behavior driving `onOpenChange(false)`.
    void onConfirm();
  }, [onConfirm]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        {/* Radix AlertDialog blocks outside-pointer dismissal by default; the
            prototype's confirmation also closes on an overlay click (R11.3), so
            the overlay explicitly requests close. Escape and the cancel control
            are handled by the primitive's default close paths. */}
        <AlertDialogOverlay onClick={() => onOpenChange(false)} />
        <AlertDialogPrimitive.Content data-slot="alert-dialog-content" className={CONTENT_CLASSES}>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                destructive &&
                  'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/40',
              )}
            >
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
}

/** Configuration for a single confirmation request. */
export interface ConfirmConfig {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export interface UseConfirmDialog {
  /** Open the confirmation dialog with the given configuration. */
  confirm: (config: ConfirmConfig) => void;
  /** Spread onto a single `<ConfirmDialog />` instance owned by the shell. */
  dialogProps: ConfirmDialogProps;
}

/**
 * Manage a single shared ConfirmDialog instance.
 *
 * The application shell (task 12.1) mounts one `<ConfirmDialog {...dialogProps} />`
 * and calls `confirm({ ... })` from each guarded action — TaskCard's `onDelete`
 * and FilterBar's `onRequestClearCompleted` — keeping the two call sites aligned
 * with the existing callback-based component APIs.
 */
export function useConfirmDialog(): UseConfirmDialog {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<ConfirmConfig | null>(null);

  const confirm = useCallback((next: ConfirmConfig) => {
    setConfig(next);
    setOpen(true);
  }, []);

  const dialogProps: ConfirmDialogProps = {
    open,
    onOpenChange: setOpen,
    title: config?.title ?? '',
    description: config?.description ?? '',
    confirmLabel: config?.confirmLabel,
    cancelLabel: config?.cancelLabel,
    destructive: config?.destructive,
    onConfirm: config?.onConfirm ?? (() => {}),
  };

  return { confirm, dialogProps };
}
