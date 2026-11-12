// 阶跃星辰 step_plan 端点 matrix 实验：量化「思考开关 / max_tokens / JSON mode」对输出可用率的影响。
// 用法：EXTRA_JSON='{"thinking":{"type":"disabled"}}' MAX_TOKENS=4000 RUNS=4 node scripts/stepfun-matrix.mjs
import { readFileSync } from "node:fs";

const BASE = process.env.LLM_BASE_URL ?? "https://api.stepfun.com/step_plan/v1";
const KEY = process.env.LLM_API_KEY ?? "";
const MODEL = process.env.LLM_MODEL ?? "step-5-preview";
const RUNS = Number(process.env.RUNS ?? 4);
const MAX_TOKENS = Number(process.env.MAX_TOKENS ?? 1500);
const JSON_MODE = process.env.JSON_MODE !== "off";
const EXTRA = process.env.EXTRA_JSON ? JSON.parse(process.env.EXTRA_JSON) : null;
if (!KEY) {
  console.error("stepfun-matrix: LLM_API_KEY is empty");
  process.exit(2);
}
const system = readFileSync("industry/prompts/translate-body.md", "utf8");
const segments = [
  '宇树科技发布 <strong>Unitree G1</strong> 人形机器人，售价 9.9 万元起，身高约 1.3 米，整机重量 35 公斤。',
  '特斯拉宣布 Optimus 第三代产线于本季度下线，规划年产能 5 万台，优先供给自有工厂的装配工位。',
];
let bad = 0;
for (let i = 1; i <= RUNS; i++) {
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ segments }) },
    ],
    temperature: 0.2,
    max_tokens: MAX_TOKENS,
    ...(JSON_MODE ? { response_format: { type: "json_object" } } : {}),
    ...(EXTRA ?? {}),
  };
  const res = await fetch(`${BASE.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const json = await res.json().catch(() => ({}));
  const content = json.choices?.[0]?.message?.content ?? "";
  const hasReasoning = Boolean(json.choices?.[0]?.message?.reasoning || json.choices?.[0]?.message?.reasoning_content);
  let verdict;
  try {
    const m = content.match(/\{[\s\S]*\}/);
    const keys = m ? Object.keys(JSON.parse(m[0])) : [];
    verdict = keys.includes("t") && Array.isArray(JSON.parse(m[0]).t) ? "OK" : "BAD-shape";
  } catch {
    verdict = "BAD-parse";
  }
  if (verdict !== "OK") bad += 1;
  console.log(
    `run=${i} http=${res.status} maxTokens=${MAX_TOKENS} jsonMode=${JSON_MODE ? "ON" : "OFF"} extra=${JSON.stringify(EXTRA)} reasoning=${hasReasoning ? "yes" : "no"} usage=${JSON.stringify(json.usage ?? null)} verdict=${verdict} content=${JSON.stringify(content.slice(0, 50))}`,
  );
}
console.log(bad === 0 ? `matrix: all ${RUNS} runs OK` : `matrix: ${bad}/${RUNS} runs BAD`);
process.exit(bad === 0 ? 0 : 1);
