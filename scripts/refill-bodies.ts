// Retries body extraction for articles still "pending", without spending Jina credits.
//
// Extraction tries Readability first and only then Jina. With no JINA_API_KEY configured, the fallback
// throws and the article stays "pending" — including the pages Readability can actually read (arXiv
// abstracts, official blogs) that merely failed on the first attempt. This script re-runs the
// Readability path only, and leaves a page "pending" again if it fails, so nothing is permanently
// written off as "unconfirmed".
//
//   node --env-file-if-exists=.env scripts/refill-bodies.ts --dry-run
//   node --env-file-if-exists=.env scripts/refill-bodies.ts
import { sql } from "@aihot/backend/db";
import { extractArticleBody, readable } from "@aihot/backend/content/extract";
import { guardedFetch } from "@aihot/backend/lib/http-fetch";

const USAGE = "usage: refill-bodies.ts [--dry-run]";

class UsageError extends Error {}

function parseArgs(argv: string[]): { dryRun: boolean } {
  let dryRun = false;
  for (const a of argv) {
    if (a === "--dry-run") dryRun = true;
    else throw new UsageError(`unknown argument: ${a}`);
  }
  return { dryRun };
}

try {
  const { dryRun } = parseArgs(process.argv.slice(2));
  const rows = await sql<{ id: string; source_id: string; url: string }[]>`
    SELECT id, source_id, url FROM articles WHERE body_status = 'pending' ORDER BY source_id, id`;
  console.log(`待抽取正文 ${rows.length} 篇${dryRun ? "（预演：只试不写）" : ""}`);

  let ok = 0;
  let kept = 0;
  for (const row of rows) {
    if (dryRun) {
      try {
        const res = await guardedFetch(row.url, { timeoutMs: 15_000, maxBytes: 6 * 1024 * 1024 });
        const got = res.status === 200 && /html/.test(res.headers.get("content-type") ?? "") ? readable(res.text(), res.url) : null;
        if (got) ok += 1;
        console.log(`${got ? "OK  " : "MISS"} ${row.source_id} ${String(got?.text.length ?? 0).padStart(6)} ${row.url.slice(0, 64)}`);
      } catch (error) {
        console.log(`ERR  ${row.source_id}      0 ${(error as Error).message.slice(0, 40)}`);
      }
      continue;
    }
    try {
      const status = await extractArticleBody(row.id, false);
      if (status === "ok") {
        ok += 1;
        console.log(`OK   ${row.source_id} ${row.url.slice(0, 64)}`);
      } else {
        // Readability missed and Jina is off: keep it pending so a configured key can still fetch it.
        await sql`UPDATE articles SET body_status = 'pending' WHERE id = ${row.id} AND body_status = 'unconfirmed'`;
        kept += 1;
        console.log(`MISS ${row.source_id} ${row.url.slice(0, 64)}`);
      }
    } catch (error) {
      kept += 1;
      console.log(`ERR  ${row.source_id} ${(error as Error).message.slice(0, 50)}`);
    }
  }
  if (!dryRun) console.log(`\n抽到正文 ${ok} 篇，仍待补 ${kept} 篇（配 JINA_API_KEY 后可再跑）`);
  else console.log(`\n预演：${ok}/${rows.length} 篇可以直接抽到正文`);
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
