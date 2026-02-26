'use client';

import { useEffect, useRef, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { diffLines } from 'diff';
import { Node, Contribution, User } from '../../../types/api';

// ---------------------------------------------------------------------------
// Diff utilities — chunk-based with markdown rendering
// ---------------------------------------------------------------------------
interface DiffChunk { type: 'context' | 'change' | 'added'; leftText: string; rightText: string; }

function buildDiffChunks(before: string, after: string): DiffChunk[] {
  const changes = diffLines(before || '', after || '');
  const chunks: DiffChunk[] = [];
  let i = 0;
  while (i < changes.length) {
    const c = changes[i];
    if (!c.added && !c.removed) {
      chunks.push({ type: 'context', leftText: c.value.trimEnd(), rightText: c.value.trimEnd() });
      i++;
    } else if (c.removed) {
      const leftText = c.value.trimEnd();
      let rightText = '';
      if (i + 1 < changes.length && changes[i + 1].added) { rightText = changes[i + 1].value.trimEnd(); i++; }
      chunks.push({ type: 'change', leftText, rightText });
      i++;
    } else {
      chunks.push({ type: 'added', leftText: '', rightText: c.value.trimEnd() });
      i++;
    }
  }
  return chunks;
}

function MdChunk({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function InlineDiff({ chunks }: { chunks: DiffChunk[] }) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="p-6 prose prose-sm max-w-none">
        {chunks.map((chunk, idx) => {
          if (chunk.type === 'context') return <MdChunk key={idx} text={chunk.leftText} />;
          return (
            <div key={idx}>
              {chunk.leftText && <MdChunk text={chunk.leftText} className="border-l-4 border-red-400 pl-3 my-1 bg-red-50 rounded-r [&_*]:!text-red-900 [&_*]:!decoration-red-400" />}
              {chunk.rightText && <MdChunk text={chunk.rightText} className="border-l-4 border-green-400 pl-3 my-1 bg-green-50 rounded-r [&_*]:!text-green-900 [&_*]:!decoration-green-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SplitDiff({ chunks, leftRef, rightRef, onScrollLeft, onScrollRight }: {
  chunks: DiffChunk[];
  leftRef: React.RefObject<HTMLDivElement | null>;
  rightRef: React.RefObject<HTMLDivElement | null>;
  onScrollLeft: React.UIEventHandler<HTMLDivElement>;
  onScrollRight: React.UIEventHandler<HTMLDivElement>;
}) {
  const panel = (side: 'left' | 'right', ref: React.RefObject<HTMLDivElement | null>, onScroll: React.UIEventHandler<HTMLDivElement>) => (
    <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-gray-100 border-b px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        {side === 'left' ? 'Before' : 'After'}
      </div>
      <div ref={ref} onScroll={onScroll} className="flex-1 overflow-auto p-4 prose prose-sm max-w-none">
        {chunks.map((chunk, idx) => {
          if (chunk.type === 'context') return <MdChunk key={idx} text={side === 'left' ? chunk.leftText : chunk.rightText} />;
          if (side === 'left' && chunk.type === 'added') return <div key={idx} className="h-4 bg-gray-50 rounded my-1" />;
          if (side === 'right' && chunk.type === 'change' && !chunk.rightText) return <div key={idx} className="h-4 bg-gray-50 rounded my-1" />;
          const text = side === 'left' ? chunk.leftText : chunk.rightText;
          const cls = side === 'left'
            ? 'border-l-4 border-red-400 pl-3 my-1 bg-red-50 rounded-r [&_*]:!text-red-900'
            : 'border-l-4 border-green-400 pl-3 my-1 bg-green-50 rounded-r [&_*]:!text-green-900';
          return <MdChunk key={idx} text={text} className={cls} />;
        })}
      </div>
    </div>
  );
  return (
    <div className="flex-1 flex divide-x overflow-hidden">
      {panel('left', leftRef, onScrollLeft)}
      {panel('right', rightRef, onScrollRight)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Expandable contribution list item (4 lines at a time)
// ---------------------------------------------------------------------------
function ContributionListItem({ c, onOpen }: { c: Contribution; onOpen: () => void }) {
  const [lines, setLines] = useState(4);
  const [hasMore, setHasMore] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setHasMore(el.scrollHeight > el.clientHeight + 2); // +2 for rounding
  }, [lines, c.content]);

  return (
    <li
      className="flex gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-indigo-50 transition-colors group"
      onClick={onOpen}
    >
      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {c.userId[0]?.toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-700 truncate text-xs">{c.userId}</span>
          <span className="text-gray-400 text-xs flex-shrink-0">{timeAgo(c.createdAt)}</span>
        </div>
        <p
          ref={contentRef}
          className="text-gray-600 text-xs whitespace-pre-wrap"
          style={{ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {c.content}
        </p>
        {(hasMore || lines > 4) && (
          <button
            onClick={e => { e.stopPropagation(); setLines(l => l + 4); }}
            className="text-indigo-500 text-xs mt-1 hover:underline"
          >
            Show more ↓
          </button>
        )}
        <span className="text-indigo-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity mt-1 block">View diff →</span>
      </div>
    </li>
  );
}

interface DiffModalProps {
  contribution: Contribution;
  afterState: string;
  onClose: () => void;
}

function DiffModal({ contribution, afterState, onClose }: DiffModalProps) {
  const before = contribution.nodeStateBefore ?? '';
  const after  = afterState;
  const chunks = buildDiffChunks(before, after);
  const [mode, setMode] = useState<'inline' | 'split'>('inline');

  const added   = chunks.filter(c => c.type === 'added' || (c.type === 'change' && c.rightText)).length;
  const removed = chunks.filter(c => c.type === 'change' && c.leftText).length;
  const hasChanges = chunks.some(c => c.type !== 'context');

  // Synchronized scrolling for split mode
  const leftRef  = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing  = useRef(false);

  const makeSyncHandler = (source: 'left' | 'right'): React.UIEventHandler<HTMLDivElement> => () => {
    if (syncing.current) return;
    syncing.current = true;
    const from = source === 'left' ? leftRef.current : rightRef.current;
    const to   = source === 'left' ? rightRef.current : leftRef.current;
    if (from && to) { to.scrollTop = from.scrollTop; to.scrollLeft = from.scrollLeft; }
    syncing.current = false;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-gray-50 px-4 py-3 flex items-center gap-3">
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none mr-1">←</button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {contribution.userId} · {timeAgo(contribution.createdAt)}
          </p>
          <p className="text-xs text-gray-500 truncate mt-0.5">{contribution.content.slice(0, 120)}{contribution.content.length > 120 ? '…' : ''}</p>
        </div>
        {/* Change counts */}
        <div className="flex gap-2 text-xs flex-shrink-0">
          {removed > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">−{removed}</span>}
          {added   > 0 && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">+{added}</span>}
        </div>
        {/* Mode toggle */}
        <div className="flex-shrink-0 flex border rounded-lg overflow-hidden text-xs">
          <button
            onClick={() => setMode('inline')}
            className={`px-3 py-1.5 transition-colors ${mode === 'inline' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Inline
          </button>
          <button
            onClick={() => setMode('split')}
            className={`px-3 py-1.5 border-l transition-colors ${mode === 'split' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            Split
          </button>
        </div>
      </div>

      {/* Contribution text */}
      <div className="flex-shrink-0 border-b bg-amber-50 px-4 py-3 max-h-40 overflow-y-auto">
        <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Contribution by {contribution.userId}</p>
        <p className="text-xs text-amber-900 whitespace-pre-wrap leading-relaxed">{contribution.content}</p>
      </div>

      {/* Diff body */}
      {!hasChanges ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">No changes detected.</div>
      ) : before === '' && mode === 'split' ? (
        // First-ever contribution in split mode: just show the new document on the right
        <div className="flex-1 flex divide-x overflow-hidden">
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm italic">New document — no prior state</div>
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <div className="flex-shrink-0 bg-gray-100 border-b px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">After</div>
            <div className="flex-1 overflow-auto p-4 prose prose-sm max-w-none">
              <MdChunk text={after} className="border-l-4 border-green-400 pl-3 bg-green-50 rounded-r [&_*]:!text-green-900" />
            </div>
          </div>
        </div>
      ) : mode === 'inline' ? (
        <InlineDiff chunks={chunks} />
      ) : (
        <SplitDiff chunks={chunks} leftRef={leftRef} rightRef={rightRef} onScrollLeft={makeSyncHandler('left')} onScrollRight={makeSyncHandler('right')} />
      )}
    </div>
  );
}

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

  // History / diff state
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);

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
          nodeStateBefore: m.nodeStateBefore ?? null,
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

      </main>

      {/* ── History side drawer ────────────────────────────────────────── */}
      {showHistory && (
        <>
          <div
            className="fixed inset-0 bg-black/20 z-30"
            onClick={() => setShowHistory(false)}
          />
          <aside className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-2xl z-40 flex flex-col">
            <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">
                Contributions <span className="text-gray-400 font-normal">({contributions.length})</span>
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {/* Search */}
            <div className="flex-shrink-0 px-4 py-2 border-b bg-gray-50">
              <input
                type="search"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search contributions…"
                className="w-full text-xs text-gray-900 border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 bg-white"
              />
            </div>
            {/* List */}
            {(() => {
              const q = searchQuery.trim().toLowerCase();
              const filtered = contributions
                .slice()
                .reverse()
                .filter(c =>
                  !q ||
                  c.content.toLowerCase().includes(q) ||
                  c.userId.toLowerCase().includes(q)
                );
              if (filtered.length === 0) {
                return (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-xs p-6 text-center">
                    {q ? `No contributions matching "${searchQuery}"` : 'No contributions yet.'}
                  </div>
                );
              }
              return (
                <ul className="flex-1 overflow-y-auto divide-y">
                  {filtered.map(c => (
                    <ContributionListItem
                      key={c.id}
                      c={c}
                      onOpen={() => { setSelectedContribution(c); setShowHistory(false); }}
                    />
                  ))}
                </ul>
              );
            })()}
          </aside>
        </>
      )}

      {/* ── Diff modal ─────────────────────────────────────────────────── */}
      {selectedContribution && node && (() => {
        const chronIdx = contributions.findIndex(c => c.id === selectedContribution.id);
        const nextContrib = contributions[chronIdx + 1];
        const afterState = nextContrib?.nodeStateBefore ?? node.nodeState;
        return (
          <DiffModal
            contribution={selectedContribution}
            afterState={afterState}
            onClose={() => setSelectedContribution(null)}
          />
        );
      })()}

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
