import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

export function NovelOverviewPage() {
  const { novelId } = useParams();
  const qc = useQueryClient();
  const { data: novel } = useQuery({
    queryKey: ['novel', novelId],
    queryFn: () => api.getNovel(novelId!),
    enabled: !!novelId,
  });

  const [form, setForm] = useState({
    title: '', genre: '', summary: '', styleGuide: '', forbiddenRules: '', targetWordCount: '' as string | number,
  });
  useEffect(() => {
    if (novel) {
      setForm({
        title: novel.title ?? '',
        genre: novel.genre ?? '',
        summary: novel.summary ?? '',
        styleGuide: novel.styleGuide ?? '',
        forbiddenRules: novel.forbiddenRules ?? '',
        targetWordCount: novel.targetWordCount ?? '',
      });
    }
  }, [novel?.id]);

  const updateMut = useMutation({
    mutationFn: () => api.updateNovel(novelId!, {
      title: form.title,
      genre: form.genre,
      summary: form.summary,
      styleGuide: form.styleGuide,
      forbiddenRules: form.forbiddenRules,
      targetWordCount: form.targetWordCount ? Number(form.targetWordCount) : null,
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['novel', novelId] }),
  });

  return (
    <div className="p-8 max-w-3xl">
      <h2 className="text-xl font-semibold mb-6">小说基本信息</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">书名</label>
          <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="label">类型 / 题材</label>
          <input className="input" value={form.genre} onChange={e => setForm({ ...form, genre: e.target.value })} />
        </div>
        <div>
          <label className="label">目标总字数</label>
          <input type="number" className="input" value={form.targetWordCount}
            onChange={e => setForm({ ...form, targetWordCount: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">简介</label>
          <textarea className="input" rows={3} value={form.summary}
            onChange={e => setForm({ ...form, summary: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">整体文风 / 风格要求</label>
          <textarea className="input" rows={3} value={form.styleGuide}
            onChange={e => setForm({ ...form, styleGuide: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">全局禁区 / 红线规则</label>
          <textarea className="input" rows={3} value={form.forbiddenRules}
            onChange={e => setForm({ ...form, forbiddenRules: e.target.value })} />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button className="btn btn-primary" disabled={updateMut.isPending} onClick={() => updateMut.mutate()}>
          {updateMut.isPending ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  );
}
