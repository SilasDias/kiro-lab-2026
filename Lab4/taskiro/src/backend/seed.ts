// TasKiro idempotent seed data.
//
// On first initialization (no seed present) this seeds the prototype's sample
// data associated with the seeded user "Ana Silva": the three projects, the
// seven sample tasks, and the three notifications. Seeding is guarded by an
// existence check so re-initialization creates no duplicates, and the seeded
// user's password is hashed via `Bun.password`.
//
// The data below is ported verbatim from the single-file prototype
// (`index.html`): project names/colors, task titles/descriptions/relative due
// dates/priorities/project associations/status/done flags, and the three
// notifications. Notification timestamps are offset from seed time
// (≈ now−10min, now−1h, now−2 days) so the relative-time display reproduces the
// prototype's "há 10 min / há 1 h / há 2 dias".
//
// Requirements: 17.10, 17.11, 18.1

import type { Database } from "bun:sqlite";
import {
  withTransaction,
  type Priority,
  type Status,
  type UserRow,
} from "./db";

// --- Seeded user identity (mirrors the prototype's avatar/user footer) ---
export const SEED_USER_ID = "u1";
export const SEED_USER_NAME = "Ana Silva";
export const SEED_USER_EMAIL = "ana@taskiro.app";
export const SEED_USER_INITIALS = "AS";

/**
 * Default password for the seeded demo account. This is a development/demo
 * credential only; it is hashed via `Bun.password` before storage and the
 * plaintext is never persisted (R18.1). Documented here so the demo login is
 * reproducible.
 */
export const SEED_USER_PASSWORD = "taskiro123";

// --- Projects (verbatim from the prototype) ---
interface SeedProject {
  id: string;
  name: string;
  color: string;
}

const SEED_PROJECTS: SeedProject[] = [
  { id: "p1", name: "Trabalho", color: "#6366f1" },
  { id: "p2", name: "Pessoal", color: "#10b981" },
  { id: "p3", name: "Estudos", color: "#f59e0b" },
];

// --- Tasks (verbatim from the prototype) ---
// `dueOffset` is the relative day offset the prototype passed to `addDays(n)`:
// the due date is computed at seed time as today + dueOffset (R17.10).
interface SeedTask {
  id: string;
  title: string;
  description: string;
  dueOffset: number;
  priority: Priority;
  projectId: string | null;
  status: Status;
  done: boolean;
}

const SEED_TASKS: SeedTask[] = [
  {
    id: "t1",
    title: "Finalizar apresentação do trimestre",
    description: "Slides + dados de vendas",
    dueOffset: 0,
    priority: "high",
    projectId: "p1",
    status: "doing",
    done: false,
  },
  {
    id: "t2",
    title: "Responder e-mails de clientes",
    description: "",
    dueOffset: 0,
    priority: "medium",
    projectId: "p1",
    status: "todo",
    done: false,
  },
  {
    id: "t3",
    title: "Comprar mantimentos",
    description: "Frutas, café e pão",
    dueOffset: 1,
    priority: "low",
    projectId: "p2",
    status: "todo",
    done: false,
  },
  {
    id: "t4",
    title: "Estudar capítulo 5 de UX",
    description: "Heurísticas de Nielsen",
    dueOffset: 2,
    priority: "medium",
    projectId: "p3",
    status: "todo",
    done: false,
  },
  {
    id: "t5",
    title: "Agendar consulta médica",
    description: "",
    dueOffset: -1,
    priority: "high",
    projectId: "p2",
    status: "todo",
    done: false,
  },
  {
    id: "t6",
    title: "Revisar pull request da equipe",
    description: "Feature de login",
    dueOffset: 3,
    priority: "medium",
    projectId: "p1",
    status: "done",
    done: true,
  },
  {
    id: "t7",
    title: "Planejar viagem de férias",
    description: "",
    dueOffset: 10,
    priority: "low",
    projectId: "p2",
    status: "doing",
    done: false,
  },
];

// --- Notifications (verbatim from the prototype) ---
// `offsetSeconds` is how far in the past (from seed time) the timestamp is set,
// chosen so the relative-time display reproduces the prototype labels (R17.10).
interface SeedNotification {
  id: string;
  text: string;
  offsetSeconds: number; // seconds before seed time
  read: boolean;
}

