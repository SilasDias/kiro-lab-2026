# Implementation Plan: TasKiro Full Stack Migration

## Overview

This plan migrates the single-file TasKiro prototype into a production-ready full stack application on a 100% native Bun ecosystem (Bun Fullstack Dev Server, React + Tailwind v4 + shadcn/ui, ElysiaJS, `bun:sqlite`), with real authentication and per-user scoping. The work is sequenced so behavior-defining logic is extracted into a pure, framework-independent `logic.ts` module first (the primary property-based-testing target), followed by persistence, auth, scoping, the REST API, the Bun fullstack server, and finally the React/shadcn front end — ending with full wiring of the application shell.

Implementation language is **TypeScript** running on the **Bun** runtime, as fixed by the design (`src/frontend/lib/logic.ts`, ElysiaJS backend, `bun:sqlite`). Property tests use **`fast-check`** under **`bun:test`** (minimum 100 generated cases per property), one test per property, each tagged `// Feature: taskiro-fullstack-migration, Property {n}: {text}`.

## Tasks

- [x] 1. Initialize the Bun project, configuration, and theme tokens
  - [x] 1.1 Scaffold the Bun-native project structure and configuration files
    - Create the `taskiro/` structure from the design (`src/`, `src/frontend`, `src/backend`, `src/styles`, `tests/`)
    - Write `package.json` with Bun-only dependencies (React, Elysia, `@elysiajs/jwt`, `lucide-react`, `fast-check`) and no Node/Vite/Webpack runtime or build dependency
    - Write `bunfig.toml` registering `bun-plugin-tailwind`, `tsconfig.json`, and `components.json` (`style: new-york`, `baseColor: neutral`, `cssVariables: true`, `iconLibrary: lucide`)
    - _Requirements: 13.2, 13.6, 14.1, 14.2, 20.3_

  - [x] 1.2 Define the OKLCH theme variables and global stylesheet
    - Create `src/styles/globals.css` with `@import "tailwindcss";`, OKLCH CSS variables in `:root` (light) and `.dark`, and `@theme inline` token registration
    - Reproduce the prototype Brand_Palette, slate neutrals, rose/amber/emerald accents, priority tokens, and the Inter font stack; light theme active by default
    - Express all theme colors only as OKLCH CSS variables (no color literals outside variable definitions)
    - _Requirements: 2.1, 2.2, 2.8, 2.10, 2.11, 14.3, 14.7_

  - [ ]* 1.3 Write static config/smoke checks
    - Assert `components.json` is `new-york`/`neutral`/`cssVariables`, `package.json` has no Node/Vite/Webpack deps, logo absolute URL convention is documented, and no emoji used as icons
    - _Requirements: 13.2, 14.2, 20.2, 20.3_

