/**
 * TaskDialog — the create/edit task dialog (Requirement 8).
 *
 * Reproduces the prototype's task modal with full visual fidelity, using the
 * shadcn **Dialog** so pointer events and focus are managed by Radix
 * (Requirement 12). It is self-contained: it reads its open state, the task
 * being edited, the active project, and the create/update actions from
 * `DataContext`, so the app shell (task 12.1) only has to mount it once.
 *
 * Behavior (Requirement 8):
 *  - Opening in create mode shows the title "Nova tarefa" with an empty title
 *    and description, no due date, the priority defaulted to "Média"
 *    (`medium`), and no project preselected — unless a project is active, in
 *    which case that project is preselected (R8.1, R8.7).
 *  - Opening in edit mode shows "Editar tarefa" pre-filled with the task's
 *    title, description, due date, priority, and project; the project select is
 *    the no-project option when the task has none (R8.2).
 *  - The form provides a title input (1–200), a description textarea (0–2000),
 *    a due-date input, a priority select (Alta/Média/Baixa), and a project
 *    select offering every project plus a "Sem projeto" option (R8.3).
 *  - Submitting with an empty or whitespace-only title keeps the dialog open,
 *    flags the title field, and performs no create/update — validated with the
 *    pure `isValidTitle` helper (R8.4).
 *  - Submitting a valid new task creates it via the API (the backend assigns
 *    status `todo` and done `false`); on success the dialog closes and a
 *    success toast is shown (R8.5). Submitting a valid existing task updates it
 *    via the API; on success the dialog closes and a success toast is shown
 *    (R8.6).
 *  - If the create/update API call fails, the dialog stays open with the
 *    entered values retained and an error toast is shown (R8.8).
 *
 * Theme colors come from OKLCH-backed Tailwind utilities; no raw color literals
 * are used (Requirements 14.3, 14.7).
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { DateField } from "@/components/DateField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { isValidTitle, type Priority } from "@/lib/logic";
import { cn } from "@/lib/utils";
import { useData } from "@/state/DataContext";

/**
 * Sentinel value for the "Sem projeto" option. Radix Select items cannot use an
 * empty string value, so a non-id sentinel represents "no project"; it is
 * mapped back to `null` on submit.
 */
const NO_PROJECT = "__no_project__";

/** Priority options in the prototype's order, with their pt-BR labels (R8.3). */
const PRIORITY_OPTIONS: ReadonlyArray<{ value: Priority; label: string }> = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
];

export function TaskDialog() {
  const {
    taskDialogOpen,
    taskBeingEdited,
    activeProject,
    projects,
    setTaskDialogOpen,
    createTask,
    updateTask,
  } = useData();

  const isEditing = taskBeingEdited !== null;

  // --- Form state ---
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [project, setProject] = useState<string>(NO_PROJECT);
  const [titleError, setTitleError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Initialize / reset the form whenever the dialog opens. In edit mode it
  // prefills from the task (R8.2); in create mode it applies defaults and
  // preselects the active project when one is set (R8.1, R8.7).
  useEffect(() => {
    if (!taskDialogOpen) return;
    if (taskBeingEdited) {
      setTitle(taskBeingEdited.title);
      setDesc(taskBeingEdited.desc ?? "");
      setDue(taskBeingEdited.due ?? "");
      setPriority(taskBeingEdited.priority);
      setProject(taskBeingEdited.project ?? NO_PROJECT);
    } else {
      setTitle("");
      setDesc("");
      setDue("");
      setPriority("medium");
      setProject(activeProject ?? NO_PROJECT);
    }
    setTitleError(false);
    setSubmitting(false);
  }, [taskDialogOpen, taskBeingEdited, activeProject]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    // Title validation keeps the dialog open and flags the field (R8.4).
    if (!isValidTitle(title)) {
      setTitleError(true);
      return;
    }

    const projectId = project === NO_PROJECT ? null : project;
    const dueValue = due.trim() === "" ? null : due;
    const payload = {
      title: title.trim(),
      desc,
      due: dueValue,
      priority,
      project: projectId,
    };

    setSubmitting(true);
    try {
      if (taskBeingEdited) {
        await updateTask(taskBeingEdited.id, payload);
        // Success: close and confirm (R8.6).
        setTaskDialogOpen(false);
        toast.success("Tarefa atualizada");
      } else {
        await createTask(payload);
        // Success: close and confirm (R8.5). The backend assigns status `todo`
        // and done `false`.
        setTaskDialogOpen(false);
        toast.success("Tarefa criada");
      }
    } catch {
      // Failure: keep the dialog open with values retained, surface the error
      // (R8.8). DataContext already routed any 401 to the auth context.
      toast.error("Não foi possível salvar a tarefa");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar tarefa" : "Nova tarefa"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize os detalhes da tarefa."
              : "Preencha os detalhes da nova tarefa."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          {/* Title (1–200) — required (R8.3, R8.4) */}
          <div className="grid gap-1.5">
            <label htmlFor="task-title" className="text-sm font-medium text-slate-700">
              Título
            </label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError(false);
              }}
              maxLength={200}
              placeholder="O que precisa ser feito?"
              aria-invalid={titleError}
              aria-describedby={titleError ? "task-title-error" : undefined}
              autoFocus
            />
            {titleError ? (
              <p id="task-title-error" className="text-xs text-destructive">
                Informe um título para a tarefa.
              </p>
            ) : null}
          </div>

          {/* Description (0–2000) (R8.3) */}
          <div className="grid gap-1.5">
            <label
              htmlFor="task-desc"
              className="text-sm font-medium text-slate-700"
            >
              Descrição
            </label>
            <Textarea
              id="task-desc"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={2000}
              placeholder="Adicione mais detalhes (opcional)"
              className="min-h-20"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Due date (R8.3) */}
            <div className="grid gap-1.5">
              <label
                htmlFor="task-due"
                className="text-sm font-medium text-slate-700"
              >
                Prazo
              </label>
              <DateField
                id="task-due"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>

            {/* Priority (Alta/Média/Baixa) (R8.3) */}
            <div className="grid gap-1.5">
              <label
                htmlFor="task-priority"
                className="text-sm font-medium text-slate-700"
              >
                Prioridade
              </label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as Priority)}
              >
                <SelectTrigger id="task-priority" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Project — every project plus a no-project option (R8.3) */}
          <div className="grid gap-1.5">
            <label
              htmlFor="task-project"
              className="text-sm font-medium text-slate-700"
            >
              Projeto
            </label>
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger id="task-project" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PROJECT}>Sem projeto</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: p.color }}
                    />
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setTaskDialogOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className={cn(submitting && "opacity-80")}>
              {isEditing ? "Salvar" : "Criar tarefa"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
