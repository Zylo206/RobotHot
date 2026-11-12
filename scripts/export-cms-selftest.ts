// Reverse verification for scripts/export-cms.ts: a valid snapshot exports; every mandatory field
// removed — or the API answering wrong — must abort with a non-zero code and write nothing.
// Runs the exporter in-process (the sandbox blocks node spawning node), through the same runExport
// entry the CLI uses.
//   node scripts/export-cms-selftest.ts
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { runExport } from "./export-cms.ts";

const TMP = mkdtempSync(join(tmpdir(), "export-cms-selftest-"));
let step = 0;
const next = () => join(TMP, `case-${++step}`);

let passed = 0;
let failed = 0;
const pass = (name: string) => { passed += 1; console.log(`✓ ${name}`); };
const fail = (name: string, detail: string) => { failed += 1; console.log(`✗ ${name}  ${detail}`); };

/** One export run with its console captured: the same path the CLI takes, minus process.exit. */
async function exportRun(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const log = console.log;
  const error = console.error;
  console.log = (...parts: unknown[]) => out.push(parts.map(String).join(" "));
  console.error = (...parts: unknown[]) => err.push(parts.map(String).join(" "));
  try {
    const code = await runExport(args);
    return { code, out: out.join("\n"), err: err.join("\n") };
  } finally {
    console.log = log;
    console.error = error;
  }
}
function expectOk(name: string, r: { code: number; err: string }): boolean {
  if (r.code !== 0) { fail(name, `exit code ${r.code}${r.err ? `: ${r.err.slice(0, 300)}` : ""}`); return false; }
  pass(name);
  return true;
}
function expectFail(name: string, r: { code: number; err: string }, keyword?: string): boolean {
  if (r.code === 0) { fail(name, "exit code 0, expected a refusal"); return false; }
  if (keyword && !r.err.includes(keyword)) { fail(name, `stderr does not mention "${keyword}": ${r.err.slice(0, 300)}`); return false; }
  pass(name);
  return true;
}
function wroteNothing(outDir: string): boolean {
  return !existsSync(join(outDir, "manifest.json"));
}

const item = (over: Record<string, unknown> = {}) => ({
  id: "itm_ok1", title: "宇树发布 Unitree G1 人形机器人，售价 9.9 万元起",
  originalTitle: "Unitree launches the G1 humanoid robot from 99,000 yuan",
  summary: "宇树发布第二代人形机器人 G1：身高 1.3 米、整机 35 公斤，官方售价 9.9 万元起，开放二次开发接口。",
  source: { name: "机器之心" },
  links: { aihot: "https://robothot.example.com/items/itm_ok1", original: "https://example.com/unitree-g1" },
  publishedAt: "2026-09-28T16:00:00+08:00", discoveredAt: "2026-09-28T16:05:00+08:00",
  category: "products", score: 92, selected: true,
  reason: "头部厂商的整机新品，价格、参数和交付时间都写明了。",
  attribution: { name: "RobotHot", url: "https://robothot.example.com" },
  ...over,
});
const item2 = item({
  id: "itm_ok2", title: "智元机器人宣布远征 A2 量产，首批交付 500 台", score: 95,
  links: { aihot: "https://robothot.example.com/items/itm_ok2", original: "https://example.com/agibot-a2" }, source: { name: "36氪" },
});
const dailyReport = () => ({
  date: "2026-09-29", generatedAt: "2026-09-29T08:00:00+08:00",
  windowStart: "2026-09-28T00:00:00+08:00", windowEnd: "2026-09-29T00:00:00+08:00",
  links: { aihot: "https://robothot.example.com/daily/2026-09-29" },
  attribution: { name: "RobotHot", url: "https://robothot.example.com" },
  lead: { title: "特斯拉 Optimus 第三代产线下线", leadParagraph: "特斯拉宣布 Optimus 第三代产线于本季度下线，规划年产能 5 万台，优先供给自有工厂。" },
  sections: [{
    label: "产品发布/更新",
    items: [{
      title: "宇树发布 Unitree G1 人形机器人", summary: "宇树发布 G1，售价 9.9 万元起，开放二次开发。",
      source: { name: "机器之心" }, links: { aihot: "https://robothot.example.com/items/itm_ok1", original: "https://example.com/unitree-g1" },
      attribution: { name: "RobotHot", url: "https://robothot.example.com" },
    }],
  }],
  flashes: [{
    title: "优必选 Walker S2 进入汽车工厂实训", source: { name: "量子位" },
    links: { aihot: null, original: "https://example.com/ubtech-walker-s2" },
    publishedAt: "2026-09-28T18:30:00+08:00", attribution: { name: "RobotHot", url: "https://robothot.example.com" },
  }],
});
const clone = (value: unknown) => JSON.parse(JSON.stringify(value)) as never;
const snapshot = (items: unknown[], daily: unknown) => ({
  schemaVersion: 1,
  items: { schemaVersion: 1, query: { mode: "selected", category: null, window: "24h", q: null, by: "timeline", ordering: "timelineDesc" }, items: clone(items), page: { count: items.length, hasMore: false, nextCursor: null } },
  daily: daily === null ? null : { schemaVersion: 1, report: clone(daily) },
});
const writeSnapshot = (dir: string, value: unknown) => {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "snapshot.json");
  writeFileSync(path, typeof value === "string" ? value : JSON.stringify(value), "utf8");
  return path;
};

