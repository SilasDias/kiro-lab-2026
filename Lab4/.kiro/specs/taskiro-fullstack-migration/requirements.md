# Requirements Document

## Introduction

TasKiro is an existing single-file front-end prototype (`index.html`) for task management, written in Portuguese (pt-BR). It uses Tailwind CSS via the Play CDN, Lucide icons via CDN, the Inter font, and an in-memory JavaScript state with seed data. All data is volatile, authentication is simulated, and there is no server.

This feature migrates the prototype into a production-ready full stack application **without changing the product**. The work is an architecture migration plus adoption of the shadcn/ui component library. The guiding principle is **preservation and fidelity**: the migrated application must look and behave like the same prototype, only with robust components and real persistence underneath.

The target stack is a 100% native Bun ecosystem: the Bun Fullstack Dev Server (HTML imports + `Bun.serve()`) serving a React + Tailwind CSS v4 + shadcn/ui front end, an ElysiaJS REST API, and native `bun:sqlite` persistence. CDN dependencies are removed. Simulated login is replaced with real backend authentication and per-user data scoping.

This document inventories every existing feature, screen, and behavior, then specifies the migration, data modeling, authentication, CDN exit, interactivity/layering correctness, and environment conventions as testable EARS requirements.

### Reference Powers (for design/implementation phases)

- **Context7**: source for up-to-date Bun documentation (Fullstack Dev Server, HTML imports, `bun-plugin-tailwind`, `bun:sqlite`, `Bun.password`), ElysiaJS docs, and shadcn/ui docs.
- **design-system-scaffold**: source of truth for shadcn configuration (`shadcn.md`), theme and Tailwind v4 guidance (`technical-guidelines.md`), and per-component specifications.

## Glossary

- **TasKiro**: The task management application being migrated.
- **Prototype**: The existing single-file `index.html` implementation and all of its current behavior, treated as the authoritative specification of product behavior.
- **System**: The migrated full stack TasKiro application as a whole.
- **Frontend**: The React + Tailwind v4 + shadcn/ui client application served by the Bun Fullstack Dev Server.
- **Backend**: The ElysiaJS REST API process.
- **API**: The REST interface exposed by the Backend.
- **Bun_Server**: The Bun Fullstack Dev Server process using HTML imports and `Bun.serve()`.
- **Database**: The `bun:sqlite` database storing persistent application data.
- **Auth_Service**: The Backend component responsible for credential verification, password hashing, and session/token issuance and validation.
- **Session_Token**: The credential (e.g., JWT) issued on successful authentication and presented on subsequent API requests.
- **User**: An authenticated account that owns tasks, projects, and notifications.
- **Task**: A work item with id, title, description, due date, priority, project association, status, and done flag.
- **Project**: A named grouping of tasks with an associated color.
- **Notification**: A message item with text, relative time, and read state.
- **View**: One of the task filters in the sidebar Menu: `all` (Todas as tarefas), `today` (Hoje), `upcoming` (Próximas), `completed` (Concluídas).
- **Layout**: The display mode of the task area: `list` (List view) or `board` (Kanban view).
- **Priority**: A task priority level: `high` (Alta), `medium` (Média), or `low` (Baixa).
- **Status**: A task workflow column value: `todo` (A fazer), `doing` (Em progresso), or `done` (Concluído).
- **Visual_Fidelity**: The property that the migrated UI reproduces the Prototype's visual identity (colors, layout, spacing, typography, arrangement, iconography) such that it is recognizably the same application.
- **Overlay_Component**: A shadcn/ui layered UI element such as Dialog, Dropdown Menu, Popover, or Toast/Sonner.
- **Brand_Palette**: The indigo color scale (50–900) with primary `#4f46e5`/`#6366f1` used by the Prototype.

---

## Requirements

### Requirement 1: Prototype Feature Inventory and Preservation

**User Story:** As a product owner, I want every existing prototype feature preserved during migration, so that the migrated application delivers the same product without regressions or scope changes.

#### Acceptance Criteria