- [x] 2. Implement the pure logic module (`src/frontend/lib/logic.ts`) and its property tests
  - [x] 2.1 Implement task filtering functions
    - Port `filterByView` (all/today/upcoming/completed against a `today` reference), `filterByProject` (active project overrides view), `filterBySearch` (case-insensitive substring on title|desc; empty/whitespace is a no-op), and `filterByPriority` (`all` is a no-op)
    - _Requirements: 1.1, 1.3, 1.5, 3.4, 4.3, 4.4, 5.2_

  - [ ]* 2.2 Write property test for view filtering
    - **Property 1: View filtering correctness**
    - **Validates: Requirements 1.1**

  - [ ]* 2.3 Write property test for priority filtering
    - **Property 2: Priority filtering**
    - **Validates: Requirements 1.3, 5.2**

  - [ ]* 2.4 Write property test for search substring filter
    - **Property 3: Search substring filter with empty/whitespace no-op**
    - **Validates: Requirements 1.5, 4.3, 4.4**

  - [x] 2.5 Implement sorting and the sort-cycle function
    - Port `sortTasks` (stable; due ascending with undated last; priority high→medium→low; title case-insensitive ascending) and `nextSort` (due→priority→title→due)
    - _Requirements: 1.4, 5.3, 5.4, 5.5, 5.6, 6.1_

  - [ ]* 2.6 Write property test for sort permutation
    - **Property 5: Sorting is a permutation of its input**
    - **Validates: Requirements 6.1**

  - [ ]* 2.7 Write property test for due-date sort ordering
    - **Property 6: Due-date sort orders ascending with undated last**
    - **Validates: Requirements 5.4**

  - [ ]* 2.8 Write property test for priority sort ordering
    - **Property 7: Priority sort orders high→medium→low and is stable**
    - **Validates: Requirements 5.5**

  - [ ]* 2.9 Write property test for title sort ordering
    - **Property 8: Title sort is case-insensitive ascending**
    - **Validates: Requirements 5.6**

  - [ ]* 2.10 Write property test for the sort cycle
    - **Property 9: Sort cycle advances due→priority→title→due**
    - **Validates: Requirements 1.4, 5.3**

  - [x] 2.11 Implement counts and board placement
    - Port `viewCounts`, `projectCount`, and `boardColumns` (done→`done` column; otherwise by status; total, disjoint, status-correct partition)
    - _Requirements: 3.3, 3.4, 6.2, 6.3_

  - [ ]* 2.12 Write property test for sidebar counts
    - **Property 4: Sidebar counts equal filtered-set sizes**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 2.13 Write property test for board partition
    - **Property 10: Board partition is total, disjoint, and status-correct**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 2.14 Implement due-date formatting, validation, and mutation helpers
    - Port `formatDue` (pt-BR labels: Sem prazo / Atrasada (Nd) / Hoje / Amanhã / localized day-month), `initials`, `isValidTitle` (trimmed 1–200), `isValidProjectName` (trimmed 1–100), `removeCompleted`, and `toggleDone`
    - _Requirements: 1.6, 1.9, 3.6, 5.8, 7.5, 7.6, 7.7, 7.8, 7.9, 7.12, 8.4, 9.3, 20.6_

  - [ ]* 2.15 Write property test for due-date badge formatting
    - **Property 11: Due-date badge formatting**
    - **Validates: Requirements 7.5, 7.6, 7.7, 7.8, 7.9**

  - [ ]* 2.16 Write property test for completion toggle
    - **Property 12: Completion toggle keeps done and status consistent**
    - **Validates: Requirements 7.12**

  - [ ]* 2.17 Write property test for clear-completed
    - **Property 13: Clear completed removes exactly the done Tasks**
    - **Validates: Requirements 1.6, 5.8**

  - [ ]* 2.18 Write property test for avatar initials
    - **Property 14: Avatar initials derivation**
    - **Validates: Requirements 3.6**

  - [ ]* 2.19 Write property test for title validation
    - **Property 17: Title validation rejects empty/whitespace**
    - **Validates: Requirements 1.9, 8.4**

  - [ ]* 2.20 Write property test for project-name validation
    - **Property 18: Project-name validation rejects empty/whitespace**
    - **Validates: Requirements 9.3**

  - [x] 2.21 Implement notification and active-selection helpers
    - Port `hasUnread` (bell indicator), `sortNotifications` (timestamp descending), and single-active-selection helpers for color swatches and View/Project navigation
    - _Requirements: 3.7, 4.6, 4.7, 9.1, 9.2, 10.3, 10.6_

  - [ ]* 2.22 Write property test for unread indicator
    - **Property 15: Unread indicator shows iff any notification is unread**
    - **Validates: Requirements 4.6, 4.7, 10.6**

  - [ ]* 2.23 Write property test for notification ordering
    - **Property 16: Notifications render most-recent-first**
    - **Validates: Requirements 10.3**

  - [ ]* 2.24 Write property test for single active selection
    - **Property 19: Single active selection (swatches and navigation)**
    - **Validates: Requirements 3.7, 9.1, 9.2**

- [x] 3. Checkpoint - pure logic complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement the persistence layer (`bun:sqlite`)
  - [x] 4.1 Implement the database schema and transactional write helper
    - Create `src/backend/db.ts`: `new Database(...)`, `PRAGMA foreign_keys = ON`, User/Project/Task/Notification/Session tables with CHECK constraints and FKs, round-trippable date storage, and a single transactional write helper that rolls back on failure
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7, 17.9_

  - [x] 4.2 Implement idempotent seed data
    - Create `src/backend/seed.ts` seeding user "Ana Silva" (hashed password), three projects, seven tasks, and three notifications with timestamp offsets; guard with an existence check so re-initialization creates no duplicates
    - _Requirements: 17.10, 17.11, 18.1_

  - [ ]* 4.3 Write property test for persistence round-trip
    - **Property 20: Persistence round-trip** (use `new Database(":memory:")`)
    - **Validates: Requirements 17.2, 17.3, 17.4, 17.8**

  - [ ]* 4.4 Write property test for referential-integrity rejection
    - **Property 21: Referential-integrity rejection**
    - **Validates: Requirements 17.7**

  - [ ]* 4.5 Write property test for idempotent seeding
    - **Property 22: Seeding is idempotent**
    - **Validates: Requirements 17.11**