console.log("— a valid snapshot exports every item, the daily report and the manifest");
{
  const out = next();
  const snap = writeSnapshot(out, snapshot([item(), item2], dailyReport()));
  const r = await exportRun(["--input", snap, "--out", out]);
  if (!expectOk("valid snapshot exits 0", r)) process.exit(1);
  const first = join(out, "2026-09-29", "01-itm_ok2.md");
  const second = join(out, "2026-09-29", "02-itm_ok1.md");
  const dailyMd = join(out, "2026-09-29", "daily.md");
  const manifestPath = join(out, "2026-09-29", "manifest.json");
  for (const [name, path] of [["highest score first", first], ["second item", second], ["daily report", dailyMd], ["manifest", manifestPath]] as const) {
    existsSync(path) ? pass(`${name} written`) : fail(`${name} written`, `${path} missing`);
  }
  const body = existsSync(first) ? readFileSync(first, "utf8") : "";
  body.includes(`title: "智元机器人宣布远征 A2 量产，首批交付 500 台"`) ? pass("front-matter title") : fail("front-matter title", body.slice(0, 200));
  body.includes(`date: "2026-09-28"`) && body.includes(`dateFrom: "publishedAt"`) ? pass("front-matter date") : fail("front-matter date", body.slice(0, 300));
  body.includes(`category: "机器人与产品"`) && body.includes(`categoryKey: "products"`) ? pass("front-matter category") : fail("front-matter category", body.slice(0, 300));
  body.includes("score: 95") && body.includes("推荐理由：") && body.includes("- 原文：https://example.com/agibot-a2") ? pass("front-matter score, reason and links") : fail("front-matter score, reason and links", body.slice(0, 400));
  const daily = existsSync(dailyMd) ? readFileSync(dailyMd, "utf8") : "";
  daily.includes("## 产品发布/更新") && daily.includes("## 快讯") && daily.includes("优必选 Walker S2 进入汽车工厂实训") ? pass("daily sections and flashes") : fail("daily sections and flashes", daily.slice(0, 300));
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
  manifest.counts?.items === 2 && manifest.items?.[0]?.id === "itm_ok2" && manifest.items?.[0]?.file === "01-itm_ok2.md" ? pass("manifest order and counts") : fail("manifest order and counts", JSON.stringify(manifest).slice(0, 300));
  manifest.daily?.date === "2026-09-29" && manifest.daily?.file === "daily.md" && Array.isArray(manifest.warnings) ? pass("manifest daily block") : fail("manifest daily block", JSON.stringify(manifest).slice(0, 300));

  const again = await exportRun(["--input", snap, "--out", out]);
  expectFail("a second export refuses to overwrite", again, "--force");
  expectOk("--force rewrites the day", await exportRun(["--input", snap, "--out", out, "--force"]));
}

console.log("— every mandatory field removed aborts the export and writes nothing");
{
  const drop = async (name: string, mutate: (value: ReturnType<typeof snapshot>) => void, keyword: string) => {
    const out = next();
    const built = snapshot([item(), item2], dailyReport());
    mutate(built);
    const snap = writeSnapshot(out, built);
    const r = await exportRun(["--input", snap, "--out", out]);
    if (!expectFail(name, r, keyword)) return;
    wroteNothing(join(out, "2026-09-29")) ? pass(`${name}: nothing written`) : fail(`${name}: nothing written`, "manifest.json exists");
  };
  await drop("item without a summary", (s) => { delete (s.items.items[0] as Record<string, unknown>).summary; }, "summary");
  await drop("item without a source", (s) => { delete (s.items.items[0] as Record<string, unknown>).source; }, "source");
  await drop("item without the original link", (s) => { delete (s.items.items[0] as Record<string, unknown>).links; }, "original");
  await drop("item without the self link", (s) => { (s.items.items[1] as Record<string, unknown>).links = { original: "https://example.com/x" }; }, "aihot");
  await drop("item without a title", (s) => { delete (s.items.items[0] as Record<string, unknown>).title; }, "title");
  await drop("item without a category", (s) => { (s.items.items[0] as Record<string, unknown>).category = null; }, "category");
  await drop("an item that is not selected", (s) => { (s.items.items[1] as Record<string, unknown>).selected = false; }, "selected");
  await drop("no items at all", (s) => { s.items.items.length = 0; }, "no selected items");
  await drop("a wrong snapshot schemaVersion", (s) => { s.schemaVersion = 2; }, "schemaVersion");
  await drop("a daily section item without a summary", (s) => { delete (s.daily!.report.sections[0]!.items[0] as unknown as Record<string, unknown>).summary; }, "summary");
  await drop("a flash without the original link", (s) => { delete (s.daily!.report.flashes[0] as unknown as Record<string, unknown>).links; }, "original");
  await drop("a daily without a date", (s) => { (s.daily!.report as Record<string, unknown>).date = "29.09.2026"; }, "date");
  await drop("an empty daily report", (s) => { s.daily!.report.sections.length = 0; s.daily!.report.flashes.length = 0; s.daily!.report.lead = null; }, "no lead");
}