1. THE System SHALL provide the four sidebar Views present in the Prototype, where `all` includes every Task, `today` includes incomplete Tasks whose due date is the current date, `upcoming` includes incomplete Tasks whose due date is after the current date, and `completed` includes done Tasks.
2. THE System SHALL provide both the `list` Layout and the `board` Layout, where the `board` Layout presents the three columns `todo`, `doing`, and `done`.
3. THE System SHALL provide Priority filtering with the values `all`, `high`, `medium`, and `low`.
4. WHEN a User activates the sort control, THE System SHALL advance the active sort mode in the fixed cycle due date (ascending), Priority (`high` then `medium` then `low`), title (ascending, case-insensitive), and back to due date.
5. WHEN a User enters a non-empty search query, THE System SHALL filter Tasks to those whose title or description contains the query as a case-insensitive substring, and WHEN the query is empty or whitespace-only THE System SHALL apply no search filter.
6. WHEN a User activates "Limpar concluídas" AND at least one completed Task exists, THE System SHALL request confirmation and, on confirmation, remove all completed Tasks.
7. WHEN a User activates "Limpar concluídas" AND no completed Task exists, THE System SHALL make no changes and display an informational message.
8. THE System SHALL provide task creation, task editing, task deletion, and task completion toggling.
9. IF a User attempts to create or edit a Task with an empty title, THEN THE System SHALL prevent the operation.
10. WHEN a User activates task deletion, THE System SHALL request confirmation before removing the Task.
11. THE System SHALL provide project creation with a name and a color selection.
12. THE System SHALL provide the notifications panel with a "Marcar todas como lidas" action.
13. THE System SHALL provide the user menu with "Meu perfil", "Configurações", and "Sair" actions.
14. WHERE a behavior exists in the Prototype, THE System SHALL preserve that behavior unless a documented technical justification tied to the migration requires a change.
15. THE System SHALL NOT introduce product features that are absent from the Prototype. (Negative statement retained because scope limitation is the requirement.)

### Requirement 2: Visual Fidelity to the Prototype

**User Story:** As a returning user, I want the migrated interface to look like the original prototype, so that the application is recognizably the same after migration.

#### Acceptance Criteria

1. THE Frontend SHALL reproduce the Prototype's Brand_Palette (indigo scale 50–900 with primary `#4f46e5` and `#6366f1`), slate neutrals, and rose, amber, and emerald accent colors.
2. THE Frontend SHALL use the font family stack Inter, ui-sans-serif, system-ui, sans-serif as the default sans-serif typeface, matching the Prototype.
3. THE Frontend SHALL reproduce the Prototype's layout structure: a fixed left sidebar of width 16rem (w-64), a top header of height 4rem (h-16), a filter bar, and a main content area.
4. WHILE the main content area is scrolled, THE Frontend SHALL keep the header fixed at the top of the viewport, matching the Prototype.
5. WHILE the viewport width is below 1024px, THE Frontend SHALL position the sidebar off-canvas (translated 100% to the left and not visible) until it is opened.
6. WHEN the sidebar is opened while the viewport width is below 1024px, THE Frontend SHALL display the sidebar over the content with a dimmed overlay of slate-900 at 40% opacity.
7. WHEN a User taps the dimmed overlay while the mobile sidebar is open, THE Frontend SHALL close the sidebar.
8. THE Frontend SHALL reproduce the Prototype's Priority color coding: `high` in rose, `medium` in amber, and `low` in emerald.
9. THE Frontend SHALL reproduce the Prototype's iconography, rendering at each icon location the corresponding `lucide-react` icon used by the Prototype.
10. WHEN the Frontend loads, THE Frontend SHALL apply the light theme as the active theme so that Visual_Fidelity is preserved.
11. WHERE a dark theme is provided as an optional addition, THE Frontend SHALL keep light as the default and SHALL NOT alter any color, typography, or layout value defined in criteria 1 through 9. (Negative clause retained to bound the optional feature.)

### Requirement 3: Sidebar Navigation, Counts, and Branding

**User Story:** As a user, I want the sidebar to show navigation, projects, live counts, and my account, so that I can move through the application as in the prototype.

#### Acceptance Criteria

