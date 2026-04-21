import { Drafts, Outlines, Settings, ChapterPlans } from '../repo.js';
import type { ChapterPlan, Novel, OutlineNode, SettingItem } from '../types.js';

export interface ChapterContext {
  novel: Novel;
  plan: ChapterPlan;
  relatedSettings: SettingItem[];
  outlineChain: OutlineNode[];
  previousChapterExcerpt?: string;
}

function truncate(text: string, max = 800): string {
  if (!text) return '';
  if (text.length <= max) return text;
  return text.slice(0, max) + '……';
}

function scoreRelevance(item: SettingItem, plan: ChapterPlan): number {
  const haystacks = [plan.title, plan.summary, plan.goal]
    .filter(Boolean).join('\n');
  if (!haystacks) return 0;
  let score = 0;
  const name = item.name || '';
  if (name && haystacks.includes(name)) score += 5;
  const summary = item.summary || '';
  if (summary) {
    for (const ch of summary.slice(0, 50)) {
      if (haystacks.includes(ch)) score += 0.05;
    }
  }
  if (item.tags) {
    for (const tag of item.tags) {
      if (tag && haystacks.includes(tag)) score += 3;
    }
  }
  if (item.type === 'worldview' || item.type === 'style') score += 1;
  return score;
}

export function buildChapterContext(novel: Novel, plan: ChapterPlan): ChapterContext {
  const allSettings = Settings.listByNovel(novel.id);
  const scored = allSettings
    .map(s => ({ item: s, score: scoreRelevance(s, plan) }))
    .sort((a, b) => b.score - a.score);

  const topByScore = scored.filter(s => s.score > 0).slice(0, 10).map(s => s.item);
  const characters = allSettings.filter(s => s.type === 'character').slice(0, 6);
  const worldview = allSettings.filter(s => s.type === 'worldview').slice(0, 3);
  const rules = allSettings.filter(s => s.type === 'rule').slice(0, 3);

  const merged = new Map<string, SettingItem>();
  for (const list of [topByScore, characters, worldview, rules]) {
    for (const item of list) merged.set(item.id, item);
  }
  const relatedSettings = Array.from(merged.values()).slice(0, 12);

  const outlineChain: OutlineNode[] = [];
  if (plan.outlineNodeId) {
    const allOutline = Outlines.listByNovel(novel.id);
    const byId = new Map(allOutline.map(n => [n.id, n]));
    let current = byId.get(plan.outlineNodeId) ?? null;
    while (current) {
      outlineChain.unshift(current);
      current = current.parentId ? byId.get(current.parentId) ?? null : null;
    }
  }

  let previousChapterExcerpt: string | undefined;
  const previousPlan = ChapterPlans.listByNovel(novel.id)
    .filter(p => p.chapterNumber < plan.chapterNumber)
    .sort((a, b) => b.chapterNumber - a.chapterNumber)[0];
  if (previousPlan) {
    const prevDraft = Drafts.getByPlan(previousPlan.id);
    if (prevDraft?.currentVersionId) {
      const ver = Drafts.getVersion(prevDraft.currentVersionId);
      if (ver?.content) {
        previousChapterExcerpt = truncate(ver.content.slice(-1500), 1500);
      }
    }
  }

  return { novel, plan, relatedSettings, outlineChain, previousChapterExcerpt };
}

export function renderContextForPrompt(ctx: ChapterContext): string {
  const lines: string[] = [];
  lines.push(`【小说基本信息】`);
  lines.push(`- 书名：${ctx.novel.title}`);
  if (ctx.novel.genre) lines.push(`- 类型：${ctx.novel.genre}`);
  if (ctx.novel.summary) lines.push(`- 简介：${truncate(ctx.novel.summary, 400)}`);
  if (ctx.novel.styleGuide) lines.push(`- 整体文风：${truncate(ctx.novel.styleGuide, 300)}`);
  if (ctx.novel.forbiddenRules) lines.push(`- 全局禁区：${truncate(ctx.novel.forbiddenRules, 300)}`);

  if (ctx.outlineChain.length) {
    lines.push('\n【大纲脉络】');
    for (const node of ctx.outlineChain) {
      lines.push(`- [${node.level}] ${node.title}${node.summary ? `：${truncate(node.summary, 200)}` : ''}`);
    }
  }

  if (ctx.relatedSettings.length) {
    lines.push('\n【相关设定】');
    for (const s of ctx.relatedSettings) {
      const head = `- [${s.type}] ${s.name}`;
      const body = s.summary || s.content || '';
      lines.push(body ? `${head}：${truncate(body, 220)}` : head);
    }
  }

  if (ctx.previousChapterExcerpt) {
    lines.push('\n【上一章结尾片段（用于承接）】');
    lines.push(ctx.previousChapterExcerpt);
  }

  lines.push('\n【本章信息】');
  lines.push(`- 章节编号：第 ${ctx.plan.chapterNumber} 章`);
  if (ctx.plan.title) lines.push(`- 标题：${ctx.plan.title}`);
  if (ctx.plan.summary) lines.push(`- 章节摘要：${ctx.plan.summary}`);
  if (ctx.plan.goal) lines.push(`- 章节目标：${ctx.plan.goal}`);

  return lines.join('\n');
}