- [x] 5. Implement the Auth_Service (`src/backend/auth.ts`)
  - [x] 5.1 Implement password hashing and session/token lifecycle
    - Implement `Bun.password.hash`/`verify`, JWT issuance via `@elysiajs/jwt` with `jti` and `exp = now + 3600s`, `sessions` row insertion, token verification (signature + expiry + session existence), uniform 401 rejection, and logout revocation
    - _Requirements: 17.6, 18.1, 18.2, 18.3, 18.5, 18.6, 18.7_

  - [x] 5.2 Implement the pure rate-limit attempt tracker
    - Implement `attemptTracker` as a deterministic function of a timestamped failure log: 5 failures within 300s triggers 429 for 900s
    - _Requirements: 18.4_

  - [ ]* 5.3 Write property test for password hash round-trip
    - **Property 23: Password hash round-trip and rejection**
    - **Validates: Requirements 17.6, 18.1, 18.3**

  - [ ]* 5.4 Write property test for login rate limiting
    - **Property 24: Login rate limiting threshold**
    - **Validates: Requirements 18.4**

  - [ ]* 5.5 Write unit tests for auth flows
    - Token carries `exp = issued + 3600s`; valid token identifies user; missing/expired token → 401; logout revokes session
    - _Requirements: 18.2, 18.5, 18.6, 18.7_

- [x] 6. Implement per-user scoping (`src/backend/scoping.ts`)
  - [x] 6.1 Implement owner-enforcement helpers
    - Implement SQL `WHERE`/`SET` owner-scoping helpers: collections return only the session user's records, creates set `user_id` from the session and ignore client-supplied owner, updates cannot change ownership, cross-owner access is rejected without leaking data, unauthenticated access returns/modifies nothing
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ]* 6.2 Write property test for per-user read isolation
    - **Property 25: Per-user read isolation** (multi-user in-memory dataset)
    - **Validates: Requirements 19.1, 19.2, 19.4, 19.5**

  - [ ]* 6.3 Write property test for ownership assignment
    - **Property 26: Ownership assignment ignores client-supplied owner**
    - **Validates: Requirements 19.3, 19.4**

- [ ] 7. Implement the ElysiaJS REST API
  - [x] 7.1 Create the Elysia app, error contract, and auth guard
    - Create `src/backend/app.ts` with route groups, a centralized `onError` mapping to `{ error, constraint? }` (400/401/403/404/409/429/503), and a `guard`/`derive` that resolves the authenticated user or rejects 401
    - _Requirements: 16.1, 16.5, 16.6, 16.7, 16.8, 13.5_

  - [x] 7.2 Implement authentication routes
    - Implement `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/me` using the Auth_Service, including 429 rate-limit and uniform 401 behavior
    - _Requirements: 18.2, 18.3, 18.4, 18.5, 18.7_

  - [x] 7.3 Implement Task routes
    - Create `src/backend/tasks.ts` for GET/POST/GET:id/PATCH:id/DELETE:id with `t` schema validation, owner scoping, and 201/200/400/401/403/404 status codes
    - _Requirements: 16.2, 16.6, 16.7, 19.1, 19.3, 19.4, 19.5_

  - [x] 7.4 Implement Project routes
    - Create `src/backend/projects.ts` for GET/POST with `t` validation (name 1–100, color), owner scoping, and 201/200/400/401 status codes
    - _Requirements: 16.3, 16.7, 19.1, 19.3_

  - [x] 7.5 Implement Notification routes
    - Create `src/backend/notifications.ts` for GET and `POST /api/notifications/mark-all-read`, owner scoped, returning 200
    - _Requirements: 10.5, 10.6, 16.4, 19.1_

  - [ ]* 7.6 Write API status-code contract tests
    - Representative requests asserting 201/200/400/401/403/404 and that error paths do not modify stored data
    - _Requirements: 16.2, 16.3, 16.4, 16.6, 16.7, 16.8_

  - [ ]* 7.7 Write durability and cross-instance isolation integration tests
    - Write through the API, restart the backend, confirm retrievable; two instances over one store enforce identical scoping
    - _Requirements: 17.8, 19.7_

