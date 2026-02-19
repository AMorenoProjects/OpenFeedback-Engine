import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Git commit reference detection
// ---------------------------------------------------------------------------
// Detects references to OpenFeedback suggestion IDs in commit messages.
//
// Supported patterns:
//   [OF-<uuid>]           — explicit tag
//   OF-<uuid>             — inline mention
//   fixes #<uuid>         — GitHub-style fix reference
//   closes #<uuid>        — GitHub-style close reference
//   resolves #<uuid>      — GitHub-style resolve reference
//   ref #<uuid>           — generic reference
// ---------------------------------------------------------------------------

export interface CommitRef {
  /** The full commit hash */
  hash: string;
  /** Short commit message (first line) */
  message: string;
  /** ISO date of the commit */
  date: string;
  /** Suggestion IDs referenced in this commit */
  suggestionIds: string[];
  /** The type of reference detected */
  refType: "tag" | "fixes" | "closes" | "resolves" | "ref" | "mention";
}

const UUID_PATTERN = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

const REF_PATTERNS: Array<{ regex: RegExp; type: CommitRef["refType"] }> = [
  { regex: new RegExp(`\\[OF-(${UUID_PATTERN})\\]`, "gi"), type: "tag" },
  { regex: new RegExp(`(?:fixes|fix)\\s+#(${UUID_PATTERN})`, "gi"), type: "fixes" },
  { regex: new RegExp(`(?:closes|close)\\s+#(${UUID_PATTERN})`, "gi"), type: "closes" },
  { regex: new RegExp(`(?:resolves|resolve)\\s+#(${UUID_PATTERN})`, "gi"), type: "resolves" },
  { regex: new RegExp(`ref\\s+#(${UUID_PATTERN})`, "gi"), type: "ref" },
  { regex: new RegExp(`OF-(${UUID_PATTERN})`, "gi"), type: "mention" },
];

/**
 * Extract suggestion references from a commit message.
 * Returns deduplicated entries — if the same UUID is matched by multiple
 * patterns, the most specific match (earliest in REF_PATTERNS) wins.
 */
export function extractRefs(
  message: string,
): Array<{ id: string; type: CommitRef["refType"] }> {
  const seen = new Set<string>();
  const results: Array<{ id: string; type: CommitRef["refType"] }> = [];

  for (const { regex, type } of REF_PATTERNS) {
    // Reset lastIndex for global regex
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(message)) !== null) {
      const id = match[1]!.toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        results.push({ id, type });
      }
    }
  }

  return results;
}

/**
 * Scan git log for commits referencing OpenFeedback suggestion IDs.
 *
 * @param since - Git revision or date to start from (e.g. "v0.1.0", "2024-01-01")
 * @param until - Git revision or date to end at (default: HEAD)
 * @param cwd   - Working directory (default: process.cwd())
 */
export async function scanCommitRefs(options?: {
  since?: string;
  until?: string;
  cwd?: string;
}): Promise<CommitRef[]> {
  const args = [
    "log",
    "--format=%H%n%s%n%aI%n---",
  ];

  if (options?.since) {
    args.push(`${options.since}..${options.until ?? "HEAD"}`);
  }

  const { stdout } = await execFileAsync("git", args, {
    cwd: options?.cwd ?? process.cwd(),
  });

  const commits: CommitRef[] = [];
  const blocks = stdout.split("---\n").filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const hash = lines[0]!;
    const message = lines[1]!;
    const date = lines[2]!;
    const refs = extractRefs(message);
    if (refs.length === 0) continue;

    commits.push({
      hash,
      message,
      date,
      suggestionIds: refs.map((r) => r.id),
      refType: refs[0]!.type,
    });
  }

  return commits;
}
