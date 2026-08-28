/**
 * API client for TasKiro (`api.ts`).
 *
 * A thin `fetch` wrapper that:
 *  - attaches `Authorization: Bearer <token>` when a session token is set,
 *  - sends/parses JSON,
 *  - maps non-2xx responses to typed errors (`UnauthorizedError` 401,
 *    `ValidationError` 400, `NotFoundError` 404, `ForbiddenError` 403, and a
 *    generic `ApiError` for everything else).
 *
 * The typed errors are consumed by the UI to drive error toasts and
 * dialog-retention behavior (Requirements 7.14, 8.8, 9.5, 10.7, 12.7).
 *
 * The client holds the token in memory and exposes `setToken` / `clearToken`
 * so `AuthContext` (task 10.3) can wire login/logout without this module
 * depending on React. A default `api` singleton is exported for convenience;
 * tests or alternate setups can construct their own `ApiClient`.
 *
 * Endpoints mirror the design's "Backend REST API" table.
 */

import type { Priority, Task } from "./logic";

// ---------- Wire DTOs ----------

/** Authenticated account. `password_hash` is never sent over the wire. */
export interface User {
  id: string;
  displayName: string;
  email: string;
}

/** A named grouping of tasks with an associated color (hex string). */
export interface Project {
  id: string;
  name: string;
  color: string;
}

/** A notification item. `time` is a round-trippable ISO timestamp. */
export interface Notification {
  id: string;
  text: string;
  time: string;
  read: boolean;
}

// ---------- Request input shapes ----------

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateTaskInput {
  title: string;
  desc?: string;
  due?: string | null;
  priority: Priority;
  project?: string | null;
}

/** Partial task update. Ownership (`user_id`/owner) can never be changed. */
export type UpdateTaskInput = Partial<{
  title: string;
  desc: string;
  due: string | null;
  priority: Priority;
  project: string | null;
  status: Task["status"];
  done: boolean;
}>;

export interface CreateProjectInput {
  name: string;
  color: string;
}

// ---------- Typed errors ----------

/** Generic API error carrying the HTTP status and parsed error body. */
export class ApiError extends Error {
  readonly status: number;
  /** The named constraint that was violated, when the backend supplies one. */
  readonly constraint?: string;
  /** The raw parsed error body, for callers that need extra detail. */
  readonly body: unknown;

  constructor(
    message: string,
    status: number,
    body?: unknown,
    constraint?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.constraint = constraint;
  }
}

/** 401 — missing, malformed, or expired session token / bad credentials. */
export class UnauthorizedError extends ApiError {
  constructor(message = "Não autorizado", body?: unknown, constraint?: string) {
    super(message, 401, body, constraint);
    this.name = "UnauthorizedError";
  }
}

/** 400 — request body failed validation (the violated constraint is named). */
export class ValidationError extends ApiError {
  constructor(message = "Requisição inválida", body?: unknown, constraint?: string) {
    super(message, 400, body, constraint);
    this.name = "ValidationError";
  }
}

/** 404 — the requested resource does not exist (or is not visible). */
export class NotFoundError extends ApiError {
  constructor(message = "Não encontrado", body?: unknown, constraint?: string) {
    super(message, 404, body, constraint);
    this.name = "NotFoundError";
  }
}

/** 403 — the resource exists but is owned by another user. */
export class ForbiddenError extends ApiError {
  constructor(message = "Acesso negado", body?: unknown, constraint?: string) {
    super(message, 403, body, constraint);
    this.name = "ForbiddenError";
  }
}

// ---------- Client ----------

export interface ApiClientOptions {
  /** Base URL prefix for all requests. Defaults to "" (same origin). */
  baseUrl?: string;
  /** Initial session token, if any. */
  token?: string | null;
  /** Injectable fetch implementation (defaults to the global `fetch`). */
  fetchFn?: typeof fetch;
}

