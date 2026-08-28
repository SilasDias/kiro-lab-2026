// TasKiro Bun Fullstack Dev Server (Requirement 13).
//
// A single Bun runtime serves both the bundled React front end and the REST API:
//
//   1. The front end is served via an **HTML import** (`./index.html`). Passing the
//      imported HTML to `Bun.serve({ routes })` makes Bun scan its `<script>` /
//      `<link>` tags, transpile/bundle the referenced `.tsx` modules, and compile
//      Tailwind (via `bun-plugin-tailwind` from `bunfig.toml`) — no Node.js, Vite,
//      or Webpack participates (R13.1, R13.2).
//   2. Every `/api/*` request is routed to the **mounted ElysiaJS app** built by
//      `createApp(...)`; the Elysia response is returned to the caller (R13.4).
//
// Failure handling:
//   - If Bun fails to transpile/bundle an imported `.tsx` module, the dev server's
//     `error` hook surfaces the bundling failure instead of serving a partially
//     bundled front end (R13.3).
//   - If the backend throws or does not produce a response within
//     `BACKEND_TIMEOUT_MS`, the server returns a `503` indicating the backend is
//     unreachable (R13.5).
//
// Requirements: 13.1, 13.3, 13.4, 13.5

import index from "./index.html";
import {
  createApp,
  BACKEND_UNREACHABLE_MESSAGE,
  type RoutePlugin,
} from "./backend/app";
import { authRoutes } from "./backend/auth-routes";
import { taskRoutes } from "./backend/tasks";
import { projectRoutes } from "./backend/projects";
import { notificationRoutes } from "./backend/notifications";
import { getDatabase } from "./backend/db";
import { isSeeded, seedDatabase } from "./backend/seed";

// --- Configuration -----------------------------------------------------------

/** Listen port; overridable via `PORT` for deployment flexibility. */
const PORT = Number(process.env.PORT ?? 3000);

/**
 * Development mode enables Bun's detailed bundling errors and hot reloading.
 * Defaults on unless `NODE_ENV === "production"`.
 */
const IS_DEV = process.env.NODE_ENV !== "production";

/**
 * Maximum time the server waits for the mounted backend to produce a response
 * before declaring it unreachable and returning a 503 (R13.5). The design fixes
 * this internal timeout at 5000 ms.
 */
const BACKEND_TIMEOUT_MS = 5000;

// --- Backend wiring -----------------------------------------------------------

/**
 * Build the ElysiaJS application with every route plugin mounted under `/api`.
 * `createApp` installs the centralized error contract and the `/api/health`
 * probe; the auth/task/project/notification plugins supply the data endpoints.
 */
const backend: RoutePlugin = createApp([
  authRoutes,
  taskRoutes,
  projectRoutes,
  notificationRoutes,
]);

/**
 * Initialize the shared database and seed the prototype's sample data on first
 * run. Seeding is guarded by {@link isSeeded} so restarts never create
 * duplicates (R17.10, R17.11).
 */
async function initBackend(): Promise<void> {
  const db = getDatabase();
  if (!isSeeded(db)) {
    await seedDatabase(db);
  }
}

/**
 * A rejection used to bound how long we wait for the backend. Distinct from any
 * error the backend itself throws so the 503 path is taken either way (R13.5).
 */
class BackendTimeoutError extends Error {
  constructor() {
    super(BACKEND_UNREACHABLE_MESSAGE);
    this.name = "BackendTimeoutError";
  }
}

/** A JSON 503 response indicating the backend could not be reached (R13.5). */
function backendUnreachableResponse(): Response {
  return new Response(JSON.stringify({ error: BACKEND_UNREACHABLE_MESSAGE }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Route an `/api/*` request to the mounted Elysia app, returning its response
 * (R13.4). If the backend throws or exceeds {@link BACKEND_TIMEOUT_MS}, return a
 * 503 instead of letting the request hang or surfacing an opaque crash (R13.5).
 */
async function routeToBackend(request: Request): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BackendTimeoutError()), BACKEND_TIMEOUT_MS);
    });
    const response = await Promise.race([backend.handle(request), timeout]);
    return response as Response;
  } catch {
    // Unhandled backend rejection or timeout → backend unreachable (R13.5).
    return backendUnreachableResponse();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// --- Server -------------------------------------------------------------------

await initBackend();

const server = Bun.serve({
  port: PORT,
  // `development` enables Bun's detailed bundling-error responses and HMR.
  // When Bun cannot transpile/bundle an imported `.tsx`, it returns a build
  // error response rather than a partially bundled front end (R13.3).
  development: IS_DEV ? { hmr: true, console: true } : false,
  routes: {
    // Route the REST API to the mounted Elysia app (R13.4, R13.5).
    "/api/*": (request: Request) => routeToBackend(request),
    // Serve the bundled front end for all other paths via the HTML import.
    // Bun bundles the referenced `.tsx`/CSS modules on demand (R13.1).
    "/*": index,
  },
  /**
   * Server-level error hook. In development Bun renders detailed bundling
   * errors; here we ensure any other unexpected server error surfaces a clear
   * response instead of an empty socket close (R13.3).
   */
  error(error: Error): Response {
    console.error("[server] request error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor.", detail: error.message }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  },
});

console.log(`TasKiro server running at ${server.url} (dev: ${IS_DEV})`);

export { server };