1. THE Frontend SHALL display, in the sidebar header, the TasKiro logo image sourced from `https://kiro.dev/images/community/events/thumbnails/meetup2.svg`, the product name "TasKiro", and the subtitle "Gerenciador de tarefas".
2. THE Frontend SHALL display the Menu section containing the four Views labeled "Todas as tarefas" (`all`), "Hoje" (`today`), "Próximas" (`upcoming`), and "Concluídas" (`completed`).
3. WHEN the set of Tasks changes, THE Frontend SHALL update each View's live count to reflect the current counts, where `all` equals the total number of Tasks, `today` equals the number of incomplete Tasks whose due date is the current date, `upcoming` equals the number of incomplete Tasks whose due date is after the current date, and `completed` equals the number of done Tasks.
4. THE Frontend SHALL display the Projetos section listing each Project with its color dot, its name, and a count equal to the number of Tasks associated with that Project.
5. THE Frontend SHALL display a "Novo projeto" button in the Projetos section.
6. THE Frontend SHALL display a user footer containing the User avatar showing the initials derived from the User display name, the User display name, the User email, and a chevron indicator.
7. WHEN a User selects a View or a Project, THE Frontend SHALL apply the Prototype's active-state styling to exactly the selected item and SHALL remove the active-state styling from all other Views and Projects.
8. WHILE the viewport width is below 1024px AND a User selects a View or a Project, THE Frontend SHALL close the mobile sidebar.

### Requirement 4: Header Controls

**User Story:** As a user, I want the header controls present in the prototype, so that I can search, switch layouts, view notifications, and create tasks.

#### Acceptance Criteria

1. THE Frontend SHALL display the current View title and subtitle in the header.
2. WHEN the active View or Project changes, THE Frontend SHALL update the header title and subtitle to match the new active View or Project.
3. WHEN a User types in the search input, THE Frontend SHALL filter the displayed Tasks to those whose title or description contains the query as a case-insensitive substring.
4. WHEN the search input is empty, THE Frontend SHALL display all Tasks permitted by the other active filters.
5. WHEN a User activates the Layout toggle, THE Frontend SHALL switch the Layout between `list` and `board` and indicate the active Layout.
6. WHILE at least one Notification is unread, THE Frontend SHALL display the unread indicator on the notifications bell.
7. WHILE all Notifications are read, THE Frontend SHALL hide the unread indicator on the notifications bell.
8. WHEN a User activates the "Nova tarefa" button, THE Frontend SHALL open the task creation dialog.
9. WHILE the viewport width is below 1024px, THE Frontend SHALL display a sidebar toggle control in the header.

### Requirement 5: Filter Bar

**User Story:** As a user, I want the filter bar from the prototype, so that I can filter by priority, change sorting, and clear completed tasks.

#### Acceptance Criteria

1. THE Frontend SHALL display Priority filter controls labeled "Todas", "Alta", "Média", and "Baixa".
2. WHEN a User selects a Priority filter, THE Frontend SHALL within 200 milliseconds display only Tasks matching the selected Priority, and SHALL display all Tasks when "Todas" is selected.
3. WHEN a User activates the sort control, THE Frontend SHALL advance to the next sort mode in the order due date, Priority, title, and back to due date, and SHALL update the sort label.
4. WHEN the sort mode is by due date, THE Frontend SHALL order Tasks in ascending due-date order and SHALL place Tasks without a due date last.
5. WHEN the sort mode is by Priority, THE Frontend SHALL order Tasks `high` then `medium` then `low`, preserving the prior relative order among Tasks of equal Priority.
6. WHEN the sort mode is by title, THE Frontend SHALL order Tasks by title in ascending, case-insensitive order.
7. WHEN a User activates "Limpar concluídas" AND at least one completed Task exists, THE Frontend SHALL present a confirmation dialog before removing any Task.
8. WHEN a User confirms the "Limpar concluídas" confirmation, THE Frontend SHALL remove all completed Tasks.
9. WHEN a User cancels the "Limpar concluídas" confirmation, THE Frontend SHALL close the dialog and SHALL make no changes.
10. IF a User activates "Limpar concluídas" AND no completed Task exists, THEN THE Frontend SHALL display an informational message and SHALL make no changes.

### Requirement 6: Task List and Board Views

**User Story:** As a user, I want both the list and kanban board views, so that I can view tasks the same way as in the prototype.

#### Acceptance Criteria

