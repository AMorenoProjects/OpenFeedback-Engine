# Esquema de Base de Datos

> Documentación completa del schema PostgreSQL, políticas RLS y triggers.
> Migración: `supabase/migrations/20260217_init.sql`

---

## 1. Diagrama de Relaciones

```
┌──────────────┐
│   projects   │
│──────────────│
│ id (PK)      │
│ name         │
│ hmac_secret  │──────────────────────────────────────────┐
│ created_at   │                                          │
│ updated_at   │                                          │
└──────┬───────┘                                          │
       │ 1:N                                              │
       │                                                  │
┌──────▼───────────┐     ┌──────────────┐     ┌──────────▼──────────┐
│   suggestions    │     │    votes     │     │ pseudonymous_vault  │
│──────────────────│     │──────────────│     │─────────────────────│
│ id (PK)          │◄────│ suggestion_id│     │ id (PK)             │
│ project_id (FK)  │     │ user_hash    │     │ user_hash           │
│ title            │     │ project_id   │     │ encrypted_email     │
│ description      │     │ created_at   │     │ project_id (FK)     │
│ status           │     │──────────────│     │ created_at          │
│ upvotes          │     │ UQ(suggestion│     │─────────────────────│
│ created_at       │     │    _id,      │     │ UQ(project_id,      │
│ updated_at       │     │    user_hash)│     │    user_hash)       │
└──────────────────┘     └──────────────┘     └─────────────────────┘
                              │
                              │ TRIGGER
                              ▼
                    update_suggestion_upvotes()
```

---

## 2. Tablas

### 2.1 `projects`

Configuración del tenant (la aplicación host que integra OpenFeedback).

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | Identificador del proyecto |
| `name` | `text` | NOT NULL | Nombre descriptivo |
| `hmac_secret` | `text` | NOT NULL | Secreto compartido para verificación HMAC-SHA256. Nunca se expone al browser |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

### 2.2 `suggestions`

El tablero de feedback público.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `title` | `text` | NOT NULL, `char_length BETWEEN 1 AND 300` | Título de la sugerencia |
| `description` | `text` | `char_length <= 5000` | Descripción opcional |
| `status` | `text` | NOT NULL, default `'open'`, CHECK enum | `open`, `planned`, `in_progress`, `shipped`, `closed` |
| `upvotes` | `integer` | NOT NULL, default `0`, CHECK `>= 0` | Mantenido automáticamente por trigger |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |
| `updated_at` | `timestamptz` | NOT NULL, default `now()` | |

**Indexes:**
- `idx_suggestions_project` — `(project_id)`
- `idx_suggestions_status` — `(project_id, status)`

### 2.3 `votes`

Registro público de votos. Almacena `user_hash`, nunca el `user_id` original.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `suggestion_id` | `uuid` | FK → `suggestions(id)` ON DELETE CASCADE | |
| `user_hash` | `text` | NOT NULL | `HMAC(user_id, project_secret)` — salted per-project |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `uq_vote_per_user (suggestion_id, user_hash)` — un voto por usuario por sugerencia.

**Indexes:**
- `idx_votes_suggestion` — `(suggestion_id)`
- `idx_votes_user_hash` — `(user_hash)`
- `idx_votes_project` — `(project_id)`

### 2.4 `pseudonymous_vault`

Almacén aislado de PII (Información Personal Identificable). Separado de `votes` por diseño.

| Columna | Tipo | Restricciones | Descripción |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_hash` | `text` | NOT NULL | Mismo hash que en `votes` |
| `encrypted_email` | `text` | NOT NULL | Email encriptado client-side |
| `project_id` | `uuid` | FK → `projects(id)` ON DELETE CASCADE | |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

**Unique constraint:** `uq_vault_per_user (project_id, user_hash)`

**Indexes:**
- `idx_vault_user_hash` — `(user_hash)`
- `idx_vault_project` — `(project_id)`

#### Por qué una tabla separada

La separación entre `votes` y `pseudonymous_vault` es una decisión de privacidad deliberada:

1. **`votes` es un registro público** — contiene `user_hash` + `suggestion_id`. Cualquiera puede leerlo.
2. **`pseudonymous_vault` es privado** — mapea `user_hash` → `encrypted_email` para notificaciones "just-in-time".
3. **Beneficios de la separación:**
   - Controles de acceso más estrictos (ni `anon` ni `authenticated` pueden leer el vault)
   - Purgar todo el PII con un solo `TRUNCATE pseudonymous_vault` sin afectar votos
   - Auditar acceso al PII de forma independiente
4. **El email está encriptado client-side** — incluso un dump de la base de datos no expone emails en texto plano.

---

## 3. Políticas RLS (Row Level Security)

RLS está habilitado en las 4 tablas. Las políticas cubren explícitamente tanto `anon` como `authenticated`:

### `projects`

| Política | Rol | Operación | Regla | Razón |
|---|---|---|---|---|
| `projects_no_anon_access` | `anon` | ALL | `USING (false)` | El `hmac_secret` nunca debe ser legible |
| `projects_no_authenticated_access` | `authenticated` | ALL | `USING (false)` | Solo `service_role` gestiona proyectos |

### `suggestions`

| Política | Rol | Operación | Regla |
|---|---|---|---|
| `suggestions_public_read` | `anon` | SELECT | `USING (true)` |
| `suggestions_no_anon_write` | `anon` | INSERT | `WITH CHECK (false)` |
| `suggestions_no_anon_update` | `anon` | UPDATE | `USING (false)` |
| `suggestions_no_anon_delete` | `anon` | DELETE | `USING (false)` |
| `suggestions_authenticated_read` | `authenticated` | SELECT | `USING (true)` |
| `suggestions_no_authenticated_write` | `authenticated` | INSERT | `WITH CHECK (false)` |
| `suggestions_no_authenticated_update` | `authenticated` | UPDATE | `USING (false)` |
| `suggestions_no_authenticated_delete` | `authenticated` | DELETE | `USING (false)` |

### `votes`

Misma estructura que `suggestions`: lectura pública, escritura denegada para ambos roles.

### `pseudonymous_vault`

| Política | Rol | Operación | Regla |
|---|---|---|---|
| `vault_no_anon_access` | `anon` | ALL | `USING (false)` |
| `vault_no_authenticated_access` | `authenticated` | ALL | `USING (false)` |

**Principio:** Solo el `service_role` (usado por Edge Functions) puede escribir en cualquier tabla. Solo `suggestions` y `votes` permiten lectura pública.

---

## 4. Triggers

### `update_suggestion_upvotes()`

Función `SECURITY DEFINER` que mantiene `suggestions.upvotes` sincronizado:

| Evento | Acción |
|---|---|
| `AFTER INSERT ON votes` | `upvotes = upvotes + 1` en la sugerencia correspondiente |
| `AFTER DELETE ON votes` | `upvotes = greatest(upvotes - 1, 0)` en la sugerencia correspondiente |

Esto permite que las Edge Functions solo hagan `INSERT`/`DELETE` en `votes` — el contador se actualiza automáticamente.

---

## 5. Extensiones

| Extensión | Uso |
|---|---|
| `pgcrypto` | `gen_random_uuid()` para PKs |
