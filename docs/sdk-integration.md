# Guia de Integracion del SDK

> Cómo integrar OpenFeedback Engine en una aplicación Next.js (App Router).

---

## 1. Instalación

```bash
# En tu proyecto Next.js
npm install @openfeedback/react @openfeedback/client
```

---

## 2. Configuración del Servidor

### 2.1 Variables de entorno

```env
# .env.local
OPENFEEDBACK_PROJECT_ID=tu-project-uuid
OPENFEEDBACK_HMAC_SECRET=tu-hmac-secret
NEXT_PUBLIC_SUPABASE_URL=https://tu-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

### 2.2 Server Action para firmar requests

La firma HMAC **debe** computarse en el servidor. Nunca expongas el `hmac_secret` al browser.

```typescript
// app/actions/openfeedback.ts
"use server";

import { signRequestBody, generateNonce } from "@openfeedback/client/server";

const PROJECT_ID = process.env.OPENFEEDBACK_PROJECT_ID!;
const HMAC_SECRET = process.env.OPENFEEDBACK_HMAC_SECRET!;

interface SignedAuth {
  signature: string;
  auth: {
    user_id: string;
    nonce: string;
    timestamp: number;
    project_id: string;
  };
}

/**
 * Firma un request de voto.
 * Llamar desde el browser via useVote() → Server Action.
 */
export async function signVoteRequest(
  userId: string,
  suggestionId: string,
  direction: "up" | "remove",
): Promise<SignedAuth> {
  const auth = {
    user_id: userId,
    nonce: generateNonce(),
    timestamp: Date.now(),
    project_id: PROJECT_ID,
  };

  const body = JSON.stringify({
    auth,
    vote: { suggestion_id: suggestionId, direction },
  });

  const signature = signRequestBody(body, HMAC_SECRET);

  return { signature, auth };
}

/**
 * Firma un request de creación de sugerencia.
 */
export async function signSuggestionRequest(
  userId: string,
  title: string,
  description?: string,
): Promise<SignedAuth> {
  const auth = {
    user_id: userId,
    nonce: generateNonce(),
    timestamp: Date.now(),
    project_id: PROJECT_ID,
  };

  const body = JSON.stringify({
    auth,
    suggestion: { title, description },
  });

  const signature = signRequestBody(body, HMAC_SECRET);

  return { signature, auth };
}
```

---

## 3. Configuración del Provider

Envuelve tu layout con `<OpenFeedbackProvider>`:

```tsx
// app/layout.tsx (o un layout anidado)
import { OpenFeedbackProvider } from "@openfeedback/react";

export default function FeedbackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OpenFeedbackProvider
      config={{
        projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
        apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      }}
      anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      // authContext se inyecta más abajo, donde tengas la sesión del usuario
    >
      {children}
    </OpenFeedbackProvider>
  );
}
```

### Con autenticación del usuario

Si tu app tiene sesión de usuario, pasa el `authContext`:

```tsx
// components/FeedbackWrapper.tsx
"use client";

import { OpenFeedbackProvider } from "@openfeedback/react";
import type { AuthContext } from "@openfeedback/react";

interface Props {
  authContext?: AuthContext;
  children: React.ReactNode;
}

export function FeedbackWrapper({ authContext, children }: Props) {
  return (
    <OpenFeedbackProvider
      config={{
        projectId: process.env.NEXT_PUBLIC_OPENFEEDBACK_PROJECT_ID!,
        apiUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      }}
      anonKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}
      authContext={authContext}
    >
      {children}
    </OpenFeedbackProvider>
  );
}
```

---

## 4. Uso de los Hooks

### 4.1 `useSuggestions()` — Leer sugerencias

No requiere autenticación. Funciona para cualquier visitante.

```tsx
"use client";

import { useSuggestions } from "@openfeedback/react";

export function SuggestionList() {
  const { suggestions, isLoading, error, refetch } = useSuggestions({
    orderBy: "upvotes",
    ascending: false,
  });

  if (isLoading) return <p>Cargando...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {suggestions.map((s) => (
        <li key={s.id}>
          <strong>{s.title}</strong>
          <span>{s.upvotes} votos</span>
          <span>{s.status}</span>
        </li>
      ))}
    </ul>
  );
}
```

#### Opciones

| Parámetro | Tipo | Default | Descripción |
|---|---|---|---|
| `status` | `string` | todos | Filtrar por estado |
| `orderBy` | `"upvotes" \| "created_at"` | `"created_at"` | Columna de orden |
| `ascending` | `boolean` | `false` | Orden ascendente |

### 4.2 `useVote()` — Votar/Desvotar

Requiere `authContext` en el Provider y una firma server-side.

```tsx
"use client";