console.log("— broken inputs and unreachable servers abort too");
{
  const out = next();
  const snap = writeSnapshot(out, "{ not json");
  expectFail("malformed JSON", await exportRun(["--input", snap, "--out", next()]), "JSON");
  expectFail("missing snapshot file", await exportRun(["--input", join(out, "nope.json"), "--out", next()]), "not found");
  expectFail("unreachable --base", await exportRun(["--base", "http://127.0.0.1:1", "--out", next()]));
  const dead = http.createServer((_req, res) => { res.writeHead(404); res.end("{}"); });
  await new Promise<void>((done) => dead.listen(0, "127.0.0.1", done));
  const deadBase = `http://127.0.0.1:${(dead.address() as { port: number }).port}`;
  expectFail("API answering 404", await exportRun(["--base", deadBase, "--out", next()]), "HTTP 404");
  await new Promise<void>((done) => dead.close(() => done()));
}

console.log("— the API path paginates and refuses a daily for another day");
{
  const asked: string[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    asked.push(url.pathname + url.search);
    if (url.pathname === "/api/v1/items") {
      const page = url.searchParams.get("cursor") === null
        ? { schemaVersion: 1, items: [item(), item2], page: { count: 2, hasMore: true, nextCursor: "c1" } }
        : { schemaVersion: 1, items: [item({ id: "itm_ok3", title: "傅利叶发布 GR-3 人形机器人", score: 81, links: { aihot: "https://robothot.example.com/items/itm_ok3", original: "https://example.com/fourier-gr3" } })], page: { count: 1, hasMore: false, nextCursor: null } };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(page));
      return;
    }
    if (url.pathname === "/api/v1/dailies/latest" || /^\/api\/v1\/dailies\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ schemaVersion: 1, report: dailyReport() }));
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const out = next();
  const r = await exportRun(["--base", base, "--out", out]);
  if (expectOk("API mode with two pages exits 0", r)) {
    const manifestPath = join(out, "2026-09-29", "manifest.json");
    existsSync(manifestPath) ? pass("API export wrote the manifest") : fail("API export wrote the manifest", `${manifestPath} missing`);
    existsSync(join(out, "2026-09-29", "03-itm_ok3.md")) ? pass("the second page's item is included") : fail("the second page's item is included", "03-itm_ok3.md missing");
    const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
    manifest.counts?.items === 3 && manifest.source?.mode === "api" ? pass("manifest counts all pages") : fail("manifest counts all pages", JSON.stringify(manifest).slice(0, 300));
    asked.some((u) => u.includes("mode=selected")) && asked.some((u) => u.includes("cursor=c1")) ? pass("asked for selected items and followed the cursor") : fail("asked for selected items and followed the cursor", asked.join(" | "));
  }
  expectFail("a daily for another day is refused", await exportRun(["--base", base, "--date", "2026-09-28", "--out", next()]), "2026-09-28");
  await new Promise<void>((done) => server.close(() => done()));
}

console.log("— a snapshot without a daily still exports, dated from the items");
{
  const out = next();
  const snap = writeSnapshot(out, snapshot([item()], null));
  const r = await exportRun(["--input", snap, "--out", out]);
  if (expectOk("daily-less snapshot exits 0", r)) {
    existsSync(join(out, "2026-09-28", "manifest.json")) ? pass("dated from the item's publishedAt") : fail("dated from the item's publishedAt", "export/2026-09-28 missing");
    existsSync(join(out, "2026-09-28", "daily.md")) ? fail("no daily.md without a report", "daily.md exists") : pass("no daily.md without a report");
  }
}

rmSync(TMP, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${passed} checks passed`);
process.exit(failed ? 1 : 0);
