# Arquitectura del Sistema

> Documento técnico que describe la arquitectura implementada de OpenFeedback Engine.

---

## 1. Vista General

OpenFeedback Engine es un monorepo que contiene tres capas:

```
┌─────────────────────────────────────────────────────┐
│                    Host App (Next.js)                │
│                                                     │
│ Route Handler (Proxy)   Browser                     │
│  ┌──────────────┐      ┌──────────────────────────┐ │
│  │OpenFeedback- │◀─req─│ <OpenFeedbackProvider>   │ │
│  │    Proxy     │      │  ├─ useSuggestions()      │ │
│  └──────────────┘      │  ├─ useVote()            │ │
│  @openfeedback/        │  └─ useSubmitSuggestion() │ │
│  client/next           │  @openfeedback/react      │ │
│                        └──────────┬───────────────┘ │
└───────────┬───────────────────────┼─────────────────┘
                                    │
                          ┌─────────▼─────────┐
                          │  Supabase          │
                          │                    │
                  Reads   │  PostgREST API     │  Writes
                 (anon) ──│  (GET /rest/v1/)   │── (Edge Functions)
                          │                    │
                          │  ┌──────────────┐  │
                          │  │ submit-vote   │  │
                          │  │ submit-       │  │
                          │  │  suggestion   │  │
                          │  └──────┬───────┘  │
                          │         │ service   │
                          │         │ role      │
                          │  ┌──────▼───────┐  │
                          │  │ PostgreSQL    │  │
                          │  │ + RLS         │  │
                          │  └──────────────┘  │
                          └────────────────────┘
```

**Reads** (sugerencias, votos) van directo a PostgREST con el `anon key`. RLS permite lectura pública.

**Writes** (votar, crear sugerencia) pasan por Edge Functions que verifican la firma HMAC antes de escribir con el `service role` (bypass RLS).

---

## 2. Estructura del Monorepo

```text
/
├── apps/
│   ├── web-dashboard/         # Panel admin para clientes Managed
│   ├── docs/                  # Sitio de documentación
│   └── demo-app/              # App Next.js de ejemplo
│
├── packages/
│   ├── react/                 # SDK React (@openfeedback/react)
│   │   └── src/
│   │       ├── components/    # OpenFeedbackProvider
│   │       ├── hooks/         # useSuggestions, useVote, useSubmitSuggestion
│   │       ├── types/         # Re-exports de @openfeedback/client
│   │       └── utils/         # cn() (clsx + tailwind-merge)
│   │
│   ├── client/                # Cliente JS (@openfeedback/client)
│   │   └── src/
│   │       ├── index.ts       # Entry point browser-safe
│   │       ├── server.ts      # Entry point Node.js (HMAC signing)
│   │       ├── schemas.ts     # Zod schemas (source of truth para tipos)
│   │       ├── types.ts       # TypeScript types inferidos de Zod
│   │       ├── constants.ts   # TABLE names, AUTH config
│   │       ├── api-client.ts  # OpenFeedbackClient class
│   │       └── signing.ts     # signRequestBody(), generateNonce()
│   │
│   ├── cli/                   # CLI (@openfeedback/cli)
│   ├── typescript-config/     # TSConfigs compartidos
│   └── tailwind-config/       # Preset Tailwind compartido
│
├── supabase/
│   ├── migrations/
│   │   └── 20260217_init.sql  # Schema completo + RLS + triggers
│   └── functions/
│       ├── _shared/           # Lógica compartida entre Edge Functions
│       │   ├── auth.ts        # Pipeline de verificación completo
│       │   ├── crypto.ts      # HMAC, timingSafeEqual, hashUserId
│       │   ├── nonce.ts       # Verificación async en tabla used_nonces
│       │   ├── cors.ts        # Headers CORS
│       │   ├── response.ts    # Helpers de respuesta JSON/error
│       │   └── validation.ts  # Validación runtime de payloads
│       ├── submit-vote/       # Edge Function: votar/desvotar
│       └── submit-suggestion/ # Edge Function: crear sugerencia
│
└── docker/                    # Configuración Self-Hosting
```

### Herramientas del Monorepo

| Herramienta | Propósito |
|---|---|
| **pnpm workspaces** | Gestión de dependencias con aislamiento estricto |
| **Turborepo** | Orquestación de builds con cache incremental |
| **tsup** (esbuild) | Compilación de librerías — dual ESM/CJS + `.d.ts` |
| **TypeScript 5.7+** | Strict mode, `noUncheckedIndexedAccess`, `bundler` moduleResolution |

---

## 3. Paquetes y Responsabilidades

### `@openfeedback/client` (packages/client)

El contrato compartido entre frontend y backend. Tres entry points:

| Import | Entorno | Contenido |
|---|---|---|
| `@openfeedback/client` | Browser + Node | Schemas Zod, tipos, `OpenFeedbackClient`, constantes |
| `@openfeedback/client/server` | Solo Node.js | `signRequestBody()`, `generateNonce()` (usa `node:crypto`) |
| `@openfeedback/client/next` | Server (Next.js) | `OpenFeedbackProxy()` Route Handler preconfigurado |

