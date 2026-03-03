# @openfeedback/react — React SDK

Main package of the frontend SDK. Exports headless components (Shadcn style), hooks and utilities to embed feedback inside any React/Next.js application.

---

## Components

### `SuggestionSearch`

Reactive headless search component. Displays an input with a dropdown that filters existing suggestions with client-side debounce. When there are no matches, it indicates that a new idea will be created.

```tsx
import { SuggestionSearch } from "@openfeedback/react";

<SuggestionSearch
  value={title}
  onChange={setTitle}
  onSelect={(suggestion) => {
    // The user selected an existing suggestion
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

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | — | Controlled input value |
| `onChange` | `(value: string) => void` | — | Callback when the text changes |
| `onSelect` | `(suggestion: Suggestion) => void` | — | Callback when an existing suggestion is selected |
| `placeholder` | `string` | `"Search or create a suggestion..."` | Input placeholder |
| `className` | `string` | — | Root container class (merged with `cn()`) |
| `inputClassName` | `string` | — | `<input>` class |
| `dropdownClassName` | `string` | — | Results dropdown class |
| `itemClassName` | `string` | — | Class for each dropdown item |
| `debounceMs` | `number` | `250` | Debounce milliseconds before filtering |

**Shadcn Architecture:** the component does not impose its own styles. All classes are passed via props and merged with `cn()` (clsx + tailwind-merge), allowing full overrides from the host app.

---

### `TrustBadge`

Headless trust micro-copy component. Shows a padlock icon next to the user's masked email to convey security and privacy.

```tsx
import { TrustBadge } from "@openfeedback/react";

<TrustBadge
  userEmail="jandro@gmail.com"
  className="font-mono text-zinc-500"
/>
// Renders: 🔒 Sending as j***o@gmail.com securely
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `userEmail` | `string \| undefined` | — | User email. If not provided, the component renders nothing |
| `className` | `string` | — | Container class (merged with `cn()`) |

The email is automatically masked with `maskEmail()` so the full address is not exposed in the DOM.

---

## Hooks

### `useSearchSuggestions`

Hook that filters suggestions client-side with debounce. Uses `useSuggestions()` internally (data already cached by the provider), without the need for an additional endpoint.

```tsx
import { useSearchSuggestions } from "@openfeedback/react";

const { results, isSearching } = useSearchSuggestions({
  query: "dark mode",
  debounceMs: 300,
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `query` | `string` | — | Search text |
| `debounceMs` | `number` | `250` | Debounce milliseconds |

**Return:**

| Field | Type | Description |
|-------|------|-------------|
| `results` | `Suggestion[]` | Suggestions whose title contains the query (case-insensitive) |
| `isSearching` | `boolean` | `true` while the debounce is pending or the data is loading |

**Note:** the search uses `String.includes()` over the `title` field. It does not require a full-text index or an additional endpoint.

---

## Utilities

### `maskEmail`

Masks an email for UI display without exposing the full address.

```ts
import { maskEmail } from "@openfeedback/react";

maskEmail("jandro@gmail.com");   // "j***o@gmail.com"
maskEmail("ab@example.com");     // "a***b@example.com"
maskEmail("x@test.com");         // "x***@test.com"
```

**Rules:**
- If the local part has 3+ characters: the first character, `***`, and the last character are shown.
- If the local part has 1-2 characters: the first character and `***` are shown.
- The domain is never masked.

### `cn`

CSS classes merge utility (clsx + tailwind-merge). Allows composing Tailwind classes without specificity conflicts.

```ts
import { cn } from "@openfeedback/react";

cn("px-4 py-2", condition && "bg-blue-500", "px-6");
// → "py-2 px-6 bg-blue-500" (px-4 resolves in favor of px-6)
```

---

## Integration in demo-app

The demo-app (`apps/demo-app`) illustrates the complete integration of the new components.

### `NewSuggestionForm`

The suggestion creation form integrates `SuggestionSearch` and `TrustBadge`:

```tsx
<NewSuggestionForm
  userId={userId}
  userEmail="user@example.com"
  onCreated={() => refetch()}
  onExistingSelected={(suggestion) => {
    // Scroll to the existing suggestion in the list
  }}
/>
```

**Added Props:**

| Prop | Type | Description |
|------|------|-------------|
| `userEmail` | `string \| undefined` | Passed to the `TrustBadge` to display the trust micro-copy |
| `onExistingSelected` | `(suggestion: Suggestion) => void` | Fires when the user selects an existing suggestion from the dropdown instead of creating a new one |
| `className` | `string` | Allows style overrides in the form (via `cn()`) |

**Behavior:**
1. While typing in the title field, `SuggestionSearch` shows existing suggestions with debounce.
2. If the user selects an existing one, `onExistingSelected` is called and the input is cleared.
3. If there are no matches, the dropdown indicates "new idea" and the user can submit the form normally.
4. Below the submit button, `TrustBadge` shows the masked email if provided.

### `FeedbackBoard`

The board now accepts `userEmail` and handles scrolling to existing suggestions:

```tsx
<FeedbackBoard
  config={config}
  anonKey={anonKey}
  userId={userId}
  userEmail="user@example.com"
/>
```

When the user selects an existing suggestion from the search, the board scrolls to the corresponding card using `data-suggestion-id` as a selector.

---

## Full Package Exports

```ts
// Components
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