const SEED_NOTIFICATIONS: SeedNotification[] = [
  {
    id: "n1",
    text: "Reunião de planejamento às 15h",
    offsetSeconds: 10 * 60, // ≈ now − 10 min  → "há 10 min"
    read: false,
  },
  {
    id: "n2",
    text: 'Tarefa "Revisar proposta" vence hoje',
    offsetSeconds: 60 * 60, // ≈ now − 1 h      → "há 1 h"
    read: false,
  },
  {
    id: "n3",
    text: "Bem-vinda ao TasKiro!",
    offsetSeconds: 2 * 24 * 60 * 60, // ≈ now − 2 dias → "há 2 dias"
    read: true,
  },
];

/** Format a Date as 'YYYY-MM-DD' (round-trippable task due storage, R17.2). */
function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Compute a task due date as today (local, start of day) + `offset` days,
 * matching the prototype's `addDays(n)` helper.
 */
function dueFromOffset(offset: number, base: Date): string {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return toDateString(d);
}

/**
 * True when the seed has already been applied. The seeded user is the anchor
 * record; if it exists we treat the database as already seeded and skip,
 * guaranteeing no duplicates on re-initialization (R17.11).
 */
export function isSeeded(db: Database): boolean {
  const row = db
    .query("SELECT 1 AS present FROM users WHERE id = ? LIMIT 1")
    .get(SEED_USER_ID) as { present: number } | null;
  return row !== null;
}

/**
 * Seed the prototype's sample data, idempotently.
 *
 * If the seed user already exists this is a no-op (R17.11). Otherwise the user,
 * three projects, seven tasks, and three notifications are inserted inside a
 * single transaction so a partial failure rolls back cleanly (R17.9). The
 * user's password is hashed via `Bun.password.hash` and the plaintext is never
 * stored (R18.1).
 *
 * @param db   target database connection (use `:memory:` in tests)
 * @param now  reference time for relative due dates / notification offsets;
 *             defaults to the current time. Injectable for deterministic tests.
 */
export async function seedDatabase(
  db: Database,
  now: Date = new Date(),
): Promise<boolean> {
  // Existence check guard — re-initialization creates no duplicates (R17.11).
  if (isSeeded(db)) {
    return false;
  }

  // Hash the demo password before opening the transaction (hashing is async;
  // `withTransaction` runs synchronously). Plaintext is never persisted (R18.1).
  const passwordHash = await Bun.password.hash(SEED_USER_PASSWORD);

  const user: UserRow = {
    id: SEED_USER_ID,
    display_name: SEED_USER_NAME,
    email: SEED_USER_EMAIL,
    password_hash: passwordHash,
  };

  withTransaction(db, (tx) => {
    tx.query(
      `INSERT INTO users (id, display_name, email, password_hash)
       VALUES (?, ?, ?, ?)`,
    ).run(user.id, user.display_name, user.email, user.password_hash);

    const insertProject = tx.query(
      `INSERT INTO projects (id, name, color, user_id) VALUES (?, ?, ?, ?)`,
    );
    for (const p of SEED_PROJECTS) {
      insertProject.run(p.id, p.name, p.color, SEED_USER_ID);
    }

    const insertTask = tx.query(
      `INSERT INTO tasks
         (id, title, description, due, priority, project_id, status, done, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const t of SEED_TASKS) {
      insertTask.run(
        t.id,
        t.title,
        t.description,
        dueFromOffset(t.dueOffset, now),
        t.priority,
        t.projectId,
        t.status,
        t.done ? 1 : 0,
        SEED_USER_ID,
      );
    }

    const insertNotification = tx.query(
      `INSERT INTO notifications (id, text, time, read, user_id)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const n of SEED_NOTIFICATIONS) {
      const time = new Date(now.getTime() - n.offsetSeconds * 1000).toISOString();
      insertNotification.run(n.id, n.text, time, n.read ? 1 : 0, SEED_USER_ID);
    }
  });

  return true;
}
