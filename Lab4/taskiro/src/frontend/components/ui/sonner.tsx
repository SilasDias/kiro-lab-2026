import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster wrapper around `sonner`.
 *
 * The base shadcn/ui component reads the active theme from `next-themes`.
 * TasKiro fixes the light theme as the active default (Requirement 2.10), so the
 * Toaster defaults to `light` while still allowing an explicit override via props.
 * Colors are sourced exclusively from the OKLCH CSS variables defined in
 * `src/styles/globals.css` (Requirements 14.3, 14.7) — no per-component literals.
 */
function Toaster({ theme = "light", ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as CSSProperties
      }
      {...props}
    />
  );
}

export { Toaster };
