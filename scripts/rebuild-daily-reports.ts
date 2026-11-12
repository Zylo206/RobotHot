// Rebuilds daily issues for days that were already over when their material arrived.
//
// A new site's first import is entirely backfill (source-dated, imported later), and the live rules only
// count fresh, already-visible items — so every past day stays empty forever. This script composes those
// days in historical mode: eligible items count on the day they were published, the import's own visibility
// time is ignored, and the edition is saved with origin='imported' so it stays distinguishable from a live
// one. The scheduled 08:00 run and the hourly catch-up never overwrite an existing key.
//
//   node --env-file-if-exists=.env scripts/rebuild-daily-reports.ts --from 2026-11-06 --to 2026-11-12
//   node --env-file-if-exists=.env scripts/rebuild-daily-reports.ts --from 2026-11-06 --to 2026-11-12 --dry-run
//
// Days with no eligible material are skipped (an existing empty edition is left untouched).
import { candidates, composeDaily } from "@aihot/backend/reports/compose";
import { addDays, beijingMidnight, isValidDate } from "@aihot/contracts/time";

const USAGE = "usage: rebuild-daily-reports.ts --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run]";

interface Options { from: string; to: string; dryRun: boolean }

class UsageError extends Error {}

function parseArgs(argv: string[]): Options {
  let from: string | undefined;
  let to: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--from") from = argv[++i];
    else if (a === "--to") to = argv[++i];
    else if (a === "--dry-run") dryRun = true;
    else throw new UsageError(`unknown argument: ${a}`);
  }
  if (!from || !to) throw new UsageError("--from and --to are required");
  if (!isValidDate(from) || !isValidDate(to)) throw new UsageError("--from and --to must be real calendar dates");
  if (from > to) throw new UsageError("--from must not be after --to");
  return { from, to, dryRun };
}

/** Same window composeDaily uses: [D-1 08:00, D 08:00) Beijing time. */
function windowOf(date: string): { start: Date; end: Date } {
  const end = new Date(beijingMidnight(date).getTime() + 8 * 3600 * 1000);
  return { start: new Date(end.getTime() - 86400000), end };
}

async function run(argv: string[]): Promise<number> {
  let opts: Options;
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(`rebuild-daily-reports: ${(error as Error).message}`);
    console.error(USAGE);
    return 2;
  }

  let total = 0;
  const rebuilt: string[] = [];
  const skipped: string[] = [];
  for (let date = opts.from; date <= opts.to; date = addDays(date, 1)) {
    const { start, end } = windowOf(date);
    const found = await candidates(start, end, { historical: true });
    if (found.length === 0) {
      skipped.push(date);
      console.log(`${date}: 无可用素材，跳过`);
      continue;
    }
    if (opts.dryRun) {
      const top = found.slice(0, 3).map((c) => `${c.score ?? "-"} ${c.title.slice(0, 24)}`).join(" / ");
      console.log(`${date}: 可补 ${found.length} 条（${top}）`);
      rebuilt.push(date);
      total += found.length;
      continue;
    }
    const result = await composeDaily(date, "rebuild-backfill", { historical: true, origin: "imported" });
    console.log(`${date}: 已生成 ${result.entries} 条`);
    rebuilt.push(date);
    total += result.entries;
  }

  console.log(`\n${opts.dryRun ? "预演" : "完成"}：${rebuilt.length} 天 / ${total} 条${skipped.length ? `，跳过 ${skipped.length} 天（无素材）` : ""}`);
  if (rebuilt.length) console.log(`${opts.dryRun ? "将重建" : "已重建"}：${rebuilt.join(", ")}`);
  return 0;
}

process.exit(await run(process.argv.slice(2)));
