import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { GenerateResult, ReviewIssue } from '../types';

const SEVERITY_COLOR: Record<string, string> = {
  info: 'bg-ink-700 text-ink-200',
  minor: 'bg-yellow-900/60 text-yellow-200',
  major: 'bg-orange-900/60 text-orange-200',
  critical: 'bg-red-900/70 text-red-200',
};

export function DraftPage() {
  const { novelId, planId } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'preview' | 'review'>('preview');
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null);
  const [content, setContent] = useState('');
  const [dirty, setDirty] = useState(false);

  const { data: plans = [] } = useQuery({
    queryKey: ['plans', novelId],
    queryFn: () => api.listPlans(novelId!),
    enabled: !!novelId,
  });
  const plan = plans.find(p => p.id === planId);

  const { data: draftData, refetch: refetchDraft } = useQuery({
    queryKey: ['draft', planId],
    queryFn: () => api.getDraft(planId!),
    enabled: !!planId,
  });

  useEffect(() => {
    if (draftData?.current?.content != null && !dirty) {
      setContent(draftData.current.content);
    }
    if (!draftData?.current) setContent('');
  }, [draftData?.current?.id]);

  const { data: preview } = useQuery({
    queryKey: ['preview', planId, plan?.updatedAt],
    queryFn: () => api.previewPlan(planId!),
    enabled: !!planId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ['reviews', planId],
    queryFn: () => api.listReviews(planId!),
    enabled: !!planId,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: api.listProviders,
  });
  const [providerId, setProviderId] = useState<string>('');
  useEffect(() => {
    if (!providerId && providers.length) {
      const def = providers.find(p => p.isDefault) ?? providers[0];
      setProviderId(def.id);
    }
  }, [providers, providerId]);

  const generateMut = useMutation({
    mutationFn: () => api.generatePlan(planId!, { providerId: providerId || undefined }),
    onSuccess: (result) => {
      setLastResult(result);
      setContent(result.content);
      setDirty(false);
      refetchDraft();
      qc.invalidateQueries({ queryKey: ['reviews', planId] });
      qc.invalidateQueries({ queryKey: ['plans', novelId] });
      setTab('review');
    },
  });

  const saveMut = useMutation({
    mutationFn: () => api.saveManualDraft(planId!, content),
    onSuccess: () => {
      setDirty(false);
      refetchDraft();
      qc.invalidateQueries({ queryKey: ['plans', novelId] });
    },
  });

  const wordCount = useMemo(() => {
    const cjk = content.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    const alpha = content.match(/[A-Za-z0-9]+/g)?.length ?? 0;
    return cjk + alpha;
  }, [content]);

  const lastReview = reviews[0];
  const lastIssues: ReviewIssue[] = lastResult?.review.issues ?? lastReview?.issues ?? [];
  const lastResult2 = lastResult?.review.result ?? lastReview?.result;

  if (!plan) return <div className="p-8 text-ink-500">章节计划不存在。</div>;

  return (
    <div className="h-full grid grid-cols-[1fr_420px]">
      <div className="flex flex-col min-h-0">
        <div className="px-6 py-3 border-b border-ink-700 flex items-center justify-between bg-ink-900/60">
          <div>
            <div className="text-sm text-ink-400">
              <Link to={`/novels/${novelId}/plans`} className="hover:text-ink-100">章节计划</Link>
              <span className="mx-2">/</span>
              <span>第 {plan.chapterNumber} 章</span>
            </div>
            <div className="font-semibold">{plan.title || '（无标题）'}</div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-400">{wordCount} 字</span>
            {plan.targetWordCount && (
              <span className="text-ink-500">· 目标 {plan.targetWordCount}</span>
            )}
            {plan.minWordCount || plan.maxWordCount ? (
              <span className="text-ink-500">· 区间 {plan.minWordCount ?? '—'}–{plan.maxWordCount ?? '—'}</span>
            ) : null}
            {dirty && <span className="tag">未保存</span>}
          </div>
        </div>

        <div className="flex-1 min-h-0 p-6">
          <textarea
            value={content}
            onChange={e => { setContent(e.target.value); setDirty(true); }}
            className="input h-full resize-none font-mono text-[15px] leading-8"
            placeholder="正文内容…（可直接手动编辑，或点击右侧「生成本章」自动生成）" />
        </div>

        <div className="px-6 py-3 border-t border-ink-700 bg-ink-900/60 flex items-center justify-between">
          <div className="text-xs text-ink-500">
            {draftData?.current
              ? `当前版本 v${draftData.current.versionNumber} · ${new Date(draftData.current.createdAt).toLocaleString()}`
              : '尚无草稿版本'}
          </div>
          <div className="flex gap-2">
            <button className="btn btn-ghost" disabled={!dirty || saveMut.isPending}
              onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? '保存中…' : '保存手动修改'}
            </button>
          </div>
        </div>
      </div>

      <aside className="border-l border-ink-700 flex flex-col min-h-0 bg-ink-900/40">
        <div className="p-4 border-b border-ink-700">
          <label className="label">使用模型</label>
          <select className="input mb-3" value={providerId}
            onChange={e => setProviderId(e.target.value)}>
            {providers.length === 0 && <option value="">（请先在「模型配置」中添加）</option>}
            {providers.map(p => <option key={p.id} value={p.id}>{p.name} · {p.model}{p.isDefault ? ' (默认)' : ''}</option>)}
          </select>
          <button className="btn btn-primary w-full"
            disabled={!providerId || generateMut.isPending}
            onClick={() => generateMut.mutate()}>
            {generateMut.isPending ? '生成中…（可能需要数十秒）' : '生成本章'}
          </button>
          {generateMut.isError && (
            <div className="mt-2 text-xs text-red-400">
              {(generateMut.error as Error)?.message}
            </div>
          )}
        </div>

        <div className="border-b border-ink-700 flex">
          <button className={`flex-1 py-2 text-sm ${tab === 'preview' ? 'bg-ink-800 text-brand-500' : 'text-ink-300'}`}
            onClick={() => setTab('preview')}>上下文注入</button>
          <button className={`flex-1 py-2 text-sm ${tab === 'review' ? 'bg-ink-800 text-brand-500' : 'text-ink-300'}`}
            onClick={() => setTab('review')}>
            审核结果
            {lastIssues.length > 0 && <span className="ml-1 text-xs text-red-400">· {lastIssues.length}</span>}
          </button>
        </div>

        <div className="flex-1 overflow-auto scrollbar-thin p-4 text-sm">
          {tab === 'preview' ? (
            <div className="space-y-3">
              <div>
                <div className="text-xs text-ink-400 mb-1">规则块（将发送给模型）</div>
                <pre className="whitespace-pre-wrap text-ink-200 bg-ink-900 rounded p-3 border border-ink-700 text-xs leading-6">
{preview?.rules}
                </pre>
              </div>
              <div>
                <div className="text-xs text-ink-400 mb-1">上下文块</div>
                <pre className="whitespace-pre-wrap text-ink-200 bg-ink-900 rounded p-3 border border-ink-700 text-xs leading-6">
{preview?.context}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {lastResult2 && (
                <div className={`rounded px-3 py-2 text-sm ${
                  lastResult2 === 'pass' ? 'bg-emerald-900/50 text-emerald-200'
                  : lastResult2 === 'warn' ? 'bg-yellow-900/60 text-yellow-200'
                  : 'bg-red-900/60 text-red-200'
                }`}>
                  审核结论：{lastResult2 === 'pass' ? '通过' : lastResult2 === 'warn' ? '有待完善' : '不通过'}
                </div>
              )}
              {lastIssues.length === 0 ? (
                <div className="text-ink-500">暂无规则问题。点击「生成本章」后这里会列出自动审核结果。</div>
              ) : (
                <ul className="space-y-2">
                  {lastIssues.map((iss, idx) => (
                    <li key={idx} className="bg-ink-900 border border-ink-700 rounded p-3">
                      <div className="flex items-center gap-2">
                        <span className={`tag ${SEVERITY_COLOR[iss.severity] || ''}`}>{iss.severity}</span>
                        <span className="text-xs text-ink-400">{iss.ruleSource ?? iss.type}</span>
                      </div>
                      <div className="mt-1 text-ink-100">{iss.message}</div>
                      {iss.suggestion && <div className="mt-1 text-xs text-ink-400">建议：{iss.suggestion}</div>}
                    </li>
                  ))}
                </ul>
              )}
              {reviews.length > 1 && (
                <div>
                  <div className="text-xs text-ink-400 mt-4 mb-2">历史审核</div>
                  <ul className="space-y-1">
                    {reviews.slice(1).map(r => (
                      <li key={r.id} className="text-xs text-ink-400">
                        {new Date(r.createdAt).toLocaleString()} · {r.result} · {r.issues.length} 项问题
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