- [x] 8. Checkpoint - backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement the Bun Fullstack Dev Server
  - [x] 9.1 Implement `server.ts` with HTML imports and mounted Elysia
    - Create `src/server.ts` using `Bun.serve({ routes })` to serve the bundled front end via HTML import and route `/api/*` to the mounted Elysia app; surface bundling errors and a 503 when the backend is unreachable
    - _Requirements: 13.1, 13.3, 13.4, 13.5_

  - [x] 9.2 Create the CDN-free HTML entry
    - Create `src/index.html` importing `main.tsx` and `globals.css` with no Tailwind Play CDN and no Lucide CDN `<script>`; reference the logo via the absolute kiro.dev URL
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 20.3_

  - [ ]* 9.3 Write fullstack serving integration tests
    - Assert the server serves the bundled front end and routes `/api/*`; a forced bundling failure yields an error response, not a partial bundle
    - _Requirements: 13.1, 13.3, 13.4_

  - [ ]* 9.4 Write CDN-exit smoke tests
    - Static scan of `index.html` for absence of Tailwind/Lucide CDN scripts; assert icons import from `lucide-react` and zero outbound CDN requests on load
    - _Requirements: 15.1, 15.2, 15.4, 15.5, 15.6_

- [x] 10. Implement the frontend foundation (state, API client, shadcn base)
  - [x] 10.1 Implement the API client and shared utilities
    - Create `src/frontend/lib/api.ts` (fetch wrapper attaching `Bearer` token, JSON parsing, typed `UnauthorizedError`/`ValidationError`/`NotFoundError`/`ForbiddenError`) and `src/frontend/lib/utils.ts` (`cn`, `initials` re-export)
    - _Requirements: 7.14, 8.8, 9.5, 10.7, 12.7_

  - [x] 10.2 Generate the shadcn/ui base components
    - Generate Dialog, AlertDialog, DropdownMenu, Popover, Sonner, Button, Input, Textarea, Select, Badge, Avatar, ToggleGroup, and Sheet into `src/frontend/components/ui/`, themed exclusively via OKLCH variables
    - _Requirements: 14.2, 14.4, 14.5, 14.7_

  - [x] 10.3 Implement AuthContext and DataContext
    - Create `src/frontend/state/`: `AuthContext` (current User, Session_Token, login/logout calling the API and clearing state on 401) and `DataContext` (tasks/projects/notifications + UI state view/activeProject/layout/priorityFilter/search/sort) driven by `logic.ts`, with optimistic completion toggle that reverts on API failure
    - _Requirements: 7.12, 7.13, 7.14, 18.7_