/** Shape of an error body returned by the backend's `onError` contract. */
interface ErrorBody {
  error?: string;
  constraint?: string;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null;
  private readonly fetchFn: typeof fetch;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.token = options.token ?? null;
    // The native `fetch` must be invoked with `this` bound to the global
    // object. Storing it as an instance property and calling it as
    // `this.fetchFn(...)` would rebind `this` to the ApiClient, which the
    // browser rejects with "Illegal invocation". Bind to `globalThis` so the
    // call site is context-safe regardless of how it is invoked.
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  }

  /** Set the Bearer token used for subsequent requests. */
  setToken(token: string | null): void {
    this.token = token;
  }

  /** Clear the Bearer token (e.g. on logout or a 401). */
  clearToken(): void {
    this.token = null;
  }

  /** The currently held token, or null when unauthenticated. */
  getToken(): string | null {
    return this.token;
  }

  // --- Core request helper ---

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const hasBody = body !== undefined;
    if (hasBody) headers["Content-Type"] = "application/json";

    const res = await this.fetchFn(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    const parsed = await this.parseBody(res);

    if (!res.ok) {
      throw this.toError(res.status, parsed);
    }

    return parsed as T;
  }

  /** Parse a JSON body, tolerating empty (204 / no-content) responses. */
  private async parseBody(res: Response): Promise<unknown> {
    if (res.status === 204) return undefined;
    const text = await res.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      // Non-JSON payload (e.g. a plain error string) — surface the raw text.
      return { error: text };
    }
  }

  /** Map an HTTP status + parsed body to the appropriate typed error. */
  private toError(status: number, body: unknown): ApiError {
    const errBody = (body ?? {}) as ErrorBody;
    const message = errBody.error;
    const constraint = errBody.constraint;
    switch (status) {
      case 400:
        return new ValidationError(message, body, constraint);
      case 401:
        return new UnauthorizedError(message, body, constraint);
      case 403:
        return new ForbiddenError(message, body, constraint);
      case 404:
        return new NotFoundError(message, body, constraint);
      default:
        return new ApiError(
          message ?? `Erro na requisição (${status})`,
          status,
          body,
          constraint,
        );
    }
  }

  // --- Auth ---

  /** POST /api/auth/login → { token, user } (401 bad creds, 429 rate-limited). */
  async login(input: LoginInput): Promise<{ token: string; user: User }> {
    return this.request<{ token: string; user: User }>(
      "POST",
      "/api/auth/login",
      input,
    );
  }

  /** POST /api/auth/logout → { ok } (revokes the current session). */
  async logout(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>("POST", "/api/auth/logout");
  }

  /** GET /api/me → the authenticated user. */
  async me(): Promise<User> {
    const res = await this.request<{ user: User }>("GET", "/api/me");
    return res.user;
  }

  // --- Tasks ---

  /** GET /api/tasks → the authenticated user's tasks. */
  listTasks(): Promise<Task[]> {
    return this.request<Task[]>("GET", "/api/tasks");
  }

  /** POST /api/tasks → the created task (201). */
  createTask(input: CreateTaskInput): Promise<Task> {
    return this.request<Task>("POST", "/api/tasks", input);
  }

  /** GET /api/tasks/:id → a single owned task. */
  getTask(id: string): Promise<Task> {
    return this.request<Task>("GET", `/api/tasks/${encodeURIComponent(id)}`);
  }

  /** PATCH /api/tasks/:id → the updated task. */
  updateTask(id: string, patch: UpdateTaskInput): Promise<Task> {
    return this.request<Task>(
      "PATCH",
      `/api/tasks/${encodeURIComponent(id)}`,
      patch,
    );
  }

  /** DELETE /api/tasks/:id → { ok }. */
  deleteTask(id: string): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>(
      "DELETE",
      `/api/tasks/${encodeURIComponent(id)}`,
    );
  }

  // --- Projects ---

  /** GET /api/projects → the authenticated user's projects. */
  listProjects(): Promise<Project[]> {
    return this.request<Project[]>("GET", "/api/projects");
  }

  /** POST /api/projects → the created project (201). */
  createProject(input: CreateProjectInput): Promise<Project> {
    return this.request<Project>("POST", "/api/projects", input);
  }

  // --- Notifications ---

  /** GET /api/notifications → the authenticated user's notifications. */
  listNotifications(): Promise<Notification[]> {
    return this.request<Notification[]>("GET", "/api/notifications");
  }

  /** POST /api/notifications/mark-all-read → { updated }. */
  markAllNotificationsRead(): Promise<{ updated: number }> {
    return this.request<{ updated: number }>(
      "POST",
      "/api/notifications/mark-all-read",
    );
  }
}

/** Default shared client instance wired by `AuthContext`. */
export const api = new ApiClient();
