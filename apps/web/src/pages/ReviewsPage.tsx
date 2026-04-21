import { useQueries, useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';

export function ReviewsPage() {
  const { novelId } = useParams();
  const { data: plans = [] } = useQuery({
    queryKey: ['plans', novelId],
    queryFn: () => api.listPlans(novelId!),
    enabled: !!novelId,
  });

  const reviewQueries = useQueries({
    queries: plans.map(p => ({
      queryKey: ['reviews', p.id],
      queryFn: () => api.listReviews(p.id),
    })),
  });

  return (
    <div className="p-6 max-w-5xl">
      <h2 className="text-xl font-semibold mb-4">审核中心</h2>
      {plans.length === 0 ? (
        <div className="text-ink-500">暂无章节计划，无法展示审核结果。</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-ink-400">
            <tr className="border-b border-ink-700">
              <th className="text-left py-2">章节</th>
              <th className="text-left py-2">状态</th>
              <th className="text-left py-2">最近审核</th>
              <th className="text-left py-2">问题 / 结论</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p, idx) => {
              const reviews = reviewQueries[idx]?.data ?? [];
              const last = reviews[0];
              return (
                <tr key={p.id} className="border-b border-ink-800">
                  <td className="py-2">
                    <div className="font-medium">第 {p.chapterNumber} 章 · {p.title || '未命名'}</div>
                  </td>
                  <td className="py-2 text-ink-300">{p.status}</td>
                  <td className="py-2 text-ink-400 text-xs">
                    {last ? new Date(last.createdAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-2">
                    {last ? (
                      <div>
                        <span className={`tag ${last.result === 'pass' ? 'bg-emerald-900/60 text-emerald-200'
                          : last.result === 'warn' ? 'bg-yellow-900/60 text-yellow-200'
                          : 'bg-red-900/60 text-red-200'}`}>
                          {last.result}
                        </span>
                        <span className="ml-2 text-ink-400 text-xs">{last.issues.length} 项问题</span>
                        {last.summary && <div className="text-xs text-ink-500 mt-1">{last.summary}</div>}
                      </div>
                    ) : <span className="text-ink-500 text-xs">—</span>}
                  </td>
                  <td className="py-2 text-right">
                    <Link className="text-brand-500 hover:underline text-xs" to={`/novels/${novelId}/plans/${p.id}`}>
                      打开 →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
