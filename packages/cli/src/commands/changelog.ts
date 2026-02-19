import { Command } from "commander";
import { scanCommitRefs } from "../git-refs.js";

// ---------------------------------------------------------------------------
// openfeedback changelog
// ---------------------------------------------------------------------------
// Scans git history for commits referencing OpenFeedback suggestion IDs
// and outputs a grouped summary. Foundation for automated changelog generation.
// ---------------------------------------------------------------------------

export function registerChangelogCommand(program: Command): void {
  program
    .command("changelog")
    .description("Scan git commits for OpenFeedback suggestion references")
    .option("--since <ref>", "Start from this git ref or date (e.g. v0.1.0, 2024-01-01)")
    .option("--until <ref>", "End at this git ref (default: HEAD)", "HEAD")
    .option("--json", "Output as JSON instead of human-readable text")
    .action(async (opts: { since?: string; until?: string; json?: boolean }) => {
      try {
        const commits = await scanCommitRefs({
          since: opts.since,
          until: opts.until,
        });

        if (commits.length === 0) {
          console.log("No commits referencing OpenFeedback suggestions found.");
          return;
        }

        if (opts.json) {
          console.log(JSON.stringify(commits, null, 2));
          return;
        }

        // Group by suggestion ID
        const bySuggestion = new Map<
          string,
          Array<{ hash: string; message: string; date: string; refType: string }>
        >();

        for (const commit of commits) {
          for (const id of commit.suggestionIds) {
            const existing = bySuggestion.get(id) ?? [];
            existing.push({
              hash: commit.hash.slice(0, 8),
              message: commit.message,
              date: commit.date,
              refType: commit.refType,
            });
            bySuggestion.set(id, existing);
          }
        }

        console.log(`Found ${commits.length} commit(s) referencing ${bySuggestion.size} suggestion(s):\n`);

        for (const [id, refs] of bySuggestion) {
          console.log(`  Suggestion ${id}:`);
          for (const ref of refs) {
            console.log(`    ${ref.hash} ${ref.message} (${ref.refType}, ${ref.date})`);
          }
          console.log();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to scan git history: ${message}`);
        process.exit(1);
      }
    });
}
