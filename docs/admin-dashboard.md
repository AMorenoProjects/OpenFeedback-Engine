# Admin Dashboard

> Documentación técnica del panel administrativo para dueños de proyectos.
> Aplicación: `apps/web-dashboard` — Next.js 15 (App Router), puerto `3100`.

---

## 1. Vista General

El Admin Dashboard permite a los dueños de proyectos gestionar sus configuraciones y moderar el feedback de los usuarios finales. Es una aplicación independiente del SDK público — no comparte autenticación con los usuarios que votan.

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN DASHBOARD                          │
│                     (Next.js App Router)                      │
│                                                              │
│  Browser                        Server (Server Actions)      │
│  ┌──────────────────────┐      ┌──────────────────────────┐  │
│  │ Login (Supabase Auth)│      │ createProject()          │  │
│  │ Project list         │      │   → service role client  │  │
│  │ Project detail       │      │   → crypto.randomBytes   │  │
│  │ Moderation panel     │      │ updateSuggestionStatus() │  │
│  │                      │      │   → authenticated client │  │
│  │ supabase browser     │      │   → RLS verifica acceso  │  │
│  │ client (auth only)   │      │                          │  │
│  └──────────┬───────────┘      └────────────┬─────────────┘  │
└─────────────┼───────────────────────────────┼────────────────┘
              │                               │
              │  Supabase Auth                │  Supabase
              │  (email/password)             │  (anon key + RLS)
              │                               │  (service role para writes)
              ▼                               ▼
        ┌─────────────────────────────────────────┐
        │              Supabase                    │
        │                                          │
        │  auth.users    project_members           │
        │  (identidad)   (membresía + rol)         │
        │                                          │
        │  projects      suggestions    votes      │
        │  (RLS scoped)  (RLS scoped)  (read-only) │
        └──────────────────────────────────────────┘
```

---

## 2. Autenticación

El dashboard usa **Supabase Auth** con email y contraseña. Este sistema es completamente independiente del Signed Stateless Auth que usan los usuarios finales del SDK.

### Flujo de login

```
Browser                    Middleware                   Supabase Auth
  │                           │                              │
  │  GET /projects            │                              │
  │──────────────────────────▶│                              │
  │                           │  getUser() → null            │
  │                           │──────────────────────────────▶│
  │                           │◀─ no session ────────────────│
  │  302 → /login             │                              │
  │◀──────────────────────────│                              │
  │                           │                              │
  │  signInWithPassword()     │                              │
  │──────────────────────────────────────────────────────────▶│
  │◀─ session cookie ────────────────────────────────────────│
  │                           │                              │
  │  GET /projects            │                              │
  │──────────────────────────▶│                              │
  │                           │  getUser() → user ✓          │
  │                           │──────────────────────────────▶│
  │  200 (page rendered)      │                              │
  │◀──────────────────────────│                              │