1. WHILE the Layout is `list`, THE Frontend SHALL render the filtered set of Tasks as task cards in a single column, ordered according to the active sort mode.
2. WHILE the Layout is `board`, THE Frontend SHALL render exactly three columns labeled "A fazer" (`todo`), "Em progresso" (`doing`), and "Concluído" (`done`), each showing a count equal to the number of filtered Tasks placed in that column.
3. WHILE the Layout is `board`, THE Frontend SHALL place every Task whose done flag is true in the "Concluído" column and SHALL place each Task whose done flag is false in the column matching its Status value.
4. IF the filtered set of Tasks is empty, THEN THE Frontend SHALL hide both the list and board views and display the empty state with an icon, a message indicating that no Tasks match the current filters, and a "Nova tarefa" call-to-action that opens the task creation dialog.
5. WHILE the Layout is `board` AND a column contains no filtered Tasks, THE Frontend SHALL display an empty placeholder within that column.

### Requirement 7: Task Card Presentation

**User Story:** As a user, I want task cards to show the same information and controls as the prototype, so that I can read and act on tasks identically.

#### Acceptance Criteria

1. THE Frontend SHALL display on each task card a circular completion toggle, the Task title, a Priority chip, the Project dot and name, and a due-date badge.
2. WHERE a Task has a non-empty description, THE Frontend SHALL display the Task description on the task card.
3. WHERE a Task has no associated Project, THE Frontend SHALL omit the Project dot and name from the task card.
4. WHILE a Task is done, THE Frontend SHALL render the Task title with strikethrough styling.
5. IF the due date is earlier than the current date, THEN THE Frontend SHALL format the due-date badge as "Atrasada" followed by the count of whole overdue days (current date minus due date, in days).
6. IF the due date equals the current date, THEN THE Frontend SHALL format the due-date badge as "Hoje".
7. IF the due date equals the current date plus one day, THEN THE Frontend SHALL format the due-date badge as "Amanhã".
8. IF the due date is later than the current date plus one day, THEN THE Frontend SHALL format the due-date badge as the localized (pt-BR) day-and-month of the due date.
9. IF no due date is set, THEN THE Frontend SHALL format the due-date badge as "Sem prazo".
10. THE Frontend SHALL keep the edit and delete controls hidden by default on each task card.
11. WHEN a User hovers the pointer over a task card, THE Frontend SHALL reveal the edit and delete controls for that Task within 200 milliseconds.
12. WHEN a User activates the completion toggle on a Task, THE Frontend SHALL toggle the Task done state, set Status to `done` when marking done and `todo` when reopening, and persist the change via the API.
13. WHEN the API confirms the persisted completion change, THE Frontend SHALL display a confirmation message indicating the Task state was updated.
14. IF the API request to persist the completion change fails, THEN THE Frontend SHALL revert the Task done state and Status to their values before the toggle and display an error message indicating the update did not save.

### Requirement 8: Task Creation and Editing Dialog

**User Story:** As a user, I want to create and edit tasks in a dialog, so that I can manage task details as in the prototype.

#### Acceptance Criteria

1. WHEN a User activates "Nova tarefa", THE Frontend SHALL open a task dialog titled "Nova tarefa" with empty title and description, no due date, the Priority defaulted to "Média", and no Project preselected unless a Project is active.
2. WHEN a User activates edit on a Task, THE Frontend SHALL open a task dialog titled "Editar tarefa" pre-filled with the Task title, description, due date, Priority, and Project, leaving the Project selection empty where the Task has no associated Project.
3. THE task dialog SHALL provide a title input (1 to 200 characters), a description input (0 to 2,000 characters), a due-date input, a Priority selection offering "Alta", "Média", and "Baixa", and a Project selection offering each Project plus a no-Project option.
4. IF a User submits the task dialog with a title that is empty or whitespace-only, THEN THE Frontend SHALL keep the dialog open, indicate the validation error on the title field, and SHALL NOT create or update a Task. (Negative clause retained for validation.)
5. WHEN a User submits the task dialog for a new Task with a non-empty title, THE Frontend SHALL create the Task via the API with Status `todo` and done set to false, and on success SHALL close the dialog and display a success-variant creation confirmation message.
6. WHEN a User submits the task dialog for an existing Task with a non-empty title, THE Frontend SHALL update the Task via the API and on success SHALL close the dialog and display a success-variant update confirmation message.
7. WHEN a new task dialog is opened while a Project is active, THE Frontend SHALL preselect that Project in the Project selection.
8. IF the API request to create or update a Task fails, THEN THE Frontend SHALL keep the dialog open, retain the entered values, and display an error message indicating the Task was not saved.

