import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ChapterPlans,
  Drafts,
  Novels,
  Outlines,
  Providers,
  Reviews,
  Settings,
} from './repo.js';
import { testConnection } from './providers/openai.js';
import { generateChapter } from './workflow/generate.js';
import { buildChapterContext, renderContextForPrompt } from './workflow/context.js';
import { renderRulesForPrompt, resolveChapterRules } from './workflow/rules.js';

const NovelInput = z.object({
  title: z.string().min(1),
  genre: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  targetWordCount: z.number().int().optional().nullable(),
  styleGuide: z.string().optional().nullable(),
  forbiddenRules: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

const SettingInput = z.object({
  type: z.enum(['worldview', 'character', 'faction', 'location', 'item', 'rule', 'style', 'other']),
  name: z.string().min(1),
  summary: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
});

const OutlineInput = z.object({
  parentId: z.string().optional().nullable(),
  level: z.enum(['novel', 'volume', 'chapter', 'scene']),
  title: z.string().min(1),
  summary: z.string().optional().nullable(),
  goal: z.string().optional().nullable(),
  orderIndex: z.number().int().optional(),
  status: z.string().optional().nullable(),
});

const RuleSetInput = z.object({
  narrativePerspective: z.string().optional(),
  toneStyle: z.string().optional(),
  dialogueRatioPreference: z.enum(['low', 'medium', 'high']).optional(),
  descriptionRatioPreference: z.enum(['low', 'medium', 'high']).optional(),
  mustIncludePoints: z.array(z.string()).optional(),
  mustAvoidPoints: z.array(z.string()).optional(),
  continuityRequirements: z.string().optional(),
  mustGenerateOutlineFirst: z.boolean().optional(),
  mustGenerateByScenes: z.boolean().optional(),
  minWordCount: z.number().int().optional(),
  maxWordCount: z.number().int().optional(),
  extraInstructions: z.string().optional(),
}).partial();

const PlanInput = z.object({
  outlineNodeId: z.string().optional().nullable(),
  chapterNumber: z.number().int(),
  title: z.string().optional().nullable(),
  summary: z.string().optional().nullable(),
  goal: z.string().optional().nullable(),
  targetWordCount: z.number().int().optional().nullable(),
  minWordCount: z.number().int().optional().nullable(),
  maxWordCount: z.number().int().optional().nullable(),
  status: z.enum(['planned', 'generating', 'drafted', 'reviewing', 'finalized']).optional(),
  ruleSet: RuleSetInput.optional(),
});

const ProviderInput = z.object({
  name: z.string().min(1),
  baseUrl: z.string().min(1),
  apiKey: z.string().optional().nullable(),
  model: z.string().min(1),
  headers: z.record(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

export async function registerRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => ({ ok: true }));

  // Novels
  app.get('/api/novels', async () => Novels.list());
  app.post('/api/novels', async (req, reply) => {
    const body = NovelInput.parse(req.body);
    return Novels.create(body);
  });
  app.get('/api/novels/:id', async (req, reply) => {
    const { id } = req.params as any;
    const n = Novels.get(id);
    if (!n) return reply.code(404).send({ error: 'novel not found' });
    return n;
  });
  app.put('/api/novels/:id', async (req, reply) => {
    const { id } = req.params as any;
    const body = NovelInput.partial().parse(req.body);
    const n = Novels.update(id, body);
    if (!n) return reply.code(404).send({ error: 'novel not found' });
    return n;
  });
  app.delete('/api/novels/:id', async (req) => {
    const { id } = req.params as any;
    Novels.delete(id);
    return { ok: true };
  });

  // Settings
  app.get('/api/novels/:novelId/settings', async (req) => {
    const { novelId } = req.params as any;
    return Settings.listByNovel(novelId);
  });
  app.post('/api/novels/:novelId/settings', async (req) => {
    const { novelId } = req.params as any;
    const body = SettingInput.parse(req.body);
    return Settings.create({ ...body, novelId });
  });
  app.put('/api/settings/:id', async (req, reply) => {
    const { id } = req.params as any;
    const body = SettingInput.partial().parse(req.body);
    const s = Settings.update(id, body);
    if (!s) return reply.code(404).send({ error: 'setting not found' });
    return s;
  });
  app.delete('/api/settings/:id', async (req) => {
    const { id } = req.params as any;
    Settings.delete(id);
    return { ok: true };
  });

  // Outline
  app.get('/api/novels/:novelId/outline', async (req) => {
    const { novelId } = req.params as any;
    return Outlines.listByNovel(novelId);
  });
  app.post('/api/novels/:novelId/outline', async (req) => {
    const { novelId } = req.params as any;
    const body = OutlineInput.parse(req.body);
    return Outlines.create({ ...body, novelId, orderIndex: body.orderIndex ?? 0 });
  });
  app.put('/api/outline/:id', async (req, reply) => {
    const { id } = req.params as any;
    const body = OutlineInput.partial().parse(req.body);
    const n = Outlines.update(id, body);
    if (!n) return reply.code(404).send({ error: 'outline not found' });
    return n;
  });
  app.delete('/api/outline/:id', async (req) => {
    const { id } = req.params as any;
    Outlines.delete(id);
    return { ok: true };
  });

  // Chapter plans
  app.get('/api/novels/:novelId/chapter-plans', async (req) => {
    const { novelId } = req.params as any;
    return ChapterPlans.listByNovel(novelId);
  });
  app.post('/api/novels/:novelId/chapter-plans', async (req) => {
    const { novelId } = req.params as any;
    const body = PlanInput.parse(req.body);
    return ChapterPlans.create({
      novelId,
      outlineNodeId: body.outlineNodeId ?? null,
      chapterNumber: body.chapterNumber,
      title: body.title ?? null,
      summary: body.summary ?? null,
      goal: body.goal ?? null,
      targetWordCount: body.targetWordCount ?? null,
      minWordCount: body.minWordCount ?? null,
      maxWordCount: body.maxWordCount ?? null,
      ruleSet: body.ruleSet ?? {},
      status: body.status,
    });
  });
  app.put('/api/chapter-plans/:id', async (req, reply) => {
    const { id } = req.params as any;
    const body = PlanInput.partial().parse(req.body);
    const n = ChapterPlans.update(id, body as any);
    if (!n) return reply.code(404).send({ error: 'plan not found' });
    return n;
  });
  app.delete('/api/chapter-plans/:id', async (req) => {
    const { id } = req.params as any;
    ChapterPlans.delete(id);
    return { ok: true };
  });

  // Draft / versions
  app.get('/api/chapter-plans/:id/draft', async (req) => {
    const { id } = req.params as any;
    const plan = ChapterPlans.get(id);
    if (!plan) return { draft: null, versions: [], current: null };
    const draft = Drafts.getByPlan(id);
    if (!draft) return { draft: null, versions: [], current: null };
    const versions = Drafts.listVersions(draft.id);
    const current = draft.currentVersionId ? Drafts.getVersion(draft.currentVersionId) : null;
    return { draft, versions, current };
  });

  app.post('/api/chapter-plans/:id/draft/manual', async (req, reply) => {
    const { id } = req.params as any;
    const plan = ChapterPlans.get(id);
    if (!plan) return reply.code(404).send({ error: 'plan not found' });
    const body = z.object({ content: z.string() }).parse(req.body);
    const draft = Drafts.getOrCreate(plan.novelId, plan.id);
    const version = Drafts.addVersion({
      draftId: draft.id,
      content: body.content,
      sourceType: 'manual_edit',
    });
    Drafts.setCurrentVersion(draft.id, version.id, 'revised');
    return { draftId: draft.id, versionId: version.id };
  });

  // Context preview
  app.get('/api/chapter-plans/:id/preview', async (req, reply) => {
    const { id } = req.params as any;
    const plan = ChapterPlans.get(id);
    if (!plan) return reply.code(404).send({ error: 'plan not found' });
    const novel = Novels.get(plan.novelId);
    if (!novel) return reply.code(404).send({ error: 'novel not found' });
    const ctx = buildChapterContext(novel, plan);
    const rules = resolveChapterRules(novel, plan);
    return {
      context: renderContextForPrompt(ctx),
      rules: renderRulesForPrompt(rules, plan),
      resolvedRules: rules,
    };
  });

  // Generate
  app.post('/api/chapter-plans/:id/generate', async (req, reply) => {
    const { id } = req.params as any;
    const body = z.object({
      providerId: z.string().optional(),
      temperature: z.number().optional(),
    }).parse(req.body ?? {});
    try {
      const result = await generateChapter(id, body);
      return result;
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e?.message || 'generation failed' });
    }
  });

  // Reviews
  app.get('/api/chapter-plans/:id/reviews', async (req) => {
    const { id } = req.params as any;
    return Reviews.listByPlan(id);
  });

  // Providers
  app.get('/api/providers', async () => Providers.list());
  app.post('/api/providers', async (req) => {
    const body = ProviderInput.parse(req.body);
    return Providers.create({
      ...body,
      apiKey: body.apiKey ?? null,
      isDefault: body.isDefault ?? false,
    });
  });
  app.put('/api/providers/:id', async (req, reply) => {
    const { id } = req.params as any;
    const body = ProviderInput.partial().parse(req.body);
    const p = Providers.update(id, body as any);
    if (!p) return reply.code(404).send({ error: 'provider not found' });
    return p;
  });
  app.delete('/api/providers/:id', async (req) => {
    const { id } = req.params as any;
    Providers.delete(id);
    return { ok: true };
  });
  app.post('/api/providers/:id/test', async (req, reply) => {
    const { id } = req.params as any;
    const p = Providers.get(id);
    if (!p) return reply.code(404).send({ error: 'provider not found' });
    return await testConnection(p);
  });
}