```

### Middleware

`src/middleware.ts` protege todas las rutas excepto `/login`, `/auth/*` y assets estáticos de Next.js. En cada request:

1. Refresca la sesión de Supabase (cookies)
2. Llama a `getUser()` para verificar autenticación
3. Redirige a `/login` si no hay sesión válida

**Matcher:** `/((?!_next/static|_next/image|favicon.ico|login|auth).*)`

### Diferencia con el auth del SDK

| Aspecto | SDK (usuarios finales) | Dashboard (admins) |
|---|---|---|
| Mecanismo | HMAC-SHA256 por request | Supabase Auth (sesión cookie) |
| Identidad | `user_hash` (pseudónimo) | `auth.users.id` (UUID real) |
| Almacenamiento | Sin estado (stateless) | Cookie de sesión |
| Tabla asociada | `votes`, `pseudonymous_vault` | `project_members` |

---

## 3. Modelo de Autorización

### Tabla `project_members`

Migración: `supabase/migrations/20260219_project_members.sql`

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `user_id` | `uuid` | FK → `auth.users(id)` ON DELETE CASCADE | |
| `role` | `text` | NOT NULL, default `'owner'`, CHECK enum | `owner`, `admin`, `viewer` |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `uq_project_member (project_id, user_id)` — un usuario no puede tener roles duplicados en el mismo proyecto.

### Roles y permisos

| Permiso | `owner` | `admin` | `viewer` |
|---|---|---|---|
| Ver proyecto y `hmac_secret` | Si | Si | Si |
| Editar nombre del proyecto | Si | Si | No |
| Eliminar proyecto | Si | No | No |
| Ver sugerencias | Si | Si | Si |
| Cambiar estado de sugerencia | Si | Si | No |
| Eliminar sugerencia | Si | Si | No |

### Políticas RLS actualizadas

La migración `20260219_project_members.sql` modifica las políticas RLS del schema original:

**`project_members`:**

| Política | Rol | Operación | Regla |
|---|---|---|---|
| `members_select_own` | `authenticated` | SELECT | `user_id = auth.uid()` |
| `members_no_anon` | `anon` | ALL | `USING (false)` |

**`projects`** (reemplaza `projects_no_authenticated_access`):

| Política | Rol | Operación | Regla |
|---|---|---|---|
| `projects_no_anon_access` | `anon` | ALL | `USING (false)` — sin cambios |
| `projects_authenticated_read_own` | `authenticated` | SELECT | Existe en `project_members` con `user_id = auth.uid()` |
| `projects_no_authenticated_insert` | `authenticated` | INSERT | `WITH CHECK (false)` |
| `projects_no_authenticated_update` | `authenticated` | UPDATE | `USING (false)` |
| `projects_no_authenticated_delete` | `authenticated` | DELETE | `USING (false)` |

**`suggestions`** (reemplaza `suggestions_no_authenticated_update` y `_delete`):

| Política | Rol | Operación | Regla |
|---|---|---|---|
| `suggestions_authenticated_update_own` | `authenticated` | UPDATE | Miembro con rol `owner` o `admin` |
| `suggestions_authenticated_delete_own` | `authenticated` | DELETE | Miembro con rol `owner` o `admin` |

> **Nota:** Las políticas de SELECT y INSERT en `suggestions` no cambian. La lectura sigue siendo pública y la inserción sigue denegada para `authenticated` (las sugerencias se crean vía Edge Functions).

---

## 4. Clientes Supabase

El dashboard usa tres clientes Supabase con propósitos distintos:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Browser (Client Components)                                 │
│  ┌────────────────────────────┐                              │
│  │ createBrowserClient()      │ ← Solo para auth             │
│  │ supabase.auth.signIn()     │   (login, logout, session)   │
│  │ supabase.auth.signOut()    │                              │
│  └────────────────────────────┘                              │
│                                                              │
│  Server (Server Components + Server Actions)                 │
│  ┌────────────────────────────┐                              │
│  │ createServerSupabaseClient │ ← Reads + moderation writes  │
│  │ (cookie-based, anon key)   │   RLS filtra por membresía   │
│  │                            │                              │
│  │ Usado en:                  │                              │
│  │ - Server Components        │ ← Lectura de proyectos,      │
│  │ - updateSuggestionStatus() │   sugerencias, estadísticas  │
│  │ - deleteSuggestion()       │                              │
│  └────────────────────────────┘                              │
│                                                              │
│  ┌────────────────────────────┐                              │
│  │ createAdminClient()        │ ← Solo Server Actions que     │
│  │ (service role key)         │   requieren bypass de RLS    │
│  │                            │                              │
│  │ Usado en:                  │                              │
│  │ - createProject()          │ ← INSERT en projects + la    │
│  │ - updateProject()          │   primera membership row     │
│  │ - deleteProject()          │                              │
│  └────────────────────────────┘                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

| Cliente | Archivo | Clave usada | Dónde se ejecuta | Propósito |
|---|---|---|---|---|
| Browser | `lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser | Auth (login/logout) |
| Server | `lib/supabase/server.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + cookies | Server | Queries con RLS |
| Admin | `lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | Server (Actions) | Bypass RLS para CRU en `projects` |

### Por qué dos clientes server-side

- **Server client (anon + cookies):** Usa la sesión del usuario autenticado. RLS verifica automáticamente que el usuario es miembro del proyecto. Usado para leer proyectos, leer sugerencias, moderar (UPDATE/DELETE en suggestions).

- **Admin client (service role):** Necesario solo para operaciones que RLS bloquea para `authenticated`: INSERT en `projects`, INSERT en `project_members` (para el primer owner), UPDATE/DELETE en `projects`. Cada Server Action que usa el admin client verifica la membresía manualmente antes de ejecutar (`requireProjectAccess()`).

---

## 5. Estructura de Archivos

```text
apps/web-dashboard/
├── src/
│   ├── middleware.ts                              # Protección de rutas
│   ├── app/
│   │   ├── layout.tsx                             # Root layout
│   │   ├── globals.css                            # Tailwind directives
│   │   ├── login/
│   │   │   └── page.tsx                           # Formulario de login
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts                       # Code exchange (email confirm)
│   │   └── (dashboard)/                           # Route group autenticado
│   │       ├── layout.tsx                         # Sidebar + Header
│   │       ├── page.tsx                           # Redirect → /projects
│   │       └── projects/
│   │           ├── page.tsx                        # Lista de proyectos
│   │           ├── actions.ts                      # Server Actions: CRUD proyectos
│   │           ├── new/
│   │           │   └── page.tsx                    # Crear proyecto
│   │           └── [projectId]/
│   │               ├── page.tsx                    # Detalle: settings, API key, stats
│   │               └── moderation/
│   │                   ├── page.tsx                # Lista sugerencias + filtros
│   │                   └── actions.ts              # Server Actions: status, delete
│   ├── components/
│   │   ├── Sidebar.tsx                            # Navegación lateral
│   │   ├── Header.tsx                             # Barra superior con email
│   │   ├── LogoutButton.tsx                       # Client Component (signOut)
│   │   ├── CreateProjectForm.tsx                  # Formulario de nuevo proyecto
│   │   ├── EditProjectForm.tsx                    # Edición inline de nombre
│   │   ├── DeleteProjectButton.tsx                # Botón con confirmación
│   │   ├── SecretDisplay.tsx                      # hmac_secret masked + reveal + copy
│   │   ├── SuggestionRow.tsx                      # Fila de sugerencia con acciones
│   │   ├── StatusBadge.tsx                        # Badge coloreado por estado
│   │   └── StatusFilter.tsx                       # Tabs de filtro por estado
│   └── lib/
│       ├── errors.ts                              # Sanitización de errores
│       ├── auth-guard.ts                          # requireAuth(), requireProjectAccess()
│       └── supabase/
│           ├── client.ts                          # Browser client
│           ├── server.ts                          # Server client (cookies)
│           ├── admin.ts                           # Service role client
│           └── middleware.ts                      # Session refresh helper
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.ts
└── .env.local.example
```

---

## 6. Pantallas

### 6.1 Login (`/login`)

Formulario con email y contraseña. Usa el browser client de Supabase (`signInWithPassword`). Errores sanitizados: siempre muestra "Invalid email or password" sin importar la causa real. Redirige a `/projects` tras login exitoso.

### 6.2 Lista de Proyectos (`/projects`)

Server Component que consulta `project_members` → `projects` usando el server client (RLS devuelve solo los proyectos del usuario). Muestra cards con nombre y fecha de creación. Botón "New Project" lleva a `/projects/new`.

### 6.3 Crear Proyecto (`/projects/new`)

Formulario que ejecuta la Server Action `createProject()`:

1. Valida que el usuario está autenticado (`requireAuth()`)
2. Genera `hmac_secret` con `crypto.randomBytes(32).toString("hex")` (256 bits)
3. Inserta en `projects` via service role (bypass RLS)
4. Inserta fila en `project_members` con `role: 'owner'` via service role
5. Si la membresía falla, hace rollback del proyecto
6. Redirige a `/projects/{id}`

### 6.4 Detalle de Proyecto (`/projects/[projectId]`)

Server Component con cuatro secciones:

```
┌──────────────────────────────────────────┐
│  ← Back to Projects                      │
├──────────────────────────────────────────┤
│  Project Settings                        │
│  [nombre del proyecto     ] [Save]       │
├──────────────────────────────────────────┤
│  API Key                                 │
│  Use this HMAC secret to sign requests   │
│  ┌──────────────────────────────────┐    │
│  │ a1b2c3d4••••••••••••••••••ef78   │    │
│  └──────────────────────────────────┘    │
│  [Reveal] [Copy]                         │
├──────────────────────────────────────────┤
│  Suggestions: 42    │    Votes: 187      │
├──────────────────────────────────────────┤
│        Open Moderation Panel             │
├──────────────────────────────────────────┤
│  ⚠ Danger Zone                           │
│  [Delete Project] → [Confirm] [Cancel]   │
└──────────────────────────────────────────┘
```

**`SecretDisplay`:** El `hmac_secret` se obtiene server-side (Server Component lee de la tabla `projects` via RLS). Se pasa como prop al Client Component `SecretDisplay`, que lo muestra masked por defecto (primeros 8 + últimos 4 caracteres). Botones "Reveal" y "Copy to clipboard".

> **Seguridad:** El `hmac_secret` es legible porque el RLS de `projects` permite SELECT a miembros autenticados. No hay riesgo de filtración al browser porque el dashboard es una aplicación privada para admins. El secreto solo llega al HTML renderizado para usuarios que ya tienen acceso legítimo.

### 6.5 Moderación (`/projects/[projectId]/moderation`)

Lista de sugerencias del proyecto con filtrado y acciones:

```
┌──────────────────────────────────────────────────────────────┐
│  ← Back to My Project                                        │
│  Moderation                                                   │
│                                                              │
│  [All] [Open] [Planned] [In Progress] [Shipped] [Closed]    │
│  [Search by title...                              ] [Search] │
│                                                              │
│  ┌───┬───────────────────────────────┬──────────┬──────────┐ │
│  │ 12│ Dark mode support    [Open]   │ [▼ Open ]│ [Delete] │ │
│  │   │ Allow users to toggle...      │          │          │ │
│  │   │ 2026-02-15                    │          │          │ │
│  ├───┼───────────────────────────────┼──────────┼──────────┤ │
│  │  8│ Export to CSV        [Shipped]│ [▼ Ship ]│ [Delete] │ │
│  │   │ 2026-02-10                    │          │          │ │
│  └───┴───────────────────────────────┴──────────┴──────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Filtros:** Los tabs de estado y la búsqueda por título usan query params de la URL (`?status=open&q=dark`). El Server Component lee estos params y construye la query Supabase con `.eq("status", ...)` y `.ilike("title", ...)`.

**Cambio de estado:** El dropdown ejecuta la Server Action `updateSuggestionStatus()`. La acción valida el nuevo estado contra el enum Zod `SuggestionStatus` antes de actualizar. RLS permite el UPDATE porque el usuario es miembro con rol `owner` o `admin`.

**Eliminar sugerencia:** Botón con confirmación en dos pasos (click → "Confirm" / "Cancel"). Ejecuta `deleteSuggestion()` que usa el server client autenticado. RLS permite el DELETE por la política `suggestions_authenticated_delete_own`.

---

## 7. Server Actions

Todas las mutaciones del dashboard se ejecutan como Server Actions de Next.js (`"use server"`).

### Proyectos (`projects/actions.ts`)

| Action | Cliente | Auth check | Descripción |
|---|---|---|---|
| `createProject()` | Admin (service role) | `requireAuth()` | Genera `hmac_secret`, inserta proyecto + membership |
| `updateProject()` | Admin (service role) | `requireProjectAccess()` | Actualiza nombre del proyecto |
| `deleteProject()` | Admin (service role) | `requireProjectAccess()` + `role === 'owner'` | Elimina proyecto (cascade) |

### Moderación (`moderation/actions.ts`)

| Action | Cliente | Auth check | Descripción |
|---|---|---|---|
| `updateSuggestionStatus()` | Server (authenticated) | `requireProjectAccess()` | Valida status con Zod, actualiza via RLS |
| `deleteSuggestion()` | Server (authenticated) | `requireProjectAccess()` | Elimina via RLS |

### Guards de autorización (`lib/auth-guard.ts`)

```
requireAuth()
├── Obtiene sesión del usuario via cookies
├── Valida que el usuario existe
└── Retorna { supabase, user }

requireProjectAccess(projectId)
├── Llama a requireAuth()
├── Consulta project_members con RLS
│   (solo retorna filas donde user_id = auth.uid())
├── Valida que existe membresía
└── Retorna { supabase, user, role }
```

---

## 8. Sanitización de Errores

`lib/errors.ts` mapea errores de Supabase/PostgreSQL a mensajes genéricos. Nunca se expone `error.message` de Supabase al cliente.

| Código PostgreSQL | Mensaje al usuario |
|---|---|
| `23505` (unique violation) | "This record already exists." |
| `23503` (FK violation) | "Referenced record not found." |
| `42501` (insufficient privilege) | "You do not have permission to perform this action." |
| `PGRST116` (not found) | "Record not found." |
| Cualquier otro | "An unexpected error occurred." |

---

## 9. Configuración

### Variables de entorno

| Variable | Dónde se usa | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + Server | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + Server | Clave pública (RLS aplica) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo Server (admin client) | Clave privada (bypass RLS) |

> **`SUPABASE_SERVICE_ROLE_KEY` no tiene prefijo `NEXT_PUBLIC_`** — nunca se expone al browser.

### Dependencias del workspace

| Paquete | Uso |
|---|---|
| `@openfeedback/client` | `TABLE` constants, `SuggestionStatus` Zod enum, tipos |
| `@openfeedback/typescript-config` | tsconfig base (`nextjs.json`) |
| `@openfeedback/tailwind-config` | Preset con colores `of-primary` y `of-neutral` |

---

## 10. Setup para Desarrollo

```bash
# 1. Instalar dependencias (desde la raíz del monorepo)
pnpm install

# 2. Configurar variables de entorno
cp apps/web-dashboard/.env.local.example apps/web-dashboard/.env.local
# Editar .env.local con las credenciales de tu proyecto Supabase

# 3. Aplicar la migración de project_members
# (via Supabase CLI o dashboard SQL editor)
# Archivo: supabase/migrations/20260219_project_members.sql

# 4. Crear un usuario admin en Supabase Auth
# Via Supabase Dashboard → Authentication → Add User

# 5. Iniciar el dashboard
pnpm --filter @openfeedback/web-dashboard dev
# → http://localhost:3100

# 6. Build de producción
pnpm --filter @openfeedback/web-dashboard build
```

---

## 11. Relación con el Resto del Sistema

```
                  Usuarios finales          Admins (dashboard)
                  ──────────────────        ──────────────────
Autenticación     HMAC por request          Supabase Auth (sesión)
Identidad en DB   user_hash (pseudo)        auth.users.id (real)
Tabla de acceso   (ninguna)                 project_members
Lectura           anon key + RLS público    authenticated + RLS por membresía
Escritura         Edge Functions            Server Actions (service role / RLS)
                  (service role)
```

El dashboard no interfiere con el flujo del SDK:

- Los usuarios finales siguen creando sugerencias y votando vía Edge Functions con HMAC
- Los admins gestionan estado y moderan vía Server Actions con Supabase Auth
- Ambos caminos convergen en las mismas tablas PostgreSQL, protegidas por políticas RLS distintas para cada rol
