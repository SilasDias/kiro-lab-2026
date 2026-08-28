/**
 * Toaster — the application-level toast host (Requirement 11.4–11.6).
 *
 * Wraps the shadcn/ui **Sonner** Toaster (`@/components/ui/sonner`) with the
 * behavior the prototype mandates:
 *  - success / info / error variants, selected per action at each call site via
 *    `toast.success` / `toast.info` / `toast.error` (R11.4 — e.g. TaskCard's
 *    completion toasts and FilterBar's sort-change toast);
 *  - auto-dismiss exactly 3.2 seconds (3200 ms) after a toast appears (R11.6);
 *  - a manual dismiss control on every toast that removes it immediately when
 *    activated before auto-dismissal (R11.6) — enabled via Sonner's
 *    `closeButton`.
 *
 * Variant colors are routed to the OKLCH theme tokens defined in
 * `src/styles/globals.css` (emerald for success, brand/indigo for info,
 * destructive/rose for error). No color literals are introduced — only CSS
 * variable references (Requirements 14.3, 14.7). `richColors` makes Sonner apply
 * these per-variant variables to each toast's icon, text, and border.
 *
 * The single source of toast variant selection remains `toast` from `sonner`,
 * matching every existing call site; it is re-exported here for convenience so
 * components may import the host and the emitter from one module.
 */

import type { CSSProperties } from 'react';
import { toast } from 'sonner';

import { Toaster as SonnerToaster } from '@/components/ui/sonner';

/** Auto-dismiss delay in milliseconds (Requirement 11.6: 3.2 s). */
export const TOAST_DURATION_MS = 3200;

/**
 * Per-variant Sonner CSS variables mapped to OKLCH theme tokens. Kept alongside
 * the base `--normal-*` mapping (re-declared here because props passed to the
 * underlying Toaster override its built-in `style`). Each variant keeps the
 * popover background and tints its icon/text/border with the matching token so
 * the variants are visually distinct yet fully theme-sourced.
 */
const TOAST_STYLE: CSSProperties = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
  '--success-bg': 'var(--popover)',
  '--success-text': 'var(--priority-low)',
  '--success-border': 'var(--priority-low)',
  '--info-bg': 'var(--popover)',
  '--info-text': 'var(--primary)',
  '--info-border': 'var(--primary)',
  '--error-bg': 'var(--popover)',
  '--error-text': 'var(--destructive)',
  '--error-border': 'var(--destructive)',
} as CSSProperties;

/**
 * Mount once near the application root (task 12.1). Renders nothing visible
 * until a `toast.*` call emits a toast.
 */
export function Toaster() {
  return (
    <SonnerToaster
      // success / info / error variants are tinted via the per-variant tokens.
      richColors
      // Manual dismiss control on every toast (R11.6).
      closeButton
      // Auto-dismiss after 3.2 s (R11.6).
      duration={TOAST_DURATION_MS}
      style={TOAST_STYLE}
    />
  );
}

export { toast };
