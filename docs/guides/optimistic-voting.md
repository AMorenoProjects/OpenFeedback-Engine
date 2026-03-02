# Optimistic Voting y Anti-spam

> Desde v2.1, `useVote` aplica actualizaciones optimistas, rollback automático y protección anti-spam por sugerencia.

---

## Cambios en la API

### `useVote()`

```tsx
const { vote, isLoading, isVotingOn, error } = useVote();
```

| Campo        | Tipo                                  | Descripción                                              |
| ------------ | ------------------------------------- | -------------------------------------------------------- |
| `vote`       | `(id, direction) => Promise<Result>`  | Lanza el voto con update optimista inmediato.            |
| `isLoading`  | `boolean`                             | `true` si **cualquier** voto está en vuelo (backward compat). |
| `isVotingOn` | `(id: string) => boolean`             | Estado de carga **por sugerencia**.                      |
| `error`      | `Error \| null`                       | Último error producido.                                  |

### Resultado de `vote()`

| `action`      | Significado                                                        |
| ------------- | ------------------------------------------------------------------ |
| `"voted"`     | Voto registrado con éxito en el servidor.                          |
| `"removed"`   | Voto eliminado con éxito.                                          |
| `"throttled"` | Se ignoró porque ya hay un voto en vuelo para esa misma sugerencia.|

---

## Comportamiento

### Optimistic Update

Al llamar a `vote(id, "up")`, el contador `upvotes` de esa sugerencia se incrementa **inmediatamente** en la UI, antes de que el servidor responda. Para `"remove"`, se decrementa (mínimo 0).

Esto funciona a través de un sistema pub/sub interno en `OpenFeedbackProvider` que conecta `useVote` con `useSuggestions` sin acoplarlos directamente.

### Rollback automático

Si la petición al servidor falla, el delta optimista se revierte automáticamente:

```
vote("up") → upvotes + 1 → servidor falla → upvotes - 1
vote("remove") → upvotes - 1 → servidor falla → upvotes + 1
```

El error se expone en `error` y también se lanza como excepción.

### Anti-spam (per-suggestion lock)

Si el usuario hace clic repetidamente en el mismo botón de voto mientras hay una petición en vuelo, las llamadas extra se resuelven inmediatamente con `{ ok: true, action: "throttled" }` sin generar peticiones adicionales al servidor.

Votos en **distintas** sugerencias funcionan en paralelo sin bloqueo.

---

## Ejemplo de uso

```tsx
function VoteButton({ suggestion }: { suggestion: Suggestion }) {
  const { vote, isVotingOn } = useVote();
  const voting = isVotingOn(suggestion.id);

  const handleVote = async () => {
    try {
      const result = await vote(suggestion.id, "up");
      if (result.action === "throttled") return;
      // Voto exitoso — la UI ya se actualizó optimistamente
    } catch {
      // Rollback ya ocurrió — opcionalmente mostrar toast de error
    }
  };

  return (
    <button onClick={handleVote} disabled={voting}>
      {suggestion.upvotes}
    </button>
  );
}
```

---

## Arquitectura interna

```
useVote                        OpenFeedbackProvider                useSuggestions
  │                                   │                                │
  │── emitSuggestionUpdate(id, +1) ──▶│── broadcast ──────────────────▶│ setSuggestions()
  │                                   │                                │
  │── fetch(proxyUrl) ───────────────▶│ (servidor)                     │
  │                                   │                                │
  │◀── error ─────────────────────────│                                │
  │── emitSuggestionUpdate(id, -1) ──▶│── broadcast (rollback) ───────▶│ setSuggestions()
```

El Provider mantiene un `Set<Callback>` en un `useRef` para evitar re-renders innecesarios al registrar/desregistrar listeners.
