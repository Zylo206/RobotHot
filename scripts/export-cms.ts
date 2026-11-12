// Exports one day's selected items and daily report from the public API (or from a saved snapshot) as
// CMS-ready Markdown plus a manifest.json — the shape for uploading to a news page such as
// https://www.ecovacs-tech.com/news (title + summary + date per article).
//   node scripts/export-cms.ts [--base http://localhost:3000] [--input snapshot.json]
//        [--date 2026-09-29] [--window 24h|7d] [--out export] [--force]
// Fail-closed: a missing title, summary, source name, original link, self link or category on any
// selected item — or on any daily entry — aborts the whole export with exit code 2 and writes nothing.
// Reverse-verify with: node scripts/export-cms-selftest.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE, withSubject } from "@aihot/industry/site";
import { CATEGORY_LABELS, isCategoryKey } from "@aihot/contracts/taxonomy";
import { beijingDate, beijingTime, isValidDate } from "@aihot/contracts/time";

export const USAGE = "usage: export-cms.ts [--base URL] [--input snapshot.json] [--date YYYY-MM-DD] [--window 24h|7d] [--out DIR] [--force]";

/** Every fail-closed stop throws this; runExport turns it into exit code 2. */
class ExportError extends Error {}

// Per-run collectors, reassigned at the start of every runExport so one process can export twice.
let problems: string[] = [];
let warnings: string[] = [];

function die(message: string): never {
  throw new ExportError(message);
}

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const httpUrl = (value: unknown): value is string => nonEmpty(value) && /^https?:\/\//i.test(value);
const yamlStr = (value: string) => JSON.stringify(value);

interface Attribution { name: string; url: string }
interface ApiItem {
  id: string; title: string; originalTitle: string | null; summary: string | null;
  source: { name: string } | null; links: { aihot: string; original: string } | null;
  publishedAt: string | null; discoveredAt: string; category: string | null;
  score: number | null; selected: boolean; reason?: string | null; attribution?: Attribution;
}
interface DailyEntry { title: string; summary?: string; source: { name: string } | null; links: { aihot: string | null; original: string }; attribution?: Attribution }
interface DailyFlash extends DailyEntry { publishedAt: string }
interface DailyReport {
  date: string; generatedAt: string; windowStart: string; windowEnd: string; links: { aihot: string };
  lead: { title: string; leadParagraph: string } | null; sections: Array<{ label: string; items: DailyEntry[] }>;
  flashes: DailyFlash[]; attribution?: Attribution;
}

function checkItem(item: unknown, where: string): void {
  const it = item as ApiItem;
  const id = nonEmpty(it?.id) ? it.id : where;
  if (!nonEmpty(it?.id)) problems.push(`item ${id}: missing id`);
  else if (!/^[A-Za-z0-9_-]{1,80}$/.test(it.id)) problems.push(`item ${id}: id is not filename-safe`);
  if (!nonEmpty(it?.title)) problems.push(`item ${id}: missing title`);
  if (!nonEmpty(it?.summary)) problems.push(`item ${id}: missing summary`);
  if (!nonEmpty(it?.source?.name)) problems.push(`item ${id}: missing source name`);
  if (!httpUrl(it?.links?.original)) problems.push(`item ${id}: missing original link`);
  if (!httpUrl(it?.links?.aihot)) problems.push(`item ${id}: missing aihot link`);
  if (it?.category === null || it?.category === undefined) problems.push(`item ${id}: missing category`);
  else if (!isCategoryKey(it.category)) warnings.push(`item ${id}: unknown category "${it.category}", exported as-is`);
  if (it?.selected !== true) problems.push(`item ${id}: not a selected item`);
  if (it?.publishedAt != null && Number.isNaN(Date.parse(it.publishedAt))) problems.push(`item ${id}: publishedAt is not a date-time`);
  if (!nonEmpty(it?.attribution?.name) || !httpUrl(it?.attribution?.url)) warnings.push(`item ${id}: no attribution, the manifest keeps the links only`);
}

function checkDailyEntry(entry: unknown, where: string, flash: boolean): void {
  const e = entry as DailyEntry & { publishedAt?: string };
  if (!nonEmpty(e?.title)) problems.push(`${where}: missing title`);
  if (!flash && !nonEmpty(e?.summary)) problems.push(`${where}: missing summary`);
  if (!nonEmpty(e?.source?.name)) problems.push(`${where}: missing source name`);
  if (!httpUrl(e?.links?.original)) problems.push(`${where}: missing original link`);
  if (flash) {
    if (!nonEmpty(e?.publishedAt)) problems.push(`${where}: missing publishedAt`);
    else if (Number.isNaN(Date.parse(e.publishedAt))) problems.push(`${where}: publishedAt is not a date-time`);
  }
}