### Requirement 9: Project Creation Dialog

**User Story:** As a user, I want to create projects with a name and color, so that I can organize tasks as in the prototype.

#### Acceptance Criteria

1. WHEN a User activates "Novo projeto", THE Frontend SHALL open a project dialog with an empty name input and a color picker offering the seven Prototype colors with exactly one color preselected as active.
2. WHEN a User selects a color swatch, THE Frontend SHALL mark exactly that swatch as active and clear the active indication from all other swatches.
3. IF a User submits the project dialog with a name that is empty or whitespace-only, THEN THE Frontend SHALL keep the dialog open and SHALL NOT create a Project. (Negative clause retained for validation.)
4. WHEN a User submits the project dialog with a non-empty name (1 to 100 characters after trimming), THE Frontend SHALL create the Project via the API using the trimmed name and the active color, and on success SHALL close the dialog and display a creation confirmation message.
5. IF the API request to create a Project fails, THEN THE Frontend SHALL keep the dialog open, retain the entered values, and display an error message indicating the Project was not created.

### Requirement 10: Notifications Panel

**User Story:** As a user, I want a notifications panel, so that I can read notifications and mark them read as in the prototype.

#### Acceptance Criteria

1. WHEN a User activates the notifications bell AND the notifications panel is closed, THE Frontend SHALL open the notifications panel and SHALL close every other open Overlay_Component within 300 milliseconds.
2. WHEN a User activates the notifications bell AND the notifications panel is open, THE Frontend SHALL close the notifications panel within 300 milliseconds.
3. WHILE the notifications panel is open AND the User has at least one Notification, THE Frontend SHALL display each Notification with its text, its relative time elapsed since the Notification timestamp, and a visual indicator distinguishing read from unread state, ordered from most recent to least recent.
4. WHILE the notifications panel is open AND the User has zero Notifications, THE Frontend SHALL display an empty-state message indicating that there are no notifications.
5. WHEN a User activates "Marcar todas como lidas", THE Frontend SHALL send a request to the API to mark every Notification of the User as read.
6. WHEN the API confirms that every Notification of the User is marked as read, THE Frontend SHALL update each Notification in the panel to the read indicator and SHALL clear the unread indicator on the bell.
7. IF the request to mark every Notification as read fails, THEN THE Frontend SHALL retain the prior read/unread state of each Notification and SHALL display an error message indicating that the notifications could not be updated.

### Requirement 11: Confirmation Dialog and Toast Notifications

**User Story:** As a user, I want confirmation prompts and transient toasts, so that destructive actions are guarded and outcomes are communicated as in the prototype.

#### Acceptance Criteria

1. WHEN a User initiates task deletion or "Limpar concluídas" while at least one matching task exists, THE Frontend SHALL present a confirmation dialog containing a title, a descriptive message, a cancel control, and a confirm control before performing the action.
2. WHEN a User activates the confirm control of a guarded action, THE Frontend SHALL perform the action and SHALL close the confirmation dialog.
3. WHEN a User cancels a guarded action via the cancel control, the overlay, or the Escape key, THE Frontend SHALL close the confirmation dialog and SHALL leave all task and project data unchanged.
4. WHEN an action completes, THE Frontend SHALL display a toast in the variant matching the Prototype for that action: success for create, update, and "Limpar concluídas" completion; info for reopen, sort change, and informational actions; error for task deletion.
5. WHEN a User initiates "Limpar concluídas" while no completed task exists, THE Frontend SHALL display an info-variant toast indicating there are no completed tasks and SHALL NOT present a confirmation dialog.
6. WHEN a toast is displayed, THE Frontend SHALL auto-dismiss the toast 3.2 seconds (3200 ms) after it appears and SHALL provide a manual dismiss control that removes the toast immediately when activated before auto-dismissal.

### Requirement 12: Interactivity and Overlay Layering Correctness

**User Story:** As a user, I want every control to perform a real action and overlays to layer correctly, so that there are no dead buttons or click interception bugs.

#### Acceptance Criteria

