'use client';

import { useEffect, useRef, useState, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { diffLines } from 'diff';
import mermaid from 'mermaid';
import { Node, Contribution, User } from '../../../types/api';

// ---------------------------------------------------------------------------
// Mermaid diagram renderer
// ---------------------------------------------------------------------------
function MermaidDiagram({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
    const id = `mermaid-${Math.random().toString(36).slice(2)}`;
    mermaid.render(id, code).then(({ svg }) => {
      if (ref.current) ref.current.innerHTML = svg;
    }).catch(console.error);
  }, [code]);
  return <div ref={ref} className="my-4 flex justify-center overflow-x-auto" />;
}

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
// Helpers: tags, TOC, impact score
// ---------------------------------------------------------------------------
const TAG_COLORS = ['bg-indigo-100 text-indigo-700','bg-purple-100 text-purple-700','bg-teal-100 text-teal-700','bg-amber-100 text-amber-700','bg-rose-100 text-rose-700','bg-blue-100 text-blue-700','bg-green-100 text-green-700'];
function tagColor(tag: string) { let h = 0; for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length; return TAG_COLORS[h]; }
function extractTOC(md: string): Array<{level:number;text:string;id:string}> {
  return md.split('\n').filter(l => /^#{1,3} /.test(l)).map(l => { const m = l.match(/^(#{1,3}) (.+)/); if (!m) return null; const text = m[2].trim(); return {level:m[1].length,text,id:text.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')}; }).filter(Boolean) as Array<{level:number;text:string;id:string}>;
}
function computeImpact(before: string, after: string): number {
  if (!after) return 0;
  const changes = diffLines(before||'', after||'');
  const changed = changes.filter(c=>c.added||c.removed).reduce((s,c)=>s+(c.count??1),0);
  const total = changes.reduce((s,c)=>s+(c.count??1),0);
  return total > 0 ? Math.round((changed/total)*100) : 0;
}

function detectContested(contributions: Contribution[]): Set<string> {
  const contested = new Set<string>();
  const addedLines: Map<string, Set<string>> = new Map();
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i];
    const before = c.nodeStateBefore ?? '';
    const nextC = contributions[i + 1];
    if (!nextC) continue;
    const after = nextC.nodeStateBefore ?? '';
    const changes = diffLines(before, after);
    const added = new Set(changes.filter(c => c.added).map(c => c.value.trim()).filter(Boolean));
    addedLines.set(c.id, added);
  }
  for (const [id, added] of addedLines.entries()) {
    if (added.size === 0) continue;
    const idxA = contributions.findIndex(c => c.id === id);
    for (let j = idxA + 1; j < contributions.length; j++) {
      const laterC = contributions[j];
      const laterBefore = laterC.nodeStateBefore ?? '';
      const laterNext = contributions[j + 1];
      if (!laterNext) continue;
      const laterAfter = laterNext.nodeStateBefore ?? '';
      const laterChanges = diffLines(laterBefore, laterAfter);
      const laterRemoved = new Set(laterChanges.filter(c => c.removed).map(c => c.value.trim()).filter(Boolean));
      const overlap = [...added].filter(line => laterRemoved.has(line)).length;
      if (overlap > 0 && overlap / added.size >= 0.3) {
        contested.add(id);
        contested.add(laterC.id);
      }
    }
  }
  return contested;
}

