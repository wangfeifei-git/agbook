import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export function NovelsPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data: novels = [], isLoading } = useQuery({
    queryKey: ['novels'],
    queryFn: api.listNovels,
  });
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [summary, setSummary] = useState('');

  const createMut = useMutation({
    mutationFn: () => api.createNovel({ title, genre, summary }),
    onSuccess: (novel) => {
      qc.invalidateQueries({ queryKey: ['novels'] });
      setCreating(false);
      setTitle(''); setGenre(''); setSummary('');
      nav(`/novels/${novel.id}`);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.deleteNovel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['novels'] }),
  });

  return (
    <div className="h-full overflow-auto scrollbar-thin p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">小说库</h1>
          <p className="text-sm text-ink-400 mt-1">本地优先 · 设定 / 大纲 / 章节计划 / 审核 一体化工作台</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(v => !v)}>
          {creating ? '取消' : '新建小说'}
        </button>
      </div>

      {creating && (
        <div className="card mb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">书名</label>
              <input className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：长夜渡" />
            </div>
            <div>
              <label className="label">类型</label>
              <input className="input" value={genre} onChange={e => setGenre(e.target.value)} placeholder="玄幻 / 都市 / 科幻 …" />
            </div>
            <div className="col-span-2">
              <label className="label">简介</label>
              <textarea className="input" rows={3} value={summary} onChange={e => setSummary(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <button className="btn btn-primary" disabled={!title.trim() || createMut.isPending}
              onClick={() => createMut.mutate()}>
              {createMut.isPending ? '创建中…' : '创建'}
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-ink-400">加载中…</div>
      ) : novels.length === 0 ? (
        <div className="card text-ink-400 text-center py-10">
          还没有小说。点击右上角「新建小说」开始创作。
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {novels.map(n => (
            <div key={n.id} className="card hover:border-brand-500 transition-colors">
              <div className="flex items-start justify-between">
                <Link to={`/novels/${n.id}`} className="text-lg font-semibold hover:text-brand-500">
                  {n.title}
                </Link>
                <button className="text-xs text-ink-400 hover:text-red-400"
                  onClick={() => { if (confirm(`删除「${n.title}」？`)) deleteMut.mutate(n.id); }}>
                  删除
                </button>
              </div>
              {n.genre && <div className="mt-1"><span className="tag">{n.genre}</span></div>}
              {n.summary && <p className="mt-2 text-sm text-ink-300 line-clamp-3">{n.summary}</p>}
              <div className="mt-3 text-xs text-ink-500">
                更新 {new Date(n.updatedAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
