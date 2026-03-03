# Base de datos — Setup con Supabase

Guía para inicializar la base de datos de OpenFeedback Engine en un proyecto Supabase. Cubre el esquema completo, las políticas de seguridad RLS y el starter SQL listo para copiar y pegar.

---

## Inicio rápido (1 minuto)

1. Abre tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. Ve a **SQL Editor** (barra lateral izquierda).
3. Copia el contenido de `supabase/00_init.sql` y pégalo en el editor.
4. Pulsa **Run**.

Eso es todo. Las 7 tablas, los índices, las políticas RLS y el trigger de upvotes se crean en una sola ejecución.

> **Nota:** el script usa `CREATE TABLE IF NOT EXISTS`, por lo que es seguro ejecutarlo múltiples veces sin duplicar tablas.

---

## Esquema de tablas

### `projects`

Registro de tenants. Cada aplicación host se registra como un proyecto.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador único, generado automáticamente |
| `name` | `text` | Nombre del proyecto |
| `hmac_secret` | `text` | Secreto compartido para verificar firmas HMAC-SHA256. **Nunca debe llegar al navegador.** |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Fecha de última modificación |

**RLS:** Anon denegado. Authenticated solo puede leer proyectos de los que es miembro (vía `project_members`). Escritura restringida al service role.

---

### `project_members`

Vincula usuarios de Supabase Auth con los proyectos que pueden gestionar desde el dashboard.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador único |
| `project_id` | `uuid` (FK → `projects`) | Proyecto al que pertenece |
| `user_id` | `uuid` (FK → `auth.users`) | Usuario de Supabase Auth |
| `role` | `text` | Rol: `owner`, `admin` o `viewer` |
| `created_at` | `timestamptz` | Fecha de creación |

**Constraint:** `UNIQUE(project_id, user_id)` — un usuario no puede tener membresía duplicada.

**RLS:** Cada usuario autenticado solo ve sus propias membresías. Anon denegado.

---

### `suggestions`

Tablero público de feedback. Cada sugerencia pertenece a un proyecto.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador único |
| `project_id` | `uuid` (FK → `projects`) | Proyecto al que pertenece |
| `title` | `text` | Título (1–300 caracteres) |
| `description` | `text` | Descripción opcional (máx. 5000 caracteres) |
| `status` | `text` | Estado: `open`, `planned`, `in_progress`, `shipped`, `closed` |
| `upvotes` | `integer` | Contador de votos (mantenido automáticamente por trigger) |
| `created_at` | `timestamptz` | Fecha de creación |
| `updated_at` | `timestamptz` | Fecha de última modificación |

**Índices:** `(project_id)`, `(project_id, status)`.

**RLS:**
- Anon y authenticated: lectura pública.
- Anon: escritura denegada.
- Authenticated (owner/admin del proyecto): puede actualizar y eliminar.
- Inserciones: solo vía Edge Functions (service role).

---

### `votes`

Ledger público de votos. Almacena un hash del usuario, nunca su identidad real.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador único |
| `suggestion_id` | `uuid` (FK → `suggestions`) | Sugerencia votada |
| `user_hash` | `text` | `HMAC(user_id, project_hmac_secret)` — hash salado, no reversible |
| `project_id` | `uuid` (FK → `projects`) | Proyecto (para queries eficientes) |
| `created_at` | `timestamptz` | Fecha del voto |

**Constraint:** `UNIQUE(suggestion_id, user_hash)` — un usuario solo puede votar una vez por sugerencia.

**Índices:** `(suggestion_id)`, `(user_hash)`, `(project_id)`.

**RLS:** Lectura pública (anon + authenticated). Escritura denegada para ambos — las mutaciones pasan por la Edge Function `submit-vote` con service role.

---

### `pseudonymous_vault`

Capa de cumplimiento GDPR. Almacena emails cifrados del lado del cliente, separados del ledger público de votos.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador único |
| `user_hash` | `text` | Mismo hash que en `votes` |
| `encrypted_email` | `text` | Email cifrado en el cliente antes de enviar |
| `project_id` | `uuid` (FK → `projects`) | Proyecto asociado |
| `created_at` | `timestamptz` | Fecha de creación |

**Constraint:** `UNIQUE(project_id, user_hash)` — una entrada por usuario por proyecto.

**RLS:** Completamente bloqueada para anon y authenticated. Solo el service role (Edge Functions) puede leer y escribir.

**¿Por qué una tabla separada?**
- El ledger de votos es público y no contiene PII.
- La vault aísla los datos personales, permitiendo purgar PII con un solo `TRUNCATE` sin afectar votos.
- Se puede auditar el acceso a PII de forma independiente.

---

### `used_nonces`

Prevención de ataques de replay. Las Edge Functions registran cada nonce usado.

