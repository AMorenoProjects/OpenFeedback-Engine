# Optimistic Voting and Anti-spam

> Since v2.1, `useVote` applies immediate optimistic updates, automatic rollback, and per-suggestion anti-spam protection.

---

## API Changes

### `useVote()`

```tsx
const { vote, isLoading, isVotingOn, error } = useVote();
```

| Field        | Type                                  | Description                                              |
| ------------ | ------------------------------------- | -------------------------------------------------------- |
| `vote`       | `(id, direction) => Promise<Result>`  | Fires the vote with an immediate optimistic update.      |
| `isLoading`  | `boolean`                             | `true` if **any** vote is en route (backward compat).    |
| `isVotingOn` | `(id: string) => boolean`             | Loading state **per suggestion**.                        |
| `error`      | `Error \| null`                       | Last produced error.                                     |

### Result of `vote()`

| `action`      | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `"voted"`     | Vote successfully registered on the server.                        |
| `"removed"`   | Vote successfully removed.                                         |
| `"throttled"` | Ignored because there is already a vote en route for that suggestion.|

---

## Behavior

### Optimistic Update

When calling `vote(id, "up")`, the `upvotes` counter for that suggestion increments **immediately** in the UI, before the server replies. For `"remove"`, it decrements (minimum 0).

This works through an internal pub/sub system in `OpenFeedbackProvider` that connects `useVote` with `useSuggestions` without coupling them directly.

### Automatic Rollback

If the request to the server fails, the optimistic delta is automatically reverted:

```
vote("up") → upvotes + 1 → server fails → upvotes - 1
vote("remove") → upvotes - 1 → server fails → upvotes + 1
```

The error is exposed in `error` and is also thrown as an exception.

### Anti-spam (per-suggestion lock)

If the user clicks repeatedly on the same vote button while there is a request en route, the extra calls are resolved immediately with `{ ok: true, action: "throttled" }` without generating additional server requests.

Votes on **different** suggestions run in parallel without blocking.

---

## Usage Example

```tsx
function VoteButton({ suggestion }: { suggestion: Suggestion }) {
  const { vote, isVotingOn } = useVote();
  const voting = isVotingOn(suggestion.id);

  const handleVote = async () => {
    try {
      const result = await vote(suggestion.id, "up");
      if (result.action === "throttled") return;
      // Successful vote — the UI is already optimistically updated
    } catch {
      // Rollback already occurred — optionally display an error toast
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

## Internal Architecture

```
useVote                        OpenFeedbackProvider                useSuggestions
  │                                   │                                │
  │── emitSuggestionUpdate(id, +1) ──▶│── broadcast ──────────────────▶│ setSuggestions()
  │                                   │                                │
  │── fetch(proxyUrl) ───────────────▶│ (server)                       │
  │                                   │                                │
  │◀── error ─────────────────────────│                                │
  │── emitSuggestionUpdate(id, -1) ──▶│── broadcast (rollback) ───────▶│ setSuggestions()
```

The Provider maintains a `Set<Callback>` on a `useRef` to avoid unnecessary re-renders when registering/unregistering listeners.
