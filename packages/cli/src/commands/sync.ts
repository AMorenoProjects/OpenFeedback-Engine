import { Command } from "commander";
import { resolve } from "node:path";
import { parseRoadmap, type RoadmapEntry } from "../roadmap-parser.js";

// ---------------------------------------------------------------------------
// openfeedback sync
// ---------------------------------------------------------------------------
// Reads ROADMAP.md, extracts suggestion anchors (<!-- id: UUID -->), and
// syncs their status with the Supabase database via PostgREST.
//
// Requires env vars:
//   OPENFEEDBACK_API_URL   — Supabase project URL
//   OPENFEEDBACK_SERVICE_KEY — Supabase service_role key (bypasses RLS)
//   OPENFEEDBACK_PROJECT_ID — Project UUID
// ---------------------------------------------------------------------------

interface SyncConfig {
  apiUrl: string;
  serviceKey: string;
  projectId: string;
}

function loadConfig(): SyncConfig {
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

async function fetchRemoteSuggestions(
  config: SyncConfig,
): Promise<Array<{ id: string; title: string; status: string }>> {
  const params = new URLSearchParams({
    project_id: `eq.${config.projectId}`,
    select: "id,title,status",
  });

  const res = await fetch(
    `${config.apiUrl}/rest/v1/suggestions?${params.toString()}`,
    {
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch suggestions: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<Array<{ id: string; title: string; status: string }>>;
}

async function updateSuggestionStatus(
  config: SyncConfig,
  id: string,
  status: string,
): Promise<void> {
  const res = await fetch(
    `${config.apiUrl}/rest/v1/suggestions?id=eq.${id}&project_id=eq.${config.projectId}`,
    {
      method: "PATCH",
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status }),
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to update suggestion ${id}: ${res.status} ${res.statusText}`);
  }
}

interface SyncResult {
  updated: Array<{ id: string; title: string; from: string; to: string }>;
  notFound: RoadmapEntry[];
  unchanged: number;
}

async function syncRoadmap(entries: RoadmapEntry[], config: SyncConfig): Promise<SyncResult> {
  const remote = await fetchRemoteSuggestions(config);
  const remoteMap = new Map(remote.map((s) => [s.id, s]));

  const result: SyncResult = { updated: [], notFound: [], unchanged: 0 };

  for (const entry of entries) {
    const remoteSuggestion = remoteMap.get(entry.id);

    if (!remoteSuggestion) {
      result.notFound.push(entry);
      continue;
    }

    if (remoteSuggestion.status === entry.status) {
      result.unchanged++;
      continue;
    }

    await updateSuggestionStatus(config, entry.id, entry.status);
    result.updated.push({
      id: entry.id,
      title: remoteSuggestion.title,
      from: remoteSuggestion.status,
      to: entry.status,
    });
  }

  return result;
}

export function registerSyncCommand(program: Command): void {
  program
    .command("sync")
    .description("Sync ROADMAP.md suggestion statuses with the database")
    .argument("[file]", "Path to ROADMAP.md", "ROADMAP.md")
    .option("--dry-run", "Show what would change without writing to the database")
    .action(async (file: string, opts: { dryRun?: boolean }) => {
      const filePath = resolve(process.cwd(), file);

      console.log(`Reading roadmap from ${filePath}...`);

      let entries: RoadmapEntry[];
      try {
        entries = await parseRoadmap(filePath);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to read roadmap: ${message}`);
        process.exit(1);
      }

      if (entries.length === 0) {
        console.log("No suggestion anchors found in roadmap.");
        return;
      }

      console.log(`Found ${entries.length} suggestion(s) in roadmap.\n`);

      if (opts.dryRun) {
        console.log("Dry run — parsed entries:");
        for (const entry of entries) {
          console.log(`  [${entry.status}] ${entry.title} (${entry.id})`);
        }
        return;
      }

      const config = loadConfig();
      const result = await syncRoadmap(entries, config);

      if (result.updated.length > 0) {
        console.log("Updated:");
        for (const u of result.updated) {
          console.log(`  ${u.title} — ${u.from} → ${u.to}`);
        }
      }

      if (result.notFound.length > 0) {
        console.log("\nNot found in database (skipped):");
        for (const nf of result.notFound) {
          console.log(`  ${nf.title} (${nf.id})`);
        }
      }

      console.log(
        `\nSync complete: ${result.updated.length} updated, ${result.unchanged} unchanged, ${result.notFound.length} not found.`,
      );
    });
}
