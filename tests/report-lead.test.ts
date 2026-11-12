// A daily's front-page picture comes from the item its lead is about: the editors' lead matched to an
// item by title, never simply the first highlight.
import "./setup.ts";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReportCitation } from "@aihot/contracts/site";
import { leadItemOf } from "@aihot/backend/publication/reports";

const cite = (itemId: string, title: string) => ({ itemId, title }) as ReportCitation;
const arena = cite("a", "Unitree R1 以 3.99 万元起售，四足与人形双形态同台亮相");
const optimus = cite("b", "特斯拉 Optimus 第三代产线下线，披露年产能 5 万台与端到端神经网络升级");

test("an editors' lead is matched to the item it is written about", () => {
  assert.equal(leadItemOf("特斯拉 Optimus 第三代产线下线，披露年产能与神经网络升级", [arena, optimus], [arena, optimus])?.itemId, "b");
});

test("a lead that matches no item clearly has no item", () => {
  assert.equal(leadItemOf("多家公司发布新机型，行业竞争加剧", [arena], [arena, optimus]), undefined);
});

test("without an editors' lead the first highlight leads", () => {
  assert.equal(leadItemOf(undefined, [arena], [optimus, arena])?.itemId, "a");
});
