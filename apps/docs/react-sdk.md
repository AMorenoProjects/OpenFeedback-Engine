# @openfeedback/react — SDK de React

Paquete principal del SDK de frontend. Exporta componentes headless (estilo Shadcn), hooks y utilidades para embeber feedback en cualquier aplicación React/Next.js.

---

## Componentes

### `SuggestionSearch`

Componente headless de búsqueda reactiva. Muestra un input con dropdown que filtra las sugerencias existentes con debounce client-side. Cuando no hay coincidencias, indica que se creará una nueva idea.

```tsx
import { SuggestionSearch } from "@openfeedback/react";

<SuggestionSearch
  value={title}
  onChange={setTitle}
  onSelect={(suggestion) => {
    // El usuario seleccionó una sugerencia existente
    scrollToSuggestion(suggestion.id);
  }}
  placeholder="What should we build next?"
  className="relative"
  inputClassName="w-full border px-4 py-3"
  dropdownClassName="mt-1 bg-white border rounded shadow-lg max-h-48 overflow-y-auto"
  itemClassName="hover:bg-gray-100 cursor-pointer"
  debounceMs={300}
/>
```

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `value` | `string` | — | Valor controlado del input |
| `onChange` | `(value: string) => void` | — | Callback cuando el texto cambia |
| `onSelect` | `(suggestion: Suggestion) => void` | — | Callback cuando se selecciona una sugerencia existente |
| `placeholder` | `string` | `"Search or create a suggestion..."` | Placeholder del input |
| `className` | `string` | — | Clase del contenedor raíz (se fusiona con `cn()`) |
| `inputClassName` | `string` | — | Clase del `<input>` |
| `dropdownClassName` | `string` | — | Clase del dropdown de resultados |
| `itemClassName` | `string` | — | Clase de cada item del dropdown |
| `debounceMs` | `number` | `250` | Milisegundos de debounce antes de filtrar |

**Arquitectura Shadcn:** el componente no impone estilos propios. Todas las clases se pasan via props y se fusionan con `cn()` (clsx + tailwind-merge), permitiendo overrides completos desde la app host.

---

### `TrustBadge`

Componente headless de micro-copy de confianza. Muestra un icono de candado junto al email enmascarado del usuario para transmitir seguridad y privacidad.

```tsx
import { TrustBadge } from "@openfeedback/react";

<TrustBadge
  userEmail="jandro@gmail.com"
  className="font-mono text-zinc-500"
/>
// Renderiza: 🔒 Sending as j***o@gmail.com securely
```

**Props:**

| Prop | Tipo | Default | Descripción |
|------|------|---------|-------------|
| `userEmail` | `string \| undefined` | — | Email del usuario. Si no se proporciona, el componente no renderiza nada |
| `className` | `string` | — | Clase del contenedor (se fusiona con `cn()`) |

El email se enmascara automáticamente con `maskEmail()` para no exponer la dirección completa en el DOM.

---

## Hooks

### `useSearchSuggestions`

Hook que filtra sugerencias client-side con debounce. Usa `useSuggestions()` internamente (datos ya cacheados por el provider), sin necesidad de endpoint adicional.

```tsx
import { useSearchSuggestions } from "@openfeedback/react";

const { results, isSearching } = useSearchSuggestions({
  query: "dark mode",
  debounceMs: 300,
});
```

**Opciones:**

| Opción | Tipo | Default | Descripción |
|--------|------|---------|-------------|
| `query` | `string` | — | Texto de búsqueda |
| `debounceMs` | `number` | `250` | Milisegundos de debounce |

**Retorno:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `results` | `Suggestion[]` | Sugerencias cuyo título contiene el query (case-insensitive) |
| `isSearching` | `boolean` | `true` mientras el debounce está pendiente o los datos están cargando |

**Nota:** la búsqueda es por `String.includes()` sobre el campo `title`. No requiere índice full-text ni endpoint adicional.

---

## Utilidades

### `maskEmail`

Enmascara un email para mostrar en UI sin exponer la dirección completa.

```ts
import { maskEmail } from "@openfeedback/react";

maskEmail("jandro@gmail.com");   // "j***o@gmail.com"
maskEmail("ab@example.com");     // "a***b@example.com"
maskEmail("x@test.com");         // "x***@test.com"
```

**Reglas:**
- Si el local part tiene 3+ caracteres: se muestra el primero, `***`, y el último.
- Si el local part tiene 1-2 caracteres: se muestra el primero y `***`.
- El dominio nunca se enmascara.

### `cn`

Utilidad de fusión de clases CSS (clsx + tailwind-merge). Permite componer clases de Tailwind sin conflictos de especificidad.

```ts
import { cn } from "@openfeedback/react";

cn("px-4 py-2", condition && "bg-blue-500", "px-6");
// → "py-2 px-6 bg-blue-500" (px-4 se resuelve a favor de px-6)
```

---

## Integración en demo-app

La demo-app (`apps/demo-app`) ilustra la integración completa de los nuevos componentes.

### `NewSuggestionForm`

El formulario de creación de sugerencias integra `SuggestionSearch` y `TrustBadge`:

```tsx
<NewSuggestionForm
  userId={userId}
  userEmail="user@example.com"
  onCreated={() => refetch()}
  onExistingSelected={(suggestion) => {
    // Scroll hasta la sugerencia existente en la lista
  }}
/>
```

**Props añadidas:**

| Prop | Tipo | Descripción |
|------|------|-------------|
| `userEmail` | `string \| undefined` | Se pasa al `TrustBadge` para mostrar el micro-copy de confianza |
| `onExistingSelected` | `(suggestion: Suggestion) => void` | Se dispara cuando el usuario selecciona una sugerencia existente del dropdown en lugar de crear una nueva |
| `className` | `string` | Permite overrides de estilo en el form (via `cn()`) |

**Comportamiento:**
1. Al escribir en el campo de título, `SuggestionSearch` muestra sugerencias existentes con debounce.
2. Si el usuario selecciona una existente, se llama `onExistingSelected` y se limpia el input.
3. Si no hay coincidencias, el dropdown indica "nueva idea" y el usuario puede enviar el formulario normalmente.
4. Debajo del botón de submit, `TrustBadge` muestra el email enmascarado si se proporcionó.

### `FeedbackBoard`

El board ahora acepta `userEmail` y maneja el scroll a sugerencias existentes:

```tsx
<FeedbackBoard
  config={config}
  anonKey={anonKey}
  userId={userId}
  userEmail="user@example.com"
/>
```

Cuando el usuario selecciona una sugerencia existente desde el search, el board hace scroll hasta el card correspondiente usando `data-suggestion-id` como selector.

---

## Exports completos del paquete

```ts
// Componentes
export { OpenFeedbackProvider, useOpenFeedback } from "./components/OpenFeedbackProvider";
export { SuggestionSearch } from "./components/SuggestionSearch";
export { TrustBadge } from "./components/TrustBadge";

// Hooks
export { useSuggestions } from "./hooks/useSuggestions";
export { useVote } from "./hooks/useVote";
export { useSubmitSuggestion } from "./hooks/useSubmitSuggestion";
export { useSearchSuggestions } from "./hooks/useSearchSuggestions";

// Types
export type {
  OpenFeedbackConfig, OpenFeedbackProviderProps,
  Suggestion, SuggestionStatusType,
  AuthPayload, VoteIntent, VoteDirectionType, SuggestionIntent,
} from "./types";

// Utilities
export { cn } from "./utils/cn";
export { maskEmail } from "./utils/mask-email";
```
