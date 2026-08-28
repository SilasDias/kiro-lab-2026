/**
 * ProjectDialog — the "Novo projeto" creation dialog (Requirement 9).
 *
 * Reproduces the prototype's project modal using the shadcn **Dialog** so
 * pointer events and focus are managed by Radix (Requirement 12). It is a
 * controlled component: the app shell (task 12.1) owns the open flag and wires
 * the Sidebar's "Novo projeto" action to it, mirroring how `onNewProject` is
 * threaded through `Sidebar`. Project creation persists through the
 * `createProject` action exposed by `DataContext`, which calls the API client.
 *
 * Behavior (Requirement 9):
 *  - Opening shows an empty name input and a seven-swatch color picker with
 *    exactly one color preselected as active (the first prototype color)
 *    (R9.1). The dialog state is (re)initialized every time it opens.
 *  - Selecting a swatch marks exactly that swatch active and clears the active
 *    indication from all others — single active selection via the pure
 *    `isActive` helper (R9.2).
 *  - Submitting with an empty or whitespace-only name (validated with the pure
 *    `isValidProjectName`, trimmed 1–100) keeps the dialog open, flags the
 *    name field, and creates no project (R9.3).
 *  - Submitting a valid name creates the project via the API using the trimmed
 *    name and the active color; on success the dialog closes and a success
 *    toast is shown (R9.4).
 *  - If the create API call fails, the dialog stays open with the entered name
 *    and selected color retained, and an error toast is shown (R9.5).
 *
 * Theme colors come from OKLCH-backed Tailwind utilities; the only literal
 * colors are the seven project swatch colors, which are record data applied via
 * inline `style` — the documented data-color exception to the OKLCH-only rule
 * (Requirements 14.3, 14.7).
 */

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { isActive, isValidProjectName } from '@/lib/logic';
import { cn } from '@/lib/utils';
import { useData } from '@/state/DataContext';

/**
 * The seven prototype project colors, in the prototype's order. These are
 * record data (hex literals applied via inline style), the allowed exception to
 * the OKLCH-only theming rule (R14.3, R14.7).
 */
const PROJECT_COLORS: readonly string[] = [
  '#6366f1',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#ef4444',
  '#8b5cf6',
];

/** The default active color is the first prototype color (R9.1). */
const DEFAULT_COLOR = PROJECT_COLORS[0]!;

export interface ProjectDialogProps {
  /** Whether the dialog is open (owned by the app shell, task 12.1). */
  open: boolean;
  /** Called to open/close the dialog (overlay click, Escape, Cancel, success). */
  onOpenChange: (open: boolean) => void;
}

export function ProjectDialog({ open, onOpenChange }: ProjectDialogProps) {
  const { createProject } = useData();

  // --- Form state ---
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(DEFAULT_COLOR);
  const [nameError, setNameError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // (Re)initialize the form whenever the dialog opens: empty name, the first
  // color preselected as active, no error, not submitting (R9.1).
  useEffect(() => {
    if (!open) return;
    setName('');
    setColor(DEFAULT_COLOR);
    setNameError(false);
    setSubmitting(false);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Name validation keeps the dialog open and flags the field (R9.3).
    if (!isValidProjectName(name)) {
      setNameError(true);
      return;
    }

    setSubmitting(true);
    try {
      await createProject({ name: name.trim(), color });
      // Success: close and confirm (R9.4).
      onOpenChange(false);
      toast.success('Projeto criado');
    } catch {
      // Failure: keep the dialog open with values retained, surface the error
      // (R9.5). DataContext already routed any 401 to the auth context.
      toast.error('Não foi possível criar o projeto');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo projeto</DialogTitle>
          <DialogDescription>Dê um nome ao projeto e escolha uma cor.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          {/* Name (1–100) — required (R9.3) */}
          <div className="grid gap-1.5">
            <label htmlFor="project-name" className="text-sm font-medium text-slate-700">
              Nome
            </label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError(false);
              }}
              maxLength={100}
              placeholder="Nome do projeto"
              aria-invalid={nameError}
              aria-describedby={nameError ? 'project-name-error' : undefined}
              autoFocus
            />
            {nameError ? (
              <p id="project-name-error" className="text-xs text-destructive">
                Informe um nome para o projeto.
              </p>
            ) : null}
          </div>

          {/* Color picker — exactly one active swatch (R9.1, R9.2) */}
          <div className="grid gap-1.5">
            <span className="text-sm font-medium text-slate-700">Cor</span>
            <div role="radiogroup" aria-label="Cor do projeto" className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((swatch) => {
                const active = isActive(color, swatch);
                return (
                  <button
                    key={swatch}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={`Cor ${swatch}`}
                    onClick={() => setColor(swatch)}
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition',
                      'ring-offset-2 ring-offset-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active && 'ring-2 ring-ring',
                    )}
                    style={{ background: swatch }}
                  >
                    {active ? <Check className="h-4 w-4 text-white" strokeWidth={3} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className={cn(submitting && 'opacity-80')}>
              Criar projeto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