function checkDaily(report: unknown): void {
  const r = report as DailyReport;
  if (!isValidDate(r?.date)) problems.push(`daily: date is not YYYY-MM-DD`);
  if (!nonEmpty(r?.links?.aihot)) problems.push(`daily: missing aihot link`);
  if (!Array.isArray(r?.sections)) problems.push(`daily: sections is not an array`);
  else r.sections.forEach((section, i) => {
    if (!nonEmpty(section?.label)) problems.push(`daily section #${i + 1}: missing label`);
    if (!Array.isArray(section?.items)) { problems.push(`daily section #${i + 1}: items is not an array`); return; }
    section.items.forEach((entry, j) => checkDailyEntry(entry, `daily section "${nonEmpty(section.label) ? section.label : `#${i + 1}`}" item #${j + 1}`, false));
  });
  if (!Array.isArray(r?.flashes)) problems.push(`daily: flashes is not an array`);
  else r.flashes.forEach((flash, i) => checkDailyEntry(flash, `daily flash #${i + 1}`, true));
  if (!r.sections?.length && !r.flashes?.length && !nonEmpty(r.lead?.leadParagraph)) problems.push(`daily: no lead, no sections and no flashes`);
}

async function fetchJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/json" } });
  } catch (error) {
    return die(`GET ${url} failed: ${String(error)}`);
  }
  if (res.status !== 200) die(`GET ${url} answered HTTP ${res.status}`);
  try {
    return await res.json();
  } catch (error) {
    return die(`GET ${url} did not answer JSON: ${String(error)}`);
  }
}

function dedupe(items: ApiItem[]): ApiItem[] {
  const seen = new Map<string, string>();
  const kept: ApiItem[] = [];
  for (const item of items) {
    const before = seen.get(item.id);
    if (before !== undefined) {
      if (before !== item.title) die(`item ${item.id} appears twice with different titles`);
      continue;
    }
    seen.set(item.id, item.title);
    kept.push(item);
  }
  return kept;
}

