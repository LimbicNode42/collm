'use client';

import { useEffect, useRef, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Node, Contribution, User } from '../../../types/api';

const POLL_INTERVAL_MS = 60_000; // Documents update infrequently — poll every 60s

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NodeDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: nodeId } = use(params);
  const router = useRouter();

  const [node, setNode] = useState<Node | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loadError, setLoadError] = useState('');

  // Contribute panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [contribution, setContribution] = useState('');
  const [evolving, setEvolving] = useState(false);
  const [evolveError, setEvolveError] = useState('');

  // History panel state
  const [showHistory, setShowHistory] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const displayName = user?.name || user?.email || 'anonymous';
  const userId = user?.email || user?.id || 'anonymous';

  // Load node
  const loadNode = useCallback(async () => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}`);
      if (!res.ok) throw new Error('Node not found');
      const data = await res.json();
      // The core service returns the node at the top level (not nested)
      setNode(data);
    } catch {
      setLoadError('Could not load this topic. Is the core-service running?');
    }
  }, [nodeId]);

  // Load contribution history (user messages only, not LLM)
  const loadContributions = useCallback(async () => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/messages?limit=200`);
      if (!res.ok) return;
      const data = await res.json();
      const userContribs: Contribution[] = (data.messages ?? [])
        .filter((m: any) => !m.isLlm && m.userId !== 'llm')
        .map((m: any) => ({
          id: m.id,
          content: m.content,
          userId: m.userId,
          createdAt: m.createdAt,
        }));
      setContributions(userContribs);
    } catch {
      // non-fatal
    }
  }, [nodeId]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.replace('/login');
      return;
    }
    setUser(JSON.parse(stored));
    loadNode();
    loadContributions();

    const interval = setInterval(() => {
      loadNode();
      loadContributions();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [nodeId, loadNode, loadContributions, router]);

  // Open contribute panel
  function openPanel() {
    setPanelOpen(true);
    setEvolveError('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function closePanel() {
    setPanelOpen(false);
    setContribution('');
    setEvolveError('');
  }

  async function submitContribution(e: React.FormEvent) {
    e.preventDefault();
    const text = contribution.trim();
    if (!text || evolving) return;

    setEvolving(true);
    setEvolveError('');

    try {
      const res = await fetch(`/api/nodes/${nodeId}/evolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contribution: text,
          userId,
          userName: displayName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || 'Evolution failed');
      }

      const data = await res.json();

      // Update node state in-place
      setNode(prev => prev ? { ...prev, nodeState: data.nodeState, version: data.version } : prev);
      // Reload contributions to include new one
      loadContributions();
      closePanel();
    } catch (err: any) {
      setEvolveError(err.message || 'Something went wrong');
    } finally {
      setEvolving(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md text-center">
          <p className="text-red-700 font-medium mb-4">{loadError}</p>
          <Link href="/nodes" className="text-indigo-600 hover:underline text-sm">← Back to topics</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/nodes" className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0">
              ← Topics
            </Link>
            {node ? (
              <>
                <h1 className="font-bold text-gray-900 truncate">{node.topic}</h1>
                <ModelBadge model={node.model} />
                <span className="text-xs text-gray-400 hidden sm:block">v{node.version}</span>
              </>
            ) : (
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {contributions.length > 0 && (
              <button
                onClick={() => setShowHistory(v => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {contributions.length} contribution{contributions.length !== 1 ? 's' : ''}
              </button>
            )}
            <button
              onClick={openPanel}
              className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              + Contribute
            </button>
          </div>
        </div>
      </header>

      {/* ── Main document ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">

        {!node ? (
          // Skeleton
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-2/3" />
            <div className="h-4 bg-gray-100 rounded w-full" />
            <div className="h-4 bg-gray-100 rounded w-5/6" />
            <div className="h-4 bg-gray-100 rounded w-4/6" />
          </div>
        ) : !node.nodeState ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
              <span className="text-2xl">📄</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No content yet</h2>
            <p className="text-gray-500 text-sm max-w-sm mb-6">
              Be the first to contribute. Add information, research, or insights about{' '}
              <strong>{node.topic}</strong> and the AI will synthesise it into a knowledge document.
            </p>
            <button
              onClick={openPanel}
              className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Write first contribution →
            </button>
          </div>
        ) : (
          // Document
          <>
            <article className="prose prose-gray prose-headings:font-bold prose-a:text-indigo-600 max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {node.nodeState}
              </ReactMarkdown>
            </article>

            {/* Footer meta */}
            <div className="mt-12 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-400">
              <span>Version {node.version}</span>
              <span>Last updated {timeAgo(node.updatedAt)}</span>
              {node.description && <span className="italic">{node.description}</span>}
            </div>
          </>
        )}

        {/* ── Contribution history ──────────────────────────────────── */}
        {showHistory && contributions.length > 0 && (
          <section className="mt-12 border-t pt-8">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Contribution history
            </h2>
            <ul className="space-y-3">
              {contributions.slice().reverse().map(c => (
                <li key={c.id} className="flex gap-3 text-sm">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {c.userId[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-medium text-gray-700 truncate">{c.userId}</span>
                      <span className="text-gray-400 text-xs">{timeAgo(c.createdAt)}</span>
                    </div>
                    <p className="text-gray-600 line-clamp-3 whitespace-pre-wrap">{c.content}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>

      {/* ── Contribute panel ───────────────────────────────────────────── */}
      {panelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 z-30"
            onClick={closePanel}
          />
          {/* Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-2xl rounded-t-2xl p-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Contribute to this document</h2>
              <button
                onClick={closePanel}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-3">
              Paste research, facts, corrections, or insights — the AI will integrate them into the document.
            </p>

            <form onSubmit={submitContribution} className="space-y-3">
              <textarea
                ref={textareaRef}
                value={contribution}
                onChange={e => setContribution(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') closePanel();
                }}
                placeholder="e.g. Recent studies have shown that… / Correction: the figure is actually… / Key fact: …"
                rows={5}
                disabled={evolving}
                className="w-full border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none placeholder:text-gray-400"
              />

              {evolveError && (
                <p className="text-sm text-red-600">{evolveError}</p>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Contributing as <strong>{displayName}</strong>
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={closePanel}
                    disabled={evolving}
                    className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={evolving || !contribution.trim()}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {evolving ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Evolving document…
                      </>
                    ) : 'Submit contribution →'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
