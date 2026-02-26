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

function ModelBadge({ model }: { model: string }) {
  const color = model.startsWith('claude')
    ? 'bg-orange-100 text-orange-800'
    : model.startsWith('gpt')
    ? 'bg-green-100 text-green-800'
    : 'bg-blue-100 text-blue-800';
  const short = model.split('-').slice(0, 2).join('-');
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {short}
    </span>
  );
}

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [model, setModel] = useState(MODELS[0]);

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
      const res = await fetch('/api/nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, description, model }),
      });
      if (!res.ok) throw new Error(await res.text());
      const node = await res.json();

      if (node.existingNode) {
        // Topic already exists — redirect straight to that conversation
        window.location.href = `/nodes/${node.id}`;
        return;
      }

      setNodes(prev => [node, ...prev]);
      setTopic('');
      setDescription('');
      setShowCreate(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create node');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">← Home</Link>
            <h1 className="text-xl font-bold text-gray-900">Conversations</h1>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="text-sm text-gray-500">
                Signed in as <strong>{user.name || user.email}</strong>
              </span>
            )}
            <button
              onClick={() => setShowCreate(v => !v)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              {showCreate ? 'Cancel' : '+ New Node'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Create form */}
        {showCreate && (
          <form
            onSubmit={createNode}
            className="bg-white rounded-xl border shadow-sm p-6 space-y-4"
          >
            <h2 className="font-semibold text-gray-900">New Conversation Node</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Topic *</label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g. Climate Change Policy"
                  required
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="What should this conversation focus on?"
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  aria-label="Select AI model"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !topic.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating…' : 'Create Node'}
              </button>
            </div>
          </form>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading nodes…</div>
        ) : nodes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-lg font-medium mb-2">No conversation nodes yet</p>
            <p className="text-sm">Create your first node to start collaborating.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {nodes.map(node => (
              <Link
                key={node.id}
                href={`/nodes/${node.id}`}
                className="block bg-white rounded-xl border shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 truncate">
                        {node.topic}
                      </h3>
                      <ModelBadge model={node.model} />
                    </div>
                    {node.description && (
                      <p className="text-sm text-gray-500 truncate">{node.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>{node.memory?.messageCount ?? 0} AI turns</span>
                      <span>{node.memory?.keyFacts?.length ?? 0} key facts</span>
                      <span>v{node.version}</span>
                      <span>
                        {new Date(node.updatedAt).toLocaleDateString('en-AU', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-indigo-400 text-lg mt-1">→</span>
                </div>
              </Link>
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
    </div>
  );
}
