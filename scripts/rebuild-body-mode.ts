// Recomputes publications.body_mode after the station's full-text policy changes.
//
// body_mode is decided once, when an article is published: "full" only when its source allows the
// station to show the whole text (sources.site_fulltext) and the body was actually extracted. Turning
// that permission on later leaves every existing row on "summary", so those pages keep showing only the
// AI digest even though the body is in the database. This script re-applies the same rule (bodyModeOf)
// to every published row.
//
//   node --env-file-if-exists=.env scripts/rebuild-body-mode.ts --dry-run
//   node --env-file-if-exists=.env scripts/rebuild-body-mode.ts
//   node --env-file-if-exists=.env scripts/rebuild-body-mode.ts --sync-sources   # 从 industry/sources.json 同步 site_fulltext
//
// --sync-sources is needed because the seed never overwrites a source that already exists: editing
// industry/sources.json alone does not change the running site.
import { readFile } from "node:fs/promises";
import { sql } from "@aihot/backend/db";

interface SourceEntry { id: string; site_fulltext?: boolean; syndicate_fulltext?: boolean }

const USAGE = "usage: rebuild-body-mode.ts [--dry-run] [--sync-sources]";

class UsageError extends Error {}

function parseArgs(argv: string[]): { dryRun: boolean; syncSources: boolean } {
  let dryRun = false;
  let syncSources = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else if (a === "--sync-sources") syncSources = true;
    else throw new UsageError(`unknown argument: ${a}`);
  }
  return { dryRun, syncSources };
}

async function syncSourcesFromFile(dryRun: boolean): Promise<void> {
  const raw = await readFile(new URL("../industry/sources.json", import.meta.url), "utf8");
  const entries = (JSON.parse(raw) as { sources: SourceEntry[] }).sources;
  let changed = 0;
  for (const s of entries) {
    if (typeof s.site_fulltext !== "boolean") continue;
    const [row] = await sql<{ id: string }[]>`
      SELECT id FROM sources
      WHERE id = ${s.id} AND site_fulltext IS DISTINCT FROM ${s.site_fulltext}`;
    if (!row) continue;
    changed += 1;
    if (dryRun) continue;
    await sql`
      UPDATE sources SET site_fulltext = ${s.site_fulltext}, syndicate_fulltext = ${s.syndicate_fulltext ?? false},
             updated_at = now()
      WHERE id = ${s.id}`;
  }
  console.log(`sources: ${changed} 条需要更新${dryRun ? "（预演，未写入）" : ""}`);
}

/** The rule bodyModeOf applies at publish time, in one statement. */
async function rebuildBodyMode(dryRun: boolean): Promise<void> {
  const [{ full, summary } = { full: 0, summary: 0 }] = await sql<{ full: number; summary: number }[]>`
    SELECT count(*) FILTER (WHERE s.site_fulltext AND a.body_status = 'ok' AND length(coalesce(a.body_text, '')) > 0)::int AS full,
           count(*) FILTER (WHERE NOT (s.site_fulltext AND a.body_status = 'ok' AND length(coalesce(a.body_text, '')) > 0))::int AS summary
    FROM publications p JOIN articles a ON a.id = p.article_id JOIN sources s ON s.id = a.source_id`;
  const [stale] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n
    FROM publications p JOIN articles a ON a.id = p.article_id JOIN sources s ON s.id = a.source_id
    WHERE p.body_mode IS DISTINCT FROM
      (CASE WHEN s.site_fulltext AND a.body_status = 'ok' AND length(coalesce(a.body_text, '')) > 0 THEN 'full' ELSE 'summary' END)`;
  console.log(`publications: 目标 full=${full} summary=${summary}，需要更新 ${stale?.n ?? 0} 条${dryRun ? "（预演，未写入）" : ""}`);
  if (dryRun || !stale?.n) return;
  await sql`
    UPDATE publications p
    SET body_mode = CASE WHEN s.site_fulltext AND a.body_status = 'ok' AND length(coalesce(a.body_text, '')) > 0
                         THEN 'full' ELSE 'summary' END,
        updated_at = now()
    FROM articles a JOIN sources s ON s.id = a.source_id
    WHERE p.article_id = a.id
      AND p.body_mode IS DISTINCT FROM
          (CASE WHEN s.site_fulltext AND a.body_status = 'ok' AND length(coalesce(a.body_text, '')) > 0
                THEN 'full' ELSE 'summary' END)`;
}

try {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.syncSources) await syncSourcesFromFile(opts.dryRun);
  await rebuildBodyMode(opts.dryRun);
} catch (error) {
  if (error instanceof UsageError) {
    console.error(USAGE);
    console.error(error.message);
    process.exit(2);
  }
  console.error(error);
  process.exit(1);
}
process.exit(0);
