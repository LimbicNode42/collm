'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

interface LeaderboardEntry {
  userId: string;
  contributionCount: number;
  netVotes: number;
  totalUpvotes: number;
  totalDownvotes: number;
  totalImpact: number;
}

const MEDAL = ['🥇', '🥈', '🥉'];

function formatImpact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<{id: string; topic: string}[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/nodes').then(r => r.ok ? r.json() : []).then(d => {
      const nodeList = Array.isArray(d) ? d : (d.nodes ?? []);
      setNodes(nodeList.map((n: any) => ({ id: n.id, topic: n.topic })));
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    const url = selectedNodeId ? `/api/nodes/${selectedNodeId}/leaderboard` : '/api/leaderboard';
    fetch(url).then(r => r.ok ? r.json() : { leaderboard: [] }).then(d => {
      setEntries(d.leaderboard ?? []);
      setLoading(false);
    });
  }, [selectedNodeId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/nodes" className="text-gray-400 hover:text-gray-600 text-sm">← Topics</Link>
          <h1 className="font-bold text-gray-900">
            {selectedTopic ? `${selectedTopic} — Contributors` : 'Contributor Leaderboard'}
          </h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">
        {nodes.length > 0 && (
          <div className="mb-6">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setSelectedNodeId(null); setSelectedTopic(null); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!selectedNodeId ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                All Topics
              </button>
              {nodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => { setSelectedNodeId(n.id); setSelectedTopic(n.topic); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors truncate max-w-[180px] ${selectedNodeId === n.id ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {n.topic}
                </button>
              ))}
            </div>
          </div>
        )}
                {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-white rounded-xl border" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-24 text-gray-400">No contributions yet.</div>
        ) : (
          <ol className="space-y-3">
            {entries.map((e, i) => (
              <li key={e.userId} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                <div className="w-10 text-2xl text-center flex-shrink-0">
                  {MEDAL[i] ?? <span className="text-base text-gray-500 font-bold">#{i + 1}</span>}
                </div>
                <Link href={`/users/${encodeURIComponent(e.userId)}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-200 transition-colors">
                    {e.userId[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate group-hover:text-indigo-700 transition-colors">{e.userId}</p>
                    <p className="text-xs text-gray-500">{e.contributionCount} contribution{e.contributionCount !== 1 ? 's' : ''}</p>
                  </div>
                </Link>
                <div className="flex gap-4 text-sm text-right flex-shrink-0 ml-auto">
                  <div>
                    <p className={`font-bold ${e.netVotes >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {e.netVotes > 0 ? `+${e.netVotes}` : e.netVotes}
                    </p>
                    <p className="text-xs text-gray-400">net votes</p>
                  </div>
                  <div>
                    <p className="font-bold text-gray-700">{formatImpact(e.totalImpact)}</p>
                    <p className="text-xs text-gray-400">impact</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