1. WHEN a User activates any interactive control in the Frontend, THE Frontend SHALL perform a defined action for that control and provide an observable visual response (state change, navigation, or overlay open/close) within 200 milliseconds. (No dead controls.)
2. THE Frontend SHALL implement dialogs, menus, and toasts using shadcn/ui Overlay_Components that manage pointer events and focus.
3. WHILE an Overlay_Component is hidden, THE Frontend SHALL prevent that component from intercepting pointer events on underlying controls, such that pointer events activate the underlying control directly.
4. WHILE the main content area is scrolled, THE Frontend SHALL keep the sidebar, header, and any open menus and panels at the same viewport positions shown in the Prototype, with no portion clipped or hidden behind other elements.
5. WHEN a User clicks outside an open menu or panel, THE Frontend SHALL close that menu or panel within 200 milliseconds.
6. WHEN a User presses the Escape key, THE Frontend SHALL close the topmost open dialog, menu, or panel within 200 milliseconds, leaving any lower-layered overlays open.
7. IF an interactive control's action fails to complete, THEN THE Frontend SHALL display an error indication to the User and retain the prior interface state without partial changes.

### Requirement 13: Bun Fullstack Server Architecture

**User Story:** As an engineer, I want the application served by the native Bun fullstack server, so that the front end and API run in a single Bun-native runtime without Node.js, Vite, or Webpack.

#### Acceptance Criteria

1. WHEN the Bun_Server receives a request for the Frontend, THE Bun_Server SHALL serve the Frontend using HTML imports and `Bun.serve()`, with Bun transpiling and bundling the imported `.tsx` modules, and SHALL return the served response within 2000 milliseconds.
2. THE System SHALL run on the Bun runtime and SHALL NOT depend on Node.js, Vite, or Webpack for development or build, such that no Node.js, Vite, or Webpack package appears in the runtime or build dependency set. (Negative statement retained because exclusion of these tools is the requirement.)
3. IF Bun fails to transpile or bundle an imported `.tsx` module, THEN THE Bun_Server SHALL return an error response indicating the bundling failure and SHALL NOT serve a partially bundled Frontend.
4. WHEN the Bun_Server receives an API request, THE Bun_Server SHALL route the request to the Backend and return the Backend response to the caller.
5. IF the Backend is unavailable or does not respond within 5000 milliseconds when routing an API request, THEN THE Bun_Server SHALL return an error response indicating the Backend is unreachable.
6. THE System SHALL compile Tailwind CSS using `bun-plugin-tailwind` configured in `bunfig.toml`.

### Requirement 14: Front-End Component Stack with shadcn/ui

**User Story:** As an engineer, I want the UI rebuilt with React and shadcn/ui, so that the prototype's appearance is reproduced with robust, maintainable components.

#### Acceptance Criteria

1. THE Frontend SHALL be implemented with React and Tailwind CSS v4.
2. THE Frontend SHALL use shadcn/ui configured with style "new-york", base color "neutral", and CSS variables enabled.
3. THE Frontend SHALL define all theme colors using CSS variables expressed in the OKLCH color space, with no hard-coded color literals outside the CSS variable definitions.
4. THE Frontend SHALL render all icons using the `lucide-react` library.
5. WHERE a Prototype UI element maps to an available shadcn/ui component, THE Frontend SHALL implement that element using the shadcn/ui component while preserving Visual_Fidelity.
6. IF a Prototype UI element does not map to any available shadcn/ui component, THEN THE Frontend SHALL implement that element as a custom component built with React and Tailwind CSS v4 while preserving Visual_Fidelity.
7. WHERE a shadcn/ui component is used, THE Frontend SHALL apply theme styling exclusively through the OKLCH CSS variables defined in criterion 3 rather than per-component color overrides.

### Requirement 15: Exit CDN Mode

**User Story:** As an engineer, I want all CDN dependencies removed, so that the application has no runtime reliance on external CDNs for styling or icons.

#### Acceptance Criteria

1. THE Frontend HTML document SHALL NOT contain any `<script>` element whose source URL references the Tailwind Play CDN. (Negative statement retained because removal is the requirement.)
2. THE Frontend HTML document SHALL NOT contain any `<script>` element whose source URL references the Lucide CDN. (Negative statement retained because removal is the requirement.)
3. THE Frontend SHALL load all Tailwind styles from the local Bun-compiled Tailwind build output rather than from any external CDN URL.
4. THE Frontend SHALL import all icons from the locally installed `lucide-react` package rather than from any external CDN URL.
5. WHEN the application is loaded in a browser, THE Frontend SHALL issue zero outbound network requests to external CDN domains for styling or icon assets.
6. IF a required Tailwind style asset or `lucide-react` icon module fails to load locally, THEN THE Frontend SHALL NOT fall back to any external CDN source and SHALL surface a load-failure indication to the caller.

