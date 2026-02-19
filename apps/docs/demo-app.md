# Demo App — Validación del Core Engine

Aplicación Next.js (App Router) que valida el funcionamiento completo de `@openfeedback/react`, `@openfeedback/client` y el backend de Supabase (Edge Functions + PostgreSQL). Sirve como ejemplo de integración de referencia para cualquier app Next.js que quiera embeber OpenFeedback.

---

## Inicio rápido

```bash
# 1. Compilar los paquetes del SDK (Turborepo resuelve el orden)
pnpm build

# 2. Configurar variables de entorno
cp apps/demo-app/.env.local.example apps/demo-app/.env.local
# Editar .env.local con tus valores (ver sección "Variables de entorno")

# 3. Arrancar el servidor de desarrollo
pnpm --filter @openfeedback/demo-app dev
# → http://localhost:3099
```

---

## Variables de entorno

El archivo `.env.local` en `apps/demo-app/` debe contener:

| Variable | Exposición | Descripción |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente + Servidor | URL base del proyecto Supabase (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente + Servidor | Clave anon (JWT público) para lecturas PostgREST |
| `NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID` | Cliente + Servidor | UUID del proyecto en la tabla `projects` |
| `OPENFEEDBACK_HMAC_SECRET` | **Solo servidor** | Secreto HMAC compartido con el backend. Se usa para firmar cada petición de escritura. **Nunca debe llegar al navegador.** |

> **Seguridad:** las variables con prefijo `NEXT_PUBLIC_` son visibles en el bundle del cliente. `OPENFEEDBACK_HMAC_SECRET` no lleva ese prefijo y por tanto solo existe en el entorno del servidor (Server Actions, API routes).

---

## Estructura de archivos

```
apps/demo-app/
├── .env.local                  # Variables de entorno (no commiteado)
├── package.json                # Next.js 15 + dependencias workspace
├── tsconfig.json               # Extiende @openfeedback/typescript-config/nextjs
├── next.config.ts              # transpilePackages para los paquetes del SDK
├── tailwind.config.ts          # Importa el preset de @openfeedback/tailwind-config
├── postcss.config.mjs
└── src/
    ├── app/
    │   ├── globals.css         # Directivas de Tailwind
    │   ├── layout.tsx          # Layout raíz (metadata, body con clases of-neutral)
    │   ├── page.tsx            # Server Component: monta FeedbackBoard con config
    │   └── actions.ts          # Server Actions: signVote, signSuggestion
    └── components/
        ├── FeedbackBoard.tsx   # Client Component: <OpenFeedbackProvider> wrapper
        ├── SuggestionList.tsx  # useSuggestions (lectura) + useVote (escritura)
        └── NewSuggestionForm.tsx # useSubmitSuggestion (creación de sugerencias)
```

---

## Arquitectura de la integración

### Diagrama de flujo

```
┌───────────────────────────────────────────────────────────────┐
│  Navegador (Client Components)                                │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  <OpenFeedbackProvider>                                 │  │
│  │    config = { projectId, apiUrl }                       │  │
│  │    anonKey = NEXT_PUBLIC_SUPABASE_ANON_KEY              │  │
│  │    authContext = { userId, ... }                        │  │
│  │                                                         │  │
│  │  ┌──────────────────┐  ┌───────────────────────────┐   │  │
│  │  │  useSuggestions   │  │  useVote / useSubmitSug.  │   │  │
│  │  │  (lectura pública)│  │  (escritura firmada)      │   │  │
│  │  └────────┬─────────┘  └────────────┬──────────────┘   │  │
│  └───────────┼─────────────────────────┼───────────────────┘  │
│              │                         │                      │
│              │ GET /rest/v1/suggestions │ 1. Llama Server      │
│              │ (anon key)              │    Action para firmar │
│              │                         │ 2. POST /functions/v1 │
│              │                         │    con signature      │
└──────────────┼─────────────────────────┼──────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Servidor Next.js (Server Actions)                           │
│                                                              │
│  signVote(userId, suggestionId, direction)                   │
│  signSuggestion(userId, title, description?)                 │
│    1. Genera nonce + timestamp frescos                       │
│    2. Construye el JSON body completo (auth + payload)       │
│    3. HMAC-SHA256(body, OPENFEEDBACK_HMAC_SECRET)            │
│    4. Devuelve { signature, nonce, timestamp }               │
└──────────────────────────────────────────────────────────────┘
               │                         │
               ▼                         ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase                                                    │
│                                                              │
│  PostgREST ← lecturas (anon key, RLS: SELECT público)       │
│  Edge Functions ← escrituras (service role, bypass RLS)      │
│    submit-vote:       verifica firma → INSERT/DELETE votes    │
│    submit-suggestion: verifica firma → INSERT suggestions     │
│  Trigger: update_suggestion_upvotes() mantiene el contador   │
└──────────────────────────────────────────────────────────────┘
```

### Flujo de un voto (paso a paso)

1. El usuario hace click en "▲" en una suggestion.
2. `SuggestionList.tsx` llama a la Server Action `signVote(userId, suggestionId, "up")`.
3. La Server Action (en el servidor Next.js):
   - Genera un `nonce` criptográficamente aleatorio (16 bytes hex).
   - Captura el `timestamp` actual (`Date.now()`).
   - Construye el JSON body exacto: `{ auth: { user_id, nonce, timestamp, project_id }, vote: { suggestion_id, direction } }`.
   - Firma el body con `HMAC-SHA256(body, hmacSecret)` usando `signRequestBody` de `@openfeedback/client/server`.
   - Devuelve `{ signature, nonce, timestamp }` al cliente.
4. El componente llama a `vote(suggestionId, "up", { signature, nonce, timestamp })` del hook `useVote`.
5. El hook usa `OpenFeedbackClient.submitVote()` que:
   - Reconstruye el body con los mismos valores de auth (userId del context + nonce/timestamp recibidos).
   - Envía `POST /functions/v1/submit-vote` con el body en el cuerpo y la firma en el header `x-openfeedback-signature`.
6. La Edge Function `submit-vote`:
   - Valida el body (estructura, tipos, UUIDs).
   - Verifica la frescura del timestamp (< 5 minutos de drift).
   - Busca el `hmac_secret` del proyecto en la tabla `projects`.
   - Recomputa `HMAC-SHA256(rawBody, hmac_secret)` y compara con la firma (constant-time).
   - Verifica que el nonce no haya sido usado (anti-replay).
   - Computa `user_hash = HMAC(user_id, project_secret)` (nunca almacena el user_id real).
   - Inserta en `votes` o retorna 409 si ya votó.
7. El trigger `update_suggestion_upvotes()` incrementa `suggestions.upvotes` automáticamente.
8. El componente llama a `refetch()` de `useSuggestions` para actualizar la lista.

---

## Componentes en detalle

### `page.tsx` — Server Component

```tsx
// Lee config del entorno (server-side)
const config = {
  projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
  apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
};
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Renderiza el FeedbackBoard (client component)
<FeedbackBoard config={config} anonKey={anonKey} userId={DEMO_USER_ID} />
```

El `userId` está hardcodeado como `"demo-user-001"` para la demo. En una app real, vendría de tu sistema de autenticación (e.g., `session.user.id`).

### `FeedbackBoard.tsx` — Provider wrapper

Monta `<OpenFeedbackProvider>` con:
- `config`: projectId + apiUrl.
- `anonKey`: para lecturas PostgREST públicas.
- `authContext`: solo lleva `userId`. Los campos `signature`, `nonce` y `timestamp` se generan frescos por cada operación via Server Actions (ver sección "Bug corregido").

### `SuggestionList.tsx` — Lectura + Votación

Usa dos hooks:
- `useSuggestions({ orderBy: "upvotes" })` — Fetch automático al montar. Devuelve `{ suggestions, isLoading, error, refetch }`.
- `useVote()` — Devuelve `{ vote, isLoading, error }`. Cada llamada a `vote()` recibe auth firmado fresco.

### `NewSuggestionForm.tsx` — Creación de sugerencias

Formulario controlado con `title` y `description`. Usa `useSubmitSuggestion()` que devuelve `{ submit, isLoading, error }`. El flujo es idéntico al de votación: llama a la Server Action para firmar, luego al hook para enviar.

### `actions.ts` — Server Actions

Dos funciones exportadas como `"use server"`:

```typescript
signVote(userId, suggestionId, direction)
  → { signature, nonce, timestamp }

signSuggestion(userId, title, description?)
  → { signature, nonce, timestamp }
```

Ambas:
1. Generan `nonce` con `generateNonce()` de `@openfeedback/client/server`.
2. Construyen el body JSON exacto que la Edge Function espera.
3. Firman con `signRequestBody(body, hmacSecret)`.
4. Devuelven solo los parámetros necesarios (el secreto nunca sale del servidor).

---

## Bug corregido en el SDK: nonce por llamada

### Problema

Los hooks `useVote` y `useSubmitSuggestion` originalmente tomaban `nonce` y `timestamp` del `authContext` del provider, que se fija al montar el componente. Esto significaba que:

- La primera operación funcionaba correctamente.
- La segunda operación con el mismo `authContext` era rechazada por la Edge Function como **replay** (nonce ya usado).

En la práctica, solo se podía realizar una única operación de escritura por sesión.

### Solución

Se modificó la firma de los hooks para aceptar un objeto `SignedAuthParams` fresco por cada llamada:

```typescript
// Antes (roto para múltiples operaciones):
vote(suggestionId, direction, signature)
// El hook leía nonce/timestamp del provider context (fijos)

// Después (correcto):
vote(suggestionId, direction, { signature, nonce, timestamp })
// Cada llamada recibe auth fresco de la Server Action
```

**Archivos modificados:**
- `packages/react/src/hooks/useVote.ts` — Nuevo parámetro `signedAuth: SignedAuthParams`.
- `packages/react/src/hooks/useSubmitSuggestion.ts` — Mismo cambio.
- `packages/react/src/index.ts` — Exporta el tipo `SignedAuthParams`.

**Nuevo tipo exportado:**

```typescript
interface SignedAuthParams {
  signature: string;
  nonce: string;
  timestamp: number;
}
```

El `authContext` del provider sigue siendo necesario para aportar el `userId`, pero ya no es responsable del nonce ni del timestamp por operación.

---

## Backend: qué se desplegó en Supabase

### Schema (4 tablas)

La migración `supabase/migrations/20260217_init.sql` crea:

| Tabla | Acceso anon/authenticated | Propósito |
|---|---|---|
| `projects` | Denegado (solo service role) | Registro de tenants + `hmac_secret` |
| `suggestions` | SELECT público, no writes | Tablero de feedback |
| `votes` | SELECT público, no writes | Ledger de votos (almacena `user_hash`, no `user_id`) |
| `pseudonymous_vault` | Denegado (solo service role) | PII cifrada para notificaciones GDPR-compliant |

### Edge Functions (2)

| Función | Ruta | Acción |
|---|---|---|
| `submit-vote` | `POST /functions/v1/submit-vote` | Insertar o eliminar voto |
| `submit-suggestion` | `POST /functions/v1/submit-suggestion` | Crear sugerencia + opcional vault entry |

Ambas siguen el mismo pipeline de autenticación:

```
Validar body → Verificar timestamp → Buscar hmac_secret → Verificar firma HMAC → Check nonce → Ejecutar operación
```

### Trigger automático

`update_suggestion_upvotes()` se ejecuta `AFTER INSERT` y `AFTER DELETE` en `votes`, manteniendo `suggestions.upvotes` sincronizado sin lógica adicional en la Edge Function.

---

## Validación E2E realizada

| Escenario | Método | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| Lectura de suggestions (anon key) | `GET /rest/v1/suggestions` | 200 + array de suggestions | 200 + 3 suggestions |
| Voto firmado | `POST /functions/v1/submit-vote` | 201 `{ ok: true, action: "voted" }` | 201 OK |
| Trigger de upvotes | SELECT tras voto | `upvotes` incrementado | `upvotes: 0 → 1` |
| Voto duplicado (mismo user + suggestion) | `POST /functions/v1/submit-vote` | 409 "Already voted" | 409 OK |
| Creación de suggestion firmada | `POST /functions/v1/submit-suggestion` | 201 + suggestion completa | 201 OK |
| Build de Next.js | `pnpm build` | Sin errores | Compilación exitosa |
| Dev server | `pnpm dev` | HTTP 200 | 200 OK |

---

## Patrón de integración para tu app

Para integrar OpenFeedback en una app Next.js real, replica este patrón:

### 1. Instalar dependencias

```bash
pnpm add @openfeedback/react @openfeedback/client
```

### 2. Crear Server Actions para firmar

```typescript
// app/actions.ts
"use server";
import { signRequestBody, generateNonce } from "@openfeedback/client/server";

const hmacSecret = process.env.OPENFEEDBACK_HMAC_SECRET!;
const projectId = process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!;

export async function signVote(userId: string, suggestionId: string, direction: "up" | "remove") {
  const nonce = generateNonce();
  const timestamp = Date.now();
  const body = JSON.stringify({
    auth: { user_id: userId, nonce, timestamp, project_id: projectId },
    vote: { suggestion_id: suggestionId, direction },
  });
  return { signature: signRequestBody(body, hmacSecret), nonce, timestamp };
}
```

### 3. Montar el Provider

```tsx
// En un Client Component
import { OpenFeedbackProvider } from "@openfeedback/react";

<OpenFeedbackProvider
  config={{ projectId: "...", apiUrl: "https://xxx.supabase.co" }}
  anonKey="eyJ..."
  authContext={{ userId: session.user.id, signature: "", nonce: "", timestamp: 0 }}
>
  {children}
</OpenFeedbackProvider>
```

### 4. Usar los hooks

```tsx
// Lectura (sin auth)
const { suggestions, isLoading, refetch } = useSuggestions({ orderBy: "upvotes" });

// Escritura (con Server Action para firmar)
const { vote } = useVote();
const signedAuth = await signVote(userId, suggestionId, "up");
await vote(suggestionId, "up", signedAuth);
```

### Punto clave: la firma siempre en el servidor

El `hmacSecret` **nunca** debe llegar al cliente. El patrón es:

1. El cliente decide qué acción tomar (e.g., votar por X).
2. Llama a una Server Action pasando los parámetros de la acción.
3. La Server Action construye el body completo, lo firma, y devuelve `{ signature, nonce, timestamp }`.
4. El cliente pasa esos valores al hook, que envía la petición firmada a la Edge Function.

---

## Comandos útiles

```bash
# Desarrollo
pnpm --filter @openfeedback/demo-app dev     # Dev server en :3099

# Build
pnpm build                                    # Build completo del monorepo
pnpm --filter @openfeedback/demo-app build    # Build solo la demo

# Type check
pnpm --filter @openfeedback/demo-app type-check
```
