import { db } from './db.js';
import { id, now, parseJson, stringifyJson } from './util.js';
import type {
  ChapterDraft,
  ChapterPlan,
  ChapterRuleSet,
  DraftVersion,
  ModelProvider,
  Novel,
  OutlineNode,
  ReviewIssue,
  ReviewReport,
  SettingItem,
} from './types.js';

function rowToNovel(row: any): Novel {
  return {
    id: row.id,
    title: row.title,
    genre: row.genre,
    summary: row.summary,
    targetWordCount: row.target_word_count,
    styleGuide: row.style_guide,
    forbiddenRules: row.forbidden_rules,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSetting(row: any): SettingItem {
  return {
    id: row.id,
    novelId: row.novel_id,
    type: row.type,
    name: row.name,
    summary: row.summary,
    content: row.content,
    tags: parseJson<string[]>(row.tags, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToOutline(row: any): OutlineNode {
  return {
    id: row.id,
    novelId: row.novel_id,
    parentId: row.parent_id,
    level: row.level,
    title: row.title,
    summary: row.summary,
    goal: row.goal,
    orderIndex: row.order_index,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPlan(row: any): ChapterPlan {
  return {
    id: row.id,
    novelId: row.novel_id,
    outlineNodeId: row.outline_node_id,
    chapterNumber: row.chapter_number,
    title: row.title,
    summary: row.summary,
    goal: row.goal,
    targetWordCount: row.target_word_count,
    minWordCount: row.min_word_count,
    maxWordCount: row.max_word_count,
    status: row.status,
    ruleSet: parseJson<ChapterRuleSet>(row.rule_set_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDraft(row: any): ChapterDraft {
  return {
    id: row.id,
    novelId: row.novel_id,
    chapterPlanId: row.chapter_plan_id,
    currentVersionId: row.current_version_id,
    status: row.status,
    lastGeneratedAt: row.last_generated_at,
    updatedAt: row.updated_at,
  };
}

function rowToVersion(row: any): DraftVersion {
  return {
    id: row.id,
    draftId: row.draft_id,
    versionNumber: row.version_number,
    content: row.content,
    sourceType: row.source_type,
    generationContext: row.generation_context,
    createdAt: row.created_at,
  };
}

function rowToReport(row: any): ReviewReport {
  return {
    id: row.id,
    novelId: row.novel_id,
    chapterPlanId: row.chapter_plan_id,
    draftVersionId: row.draft_version_id,
    result: row.result,
    score: row.score,
    summary: row.summary,
    issues: parseJson<ReviewIssue[]>(row.issues_json, []),
    createdAt: row.created_at,
  };
}

function rowToProvider(row: any): ModelProvider {
  return {
    id: row.id,
    name: row.name,
    baseUrl: row.base_url,
    apiKey: row.api_key,
    model: row.model,
    headers: parseJson<Record<string, string>>(row.headers_json, {}),
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const Novels = {
  list(): Novel[] {
    return db.prepare('SELECT * FROM novels ORDER BY updated_at DESC').all().map(rowToNovel);
  },
  get(id: string): Novel | null {
    const row = db.prepare('SELECT * FROM novels WHERE id = ?').get(id);
    return row ? rowToNovel(row) : null;
  },
  create(input: Partial<Novel> & { title: string }): Novel {
    const nid = id();
    const ts = now();
    db.prepare(`INSERT INTO novels
      (id, title, genre, summary, target_word_count, style_guide, forbidden_rules, status, created_at, updated_at)
      VALUES (@id, @title, @genre, @summary, @tw, @style, @forbidden, @status, @ts, @ts)`).run({
      id: nid,
      title: input.title,
      genre: input.genre ?? null,
      summary: input.summary ?? null,
      tw: input.targetWordCount ?? null,
      style: input.styleGuide ?? null,
      forbidden: input.forbiddenRules ?? null,
      status: input.status ?? 'active',
      ts,
    });
    return this.get(nid)!;
  },
  update(id: string, patch: Partial<Novel>): Novel | null {
    const existing = this.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, updatedAt: now() };
    db.prepare(`UPDATE novels SET
      title=@title, genre=@genre, summary=@summary, target_word_count=@tw,
      style_guide=@style, forbidden_rules=@forbidden, status=@status, updated_at=@ts
      WHERE id=@id`).run({
      id,
      title: merged.title,
      genre: merged.genre ?? null,
      summary: merged.summary ?? null,
      tw: merged.targetWordCount ?? null,
      style: merged.styleGuide ?? null,
      forbidden: merged.forbiddenRules ?? null,
      status: merged.status ?? 'active',
      ts: merged.updatedAt,
    });
    return this.get(id);
  },
  delete(id: string): void {
    db.prepare('DELETE FROM novels WHERE id = ?').run(id);
  },
};

export const Settings = {
  listByNovel(novelId: string): SettingItem[] {
    return db.prepare('SELECT * FROM setting_items WHERE novel_id = ? ORDER BY type, name')
      .all(novelId).map(rowToSetting);
  },
  get(id: string): SettingItem | null {
    const row = db.prepare('SELECT * FROM setting_items WHERE id = ?').get(id);
    return row ? rowToSetting(row) : null;
  },
  create(input: Omit<SettingItem, 'id' | 'createdAt' | 'updatedAt'>): SettingItem {
    const sid = id();
    const ts = now();
    db.prepare(`INSERT INTO setting_items
      (id, novel_id, type, name, summary, content, tags, created_at, updated_at)
      VALUES (@id, @novelId, @type, @name, @summary, @content, @tags, @ts, @ts)`).run({
      id: sid,
      novelId: input.novelId,
      type: input.type,
      name: input.name,
      summary: input.summary ?? null,
      content: input.content ?? null,
      tags: stringifyJson(input.tags ?? []),
      ts,
    });
    return this.get(sid)!;
  },
  update(id: string, patch: Partial<SettingItem>): SettingItem | null {
    const existing = this.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, updatedAt: now() };
    db.prepare(`UPDATE setting_items SET
      type=@type, name=@name, summary=@summary, content=@content, tags=@tags, updated_at=@ts
      WHERE id=@id`).run({
      id,
      type: merged.type,
      name: merged.name,
      summary: merged.summary ?? null,
      content: merged.content ?? null,
      tags: stringifyJson(merged.tags ?? []),
      ts: merged.updatedAt,
    });
    return this.get(id);
  },
  delete(id: string): void {
    db.prepare('DELETE FROM setting_items WHERE id = ?').run(id);
  },
};

export const Outlines = {
  listByNovel(novelId: string): OutlineNode[] {
    return db.prepare('SELECT * FROM outline_nodes WHERE novel_id = ? ORDER BY order_index')
      .all(novelId).map(rowToOutline);
  },
  get(id: string): OutlineNode | null {
    const row = db.prepare('SELECT * FROM outline_nodes WHERE id = ?').get(id);
    return row ? rowToOutline(row) : null;
  },
  create(input: Omit<OutlineNode, 'id' | 'createdAt' | 'updatedAt'>): OutlineNode {
    const oid = id();
    const ts = now();
    db.prepare(`INSERT INTO outline_nodes
      (id, novel_id, parent_id, level, title, summary, goal, order_index, status, created_at, updated_at)
      VALUES (@id, @novelId, @parentId, @level, @title, @summary, @goal, @orderIndex, @status, @ts, @ts)`).run({
      id: oid,
      novelId: input.novelId,
      parentId: input.parentId ?? null,
      level: input.level,
      title: input.title,
      summary: input.summary ?? null,
      goal: input.goal ?? null,
      orderIndex: input.orderIndex ?? 0,
      status: input.status ?? 'draft',
      ts,
    });
    return this.get(oid)!;
  },
  update(id: string, patch: Partial<OutlineNode>): OutlineNode | null {
    const existing = this.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, updatedAt: now() };
    db.prepare(`UPDATE outline_nodes SET
      parent_id=@parentId, level=@level, title=@title, summary=@summary, goal=@goal,
      order_index=@orderIndex, status=@status, updated_at=@ts WHERE id=@id`).run({
      id,
      parentId: merged.parentId ?? null,
      level: merged.level,
      title: merged.title,
      summary: merged.summary ?? null,
      goal: merged.goal ?? null,
      orderIndex: merged.orderIndex,
      status: merged.status ?? 'draft',
      ts: merged.updatedAt,
    });
    return this.get(id);
  },
  delete(id: string): void {
    db.prepare('DELETE FROM outline_nodes WHERE id = ?').run(id);
  },
};

export const ChapterPlans = {
  listByNovel(novelId: string): ChapterPlan[] {
    return db.prepare('SELECT * FROM chapter_plans WHERE novel_id = ? ORDER BY chapter_number')
      .all(novelId).map(rowToPlan);
  },
  get(id: string): ChapterPlan | null {
    const row = db.prepare('SELECT * FROM chapter_plans WHERE id = ?').get(id);
    return row ? rowToPlan(row) : null;
  },
  create(input: Omit<ChapterPlan, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
    status?: ChapterPlan['status'];
  }): ChapterPlan {
    const pid = id();
    const ts = now();
    db.prepare(`INSERT INTO chapter_plans
      (id, novel_id, outline_node_id, chapter_number, title, summary, goal,
       target_word_count, min_word_count, max_word_count, status, rule_set_json, created_at, updated_at)
      VALUES (@id, @novelId, @outlineNodeId, @chapterNumber, @title, @summary, @goal,
       @tw, @minW, @maxW, @status, @ruleSet, @ts, @ts)`).run({
      id: pid,
      novelId: input.novelId,
      outlineNodeId: input.outlineNodeId ?? null,
      chapterNumber: input.chapterNumber,
      title: input.title ?? null,
      summary: input.summary ?? null,
      goal: input.goal ?? null,
      tw: input.targetWordCount ?? null,
      minW: input.minWordCount ?? null,
      maxW: input.maxWordCount ?? null,
      status: input.status ?? 'planned',
      ruleSet: stringifyJson(input.ruleSet ?? {}),
      ts,
    });
    return this.get(pid)!;
  },
  update(id: string, patch: Partial<ChapterPlan>): ChapterPlan | null {
    const existing = this.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, updatedAt: now() };
    db.prepare(`UPDATE chapter_plans SET
      outline_node_id=@outlineNodeId, chapter_number=@chapterNumber, title=@title,
      summary=@summary, goal=@goal, target_word_count=@tw, min_word_count=@minW,
      max_word_count=@maxW, status=@status, rule_set_json=@ruleSet, updated_at=@ts WHERE id=@id`).run({
      id,
      outlineNodeId: merged.outlineNodeId ?? null,
      chapterNumber: merged.chapterNumber,
      title: merged.title ?? null,
      summary: merged.summary ?? null,
      goal: merged.goal ?? null,
      tw: merged.targetWordCount ?? null,
      minW: merged.minWordCount ?? null,
      maxW: merged.maxWordCount ?? null,
      status: merged.status,
      ruleSet: stringifyJson(merged.ruleSet ?? {}),
      ts: merged.updatedAt,
    });
    return this.get(id);
  },
  delete(id: string): void {
    db.prepare('DELETE FROM chapter_plans WHERE id = ?').run(id);
  },
};

export const Drafts = {
  getByPlan(chapterPlanId: string): ChapterDraft | null {
    const row = db.prepare('SELECT * FROM chapter_drafts WHERE chapter_plan_id = ?').get(chapterPlanId);
    return row ? rowToDraft(row) : null;
  },
  getOrCreate(novelId: string, chapterPlanId: string): ChapterDraft {
    const existing = this.getByPlan(chapterPlanId);
    if (existing) return existing;
    const did = id();
    const ts = now();
    db.prepare(`INSERT INTO chapter_drafts (id, novel_id, chapter_plan_id, status, updated_at)
      VALUES (?, ?, ?, 'empty', ?)`).run(did, novelId, chapterPlanId, ts);
    return this.getByPlan(chapterPlanId)!;
  },
  setCurrentVersion(draftId: string, versionId: string, status: ChapterDraft['status']) {
    db.prepare(`UPDATE chapter_drafts SET current_version_id=?, status=?, last_generated_at=?, updated_at=? WHERE id=?`)
      .run(versionId, status, now(), now(), draftId);
  },
  listVersions(draftId: string): DraftVersion[] {
    return db.prepare('SELECT * FROM draft_versions WHERE draft_id = ? ORDER BY version_number DESC')
      .all(draftId).map(rowToVersion);
  },
  getVersion(versionId: string): DraftVersion | null {
    const row = db.prepare('SELECT * FROM draft_versions WHERE id = ?').get(versionId);
    return row ? rowToVersion(row) : null;
  },
  addVersion(input: {
    draftId: string;
    content: string;
    sourceType: DraftVersion['sourceType'];
    generationContext?: string;
  }): DraftVersion {
    const versions = this.listVersions(input.draftId);
    const nextNumber = (versions[0]?.versionNumber ?? 0) + 1;
    const vid = id();
    const ts = now();
    db.prepare(`INSERT INTO draft_versions
      (id, draft_id, version_number, content, source_type, generation_context, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      vid,
      input.draftId,
      nextNumber,
      input.content,
      input.sourceType,
      input.generationContext ?? null,
      ts
    );
    return this.getVersion(vid)!;
  },
};

export const Reviews = {
  listByPlan(chapterPlanId: string): ReviewReport[] {
    return db.prepare('SELECT * FROM review_reports WHERE chapter_plan_id = ? ORDER BY created_at DESC')
      .all(chapterPlanId).map(rowToReport);
  },
  get(id: string): ReviewReport | null {
    const row = db.prepare('SELECT * FROM review_reports WHERE id = ?').get(id);
    return row ? rowToReport(row) : null;
  },
  create(input: Omit<ReviewReport, 'id' | 'createdAt'>): ReviewReport {
    const rid = id();
    const ts = now();
    db.prepare(`INSERT INTO review_reports
      (id, novel_id, chapter_plan_id, draft_version_id, result, score, summary, issues_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      rid,
      input.novelId,
      input.chapterPlanId,
      input.draftVersionId,
      input.result,
      input.score ?? null,
      input.summary ?? null,
      stringifyJson(input.issues ?? []),
      ts
    );
    return this.get(rid)!;
  },
};

export const Providers = {
  list(): ModelProvider[] {
    return db.prepare('SELECT * FROM model_providers ORDER BY is_default DESC, created_at DESC')
      .all().map(rowToProvider);
  },
  get(id: string): ModelProvider | null {
    const row = db.prepare('SELECT * FROM model_providers WHERE id = ?').get(id);
    return row ? rowToProvider(row) : null;
  },
  getDefault(): ModelProvider | null {
    const row = db.prepare('SELECT * FROM model_providers WHERE is_default = 1 LIMIT 1').get()
      || db.prepare('SELECT * FROM model_providers ORDER BY created_at DESC LIMIT 1').get();
    return row ? rowToProvider(row) : null;
  },
  create(input: Omit<ModelProvider, 'id' | 'createdAt' | 'updatedAt'>): ModelProvider {
    const pid = id();
    const ts = now();
    if (input.isDefault) {
      db.prepare('UPDATE model_providers SET is_default = 0').run();
    }
    db.prepare(`INSERT INTO model_providers
      (id, name, base_url, api_key, model, headers_json, is_default, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      pid,
      input.name,
      input.baseUrl,
      input.apiKey ?? null,
      input.model,
      stringifyJson(input.headers ?? {}),
      input.isDefault ? 1 : 0,
      ts,
      ts
    );
    return this.get(pid)!;
  },
  update(id: string, patch: Partial<ModelProvider>): ModelProvider | null {
    const existing = this.get(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, updatedAt: now() };
    if (patch.isDefault) {
      db.prepare('UPDATE model_providers SET is_default = 0').run();
    }
    db.prepare(`UPDATE model_providers SET
      name=?, base_url=?, api_key=?, model=?, headers_json=?, is_default=?, updated_at=? WHERE id=?`).run(
      merged.name,
      merged.baseUrl,
      merged.apiKey ?? null,
      merged.model,
      stringifyJson(merged.headers ?? {}),
      merged.isDefault ? 1 : 0,
      merged.updatedAt,
      id
    );
    return this.get(id);
  },
  delete(id: string): void {
    db.prepare('DELETE FROM model_providers WHERE id = ?').run(id);
  },
};
