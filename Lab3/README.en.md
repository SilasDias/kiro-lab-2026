# TasKiro — Lab 2: Spec Driven Development

Welcome! This workspace contains the **TasKiro** project, a full-stack app built
with a 100% Bun ecosystem (React 19 + Tailwind v4 + shadcn/ui on the front-end, ElysiaJS
and `bun:sqlite` on the back-end).

The application code lives in the **`taskiro/`** subfolder. The Specs (requirements, design,
and tasks) that guided the build are in **`.kiro/specs/taskiro-fullstack-migration/`** and
open automatically in Kiro.

---

## Prerequisites

- **Bun** installed (recent version). Check with:

  ```powershell
  bun --version
  ```

  If you don't have Bun, install it with (PowerShell):

  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```

  If you already have Bun but on an older version, update it:

  ```powershell
  bun upgrade
  ```

---

## How to run the application

All the commands below run **inside the `taskiro/` subfolder**, not at the workspace root.

1. Enter the app subfolder:

   ```powershell
   cd taskiro
   ```

2. Install the dependencies (the `node_modules/` folder doesn't ship with the project and is
   recreated here):

   ```powershell
   bun install
   ```

3. Start the development server (with hot reload):

   ```powershell
   bun run dev
   ```

4. Open it in your browser:

   ```
   http://localhost:3100
   ```

To run in production mode, use `bun run start` instead of step 3.

---

## Login credentials (demo account)

On the first run, the database is automatically seeded with a sample account.
Use these credentials to log in:

- **Email:** `ana@taskiro.app`
- **Password:** `taskiro123`

This account comes with sample projects, tasks, and notifications already registered.
The password is for demonstration only and is stored hashed (`Bun.password`), never
in plain text.

---

## Database

The app uses `bun:sqlite`. The `taskiro.db` file is created automatically on the first
run and the sample data is seeded on its own. Restarts don't duplicate
data. There's nothing to configure.

> The `JWT_SECRET` has a default development value, so the application starts without
> any environment variables. In a real production scenario, set `JWT_SECRET`.

---

## Workspace structure

```
.
├── .kiro/                  # Kiro Specs (requirements, design, tasks)
│   └── specs/taskiro-fullstack-migration/
├── README.md               # this guide
└── taskiro/                # application code (run the commands here)
    ├── package.json
    ├── src/
    │   ├── backend/        # ElysiaJS + bun:sqlite
    │   └── frontend/       # React + Tailwind + shadcn/ui
    └── ...
```

---

## Useful commands (inside `taskiro/`)

| Command         | Description                              |
| --------------- | ---------------------------------------- |
| `bun install`   | Installs the dependencies                |
| `bun run dev`   | Development server (hot reload)          |
| `bun run start` | Server in production mode                |
| `bun test`      | Runs the tests                           |