async function loadFromApi(base: string, date: string | null, window: string): Promise<{ items: ApiItem[]; daily: DailyReport }> {
  const items: ApiItem[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const url = `${base}/api/v1/items?mode=selected&window=${window}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const body = await fetchJson(url) as { schemaVersion?: unknown; items?: unknown; page?: { hasMore?: unknown; nextCursor?: unknown } };
    if (body?.schemaVersion !== 1) die(`GET ${url}: schemaVersion is ${JSON.stringify(body?.schemaVersion)}, expected 1`);
    if (!Array.isArray(body?.items)) die(`GET ${url}: items is not an array`);
    items.push(...(body.items as ApiItem[]));
    if (body.page?.hasMore !== true) break;
    cursor = nonEmpty(body.page?.nextCursor) ? body.page.nextCursor : null;
    if (!cursor) die(`GET ${url}: the page says hasMore but gives no nextCursor`);
  }
  const dailyUrl = date ? `${base}/api/v1/dailies/${date}` : `${base}/api/v1/dailies/latest`;
  const dailyBody = await fetchJson(dailyUrl) as { schemaVersion?: unknown; report?: unknown };
  if (dailyBody?.schemaVersion !== 1) die(`GET ${dailyUrl}: schemaVersion is ${JSON.stringify(dailyBody?.schemaVersion)}, expected 1`);
  const daily = dailyBody.report as DailyReport;
  if (date && daily?.date !== date) die(`GET ${dailyUrl} answered the daily for ${JSON.stringify(daily?.date)}, not ${date}`);
  return { items: dedupe(items), daily };
}

function loadFromFile(path: string): { items: ApiItem[]; daily: DailyReport | null } {
  if (!existsSync(path)) die(`--input file not found: ${path}`);
  let snapshot: { schemaVersion?: unknown; items?: { schemaVersion?: unknown; items?: unknown }; daily?: { schemaVersion?: unknown; report?: unknown } | null };
  try {
    snapshot = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    return die(`--input file is not valid JSON: ${String(error)}`);
  }
  if (snapshot?.schemaVersion !== 1) die(`snapshot schemaVersion is ${JSON.stringify(snapshot?.schemaVersion)}, expected 1`);
  if (snapshot?.items?.schemaVersion !== 1) die(`snapshot items schemaVersion is ${JSON.stringify(snapshot?.items?.schemaVersion)}, expected 1`);
  if (!Array.isArray(snapshot?.items?.items)) die(`snapshot items.items is not an array`);
  const daily = snapshot.daily ?? null;
  if (daily !== null) {
    if (daily.schemaVersion !== 1) die(`snapshot daily schemaVersion is ${JSON.stringify(daily.schemaVersion)}, expected 1`);
    if (!daily.report || typeof daily.report !== "object") die(`snapshot daily.report is missing`);
  }
  return { items: dedupe(snapshot.items.items as ApiItem[]), daily: daily ? (daily.report as DailyReport) : null };
}

/** One export run. Returns the process exit code: 0 written, 2 refused (fail-closed). */
export async function runExport(argv: string[]): Promise<number> {
  try {
    return await exportOnce(argv);
  } catch (error) {
    if (error instanceof ExportError) {
      console.error(`export-cms: ${error.message}`);
      return 2;
    }
    throw error;
  }
}

async function exportOnce(argv: string[]): Promise<number> {
  problems = [];
  warnings = [];
  const flag = (name: string): string | null => {
    const at = argv.indexOf(`--${name}`);
    return at > -1 ? (argv[at + 1] ?? "") : null;
  };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  const base = (flag("base") ?? process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const input = flag("input");
  const date = flag("date");
  const window = flag("window") ?? "24h";
  const out = flag("out") ?? "export";
  const force = argv.includes("--force");
  if (input !== null && argv.includes("--base")) die("--base and --input are mutually exclusive; a snapshot needs no server");
  if (date !== null && !isValidDate(date)) die(`--date must be YYYY-MM-DD, got "${date}"`);
  if (window !== "24h" && window !== "7d") die(`--window must be 24h or 7d, got "${window}"`);
  if (!/^https?:\/\//i.test(base)) die(`--base must be an http(s) URL, got "${base}"`);
  if (flag("out") === "") die("--out needs a directory");

  const loaded = input !== null ? loadFromFile(input) : await loadFromApi(base, date, window);
  if (loaded.items.length === 0) die("no selected items to export; a wrong --base, --date or an empty day all look like this");
  loaded.items.forEach((item, i) => checkItem(item, `#${i + 1}`));
  if (loaded.daily) checkDaily(loaded.daily);
  if (problems.length > 0) {
    for (const problem of problems) console.error(`export-cms: ${problem}`);
    console.error(`export-cms: ${problems.length} problem(s); nothing written`);
    return 2;
  }

  // Best first: score, then newest. Ties broken by id so two runs of one day agree.
  const ordered = [...loaded.items].sort((a, b) =>
    (b.score ?? -1) - (a.score ?? -1) ||
    Date.parse(b.publishedAt ?? "0") - Date.parse(a.publishedAt ?? "0") ||
    a.id.localeCompare(b.id));
  const exportDate = loaded.daily
    ? loaded.daily.date
    : ordered.map((item) => (item.publishedAt ? beijingDate(item.publishedAt) : "")).filter(Boolean).sort().at(-1)
      ?? die("no daily report and no publishedAt on any item: the export date is unknowable");

  const outDir = join(resolve(out), exportDate);
  if (existsSync(join(outDir, "manifest.json")) && !force) die(`${relative(process.cwd(), outDir)}/manifest.json exists; pass --force to rewrite it`);

  const itemDate = (item: ApiItem) => (item.publishedAt ? { date: beijingDate(item.publishedAt), from: "publishedAt" } : { date: exportDate, from: "exportDate" });
  const renderItem = (item: ApiItem): string => {
    const when = itemDate(item);
    const label = isCategoryKey(item.category) ? CATEGORY_LABELS[item.category] : item.category!;
    const lines = [
      "---",
      `title: ${yamlStr(item.title)}`,
      `date: ${yamlStr(when.date)}`,
      `dateFrom: ${yamlStr(when.from)}`,
      ...(item.publishedAt ? [`publishedAt: ${yamlStr(item.publishedAt)}`] : []),
      `category: ${yamlStr(label)}`,
      `categoryKey: ${yamlStr(item.category!)}`,
      `source: ${yamlStr(item.source!.name)}`,
      ...(item.score !== null ? [`score: ${item.score}`] : []),
      `original: ${yamlStr(item.links!.original)}`,
      `aihot: ${yamlStr(item.links!.aihot)}`,
      ...(nonEmpty(item.attribution?.name) ? [`attribution: ${yamlStr(`${item.attribution!.name} — ${item.attribution!.url}`)}`] : []),
      "---",
      "",
      item.summary!.trim(),
    ];
    if (nonEmpty(item.originalTitle) && item.originalTitle !== item.title) lines.push("", `原文标题：${item.originalTitle}`);
    if (nonEmpty(item.reason)) lines.push("", `推荐理由：${item.reason}`);
    lines.push("", `- 原文：${item.links!.original}`, `- ${SITE.name}：${item.links!.aihot}`);
    if (nonEmpty(item.attribution?.name)) lines.push(`- 来源归属：${item.attribution!.name}（${item.attribution!.url}）`);
    return `${lines.join("\n")}\n`;
  };
  const renderDaily = (daily: DailyReport): string => {
    const lines = [
      "---",
      `title: ${yamlStr(`${SITE.name} ${withSubject("日报")} · ${daily.date}`)}`,
      `date: ${yamlStr(daily.date)}`,
      `type: ${yamlStr("daily")}`,
      `aihot: ${yamlStr(daily.links.aihot)}`,
      ...(nonEmpty(daily.attribution?.name) ? [`attribution: ${yamlStr(`${daily.attribution!.name} — ${daily.attribution!.url}`)}`] : []),
      "---",
      "",
    ];
    if (nonEmpty(daily.lead?.leadParagraph)) lines.push(daily.lead!.leadParagraph.trim(), "");
    for (const section of daily.sections) {
      lines.push(`## ${section.label}`, "");
      for (const entry of section.items) {
        lines.push(`### ${entry.title}`, "", entry.summary!.trim(), "", `来源：${entry.source!.name}｜原文：${entry.links.original}`, "");
      }
    }
    if (daily.flashes.length > 0) {
      lines.push("## 快讯", "");
      for (const flash of daily.flashes) lines.push(`- **${flash.title}**　${flash.source!.name}　${beijingTime(flash.publishedAt)}　原文：${flash.links.original}`);
      lines.push("");
    }
    return `${lines.join("\n")}\n`;
  };

  // Render everything before touching the disk: a failure halfway through must not leave a partial export.
  const files: Array<{ name: string; body: string }> = ordered.map((item, i) => ({ name: `${String(i + 1).padStart(2, "0")}-${item.id}.md`, body: renderItem(item) }));
  if (loaded.daily) files.push({ name: "daily.md", body: renderDaily(loaded.daily) });
  const manifest = {
    schemaVersion: 1,
    exporter: "scripts/export-cms.ts",
    site: SITE.name,
    generatedAt: new Date().toISOString(),
    date: exportDate,
    source: input !== null
      ? { mode: "file", path: input }
      : { mode: "api", base, window, date: date ?? null },
    counts: { items: ordered.length, dailySections: loaded.daily?.sections.length ?? 0, dailyFlashes: loaded.daily?.flashes.length ?? 0 },
    items: ordered.map((item, i) => {
      const when = itemDate(item);
      return {
        file: files[i]!.name, id: item.id, title: item.title, originalTitle: item.originalTitle ?? null,
        category: isCategoryKey(item.category) ? CATEGORY_LABELS[item.category] : item.category,
        categoryKey: item.category, score: item.score ?? null, reason: item.reason ?? null,
        date: when.date, dateFrom: when.from, publishedAt: item.publishedAt ?? null,
        source: { name: item.source!.name },
        links: { original: item.links!.original, aihot: item.links!.aihot },
        attribution: nonEmpty(item.attribution?.name) ? { name: item.attribution!.name, url: item.attribution!.url } : null,
      };
    }),
    daily: loaded.daily
      ? {
        file: "daily.md", date: loaded.daily.date, leadTitle: loaded.daily.lead?.title ?? null,
        windowStart: loaded.daily.windowStart, windowEnd: loaded.daily.windowEnd,
        links: { aihot: loaded.daily.links.aihot },
        attribution: nonEmpty(loaded.daily.attribution?.name) ? { name: loaded.daily.attribution!.name, url: loaded.daily.attribution!.url } : null,
      }
      : null,
    warnings,
  };
  files.push({ name: "manifest.json", body: `${JSON.stringify(manifest, null, 2)}\n` });

  mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    writeFileSync(join(outDir, file.name), file.body, "utf8");
    console.log(`✓ ${relative(process.cwd(), join(outDir, file.name))}`);
  }
  for (const warning of warnings) console.error(`export-cms: warning: ${warning}`);
  console.log(`exported ${ordered.length} item(s)${loaded.daily ? " and the daily report" : ""} to ${relative(process.cwd(), outDir)}`);
  return 0;
}

const entry = process.argv[1] === undefined ? "" : resolve(process.argv[1]);
if (entry === fileURLToPath(import.meta.url)) process.exit(await runExport(process.argv.slice(2)));
