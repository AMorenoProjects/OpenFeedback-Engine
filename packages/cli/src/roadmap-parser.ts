import { readFile } from "node:fs/promises";
import type { SuggestionStatusType } from "@openfeedback/client";

// ---------------------------------------------------------------------------
// Roadmap entry parsed from ROADMAP.md
// ---------------------------------------------------------------------------
// Format expected:
//   ## Section Header (maps to status)
//   - Item title <!-- id: <uuid> -->
//   - Another item <!-- id: <uuid> -->
// ---------------------------------------------------------------------------

export interface RoadmapEntry {
  id: string;
  title: string;
  status: SuggestionStatusType;
}

/** Maps common roadmap section headings to suggestion statuses. */
const HEADING_STATUS_MAP: Record<string, SuggestionStatusType> = {
  open: "open",
  backlog: "open",
  planned: "planned",
  "in progress": "in_progress",
  "in-progress": "in_progress",
  shipped: "shipped",
  done: "shipped",
  completed: "shipped",
  closed: "closed",
  rejected: "closed",
};

const ANCHOR_REGEX = /<!--\s*id:\s*([0-9a-f-]{36})\s*-->/i;
const HEADING_REGEX = /^#{1,3}\s+(.+)$/;
const LIST_ITEM_REGEX = /^[-*]\s+(.+)/;

/**
 * Parse a ROADMAP.md file and extract suggestion entries with their statuses.
 */
export async function parseRoadmap(filePath: string): Promise<RoadmapEntry[]> {
  const content = await readFile(filePath, "utf-8");
  return parseRoadmapContent(content);
}

/**
 * Parse roadmap markdown content into structured entries.
 */
export function parseRoadmapContent(content: string): RoadmapEntry[] {
  const lines = content.split("\n");
  const entries: RoadmapEntry[] = [];
  let currentStatus: SuggestionStatusType = "open";

  for (const line of lines) {
    const headingMatch = line.match(HEADING_REGEX);
    if (headingMatch?.[1]) {
      const heading = headingMatch[1].trim().toLowerCase();
      const mapped = HEADING_STATUS_MAP[heading];
      if (mapped) {
        currentStatus = mapped;
      }
      continue;
    }

    const listMatch = line.match(LIST_ITEM_REGEX);
    if (!listMatch) continue;

    const itemText = listMatch[1] ?? "";
    const anchorMatch = itemText.match(ANCHOR_REGEX);
    if (!anchorMatch?.[1]) continue;

    const id = anchorMatch[1];
    const title = itemText.replace(ANCHOR_REGEX, "").trim();

    entries.push({ id, title, status: currentStatus });
  }

  return entries;
}