- [x] 11. Implement the frontend components
  - [x] 11.1 Implement the Sidebar and mobile off-canvas behavior
    - Create `Sidebar` (`w-64`, logo/name/subtitle, Menu Views with live counts, Projetos list with color dots and counts, "Novo projeto", user footer) and the mobile Sheet overlay with slate-900/40 dim and click-to-close
    - _Requirements: 2.3, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

  - [x] 11.2 Implement the Header
    - Create `Header` (sticky `h-16`, View title/subtitle, search input, layout toggle, notifications bell with unread indicator, "Nova tarefa", mobile sidebar toggle)
    - _Requirements: 2.3, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9_

  - [x] 11.3 Implement the FilterBar
    - Create `FilterBar` (priority pills Todas/Alta/Média/Baixa, sort control cycling with label, "Limpar concluídas" triggering confirm or info-toast when none)
    - _Requirements: 5.1, 5.2, 5.3, 5.7, 5.10_

  - [x] 11.4 Implement the TaskCard with badges and due-date formatting
    - Create `TaskCard`, `PriorityBadge`, and `DateField`: completion toggle, title (strikethrough when done), priority chip, project dot/name (omitted when none), due-date badge from `formatDue`, description when present, hover-revealed edit/delete, optimistic toggle with success/error toasts
    - _Requirements: 2.8, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12, 7.13, 7.14_

  - [x] 11.5 Implement the list view, board view, and empty state
    - Create `TaskList` (single column, sorted), `BoardView` (three columns todo/doing/done with counts, done→Concluído, per-column empty placeholder), and `EmptyState` with icon, message, and "Nova tarefa" CTA
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 11.6 Implement the TaskDialog
    - Create `TaskDialog` (Dialog) for "Nova tarefa"/"Editar tarefa": title/description/due/priority/project fields, defaults and prefill, project preselect when active, title validation keeping dialog open, create/update via API with success toasts, dialog retention with retained values on API failure
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 11.7 Implement the ProjectDialog
    - Create `ProjectDialog` (Dialog): name input, seven-color picker with exactly one active swatch, name validation, create via API with trimmed name and active color, dialog retention on failure
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 11.8 Implement the NotificationsPanel
    - Create `NotificationsPanel` (Popover): toggle open/close closing other overlays, render notifications most-recent-first with relative time and read/unread indicator, empty state, "Marcar todas como lidas" via API updating indicators, error retains prior state
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 11.9 Implement the ConfirmDialog and Toaster
    - Create `ConfirmDialog` (AlertDialog) for task deletion and "Limpar concluídas" (title, message, cancel/confirm; cancel/overlay/Escape leaves data unchanged) and `Toaster` (Sonner) with success/info/error variants and 3.2s auto-dismiss plus manual dismiss
    - _Requirements: 1.6, 1.7, 1.10, 5.8, 5.9, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 11.10 Implement the UserMenu
    - Create `UserMenu` (DropdownMenu) with avatar initials, "Meu perfil", "Configurações", and "Sair" (logout)
    - _Requirements: 1.13, 3.6, 18.7_

  - [ ]* 11.11 Write component behavior tests
    - Dialog defaults/prefill/validation, toast variants, confirm-guard and cancel-leaves-unchanged, hover reveal, card content/conditional rendering, empty states, layout toggle, notifications open/close/empty
    - _Requirements: 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.10, 7.11, 7.13, 8.1, 8.2, 8.7, 9.1, 10.1, 10.2, 10.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 11.12 Write overlay layering regression tests
    - Assert a click reaches an underlying control while an overlay is hidden; Escape closes only the topmost overlay; click-outside closes panels; scroll keeps positions with nothing clipped
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [x] 12. Wire the application shell together
  - [x] 12.1 Compose `App.tsx` and `main.tsx`
    - Create `src/frontend/main.tsx` (React root) and `src/frontend/App.tsx` composing the shell (fixed `w-64` Sidebar, `lg:ml-64` column with sticky Header, FilterBar, main task area) inside AuthContext/DataContext, mounting all dialogs, panels, menus, and the Toaster, with a login gate
    - _Requirements: 2.3, 2.4, 12.4_

  - [ ]* 12.2 Write snapshot/visual-fidelity tests
    - Assert OKLCH variables exist and components reference variables (no literals), Inter font default, light theme active, priority→token mapping, fixed `w-64` sidebar, sticky `h-16` header, logo/name/subtitle, menu labels, and pt-BR copy including `formatDue` labels
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.8, 2.10, 3.1, 3.2, 14.2, 14.3, 20.6_

- [x] 13. Final checkpoint - full stack integrated
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements (granular sub-requirement clauses) for traceability.
- Property tests use `fast-check` under `bun:test`, one test per property, minimum 100 generated cases, tagged per the design's Testing Strategy.
- Properties 1–19 target the pure `logic.ts` module; Properties 20–22, 25, 26 run against an in-memory `bun:sqlite` database; Property 23 calls `Bun.password`; Property 24 tests the pure `attemptTracker`.
- Checkpoints provide incremental validation at the end of each major layer.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.1", "4.1", "5.2", "10.2"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5", "4.2", "5.1", "10.1"] },
    { "id": 3, "tasks": ["2.6", "2.7", "2.8", "2.9", "2.10", "2.11", "4.3", "4.4", "4.5", "5.3", "5.4", "5.5", "6.1", "10.3"] },
    { "id": 4, "tasks": ["2.12", "2.13", "2.14", "6.2", "6.3", "7.1"] },
    { "id": 5, "tasks": ["2.15", "2.16", "2.17", "2.18", "2.19", "2.20", "2.21", "7.2", "7.3", "7.4", "7.5"] },
    { "id": 6, "tasks": ["2.22", "2.23", "2.24", "7.6", "7.7", "9.1", "9.2"] },
    { "id": 7, "tasks": ["9.3", "9.4", "11.1", "11.2", "11.3", "11.4", "11.5", "11.6", "11.7", "11.8", "11.9", "11.10"] },
    { "id": 8, "tasks": ["11.11", "11.12", "12.1"] },
    { "id": 9, "tasks": ["12.2"] }
  ]
}
```