### Requirement 16: REST API with ElysiaJS

**User Story:** As an engineer, I want a REST API built with ElysiaJS, so that the front end persists and retrieves data over HTTP.

#### Acceptance Criteria

1. THE Backend SHALL be implemented with ElysiaJS and SHALL expose REST endpoints for Tasks, Projects, Notifications, and authentication.
2. WHEN the API receives an authenticated request to create, read, update, or delete a Task owned by the authenticated User, THE API SHALL perform the requested operation and return a JSON response, returning HTTP 201 for a successful create and HTTP 200 for a successful read, update, or delete.
3. WHEN the API receives an authenticated request to create or read a Project owned by the authenticated User, THE API SHALL perform the requested operation and return a JSON response, returning HTTP 201 for a successful create and HTTP 200 for a successful read.
4. WHEN the API receives an authenticated request to read Notifications or to mark all Notifications read for the authenticated User, THE API SHALL perform the requested operation and return HTTP 200 with a JSON response.
5. WHEN the API receives a well-formed request, THE API SHALL return a JSON response within 2 seconds with an HTTP status code in the 2xx range for a successful outcome.
6. IF the API receives a request for a resource that does not exist, THEN THE API SHALL return an HTTP 404 status with a JSON error body indicating that the requested resource was not found, and SHALL NOT modify stored data.
7. IF the API receives a request whose body is not valid JSON or fails field validation, THEN THE API SHALL return an HTTP 400 status with a JSON error body indicating which validation constraint was violated, and SHALL NOT modify stored data.
8. IF the API receives a request that lacks valid authentication credentials, THEN THE API SHALL return an HTTP 401 status with a JSON error body indicating that authentication is required, and SHALL NOT modify stored data.

### Requirement 17: Persistence with bun:sqlite and Data Modeling

**User Story:** As an engineer, I want data stored in a Bun-native SQLite database, so that tasks, projects, notifications, and users persist across restarts without an external database.

#### Acceptance Criteria

1. THE Database SHALL be implemented with `bun:sqlite` and SHALL NOT require any external database service or network connection to operate. (Negative statement retained because the no-external-dependency constraint is the requirement.)
2. THE Database SHALL define a Task schema with fields for id (unique, non-null identifier), title (non-empty string, 1 to 200 characters), description (string, 0 to 2,000 characters), due date (stored as a date value that, on retrieval, equals the value written), Priority (one value from a finite enumerated set of Priority values), Project association (id reference to an existing Project), Status (one value from a finite enumerated set of Status values), done flag (boolean), and owning User (id reference to an existing User).
3. THE Database SHALL define a Project schema with fields for id (unique, non-null identifier), name (non-empty string, 1 to 100 characters), color (string color value), and owning User (id reference to an existing User).
4. THE Database SHALL define a Notification schema with fields for id (unique, non-null identifier), text (non-empty string, 1 to 1,000 characters), time (stored as a date value that, on retrieval, equals the value written), read flag (boolean), and owning User (id reference to an existing User).
5. THE Database SHALL define a User schema with fields for id (unique, non-null identifier), display name (non-empty string, 1 to 100 characters), email (string conforming to the format local-part@domain), and hashed password (non-empty string).
6. THE Database SHALL store the User password only as a hashed value and SHALL NOT store the password in plaintext. (Negative clause retained for security.)
7. IF an attempt is made to persist a Task, Project, or Notification whose owning User id or Project association does not reference an existing record, THEN THE Database SHALL reject the write, retain the prior stored state unchanged, and return a result indicating a referential validation failure.
8. WHEN the Backend persists a write through the API, THE Database SHALL retain the change such that the same value is retrievable after a Backend restart.
9. IF a persistence write fails, THEN THE Database SHALL leave the affected records in their pre-write state and return a result indicating the write failed.
10. WHEN the Database is first initialized and contains no seeded data, THE System SHALL seed the Prototype's sample data (the three Projects, seven Tasks, three Notifications, and the user "Ana Silva") associated with the seeded User.
11. IF the Database is initialized and the seed data already exists, THEN THE System SHALL NOT create duplicate seed records.

