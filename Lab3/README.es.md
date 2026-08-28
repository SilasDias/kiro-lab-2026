# TasKiro — Lab 2: Spec Driven Development

¡Bienvenido(a)! Este workspace contiene el proyecto **TasKiro**, una app full stack construida
con un ecosistema 100% Bun (React 19 + Tailwind v4 + shadcn/ui en el front-end, ElysiaJS
y `bun:sqlite` en el back-end).

El código de la aplicación está en la subcarpeta **`taskiro/`**. Las Specs (requirements, design
y tasks) que guiaron la construcción están en **`.kiro/specs/taskiro-fullstack-migration/`** y
se abren automáticamente en Kiro.

---

## Requisitos previos

- **Bun** instalado (versión reciente). Verifícalo con:

  ```powershell
  bun --version
  ```

  Si no tienes Bun, instálalo con (PowerShell):

  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```

  Si ya tienes Bun pero en una versión antigua, actualízalo:

  ```powershell
  bun upgrade
  ```

---

## Cómo levantar la aplicación

Todos los comandos a continuación se ejecutan **dentro de la subcarpeta `taskiro/`**, no en la raíz del workspace.

1. Entra en la subcarpeta de la app:

   ```powershell
   cd taskiro
   ```

2. Instala las dependencias (la carpeta `node_modules/` no acompaña al proyecto y se
   recrea aquí):

   ```powershell
   bun install
   ```

3. Inicia el servidor de desarrollo (con hot reload):

   ```powershell
   bun run dev
   ```

4. Ábrela en el navegador:

   ```
   http://localhost:3000
   ```

Para ejecutar en modo de producción, usa `bun run start` en lugar del paso 3.

---

## Credenciales de acceso (cuenta de demostración)

En la primera ejecución, la base de datos se rellena automáticamente con una cuenta de ejemplo.
Usa estas credenciales para iniciar sesión:

- **Correo electrónico:** `ana@taskiro.app`
- **Contraseña:** `taskiro123`

Esta cuenta viene con proyectos, tareas y notificaciones de ejemplo ya registrados.
La contraseña es solo para demostración y se almacena con hash (`Bun.password`), nunca
en texto plano.

---

## Base de datos

La app usa `bun:sqlite`. El archivo `taskiro.db` se crea automáticamente en la primera
ejecución y los datos de ejemplo se rellenan solos (seed). Los reinicios no duplican
datos. No es necesario configurar nada.

> El `JWT_SECRET` tiene un valor predeterminado de desarrollo, así que la aplicación arranca sin
> ninguna variable de entorno. En un escenario real de producción, define `JWT_SECRET`.

---

## Estructura del workspace

```
.
├── .kiro/                  # Specs de Kiro (requirements, design, tasks)
│   └── specs/taskiro-fullstack-migration/
├── README.md               # esta guía
└── taskiro/                # código de la aplicación (ejecuta los comandos aquí)
    ├── package.json
    ├── src/
    │   ├── backend/        # ElysiaJS + bun:sqlite
    │   └── frontend/       # React + Tailwind + shadcn/ui
    └── ...
```

---

## Comandos útiles (dentro de `taskiro/`)

| Comando         | Descripción                              |
| --------------- | ---------------------------------------- |
| `bun install`   | Instala las dependencias                 |
| `bun run dev`   | Servidor de desarrollo (hot reload)      |
| `bun run start` | Servidor en modo de producción           |
| `bun test`      | Ejecuta las pruebas                      |
