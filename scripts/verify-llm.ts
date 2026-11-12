// 用站点自己的 provider 代码路径实测 .env 里的 LLM_* 配置（服务商无关：DeepSeek / StepFun / 任意 OpenAI 兼容端点）。
// 与线上 translateBatch 的调用完全一致：同一个 system 提示词、同一个 user 结构、同一个 zod schema。
// 用法：node --env-file-if-exists=.env scripts/verify-llm.ts
import { z } from "zod";
import { chatJson } from "@aihot/backend/providers/llm";
import { promptText, promptVersion } from "@aihot/backend/editorial/prompts";

const Output = z.object({ t: z.array(z.string()) });

// 每轮一个唯一 run 号：receipt 按「模型+提示词版本+输入内容」的哈希复用，输入相同就不会真的调 API。
const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const segments = [
  `宇树科技发布 <strong>Unitree G1</strong> 人形机器人（样批 ${run}），售价 9.9 万元起，身高约 1.3 米，整机重量 35 公斤。`,
  '特斯拉宣布 Optimus 第三代产线于本季度下线，规划年产能 5 万台，优先供给自有工厂的装配工位。',
];

const started = Date.now();
const res = await chatJson({
  model: "default",
  purpose: "verify_llm",
  subject: `verify:llm:${run}`,
  promptVersion: promptVersion("translate-body", "translate-post"),
  system: promptText("translate-body"),
  user: JSON.stringify({ segments }),
  schema: Output,
  temperature: 0.2,
  maxTokens: 1500,
});

const elapsed = Date.now() - started;
const ok = res.data.t.length === segments.length;
console.log(
  JSON.stringify(
    {
      ok,
      model: res.model,
      receiptId: res.receiptId,
      reused: res.reused,
      elapsedMs: elapsed,
      usage: res.usage,
      translations: res.data.t,
    },
    null,
    2,
  ),
);
if (!ok) {
  console.error(`verify-llm: expected ${segments.length} translations, got ${res.data.t.length}`);
  process.exit(1);
}
console.log("verify-llm: OK");
// CLI 收尾：backend 的 postgres 连接池会保活事件循环，成功路径必须显式退出，
// 否则 node 永久挂起、上层 shell 循环卡死在等待上（与 export-cms / selftest / matrix 一致）。
process.exit(0);