### Requirement 18: Real Authentication and Session Management

**User Story:** As a user, I want real login with secure credentials, so that my account is protected rather than simulated.

#### Acceptance Criteria

1. WHEN a User registers or is seeded with a password, THE Auth_Service SHALL store only a hashed password using `Bun.password` (or an equivalent bcrypt/argon2 algorithm) and SHALL NOT store the plaintext password in any field, log, or persistent store. (Negative clause retained for security.)
2. WHEN a User submits credentials that match a known account email and whose password verifies against the stored hash, THE Auth_Service SHALL issue a Session_Token that expires 3600 seconds after issuance.
3. IF a User submits credentials for an unknown account or whose password fails hash verification, THEN THE Auth_Service SHALL reject the request with an HTTP 401 status, SHALL NOT issue a Session_Token, and SHALL NOT disclose which credential field was incorrect. (Negative clause retained for security.)
4. IF a User submits invalid credentials 5 times within a 300-second window, THEN THE Auth_Service SHALL reject further attempts for that account with an HTTP 429 status for 900 seconds.
5. WHEN the API receives a request carrying a Session_Token that is well-formed, was issued by the Auth_Service, and has not expired, THE Backend SHALL identify the requesting User from the Session_Token.
6. IF the API receives a request to a protected endpoint with a missing, malformed, or expired Session_Token, THEN THE Backend SHALL reject the request with an HTTP 401 status.
7. WHEN a User activates "Sair", THE Frontend SHALL end the authenticated session such that subsequent requests to protected endpoints with the prior Session_Token are rejected with an HTTP 401 status.

### Requirement 19: Per-User Data Scoping

**User Story:** As a user, I want my data isolated from other users, so that the application is safe for multi-instance deployment where isolation cannot rely on the browser.

#### Acceptance Criteria

1. WHEN the API returns a collection of Tasks, Projects, or Notifications, THE Backend SHALL return only the records whose owner is the authenticated User and SHALL exclude every record owned by any other User.
2. WHEN the authenticated User has no owned records of the requested type, THE Backend SHALL return an empty collection rather than records belonging to other Users.
3. WHEN the API creates a Task, Project, or Notification, THE Backend SHALL associate the new record with the authenticated User as its owner, and SHALL ignore any owner value supplied in the request.
4. IF a request to update a record attempts to change the record's owner to a User other than the current owner, THEN THE Backend SHALL reject the request and SHALL leave the record's owner unchanged.
5. IF an authenticated User requests, updates, or deletes a record owned by another User, THEN THE Backend SHALL reject the request with an HTTP 403 or HTTP 404 status, SHALL NOT include the target record's data in the response, and SHALL leave the target record unchanged. (Negative clause retained for isolation.)
6. IF a request to read, create, update, or delete a Task, Project, or Notification is not associated with an authenticated User, THEN THE Backend SHALL reject the request and SHALL NOT return or modify any record.
7. THE Backend SHALL enforce per-User data scoping independently of any browser-side state so that data isolation holds identically across all Backend instances serving the same data store.

### Requirement 20: Environment and Tooling Conventions

**User Story:** As an engineer, I want consistent environment conventions, so that the project builds, runs, and is testable on the target platform.

#### Acceptance Criteria

1. THE Frontend SHALL render all user-interface icons using `lucide-react` icon components.
2. THE Frontend SHALL NOT use emoji characters as user-interface icons. (Negative statement retained because the no-emoji convention is the requirement.)
3. THE Frontend SHALL reference the logo image using the absolute URL `https://kiro.dev/images/community/events/thumbnails/meetup2.svg`.
4. WHERE the System runs on Windows with PowerShell, THE System SHALL perform API JSON response validation using `Invoke-RestMethod`.
5. WHERE the System runs on Windows with PowerShell, THE System SHALL perform HTTP status code checks using `Invoke-WebRequest -UseBasicParsing`.
6. THE Frontend SHALL display all user-facing text in Portuguese (pt-BR), matching the text content of the Prototype without translation or alteration.
