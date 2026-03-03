# @openfeedback/cli

Command-line tool for OpenFeedback Engine. It allows synchronizing the state of suggestions from a local `ROADMAP.md` file to the database, and scanning the git history to detect commits that reference suggestions (basis for automatic changelog generation).

## Installation

The package is located in `packages/cli` within the monorepo. To build it:

```bash
pnpm --filter @openfeedback/cli build
```

After building, the binary is available at `packages/cli/dist/index.js` and is registered as the `openfeedback` executable in the `bin` field of `package.json`.

To link it globally during development:

```bash
# From the root of the monorepo
pnpm --filter @openfeedback/cli build
cd packages/cli
pnpm link --global
```

Then you can invoke it directly:

```bash
openfeedback --help
openfeedback --version
```

## Environment Variables

The `sync` command requires the following variables to connect to Supabase. Without them, the process will exit with an error indicating which ones are missing.

| Variable                    | Description                                                                 | Example                                     |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| `OPENFEEDBACK_API_URL`      | Base URL of the Supabase project                                              | `https://xyzcompany.supabase.co`            |
| `OPENFEEDBACK_SERVICE_KEY`  | Supabase `service_role` key (bypasses RLS, never expose to the client) | `eyJhbGciOiJIUzI1NiIs...`                   |
| `OPENFEEDBACK_PROJECT_ID`   | UUID of the project in the `projects` table                                    | `a1b2c3d4-e5f6-7890-abcd-ef1234567890`     |

It is recommended to use a local `.env` file (excluded from git) or export the variables in the shell session before running the command.

```bash
export OPENFEEDBACK_API_URL="https://xyzcompany.supabase.co"
export OPENFEEDBACK_SERVICE_KEY="eyJhbGci..."
export OPENFEEDBACK_PROJECT_ID="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

> **Security:** the `service_role` key has full access to the database. Do not include it in client code or public repositories.

---

## Commands

### `openfeedback sync`

Synchronizes the status of the suggestions defined in a `ROADMAP.md` file with the Supabase database.

```
Usage: openfeedback sync [options] [file]

Sync ROADMAP.md suggestion statuses with the database

Arguments:
  file        Path to ROADMAP.md (default: "ROADMAP.md")

Options:
  --dry-run   Show what would change without writing to the database
  -h, --help  display help for command
```

#### ROADMAP.md File Format

The file follows a Markdown convention where headings (`##`) determine the state and list items (`-` or `*`) represent individual suggestions. Each suggestion must include an HTML anchor with the database UUID:

```markdown
# Roadmap

## Planned
- Dark mode support <!-- id: a1b2c3d4-e5f6-7890-abcd-ef1234567890 -->
- CSV export <!-- id: b2c3d4e5-f6a7-8901-bcde-f12345678901 -->

## In Progress
- Real-time notifications <!-- id: c3d4e5f6-a7b8-9012-cdef-123456789012 -->

## Shipped
- Voting system <!-- id: d4e5f6a7-b8c9-0123-defa-234567890123 -->

## Closed
- Legacy integration discarded <!-- id: e5f6a7b8-c9d0-1234-efab-345678901234 -->
```

The anchor has the format `<!-- id: <uuid> -->` where `<uuid>` is the 36-character identifier (standard UUID v4 format) of the suggestion in the `suggestions` table.

#### Heading to Status Mapping

The parser recognizes the following headings (case-insensitive) and translates them to the `status` field of the `suggestions` table:

| Heading      | Resulting Status |
| --------------- | ----------------- |
| `Open`          | `open`            |
| `Backlog`       | `open`            |
| `Planned`       | `planned`         |
| `In Progress`   | `in_progress`     |
| `In-Progress`   | `in_progress`     |
| `Shipped`       | `shipped`         |
| `Done`          | `shipped`         |
| `Completed`     | `shipped`         |
| `Closed`        | `closed`          |
| `Rejected`      | `closed`          |

Headings support levels `#`, `##` and `###`. If a heading doesn't match any of the above, the current status is kept (defaulting to `open` at the beginning of the document).

Suggestions without an `<!-- id: ... -->` anchor are silently ignored.

#### Dry-run Mode

Running with `--dry-run` parses the file and shows the detected entries without connecting to the database. It does not require environment variables.

```bash
openfeedback sync --dry-run
```

Example output:

```
Reading roadmap from /home/user/project/ROADMAP.md...
Found 4 suggestion(s) in roadmap.

Dry run — parsed entries:
  [planned] Dark mode support (a1b2c3d4-e5f6-7890-abcd-ef1234567890)
  [planned] CSV export (b2c3d4e5-f6a7-8901-bcde-f12345678901)
  [in_progress] Real-time notifications (c3d4e5f6-a7b8-9012-cdef-123456789012)
  [shipped] Voting system (d4e5f6a7-b8c9-0123-defa-234567890123)
```