// ---------------------------------------------------------------------------
// Expandable contribution list item (4 lines at a time)
// ---------------------------------------------------------------------------
function ContributionListItem({ c, afterState, onOpen, contested }: { c: Contribution; afterState?: string; onOpen: () => void; contested?: boolean }) {
  const [lines, setLines] = useState(4);
  const [hasMore, setHasMore] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setHasMore(el.scrollHeight > el.clientHeight + 2);
  }, [lines, c.content]);

  const impact = afterState != null ? computeImpact(c.nodeStateBefore ?? '', afterState) : null;
  const score = (c.upvotes ?? 0) - (c.downvotes ?? 0);

  return (
    <li
      className="flex gap-3 px-4 py-3 text-sm cursor-pointer hover:bg-indigo-50 transition-colors group"
      onClick={onOpen}
    >
      <Link href={`/users/${encodeURIComponent(c.userId)}`} onClick={e => e.stopPropagation()} className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5 hover:bg-indigo-200 transition-colors">
        {c.userId[0]?.toUpperCase() ?? '?'}
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Link href={`/users/${encodeURIComponent(c.userId)}`} onClick={e => e.stopPropagation()} className="font-medium text-gray-700 truncate text-xs hover:text-indigo-700 hover:underline transition-colors">{c.userId}</Link>
          <span className="text-gray-400 text-xs flex-shrink-0">{timeAgo(c.createdAt)}</span>
          {impact !== null && impact > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${impact >= 30 ? 'bg-green-100 text-green-700' : impact >= 10 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
              {impact}% changed
            </span>
          )}
          {score !== 0 && (
            <span className={`text-xs flex-shrink-0 font-medium ${score > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {score > 0 ? `+${score}` : score}
            </span>
          )}
          {contested && <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 bg-orange-100 text-orange-700"> Disputed</span>}
        </div>
        <p
          ref={contentRef}
          className="text-gray-600 text-xs whitespace-pre-wrap"
          style={{ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {c.content}
        </p>
        {(hasMore || lines > 4) && (
          <button onClick={e => { e.stopPropagation(); setLines(l => l + 4); }} className="text-indigo-500 text-xs mt-1 hover:underline">
            Show more ↓
          </button>
        )}
        {c.sourceUrl && (
          <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            className="text-xs text-indigo-400 hover:text-indigo-600 hover:underline mt-1 block truncate">
            🔗 {c.sourceUrl.replace(/^https?:\/\//, '')}
          </a>
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

const TEMPLATES = [
  { label: '📊 Add statistic', text: 'According to [source], [statistic]. This data shows that ' },
  { label: '✏️ Correct error', text: 'Correction: The statement "[incorrect claim]" is inaccurate. The correct information is: ' },
  { label: '📚 Add case study', text: 'Case study: [organization/person] demonstrates this by [description]. The outcome was ' },
  { label: '🔗 Add source', text: 'Source: [URL or publication]. This source states that ' },
  { label: '💡 Add example', text: 'For example, [specific example]. This illustrates ' },
  { label: '🔄 Update info', text: 'Update: As of [date], [updated information]. Previously, ' },
];

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
  // Streaming preview state
  const [streamingText, setStreamingText] = useState('');
  const [streamDone, setStreamDone] = useState(false);
  const [previewFinal, setPreviewFinal] = useState<string | null>(null);

  // Relevance checking state
  const [relevanceResult, setRelevanceResult] = useState<{score: number; recommendation: string; betterMatch: {id: string; topic: string; score: number} | null} | null>(null);
  const [checkingRelevance, setCheckingRelevance] = useState(false);

  // History / diff state
  const [showHistory, setShowHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);

  // Extra panels + form fields
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showFactBrowser, setShowFactBrowser] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [sourceUrl, setSourceUrl] = useState('');
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const [showMilestones, setShowMilestones] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [showTopContributors, setShowTopContributors] = useState(false);
  const [topContributors, setTopContributors] = useState<any[]>([]);
  const [topContributorsLoading, setTopContributorsLoading] = useState(false);
  const [pendingContribs, setPendingContribs] = useState<any[]>([]);
  const [relatedNodes, setRelatedNodes] = useState<any[]>([]);
  const [viewers, setViewers] = useState<string[]>([]);
  const [deferContrib, setDeferContrib] = useState(false);
  const [scoringQuality, setScoringQuality] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [factSearch, setFactSearch] = useState('');
  const [factsLearnedCount, setFactsLearnedCount] = useState<number | null>(null);
  const [prevFactCount, setPrevFactCount] = useState<number>(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const displayName = user?.name || user?.email || 'anonymous';
  const userId = user?.email || user?.id || 'anonymous';

  async function voteContribution(messageId: string, value: number) {
    if (!userId) return;
    const current = userVotes[messageId] ?? 0;
    const next = current === value ? 0 : value;
    setUserVotes(prev => ({ ...prev, [messageId]: next }));
    try {
      await fetch(`/api/nodes/${nodeId}/messages/${messageId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, value: next }),
      });
    } catch { /* non-fatal */ }
  }

  // Load node
  const loadNode = useCallback(async () => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}`);
      if (!res.ok) throw new Error('Node not found');
      const data = await res.json();
      // The core service returns the node at the top level (not nested)
      setNode(data);
      // Fetch related nodes
      try {
        const relRes = await fetch(`/api/nodes/${nodeId}/related`);
        if (relRes.ok) { const relData = await relRes.json(); setRelatedNodes(relData.related ?? relData ?? []); }
      } catch { /* non-fatal */ }
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
          sourceUrl: m.sourceUrl ?? null,
          upvotes: m.upvotes ?? 0,
          downvotes: m.downvotes ?? 0,
        }));
      setContributions(userContribs);
      // Load pending contributions
      try {
        const pRes = await fetch(`/api/nodes/${nodeId}/pending`);
        if (pRes.ok) { const pData = await pRes.json(); setPendingContribs(pData.pending ?? pData ?? []); }
      } catch { /* non-fatal */ }
      // Load milestones
      try {
        const mRes = await fetch(`/api/nodes/${nodeId}/milestones`);
        if (mRes.ok) { const mData = await mRes.json(); setMilestones(mData.milestones ?? mData ?? []); }
      } catch { /* non-fatal */ }
    } catch {
      // non-fatal
    }
  }, [nodeId]);

  const loadTopContributors = async () => {
    setTopContributorsLoading(true);
    try {
      const res = await fetch(`/api/nodes/${nodeId}/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setTopContributors(data.leaderboard ?? []);
      }
    } catch { /* non-fatal */ } finally {
      setTopContributorsLoading(false);
    }
  };

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

  // Presence polling: POST every 15s
  useEffect(() => {
    if (!userId || userId === 'anonymous') return;
    const postPresence = async () => {
      try {
        const res = await fetch(`/api/nodes/${nodeId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        if (res.ok) { const d = await res.json(); setViewers((d.viewers ?? []).filter((v: string) => v !== userId)); }
      } catch { /* non-fatal */ }
    };
    postPresence();
    const presenceInterval = setInterval(postPresence, 15_000);
    return () => clearInterval(presenceInterval);
  }, [nodeId, userId]);

  // Debounced relevance check
  useEffect(() => {
    if (!panelOpen || !contribution.trim() || contribution.trim().length < 30) {
      setRelevanceResult(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingRelevance(true);
      try {
        const res = await fetch(`/api/nodes/${nodeId}/relevance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contribution: contribution.trim() })
        });
        if (res.ok) setRelevanceResult(await res.json());
      } catch { /* non-fatal */ } finally {
        setCheckingRelevance(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [contribution, panelOpen, nodeId]);

  // Open contribute panel
  function openPanel() {
    setPanelOpen(true);
    setEvolveError('');
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function closePanel() {
    setPanelOpen(false);
    setContribution('');
    setSourceUrl('');
    setEvolveError('');
    setRelevanceResult(null);
    setStreamingText('');
    setStreamDone(false);
    setPreviewFinal(null);
  }

  // Step 1: Stream a preview — does NOT save yet
  async function submitContribution(e: React.FormEvent) {
    e.preventDefault();
    const text = contribution.trim();
    if (!text || evolving) return;

    setEvolving(true);
    setEvolveError('');
    setStreamingText('');
    setStreamDone(false);
    setPreviewFinal(null);

    try {
      const res = await fetch(`/api/nodes/${nodeId}/evolve/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contribution: text }),
      });

      if (!res.ok || !res.body) {
        throw new Error('Failed to start preview stream');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'token') {
              setStreamingText(prev => prev + event.text);
            } else if (event.type === 'done') {
              setPreviewFinal(event.preview);
              setStreamDone(true);
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Stream error');
            }
          } catch (parseErr: any) {
            if (parseErr.message?.includes('Stream error') || parseErr.message?.includes('stream')) throw parseErr;
          }
        }
      }
    } catch (err: any) {
      setEvolveError(err.message || 'Something went wrong');
    } finally {
      setEvolving(false);
    }
  }

  // Step 2: Save confirmed preview to the database
  async function confirmContribution() {
    const text = contribution.trim();
    if (!text || !previewFinal || evolving) return;

    setEvolving(true);
    setEvolveError('');

    // Snapshot fact count before saving so we can detect new facts after compression
    const factCountBefore = node?.memory?.keyFacts?.length ?? 0;
    setPrevFactCount(factCountBefore);
    setFactsLearnedCount(null);

    try {
      const res = await fetch(`/api/nodes/${nodeId}/evolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contribution: text,
          userId,
          sourceUrl: sourceUrl.trim() || undefined,
          defer: deferContrib,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || 'Save failed');
      }

      const data = await res.json();
      setNode(prev => prev ? { ...prev, nodeState: data.nodeState, version: data.version } : prev);
      loadContributions();
      closePanel();

      // Poll once after ~6s for background compression results (new key facts)
      setTimeout(async () => {
        try {
          const refreshed = await fetch(`/api/nodes/${nodeId}`).then(r => r.ok ? r.json() : null);
          if (refreshed) {
            setNode(refreshed);
            const newCount = refreshed.memory?.keyFacts?.length ?? 0;
            if (newCount > factCountBefore) {
              setFactsLearnedCount(newCount - factCountBefore);
              setTimeout(() => setFactsLearnedCount(null), 7000);
            }
          }
        } catch { /* non-fatal */ }
      }, 6000);
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
                {node.qualityScore && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${node.qualityScore.overall >= 8 ? 'bg-green-100 text-green-800' : node.qualityScore.overall >= 5 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                    ⭐ {node.qualityScore.overall.toFixed(1)}/10
                  </span>
                )}
                {factsLearnedCount !== null && factsLearnedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 animate-pulse flex-shrink-0">
                    🧠 +{factsLearnedCount} fact{factsLearnedCount !== 1 ? 's' : ''} learned
                  </span>
                )}
              </>
            ) : (
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Live viewer avatars */}
            {viewers.length > 0 && (
              <div className="flex items-center gap-1">
                {viewers.slice(0, 3).map((v, i) => (
                  <div key={i} title={v} className="w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `hsl(${v.charCodeAt(0) * 37 % 360}, 60%, 50%)` }}>
                    {v[0]?.toUpperCase()}
                  </div>
                ))}
              </div>
            )}
            {/* Contributions count */}
            {contributions.length > 0 && (
              <button onClick={() => setShowHistory(v => !v)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap">
                {contributions.length} contribution{contributions.length !== 1 ? 's' : ''}
              </button>
            )}
            {/* More actions dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowMoreMenu(v => !v)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                title="More actions"
              >
                ⋯
              </button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-40 py-1 text-sm">
                    {node?.nodeState && extractTOC(node.nodeState).length > 0 && (
                      <button onClick={() => { setShowTOC(v => !v); setShowMoreMenu(false); }} className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                        📋 Contents
                      </button>
                    )}
                    {(node?.memory?.keyFacts?.length ?? 0) > 0 && (
                      <button onClick={() => { setShowFactBrowser(v => !v); setShowMoreMenu(false); }} className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                        🧠 {node?.memory?.keyFacts?.length} Key Facts
                      </button>
                    )}
                    <button onClick={() => { setShowAnalytics(v => !v); setShowMoreMenu(false); }} className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                      📊 Analytics
                    </button>
                    <button onClick={() => { setShowTopContributors(true); loadTopContributors(); setShowMoreMenu(false); }} className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                      🏆 Top Contributors
                    </button>
                    <button onClick={() => { setShowMilestones(v => !v); setShowMoreMenu(false); }} className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                      📌 Milestones
                    </button>
                    {node?.nodeState && (
                      <button onClick={() => { setShowMoreMenu(false); const n = window.prompt('Milestone name'); if (n) { fetch(`/api/nodes/${nodeId}/milestones`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n }) }).then(r => { if (r.ok) loadContributions(); }); } }} className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">
                        💾 Save Milestone
                      </button>
                    )}
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={async () => {
                        setShowMoreMenu(false);
                        if (scoringQuality) return;
                        setScoringQuality(true);
                        try {
                          await fetch(`/api/nodes/${nodeId}/quality-score`, { method: 'POST' });
                          setTimeout(() => { loadNode(); setScoringQuality(false); }, 3000);
                        } catch { setScoringQuality(false); }
                      }}
                      disabled={scoringQuality}
                      className="w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {scoringQuality ? '⏳ Scoring…' : '⭐ Score Quality'}
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={openPanel} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap">
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
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                code({ node: _n, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  const lang = match?.[1];
                  const code = String(children).replace(/\n$/, '');
                  if (lang === 'mermaid') return <MermaidDiagram code={code} />;
                  return <code className={className} {...props}>{children}</code>;
                }
              }}>
                {node.nodeState}
              </ReactMarkdown>
            </article>

            {/* Tags */}
            {(node.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-8 mb-4">
                {(node.tags ?? []).map(tag => (
                  <span key={tag} className={`px-2 py-0.5 rounded-full text-xs font-medium ${tagColor(tag)}`}>{tag}</span>
                ))}
              </div>
            )}
            {/* Footer meta */}
            <div className="mt-6 pt-6 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs text-gray-400">
              <span>Version {node.version}</span>
              <span>Last updated {timeAgo(node.updatedAt)}</span>
              {node.description && <span className="italic">{node.description}</span>}
            </div>
          </>
        )}

        {/* Related Topics */}
        {relatedNodes.length > 0 && (
          <div className="mt-10 pt-6 border-t border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600 mb-3">Related Topics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {relatedNodes.slice(0, 5).map((rn: any) => (
                <a key={rn.id} href={`/nodes/${rn.id}`} className="block p-3 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-colors">
                  <p className="font-medium text-sm text-gray-800 truncate">{rn.topic}</p>
                  {typeof rn.similarity === "number" && (
                    <p className="text-xs text-indigo-500 mt-0.5">
                      {Math.round(rn.similarity * 100)}% match
                    </p>
                  )}
                </a>
              ))}
            </div>
          </div>
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
            {/* Pending Queue */}
            {pendingContribs.length > 0 && (
              <div className="border-b px-4 py-3 bg-amber-50">
                <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Pending Queue</h3>
                <ul className="space-y-2">
                  {pendingContribs.map((pc: any) => (
                    <li key={pc.id} className="flex items-center justify-between gap-2 text-xs text-amber-900">
                      <span className="truncate">{pc.userId}: {pc.content?.slice(0, 40)}...</span>
                      <button onClick={() => fetch(`/api/nodes/${nodeId}/pending/synthesize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pc.id }) }).then(() => loadContributions())} className="flex-shrink-0 text-xs bg-amber-600 text-white px-2 py-0.5 rounded hover:bg-amber-700">
                        Synthesize now
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
              const contestedSet = detectContested(contributions);
              return (
                <ul className="flex-1 overflow-y-auto divide-y">
                  {filtered.map(c => {
                    const chronIdx = contributions.findIndex(x => x.id === c.id);
                    const nextContrib = contributions[chronIdx + 1];
                    const afterState = nextContrib?.nodeStateBefore ?? node?.nodeState ?? '';
                    return (
                      <ContributionListItem
                        key={c.id}
                        c={c}
                        afterState={afterState}
                        onOpen={() => { setSelectedContribution(c); setShowHistory(false); }}
                        contested={contestedSet.has(c.id)}
                      />
                    );
                  })}
                </ul>
              );
            })()}
          </aside>
        </>
      )}

      {/* ── Diff modal ─────────────────────────────────────────────────── */}
      {showTOC && node?.nodeState && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setShowTOC(false)} />
          <aside className="fixed top-0 left-0 h-full w-72 bg-white border-r shadow-2xl z-40 flex flex-col">
            <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Contents</h2>
              <button onClick={() => setShowTOC(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {extractTOC(node.nodeState).map((entry, i) => (
                <a key={i} href={`#${entry.id}`} onClick={() => setShowTOC(false)}
                  className={`block px-3 py-1.5 rounded-lg text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors truncate ${entry.level === 1 ? 'font-semibold' : entry.level === 2 ? 'pl-5' : 'pl-8 text-xs text-gray-500'}`}>
                  {entry.text}
                </a>
              ))}
            </nav>
          </aside>
        </>
      )}

      {showFactBrowser && node && (() => {
        const allFacts = (node.memory?.keyFacts ?? []).map((fact: any) => ({
          content: typeof fact === 'string' ? fact : (fact.content ?? ''),
          confidence: typeof fact === 'object' ? (fact.confidence ?? null) : null,
        }));
        const q = factSearch.trim().toLowerCase();
        const filtered = q ? allFacts.filter(f => f.content.toLowerCase().includes(q)) : allFacts;
        const highConfidence = filtered.filter(f => f.confidence === null || f.confidence >= 0.7);
        const lowConfidence = filtered.filter(f => f.confidence !== null && f.confidence < 0.7);
        const renderFact = (f: { content: string; confidence: number | null }, i: number, isHigh: boolean) => (
          <li key={i} className="px-4 py-3">
            <p className="text-xs text-gray-700 leading-relaxed">{f.content}</p>
            {f.confidence !== null && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${isHigh ? 'bg-indigo-400' : 'bg-amber-400'}`} style={{width:`${Math.round(f.confidence*100)}%`}} />
                </div>
                <span className="text-xs text-gray-400">{Math.round(f.confidence*100)}%</span>
              </div>
            )}
          </li>
        );
        return (
          <>
            <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setShowFactBrowser(false)} />
            <aside className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-2xl z-40 flex flex-col">
              <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">Key Facts <span className="text-gray-400 font-normal">({filtered.length})</span></h2>
                <button onClick={() => setShowFactBrowser(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
              </div>
              <div className="flex-shrink-0 px-4 py-2 border-b bg-gray-50">
                <input
                  type="search"
                  value={factSearch}
                  onChange={e => setFactSearch(e.target.value)}
                  placeholder="Search facts…"
                  className="w-full text-xs text-gray-900 border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-gray-400 bg-white"
                />
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">{q ? `No facts matching "${factSearch}"` : 'No facts yet.'}</p>
                )}
                {highConfidence.length > 0 && (
                  <>
                    <div className="px-4 pt-3 pb-1">
                      <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">High Confidence</span>
                    </div>
                    <ul className="divide-y">
                      {highConfidence.map((f, i) => renderFact(f, i, true))}
                    </ul>
                  </>
                )}
                {lowConfidence.length > 0 && (
                  <>
                    <div className="px-4 pt-3 pb-1 border-t">
                      <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Lower Confidence</span>
                    </div>
                    <ul className="divide-y">
                      {lowConfidence.map((f, i) => renderFact(f, i, false))}
                    </ul>
                  </>
                )}
              </div>
            </aside>
          </>
        );
      })()}


      {showMilestones && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setShowMilestones(false)} />
          <aside className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-2xl z-40 flex flex-col">
            <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">Milestones</h2>
              <button onClick={() => setShowMilestones(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <ul className="flex-1 overflow-y-auto divide-y">
              {milestones.length === 0 && <li className="px-4 py-6 text-xs text-gray-400 text-center">No milestones yet.</li>}
              {milestones.map((m: any) => (
                <li key={m.id} className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-800">{m.name}</span>
                    <button onClick={() => fetch(`/api/nodes/${nodeId}/milestones/${m.id}/restore`, { method: "POST" }).then(r => r.ok && r.json()).then(d => d && setNode(prev => prev ? { ...prev, nodeState: d.nodeState, version: d.version } : prev))} className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded hover:bg-indigo-700">
                      Restore
                    </button>
                  </div>
                  <div className="text-xs text-gray-400">
                    <span>v{m.version}</span> <span>{m.createdAt ? new Date(m.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </>
      )}

      {showTopContributors && (
        <div className="fixed inset-0 bg-black/20 z-40" onClick={() => setShowTopContributors(false)} />
      )}
      <div className={`fixed top-0 right-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${showTopContributors ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">🏆 Top Contributors</h3>
          <button onClick={() => setShowTopContributors(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {topContributorsLoading ? (
            <div className="p-4 space-y-3 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg" />)}
            </div>
          ) : topContributors.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-10">No contributions yet.</p>
          ) : (
            <ol className="divide-y divide-gray-50">
              {topContributors.map((e, i) => (
                <li key={e.userId} className="px-4 py-3 flex items-center gap-3">
                  <span className="text-base w-6 text-center flex-shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-xs text-gray-500 font-bold">#{i+1}</span>}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                    {e.userId[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{e.userId}</p>
                    <p className="text-xs text-gray-400">{e.contributionCount} contribution{e.contributionCount !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-xs font-bold ${e.netVotes >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {e.netVotes > 0 ? `+${e.netVotes}` : e.netVotes}
                    </p>
                    <p className="text-xs text-gray-400">votes</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ── Analytics drawer ───────────────────────────────────────────── */}
      {showAnalytics && node && (
        <>
          <div className="fixed inset-0 bg-black/20 z-30" onClick={() => setShowAnalytics(false)} />
          <aside className="fixed top-0 right-0 h-full w-80 bg-white border-l shadow-2xl z-40 flex flex-col">
            <div className="flex-shrink-0 border-b px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800">📊 Analytics</h2>
              <button onClick={() => setShowAnalytics(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none" aria-label="Close">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Document stats */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Document</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Words', value: node.nodeState ? node.nodeState.trim().split(/\s+/).length : 0 },
                    { label: 'Sections', value: node.nodeState ? (node.nodeState.match(/^#{1,3} /gm) ?? []).length : 0 },
                    { label: 'Version', value: node.version ?? 0 },
                    { label: 'Key Facts', value: node.memory?.keyFacts?.length ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Quality breakdown */}
              {node.qualityScore && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quality Score</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Overall', value: node.qualityScore.overall },
                      { label: 'Accuracy', value: node.qualityScore.accuracy },
                      { label: 'Completeness', value: node.qualityScore.completeness },
                      { label: 'Neutrality', value: node.qualityScore.neutrality },
                      { label: 'Citations', value: node.qualityScore.citations },
                    ].filter(d => d.value != null).map(({ label, value }) => (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-600">{label}</span>
                          <span className="font-medium text-gray-800">{value?.toFixed(1)}/10</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${(value ?? 0) >= 8 ? 'bg-green-500' : (value ?? 0) >= 5 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${((value ?? 0) / 10) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Contribution stats */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Contributions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Total', value: contributions.length },
                    { label: 'Contributors', value: new Set(contributions.map(c => c.userId)).size },
                    { label: 'Avg length', value: contributions.length > 0 ? Math.round(contributions.reduce((s, c) => s + c.content.length, 0) / contributions.length) : 0 },
                    { label: 'Net upvotes', value: contributions.reduce((s, c) => s + (c.upvotes ?? 0) - (c.downvotes ?? 0), 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {/* Memory stats */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Memory</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Working mem', value: node.memory?.workingMemory ? Math.round(node.memory.workingMemory.length / 4) + ' tkn' : '—' },
                    { label: 'Key facts', value: node.memory?.keyFacts?.length ?? 0 },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-lg font-bold text-gray-800">{value}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </>
      )}

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

            {/* ── Input form (hidden once streaming starts) ─────────── */}
            {!streamDone && !streamingText && (
              <form onSubmit={submitContribution} className="space-y-3">
                <div className="flex flex-wrap gap-1.5 mb-1">
                  {TEMPLATES.map(t => (
                    <button key={t.label} type="button" onClick={() => { setContribution(t.text); setTimeout(() => textareaRef.current?.focus(), 0); }}
                      className="px-2.5 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-700 transition-colors border border-gray-200 font-medium">
                      {t.label}
                    </button>
                  ))}
                </div>
                <textarea
                  ref={textareaRef}
                  value={contribution}
                  onChange={e => setContribution(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') closePanel(); }}
                  placeholder="e.g. Recent studies have shown that… / Correction: the figure is actually… / Key fact: …"
                  rows={5}
                  disabled={evolving}
                  className="w-full border rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 resize-none placeholder:text-gray-400"
                />
                {checkingRelevance && (
                  <p className="text-xs text-gray-400 animate-pulse">Checking relevance…</p>
                )}
                {!checkingRelevance && relevanceResult && (
                  <div className={`text-xs px-3 py-2 rounded-lg ${relevanceResult.recommendation === 'highly_relevant' ? 'bg-green-50 text-green-700' : relevanceResult.recommendation === 'relevant' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                    {relevanceResult.recommendation === 'highly_relevant' && '✓ Highly relevant to this topic'}
                    {relevanceResult.recommendation === 'relevant' && '✓ Relevant to this topic'}
                    {relevanceResult.recommendation === 'off_topic' && (
                      <span>
                        ⚠️ This may not be relevant to <strong>{node?.topic}</strong>
                        {relevanceResult.betterMatch && (
                          <> — it might fit better in{' '}
                            <button onClick={() => { closePanel(); router.push(`/nodes/${relevanceResult.betterMatch!.id}`); }} className="underline font-medium hover:no-underline">
                              {relevanceResult.betterMatch.topic}
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                )}
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={e => setSourceUrl(e.target.value)}
                  placeholder="Source URL (optional) — e.g. https://example.com/study"
                  disabled={evolving}
                  className="w-full border rounded-xl px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 placeholder:text-gray-400"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={deferContrib} onChange={e => setDeferContrib(e.target.checked)} disabled={evolving} className="rounded" />
                  Defer (add to moderation queue)
                </label>
                {evolveError && <p className="text-sm text-red-600">{evolveError}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Contributing as <strong>{displayName}</strong></span>
                  <div className="flex gap-2">
                    <button type="button" onClick={closePanel} disabled={evolving} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={evolving || !contribution.trim()}
                      className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {evolving ? (
                        <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating preview…</>
                      ) : 'Preview contribution →'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* ── Live streaming preview ──────────────────────────────── */}
            {(streamingText || streamDone) && (
              <div className="space-y-3">
                {/* Status bar */}
                <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${streamDone ? 'bg-green-50 text-green-700' : 'bg-indigo-50 text-indigo-700'}`}>
                  {streamDone ? (
                    <><span className="text-base">✅</span> Preview ready — review the updated document below</>
                  ) : (
                    <><span className="w-3 h-3 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin flex-shrink-0" /> Generating preview…</>
                  )}
                </div>

                {/* Live markdown preview */}
                <div className="border rounded-xl overflow-hidden">
                  <div className="bg-gray-50 border-b px-4 py-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Document Preview</span>
                    {!streamDone && (
                      <span className="text-xs text-gray-400 animate-pulse">Streaming…</span>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto px-4 py-4 prose prose-sm prose-gray max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {streamingText || ''}
                    </ReactMarkdown>
                    {!streamDone && <span className="inline-block w-1 h-4 bg-indigo-500 animate-pulse ml-0.5 align-text-bottom" />}
                  </div>
                </div>

                {evolveError && <p className="text-sm text-red-600">{evolveError}</p>}

                {/* Action buttons */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Contributing as <strong>{displayName}</strong></span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setStreamingText(''); setStreamDone(false); setPreviewFinal(null); setEvolveError(''); }}
                      disabled={evolving}
                      className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-xl disabled:opacity-50 transition-colors"
                    >
                      ← Revise
                    </button>
                    <button
                      type="button"
                      onClick={confirmContribution}
                      disabled={!streamDone || evolving}
                      className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {evolving ? (
                        <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>
                      ) : 'Looks good — save →'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