**`OpenFeedbackClient`** es el wrapper HTTP tipado:
- **Reads** (`getSuggestions`, `getSuggestion`, `hasVoted`): usan PostgREST con `anon key`
- **Writes** (`submitVote`, `submitSuggestion`): Si se inyecta por el Proxy, se llaman hacia el Proxy. Internamente llaman a Edge Functions con firma HMAC.

### `@openfeedback/react` (packages/react)

SDK de React. Depende de `@openfeedback/client`.

| Export | Tipo | Descripción |
|---|---|---|
| `<OpenFeedbackProvider>` | Componente | Instancia `OpenFeedbackClient`, provee contexto (`proxyUrl`) |
| `useOpenFeedback()` | Hook | Acceso al client y configuración |
| `useSuggestions()` | Hook | Fetch de sugerencias con estado de loading/error |
| `useVote()` | Hook | Votar/desvotar (routea al proxy interno de Next.js) |
| `useSubmitSuggestion()` | Hook | Crear sugerencia (routea al proxy interno de Next.js) |
| `cn()` | Utilidad | `clsx` + `tailwind-merge` para componentes headless |

### `@openfeedback/cli` (packages/cli)

Herramienta de línea de comandos (skeleton). Planificado para:
- Análisis de historial Git con fuzzy matching
- Generación de changelogs
- `openfeedback sync` para Roadmap-as-Code

### Edge Functions (supabase/functions/)

Todas las Edge Functions comparten el mismo pipeline de autenticación via `_shared/`:

```
Request → CORS check → Parse JSON → Validate body → Check timestamp
        → Fetch project secret → Verify HMAC (constant-time)
        → Check nonce replay → Execute business logic
```

| Función | Endpoint | Acción |
|---|---|---|
| `submit-vote` | `POST /functions/v1/submit-vote` | INSERT o DELETE en `votes` |
| `submit-suggestion` | `POST /functions/v1/submit-suggestion` | INSERT en `suggestions` + UPSERT en `pseudonymous_vault` |

---

## 4. Flujo de Datos: Ciclo de Vida de un Voto

```
1. Browser (React Hook):
   │
   ├─ useVote()
   └─ POST /api/openfeedback
       Body: { action: "vote", payload: {...} }

2. Host App (Proxy Route Handler):
   │
   ├─ sesion = getUser()
   ├─ auth = { user_id: sesion.id, nonce: generateNonce(), timestamp: Date.now(), project_id }
   ├─ body = JSON.stringify({ auth, vote: { suggestion_id, direction: "up" } })
   ├─ signature = signRequestBody(body, HMAC_SECRET)
   └─ POST /functions/v1/submit-vote (Headers: { x-openfeedback-signature })

3. Edge Function (submit-vote):
   │
   ├─ Valida body con validateVoteRequest()
   ├─ Verifica timestamp (±5 min)
   ├─ Fetch project.hmac_secret de DB
   ├─ Computa HMAC(rawBody, secret)
   ├─ timingSafeEqual(received_sig, expected_sig)
   ├─ Marca nonce como usado
   ├─ userHash = HMAC(user_id, project_secret)  ← salted per-project
   └─ INSERT INTO votes (suggestion_id, user_hash, project_id)
```
4. Trigger PostgreSQL:
   │
   └─ UPDATE suggestions SET upvotes = upvotes + 1
```

---

## 5. Configuración Compartida

### TypeScript (`packages/typescript-config`)

| Config | Uso | Particularidades |
|---|---|---|
| `base.json` | Base para todos | `strict`, `noUncheckedIndexedAccess`, `bundler` resolution |
| `react-library.json` | `packages/react` | Extiende base + `jsx: "react-jsx"`, DOM libs |
| `nextjs.json` | `apps/demo-app` | Extiende base + `jsx: "preserve"`, plugin Next.js |
| `node.json` | `packages/cli` | Extiende base, sin DOM libs |

### Tailwind (`packages/tailwind-config`)

Preset compartido con escalas de color propias:
- `of-primary-{50..900}` — azul para acciones principales
- `of-neutral-{50..900}` — grises para UI base
- `borderRadius.of` — `0.5rem` estándar

---

## 6. Integración y Webhooks (Phase 5)

Para soportar notificaciones en herramientas de colaboración nativas como Slack o Discord, OpenFeedback implementa un sistema de **Outbound Webhooks**.

1. Una tabla `webhooks` almacena los endpoints configurados por proyecto.
2. Un **Trigger de PostgreSQL** escucha eventos de `INSERT` o `UPDATE` (ej. cuando el estado cambia a `shipped`) en la tabla `suggestions`.
3. El trigger encola y transmite de forma fiable el payload asincrónicamente usando `pg_net` hacia la Edge Function `dispatch-webhook`.
4. `dispatch-webhook` transforma el payload estándar a formatos enriquecidos (como Embeds de Discord) y ejecuta el HTTP POST final al consumidor.

*Ejemplo de Evento Discord: suggestion.created*
```json
{
  "content": "🚀 **New Suggestion Created:** Export to PDF",
  "embeds": [{
       "title": "Export to PDF",
       "color": 5814783,
       "footer": { "text": "ID: [...]" }
  }]
}
```