#### Real Synchronization

Without `--dry-run`, the command:

1. Reads and parses the `ROADMAP.md` file.
2. Fetches all project suggestions from the Supabase REST API (`GET /rest/v1/suggestions`).
3. Compares the local state (from markdown) with the remote one (from the database).
4. Updates via `PATCH` only the suggestions whose status has changed.
5. Reports suggestions not found in the database (markdown IDs that don't exist remotely).

```bash
openfeedback sync
```

Example output:

```
Reading roadmap from /home/user/project/ROADMAP.md...
Found 4 suggestion(s) in roadmap.

Updated:
  Dark mode support — open → planned
  Voting system — in_progress → shipped

Not found in database (skipped):
  CSV export (b2c3d4e5-f6a7-8901-bcde-f12345678901)

Sync complete: 2 updated, 1 unchanged, 1 not found.
```

#### Alternative File

You can specify a file other than `ROADMAP.md`:

```bash
openfeedback sync docs/public-roadmap.md
openfeedback sync --dry-run ./my-roadmap.md
```

---

### `openfeedback changelog`

Scans the git commit history for references to OpenFeedback suggestion IDs. Groups the results by suggestion to facilitate changelog generation.

```
Usage: openfeedback changelog [options]

Scan git commits for OpenFeedback suggestion references

Options:
  --since <ref>  Start from this git ref or date (e.g. v0.1.0, 2024-01-01)
  --until <ref>  End at this git ref (default: HEAD) (default: "HEAD")
  --json         Output as JSON instead of human-readable text
  -h, --help     display help for command
```

#### Recognized Reference Patterns

The scanner looks for the following patterns in commit messages (case-insensitive). The UUID must be a full 36-character UUID v4:

| Pattern                  | Detected Type | Commit Example                                            |
| ----------------------- | -------------- | ------------------------------------------------------------ |
| `[OF-<uuid>]`          | `tag`          | `feat: dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890]` |
| `OF-<uuid>`            | `mention`      | `refactor related to OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `fix(es) #<uuid>`      | `fixes`        | `fix: color contrast fixes #a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `close(s) #<uuid>`     | `closes`       | `feat: implement feature closes #a1b2c3d4-...`              |
| `resolve(s) #<uuid>`   | `resolves`     | `resolves #a1b2c3d4-...`                                    |
| `ref #<uuid>`          | `ref`          | `docs: update readme ref #a1b2c3d4-...`                     |

When the same UUID is detected by multiple patterns, the most specific one is kept (priority order: tag > fixes > closes > resolves > ref > mention).

#### Filter by Range

```bash
# Commits from a tag to HEAD
openfeedback changelog --since v0.1.0

# Commits between two tags
openfeedback changelog --since v0.1.0 --until v0.2.0

# Commits from a date
openfeedback changelog --since 2025-01-01
```

Without `--since`, the entire repository history is scanned.

#### Readable Output

```bash
openfeedback changelog --since v0.1.0
```

```
Found 3 commit(s) referencing 2 suggestion(s):

  Suggestion a1b2c3d4-e5f6-7890-abcd-ef1234567890:
    abcd1234 feat: dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890] (tag, 2025-06-15T10:30:00+02:00)
    efgh5678 fix: dark mode contrast fixes #a1b2c3d4-e5f6-7890-abcd-ef1234567890 (fixes, 2025-06-16T14:20:00+02:00)

  Suggestion c3d4e5f6-a7b8-9012-cdef-123456789012:
    ijkl9012 feat: notifications closes #c3d4e5f6-a7b8-9012-cdef-123456789012 (closes, 2025-06-17T09:00:00+02:00)
```

#### JSON Output

For integration with scripts or CI/CD pipelines:

```bash
openfeedback changelog --since v0.1.0 --json
```

```json
[
  {
    "hash": "abcd1234efgh5678ijkl9012mnop3456qrst7890",
    "message": "feat: dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890]",
    "date": "2025-06-15T10:30:00+02:00",
    "suggestionIds": ["a1b2c3d4-e5f6-7890-abcd-ef1234567890"],
    "refType": "tag"
  }
]
```

Each object in the array contains:

| Field            | Type       | Description                                                     |
| ---------------- | ---------- | --------------------------------------------------------------- |
| `hash`           | `string`   | Full commit hash (40 characters)                        |
| `message`        | `string`   | First line of the commit message                             |
| `date`           | `string`   | Commit date in ISO 8601 format                            |
| `suggestionIds`  | `string[]` | UUIDs of the suggestions referenced in that commit            |
| `refType`        | `string`   | Primary reference type: `tag`, `fixes`, `closes`, `resolves`, `ref`, `mention` |

---

## Internal Architecture

```
packages/cli/src/
  index.ts              # Entry point: registers commands and runs commander
  roadmap-parser.ts     # ROADMAP.md format parser → RoadmapEntry[]
  git-refs.ts           # Detection of suggestion references in git commits
  commands/
    sync.ts             # `sync` command: reads roadmap, compares with DB, updates
    changelog.ts        # `changelog` command: scans git log, groups by suggestion
```

### roadmap-parser.ts

Standalone module that exports two functions:

- `parseRoadmap(filePath)` — Reads the file from disk and delegates to the parser.
- `parseRoadmapContent(content)` — Parses a Markdown string. Useful for testing without filesystem access.

Both return an array of `RoadmapEntry`:

```typescript
interface RoadmapEntry {
  id: string;                  // Suggestion UUID
  title: string;               // Item text (without the HTML anchor)
  status: SuggestionStatusType; // "open" | "planned" | "in_progress" | "shipped" | "closed"
}
```

The `SuggestionStatusType` type is imported from `@openfeedback/client`, ensuring stats are always consistent with the database Zod schema.

### git-refs.ts

Standalone module that exports:

- `extractRefs(message)` — Extracts references from a string (a commit message). Returns a deduplicated array of `{ id, type }`.
- `scanCommitRefs(options?)` — Runs `git log` with custom format and filters commits containing references. Returns an array of `CommitRef`.

```typescript
interface CommitRef {
  hash: string;            // Full commit hash
  message: string;         // First line of the message
  date: string;            // ISO 8601 date
  suggestionIds: string[]; // Referenced UUIDs
  refType: "tag" | "fixes" | "closes" | "resolves" | "ref" | "mention";
}
```

Detection uses regular expressions evaluated in priority order. If a UUID matches multiple patterns (e.g., `[OF-<uuid>]` contains both the `tag` and `mention` pattern), only the most specific match is recorded.

### Sync Command Flow

```
ROADMAP.md
    │
    ▼
parseRoadmap()  ──►  RoadmapEntry[]
                         │
                         ▼
              fetchRemoteSuggestions()  ──►  Remote suggestions (DB)
                         │
                         ▼
                     Comparison by ID
                    ┌─────────────────────────┐
                    │ Same status → unchanged │
                    │ Different   → PATCH      │
                    │ Not found   → notFound   │
                    └─────────────────────────┘
                         │
                         ▼
                   Console summary
```

### Changelog Command Flow

```
git log --format="%H%n%s%n%aI%n---"
    │
    ▼
scanCommitRefs()
    │
    ├── For each commit: extractRefs(message)
    │       │
    │       ▼
    │   Regex patterns evaluated in priority order
    │   UUID Deduplication
    │
    ▼
CommitRef[] (only commits with ≥1 reference)
    │
    ▼
Grouping by suggestion ID → readable or JSON output
```

---

## Build and Development

```bash
# Build only the CLI (requires @openfeedback/client to be built)
pnpm --filter @openfeedback/client build
pnpm --filter @openfeedback/cli build

# Build the whole monorepo (Turborepo resolves dependency order)
pnpm build

# Watch mode for development
pnpm --filter @openfeedback/cli dev

# Type check without building
pnpm --filter @openfeedback/cli type-check
```

The CLI is built with `tsup` in ESM format. The `#!/usr/bin/env node` banner is injected automatically so the resulting file is directly executable as a Node.js script.

### Dependencies

| Package                  | Purpose                                                   |
| ------------------------ | ----------------------------------------------------------- |
| `commander`              | Framework for argument parsing and command registration |
| `@openfeedback/client`   | Shared types (`SuggestionStatusType`) derived from Zod schemas |

---

## Commit Message Conventions

For `openfeedback changelog` to detect references correctly, include the suggestion UUID in the commit message using any of these formats:

```bash
# Recommended format: explicit tag
git commit -m "feat: implement dark mode [OF-a1b2c3d4-e5f6-7890-abcd-ef1234567890]"

# GitHub-style format
git commit -m "fix: contrast ratio fixes #a1b2c3d4-e5f6-7890-abcd-ef1234567890"
git commit -m "feat: real-time updates closes #c3d4e5f6-a7b8-9012-cdef-123456789012"

# Generic reference
git commit -m "docs: update API docs ref #a1b2c3d4-e5f6-7890-abcd-ef1234567890"
```

A single commit can reference multiple suggestions:

```bash
git commit -m "feat: batch export [OF-aaaa...] closes #bbbb..."
```
