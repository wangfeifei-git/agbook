import type { ChapterPlan, ChapterRuleSet, Novel, ReviewIssue } from '../types.js';

export interface ResolvedChapterRuleSet extends ChapterRuleSet {
  targetWordCount?: number;
}

const perspectiveHint: Record<string, string> = {
  first: '第一人称',
  third: '第三人称',
  omniscient: '全知视角',
};

export function resolveChapterRules(novel: Novel, plan: ChapterPlan): ResolvedChapterRuleSet {
  const rs: ResolvedChapterRuleSet = { ...plan.ruleSet };
  if (plan.minWordCount != null) rs.minWordCount = plan.minWordCount;
  if (plan.maxWordCount != null) rs.maxWordCount = plan.maxWordCount;
  if (plan.targetWordCount != null) rs.targetWordCount = plan.targetWordCount;
  if (!rs.extraInstructions && novel.styleGuide) {
    rs.extraInstructions = novel.styleGuide;
  }
  return rs;
}

export function renderRulesForPrompt(rs: ResolvedChapterRuleSet, plan: ChapterPlan): string {
  const lines: string[] = [];
  lines.push('【本章生成规则（必须遵守）】');
  const target = rs.targetWordCount ?? plan.targetWordCount;
  if (target) lines.push(`- 目标字数：约 ${target} 字`);
  if (rs.minWordCount) lines.push(`- 最低字数：不少于 ${rs.minWordCount} 字`);
  if (rs.maxWordCount) lines.push(`- 最高字数：不超过 ${rs.maxWordCount} 字`);
  if (rs.narrativePerspective) {
    const display = perspectiveHint[rs.narrativePerspective] || rs.narrativePerspective;
    lines.push(`- 叙事视角：${display}`);
  }
  if (rs.toneStyle) lines.push(`- 文风 / 语气：${rs.toneStyle}`);
  if (rs.dialogueRatioPreference) lines.push(`- 对白比例倾向：${rs.dialogueRatioPreference}`);
  if (rs.descriptionRatioPreference) lines.push(`- 描写比例倾向：${rs.descriptionRatioPreference}`);
  if (rs.mustIncludePoints && rs.mustIncludePoints.length) {
    lines.push('- 必须出现的情节点：');
    rs.mustIncludePoints.forEach(p => lines.push(`  * ${p}`));
  }
  if (rs.mustAvoidPoints && rs.mustAvoidPoints.length) {
    lines.push('- 禁止出现的内容：');
    rs.mustAvoidPoints.forEach(p => lines.push(`  * ${p}`));
  }
  if (rs.continuityRequirements) lines.push(`- 连续性要求：${rs.continuityRequirements}`);
  if (rs.mustGenerateByScenes) lines.push('- 请按场景分段生成，场景之间空行分隔。');
  if (rs.extraInstructions) lines.push(`- 额外要求：${rs.extraInstructions}`);
  return lines.join('\n');
}

export function countChineseWords(text: string): number {
  const cjk = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const alpha = text.match(/[A-Za-z0-9]+/g)?.length ?? 0;
  return cjk + alpha;
}

export function validateRules(content: string, rs: ResolvedChapterRuleSet): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const len = countChineseWords(content);

  if (rs.minWordCount && len < rs.minWordCount) {
    issues.push({
      type: 'word_count_below_min',
      severity: 'major',
      message: `正文长度约 ${len} 字，低于最低字数 ${rs.minWordCount} 字。`,
      suggestion: '建议补充场景描写、人物心理或对白细节以达到最低字数。',
      ruleSource: '章节规则 - 字数下限',
    });
  }
  if (rs.maxWordCount && len > rs.maxWordCount) {
    issues.push({
      type: 'word_count_above_max',
      severity: 'major',
      message: `正文长度约 ${len} 字，超出最高字数 ${rs.maxWordCount} 字。`,
      suggestion: '建议删减冗余描写或合并场景。',
      ruleSource: '章节规则 - 字数上限',
    });
  }
  if (rs.targetWordCount) {
    const delta = Math.abs(len - rs.targetWordCount);
    if (delta > rs.targetWordCount * 0.25) {
      issues.push({
        type: 'word_count_deviates_target',
        severity: 'minor',
        message: `正文长度 ${len} 字，与目标字数 ${rs.targetWordCount} 偏差较大。`,
        ruleSource: '章节规则 - 目标字数',
      });
    }
  }

  if (rs.mustIncludePoints && rs.mustIncludePoints.length) {
    for (const point of rs.mustIncludePoints) {
      const keyword = point.replace(/[【】\[\]()（）]/g, '').slice(0, 12);
      if (keyword && !content.includes(keyword)) {
        issues.push({
          type: 'missing_required_point',
          severity: 'major',
          message: `未检测到必须出现的情节点：${point}`,
          suggestion: '请确认该情节点是否以其他表述出现；若无，请补齐。',
          ruleSource: '章节规则 - 必须情节点',
        });
      }
    }
  }

  if (rs.mustAvoidPoints && rs.mustAvoidPoints.length) {
    for (const point of rs.mustAvoidPoints) {
      const keyword = point.replace(/[【】\[\]()（）]/g, '').slice(0, 12);
      if (keyword && content.includes(keyword)) {
        issues.push({
          type: 'hit_forbidden_point',
          severity: 'critical',
          message: `命中禁止内容：${point}`,
          suggestion: '请重写相关段落，避免该内容。',
          ruleSource: '章节规则 - 禁区',
        });
      }
    }
  }

  return issues;
}
