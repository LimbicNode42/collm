'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Node, User } from '../../types/api';

const MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

const TAG_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-purple-100 text-purple-700',
  'bg-teal-100 text-teal-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
];

function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[h];
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}>
      {tag}
    </span>
  );
}

function ModelBadge({ model }: { model: string }) {
  const color = model.startsWith('claude')
    ? 'bg-orange-100 text-orange-800'
    : model.startsWith('gpt')
    ? 'bg-green-100 text-green-800'
    : 'bg-blue-100 text-blue-800';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {model.split('-').slice(0, 2).join('-')}
    </span>
  );
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [synthesizing, setSynthesizing] = useState(false);
  const [showSynthesizeForm, setShowSynthesizeForm] = useState(false);
  const [synthesizeTopic, setSynthesizeTopic] = useState('');

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [tagsInput, setTagsInput] = useState('');

  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
      loadNodes();
    } else {
      router.replace('/login');
    }
  }, [router]);

  async function loadNodes() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/nodes');
      const data = await res.json();
      setNodes(data.nodes ?? []);
    } catch {
      setError('Failed to load nodes. Is the core-service running?');
    } finally {
      setLoading(false);
    }
  }

  async function createNode(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setCreating(true);
    setError('');
    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(Boolean);
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, description, model, tags }),
      });
      if (!res.ok) throw new Error(await res.text());
      const node = await res.json();

      if (node.existingNode) {
        window.location.href = `/nodes/${node.id}`;
        return;
      }

      setNodes(prev => [node, ...prev]);
      setTopic(''); setDescription(''); setTagsInput('');
      setShowCreate(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create node');
    } finally {
      setCreating(false);
    }
  }

  async function synthesizeNodes() {
    if (selected.size < 2 || synthesizing) return;
    const topicName = synthesizeTopic.trim();
    if (!topicName) return;
    setSynthesizing(true);
    setError('');
    try {
      const res = await fetch('/api/nodes/synthesize-multiple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeIds: Array.from(selected), topic: topicName }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      router.push(`/nodes/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to synthesize nodes');
    } finally {
      setSynthesizing(false);
      setShowSynthesizeForm(false);
      setSelected(new Set());
      setSynthesizeTopic('');
    }
  }

  // Collect all unique tags across all nodes
  const allTags = Array.from(new Set(nodes.flatMap(n => n.tags ?? [])));

  // Filter nodes
  const filteredNodes = nodes.filter(n => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      n.topic.toLowerCase().includes(q) ||
      (n.description ?? '').toLowerCase().includes(q) ||
      (n.tags ?? []).some(t => t.toLowerCase().includes(q));
    const matchesTag = !activeTagFilter || (n.tags ?? []).includes(activeTagFilter);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">← Home</Link>
            <h1 className="text-xl font-bold text-gray-900">Knowledge Base</h1>
            <Link href="/leaderboard" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium hidden sm:block">Leaderboard →</Link>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-500 hidden sm:block">
                <strong>{user.name || user.email}</strong>
              </span>
            )}
            <button
              onClick={() => setShowCreate(v => !v)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {showCreate ? 'Cancel' : '+ New Topic'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Create form */}
        {showCreate && (
          <form onSubmit={createNode} className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">New Knowledge Topic</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic *</label>
                <input
                  value={topic} onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Climate Change Policy"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What should this topic cover?"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input
                  value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                  placeholder="science, economics, policy (comma-separated)"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                {tagsInput.trim() && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).map(t => (
                      <TagPill key={t} tag={t} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                <select
                  value={model} onChange={e => setModel(e.target.value)}
                  aria-label="Select AI model"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
                Cancel
              </button>
              <button
                type="submit" disabled={creating || !topic.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating…' : 'Create Topic'}
              </button>
            </div>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error}</div>
        )}

        {/* Search + tag filters */}
        {!loading && nodes.length > 0 && (
          <div className="space-y-3">
            <input
              type="search"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search topics, descriptions, or tags…"
              className="w-full bg-white border rounded-xl px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 shadow-sm"
            />
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-400 font-medium">Filter:</span>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                      activeTagFilter === tag
                        ? `${tagColor(tag)} ring-2 ring-offset-1 ring-indigo-400`
                        : `${tagColor(tag)} opacity-70 hover:opacity-100`
                    }`}
                  >
                    {tag}
                  </button>
                ))}
                {activeTagFilter && (
                  <button onClick={() => setActiveTagFilter(null)} className="text-xs text-gray-400 hover:text-gray-600 underline">
                    Clear filter
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading topics…</div>
        ) : filteredNodes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {nodes.length === 0 ? (
              <>
                <p className="text-lg font-medium mb-2 text-gray-600">No topics yet</p>
                <p className="text-sm">Create your first topic to start building a knowledge base.</p>
              </>
            ) : (
              <p className="text-sm">No topics match your search{activeTagFilter ? ` or tag "${activeTagFilter}"` : ''}.</p>
            )}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredNodes.map(node => (
              <div key={node.id} className="relative flex items-start group">
                <div className={`flex-shrink-0 mt-5 ml-2 mr-0 transition-opacity ${selected.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  <input type="checkbox" aria-label={`Select ${node.topic}`} checked={selected.has(node.id)} onChange={e => { e.stopPropagation(); setSelected(prev => { const s=new Set(prev); if(s.has(node.id)) s.delete(node.id); else s.add(node.id); return s; }); }} className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer" />
                </div>
                <Link
                  href={`/nodes/${node.id}`}
                  className="flex-1 block bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition-all ml-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 truncate">
                        {node.topic}
                      </h3>
                      <ModelBadge model={node.model} />
                    </div>
                    {node.description && (
                      <p className="text-sm text-gray-500 truncate mb-2">{node.description}</p>
                    )}
                    {/* Tags */}
                    {(node.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {(node.tags ?? []).map(tag => <TagPill key={tag} tag={tag} />)}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>{node.memory?.messageCount ?? 0} AI turns</span>
                      <span>{node.memory?.keyFacts?.length ?? 0} facts</span>
                      <span>v{node.version}</span>
                      <span>
                        {new Date(node.updatedAt).toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-indigo-400 text-lg mt-1 flex-shrink-0">→</span>
                </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {nodes.length > 0 && (
          <div className="text-center pt-2">
            <button onClick={loadNodes} className="text-sm text-gray-500 hover:text-gray-700 underline">
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Floating Synthesize Button */}
      {selected.size >= 2 && !showSynthesizeForm && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <button onClick={() => setShowSynthesizeForm(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-full shadow-lg font-medium text-sm hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <span>Synthesize selected ({selected.size})</span>
            <span className="text-indigo-200">→</span>
          </button>
        </div>
      )}

      {/* Synthesize form modal */}
      {showSynthesizeForm && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={() => { setShowSynthesizeForm(false); setSynthesizeTopic(''); }} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t shadow-2xl rounded-t-2xl p-6 max-w-lg mx-auto">
            <h2 className="font-semibold text-gray-900 mb-2">Synthesize {selected.size} topics</h2>
            <p className="text-xs text-gray-500 mb-4">Enter a name for the new synthesized topic</p>
            <form onSubmit={e => { e.preventDefault(); synthesizeNodes(); }} className="space-y-3">
              <input value={synthesizeTopic} onChange={e => setSynthesizeTopic(e.target.value)} placeholder="New topic name…" required autoFocus className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowSynthesizeForm(false); setSynthesizeTopic(''); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                <button type="submit" disabled={synthesizing || !synthesizeTopic.trim()} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">{synthesizing ? 'Synthesizing…' : `Synthesize →`}</button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