import { useVote } from "@openfeedback/react";
import { signVoteRequest } from "@/app/actions/openfeedback";

interface VoteButtonProps {
  suggestionId: string;
  userId: string;
}

export function VoteButton({ suggestionId, userId }: VoteButtonProps) {
  const { vote, isLoading, error } = useVote();

  async function handleVote() {
    // 1. Firma server-side
    const { signature, auth } = await signVoteRequest(
      userId,
      suggestionId,
      "up",
    );

    // 2. Envía a Edge Function
    await vote(suggestionId, "up", signature);
  }

  return (
    <button onClick={handleVote} disabled={isLoading}>
      {isLoading ? "Votando..." : "Votar"}
    </button>
  );
}
```

### 4.3 `useSubmitSuggestion()` — Crear sugerencia

```tsx
"use client";

import { useState } from "react";
import { useSubmitSuggestion } from "@openfeedback/react";
import { signSuggestionRequest } from "@/app/actions/openfeedback";

interface Props {
  userId: string;
}

export function SuggestionForm({ userId }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { submit, isLoading, error } = useSubmitSuggestion();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const { signature } = await signSuggestionRequest(
      userId,
      title,
      description || undefined,
    );

    const result = await submit(
      { title, description: description || undefined },
      signature,
    );

    // result.suggestion contiene la sugerencia creada
    setTitle("");
    setDescription("");
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Título de tu sugerencia"
        maxLength={300}
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Descripción (opcional)"
        maxLength={5000}
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? "Enviando..." : "Enviar sugerencia"}
      </button>
      {error && <p>Error: {error.message}</p>}
    </form>
  );
}
```

---

## 5. Referencia de la API

### OpenFeedbackClient

Si necesitas acceso directo al client fuera de React:

```typescript
import { OpenFeedbackClient } from "@openfeedback/client";

const client = new OpenFeedbackClient({
  apiUrl: "https://tu-ref.supabase.co",
  anonKey: "tu-anon-key",
  projectId: "tu-project-uuid",
});

// Reads (públicos, no requieren firma)
const suggestions = await client.getSuggestions({ orderBy: "upvotes" });
const suggestion = await client.getSuggestion("uuid");
const voted = await client.hasVoted("suggestion-uuid", "user-hash");

// Writes (requieren firma server-side)
await client.submitVote(
  { suggestion_id: "uuid", direction: "up" },
  { signature: "hmac-hex", auth: { ... } },
);

await client.submitSuggestion(
  { title: "Mi idea", description: "Detalle" },
  { signature: "hmac-hex", auth: { ... } },
  "encrypted-email-optional",
);
```

### Server-side signing

```typescript
import { signRequestBody, generateNonce } from "@openfeedback/client/server";

// Genera nonce criptográficamente seguro (32 hex chars = 128 bits)
const nonce = generateNonce();

// Firma un body JSON
const signature = signRequestBody(jsonBody, hmacSecret);
```

---

## 6. Flujo Completo (Diagrama de Secuencia)

```
Browser                     Server Action              Edge Function         PostgreSQL
  │                              │                          │                    │
  │──[click votar]──────────────▶│                          │                    │
  │                              │                          │                    │
  │                              │ auth = {user_id,nonce,   │                    │
  │                              │   timestamp,project_id}  │                    │
  │                              │ body = JSON({auth,vote}) │                    │
  │                              │ sig = HMAC(body,secret)  │                    │
  │                              │                          │                    │
  │◀──{signature, auth}─────────│                          │                    │
  │                              │                          │                    │
  │──POST /submit-vote──────────────────────────────────────▶│                    │
  │  Header: x-openfeedback-sig │                          │                    │
  │  Body: {auth, vote}         │                          │                    │
  │                              │                          │                    │
  │                              │                          │──SELECT project──▶│
  │                              │                          │◀──hmac_secret─────│
  │                              │                          │                    │
  │                              │                          │ verify HMAC        │
  │                              │                          │ check nonce        │
  │                              │                          │ hash user_id       │
  │                              │                          │                    │
  │                              │                          │──INSERT vote─────▶│
  │                              │                          │                    │──trigger
  │                              │                          │                    │  upvotes++
  │                              │                          │◀──ok──────────────│
  │◀──{ok: true}─────────────────────────────────────────────│                    │
  │                              │                          │                    │
```