| Columna | Tipo | Descripción |
|---|---|---|
| `project_id` | `uuid` (FK → `projects`, PK) | Proyecto |
| `nonce` | `text` (PK) | Nonce de un solo uso |
| `created_at` | `timestamptz` | Momento de uso |

**PK compuesta:** `(project_id, nonce)`.

**RLS:** Habilitada sin políticas = denegación implícita para anon y authenticated. El service role bypassa RLS automáticamente.

---

### `webhooks`

Permite a los proyectos registrar URLs de webhook para eventos como creación o envío de sugerencias.

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | `uuid` (PK) | Identificador único |
| `project_id` | `uuid` (FK → `projects`) | Proyecto asociado |
| `url` | `text` | URL destino del webhook |
| `events` | `text[]` | Eventos suscritos (default: `suggestion.created`, `suggestion.shipped`) |
| `secret` | `text` | Secreto opcional para firmar payloads del webhook |
| `is_active` | `boolean` | Indica si el webhook está activo |
| `created_at` | `timestamptz` | Fecha de creación |

**RLS:** Miembros del proyecto pueden leer. Owners y admins pueden gestionar (CRUD completo).

---

## Trigger automático de upvotes

El script crea una función `update_suggestion_upvotes()` con dos triggers:

- `AFTER INSERT` en `votes` → incrementa `suggestions.upvotes`.
- `AFTER DELETE` en `votes` → decrementa `suggestions.upvotes` (mínimo 0).

Esto mantiene el contador sincronizado sin lógica adicional en las Edge Functions. La función usa `SECURITY DEFINER` para poder actualizar `suggestions` independientemente de las políticas RLS del caller.

---

## Modelo de seguridad RLS

Todas las tablas tienen Row Level Security habilitado. El principio general es:

| Tabla | Anon | Authenticated | Service Role |
|---|---|---|---|
| `projects` | Denegado | Lectura (solo sus proyectos) | Total |
| `project_members` | Denegado | Lectura (solo sus membresías) | Total |
| `suggestions` | Lectura | Lectura + Update/Delete (admins) | Total |
| `votes` | Lectura | Lectura | Total |
| `pseudonymous_vault` | Denegado | Denegado | Total |
| `used_nonces` | Denegado (implícito) | Denegado (implícito) | Total |
| `webhooks` | Denegado (implícito) | Lectura + CRUD (admins) | Total |

> **Importante:** el service role bypassa RLS automáticamente en Supabase. Las Edge Functions (`submit-vote`, `submit-suggestion`) usan este rol para todas las escrituras, después de verificar la firma HMAC del payload.

---

## Migraciones individuales vs. Starter SQL

El repositorio contiene las migraciones incrementales en `supabase/migrations/`:

| Migración | Contenido |
|---|---|
| `20260217_init.sql` | Tablas core: projects, suggestions, votes, pseudonymous_vault + trigger |
| `20260219_project_members.sql` | Tabla project_members + actualización de RLS para dashboard |
| `20260221_used_nonces.sql` | Tabla used_nonces para prevención de replay |
| `20260222_add_webhooks_table_and_triggers.sql` | Tabla webhooks + trigger de despacho |

El archivo `supabase/00_init.sql` es la consolidación de todas estas migraciones en un solo script, diseñado para usuarios que configuran un proyecto Supabase desde cero. Si ya ejecutaste las migraciones individuales, **no necesitas ejecutar `00_init.sql`**.

---

## Variables de entorno necesarias

Después de ejecutar el SQL, tu aplicación necesitará estas variables para conectarse:

| Variable | Dónde obtenerla | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Settings → API → Project URL | Lecturas PostgREST desde el cliente |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → Settings → API → anon key | Autenticación para lecturas públicas |
| `OPENFEEDBACK_HMAC_SECRET` | Tú lo defines al crear el proyecto en la tabla `projects` | Firma de payloads (solo servidor) |
| `NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID` | UUID del registro insertado en `projects` | Identifica tu proyecto |

> **Seguridad:** `OPENFEEDBACK_HMAC_SECRET` es solo para el servidor (Server Actions / API Routes). Nunca uses el prefijo `NEXT_PUBLIC_` para esta variable.

---

## Crear tu primer proyecto

Después de ejecutar el starter SQL, inserta tu primer proyecto usando el SQL Editor de Supabase:

```sql
insert into projects (name, hmac_secret)
values ('Mi App', 'un-secreto-aleatorio-largo-y-seguro')
returning id;
```

Guarda el `id` devuelto — es tu `OPENFEEDBACK_PROJECT_ID`. El `hmac_secret` debe ser una cadena aleatoria larga (mínimo 32 caracteres). Puedes generarla con:

```bash
openssl rand -hex 32
```

Si usas el dashboard de administración, crea también tu membresía:

```sql
insert into project_members (project_id, user_id, role)
values ('<project-id>', '<tu-auth-user-id>', 'owner');
```
