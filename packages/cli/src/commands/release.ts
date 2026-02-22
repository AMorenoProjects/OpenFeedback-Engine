import { Command } from "commander";
import { scanCommitRefs } from "../git-refs.js";

// ---------------------------------------------------------------------------
// openfeedback release
// ---------------------------------------------------------------------------
// A command designed to run in CI/CD.
// Scans git history for commits referencing OpenFeedback suggestion IDs
// since the last release, generates a changelog, and pushes to Supabase
// to mark those suggestions as "shipped" and notify users.
// ---------------------------------------------------------------------------

interface ReleaseConfig {
    apiUrl: string;
    serviceKey: string;
    projectId: string;
}

function loadConfig(): ReleaseConfig {
    const apiUrl = process.env.OPENFEEDBACK_API_URL;
    const serviceKey = process.env.OPENFEEDBACK_SERVICE_KEY;
    const projectId = process.env.OPENFEEDBACK_PROJECT_ID;

    if (!apiUrl || !serviceKey || !projectId) {
        console.error(
            "Missing required environment variables:\n" +
            "  OPENFEEDBACK_API_URL\n" +
            "  OPENFEEDBACK_SERVICE_KEY\n" +
            "  OPENFEEDBACK_PROJECT_ID",
        );
        process.exit(1);
    }

    return { apiUrl, serviceKey, projectId };
}

async function triggerProcessRelease(
    config: ReleaseConfig,
    version: string,
    suggestionIds: string[],
    changelogMarkdown: string,
): Promise<void> {
    const res = await fetch(`${config.apiUrl}/functions/v1/process-release`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.serviceKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            project_id: config.projectId,
            version,
            suggestion_ids: suggestionIds,
            changelog_markdown: changelogMarkdown,
        }),
    });

    if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to process release. Status: ${res.status}. Error: ${errorText}`);
    }
}

export function registerReleaseCommand(program: Command): void {
    program
        .command("release")
        .description("Generate changelog and mark suggestions as shipped via Edge Function")
        .argument("<version>", "The release version (e.g., v1.2.0)")
        .option("--since <ref>", "Start scanning from this git ref or date")
        .option("--until <ref>", "End scanning at this git ref (default: HEAD)", "HEAD")
        .option("--dry-run", "Show what would be pushed without executing the HTTP request")
        .action(async (version: string, opts: { since?: string; until?: string; dryRun?: boolean }) => {
            try {
                console.log(`Analyzing Git history for release ${version}...`);

                const commits = await scanCommitRefs({
                    since: opts.since,
                    until: opts.until,
                });

                if (commits.length === 0) {
                    console.log("No commits referencing OpenFeedback suggestions found in this range. Exiting.");
                    return;
                }

                // Group by suggestion ID to build a changelog string
                const bySuggestion = new Map<
                    string,
                    Array<{ hash: string; message: string; date: string; refType: string }>
                >();

                for (const commit of commits) {
                    for (const id of commit.suggestionIds) {
                        const existing = bySuggestion.get(id) ?? [];
                        existing.push({
                            hash: commit.hash.substring(0, 8),
                            message: commit.message,
                            date: commit.date,
                            refType: commit.refType,
                        });
                        bySuggestion.set(id, existing);
                    }
                }

                const suggestionIds = Array.from(bySuggestion.keys());

                // Build Changelog Markdown
                let changelogMarkdown = `## Release ${version}\n\n`;
                changelogMarkdown += `This release resolves the following community feedback:\n\n`;

                for (const [id, refs] of bySuggestion) {
                    changelogMarkdown += `- **Suggestion ${id.slice(0, 8)}...**\n`;
                    for (const ref of refs) {
                        changelogMarkdown += `  - \`${ref.hash}\` ${ref.message}\n`;
                    }
                }

                console.log(`\nPrepared Changelog for ${suggestionIds.length} resolved suggestions:\n`);
                console.log("---------------------------------------------------");
                console.log(changelogMarkdown);
                console.log("---------------------------------------------------\n");

                if (opts.dryRun) {
                    console.log("Dry run — exiting without hitting the Edge Function.");
                    return;
                }

                const config = loadConfig();
                console.log("Triggering Edge Function `process-release`...");

                await triggerProcessRelease(config, version, suggestionIds, changelogMarkdown);

                console.log("\nSuccess! Release processed and suggestions marked as shipped.");

            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`\nFatal error processing release: ${message}`);
                process.exit(1);
            }
        });
}
