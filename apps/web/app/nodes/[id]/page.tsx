'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { Node, ChatMessage, User } from '../../../types/api';

const POLL_INTERVAL_MS = 3000;

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

function Avatar({ userId, isLlm }: { userId: string; isLlm: boolean }) {
  if (isLlm) {
    return (
      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        AI
      </div>
    );
  }
  const initials = userId.includes('@')
    ? userId[0].toUpperCase()
    : userId.slice(0, 2).toUpperCase();
  const colors = ['bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-sky-500', 'bg-violet-500'];
  const idx = userId.charCodeAt(0) % colors.length;
  return (
    <div className={`w-8 h-8 rounded-full ${colors[idx]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {initials}
    </div>
  );
}

function MessageBubble({
  message,
  currentUserId,
}: {
  message: ChatMessage;
  currentUserId: string;
}) {
  const isCurrentUser = !message.isLlm && message.userId === currentUserId;
  const time = new Date(message.createdAt).toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (message.isLlm) {
    return (
      <div className="flex gap-3 py-1 px-2">
        <Avatar userId="llm" isLlm />
        <div className="flex-1">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs font-semibold text-indigo-700">AI Assistant</span>
            <span className="text-xs text-gray-400">{time}</span>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap max-w-2xl">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  if (isCurrentUser) {
    return (
      <div className="flex gap-3 py-1 px-2 flex-row-reverse">
        <Avatar userId={message.userId} isLlm={false} />
        <div className="flex-1 flex flex-col items-end">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs text-gray-400">{time}</span>
            <span className="text-xs font-semibold text-gray-700">You</span>
          </div>
          <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm whitespace-pre-wrap max-w-2xl">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  // Other user
  const displayName = message.userId.includes('@')
    ? message.userId.split('@')[0]
    : message.userId;

  return (
    <div className="flex gap-3 py-1 px-2">
      <Avatar userId={message.userId} isLlm={false} />
      <div className="flex-1">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-xs font-semibold text-gray-700">{displayName}</span>
          <span className="text-xs text-gray-400">{time}</span>
        </div>
        <div className="bg-white border rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap max-w-2xl shadow-sm">
          {message.content}
        </div>
      </div>
    </div>
  );
}

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: nodeId } = use(params);

  const [node, setNode] = useState<Node | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [showMemory, setShowMemory] = useState(false);
  const [lastPollAt, setLastPollAt] = useState<Date | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const knownIdsRef = useRef<Set<string>>(new Set());

  // The display name we'll use as userId for sent messages
  const currentUserId = user?.email || user?.id || 'anonymous';
  const displayName = user?.name || user?.email || 'anonymous';

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Load node details
  async function loadNode() {
    try {
      const res = await fetch(`/api/nodes/${nodeId}`);
      if (!res.ok) throw new Error('Node not found');
      const data = await res.json();
      setNode(data);
    } catch {
      setLoadError('Could not load node. Is the core-service running?');
    }
  }

  // Poll for messages
  const pollMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}/messages?limit=200`);
      if (!res.ok) return;
      const data: { messages: ChatMessage[] } = await res.json();
      const newOnes = data.messages.filter(m => !knownIdsRef.current.has(m.id));
      if (newOnes.length > 0) {
        newOnes.forEach(m => knownIdsRef.current.add(m.id));
        setMessages(prev => [...prev, ...newOnes]);
        setTimeout(scrollToBottom, 50);
      }
      setLastPollAt(new Date());
    } catch {
      // silent — poll will retry
    }
  }, [nodeId, scrollToBottom]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    loadNode();
    pollMessages();

    const interval = setInterval(pollMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [nodeId, pollMessages]);

  // Auto-grow textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  }

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    // Optimistically add user message
    const optimistic: ChatMessage = {
      id: `optimistic-${Date.now()}`,
      content: text,
      userId: currentUserId,
      isLlm: false,
      status: 'SENDING',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    setTimeout(scrollToBottom, 50);

    try {
      const res = await fetch(`/api/llm/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId,
          message: text,
          userId: currentUserId,
          userName: displayName,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Send failed');
      }

      // Remove optimistic message — the real ones will arrive via poll
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      // Immediately poll to get the persisted messages
      await pollMessages();
      // Refresh node to get updated memory/messageCount
      await loadNode();
    } catch (err: any) {
      // Replace optimistic with error state
      setMessages(prev =>
        prev.map(m =>
          m.id === optimistic.id
            ? { ...m, status: 'ERROR', content: `${text}\n\n⚠ Failed: ${err.message}` }
            : m
        )
      );
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md text-center">
          <p className="text-red-700 font-medium mb-4">{loadError}</p>
          <Link href="/nodes" className="text-indigo-600 hover:underline text-sm">
            ← Back to nodes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-white border-b shadow-sm flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/nodes" className="text-gray-400 hover:text-gray-600 text-sm flex-shrink-0">
              ← Nodes
            </Link>
            {node ? (
              <>
                <h1 className="font-semibold text-gray-900 truncate">{node.topic}</h1>
                <ModelBadge model={node.model} />
                <span className="text-xs text-gray-400 hidden sm:block">
                  {node.memory?.messageCount ?? 0} messages
                </span>
              </>
            ) : (
              <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowMemory(v => !v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showMemory
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {showMemory ? 'Hide Memory' : 'Memory'}
            </button>
            {user && (
              <span className="text-xs text-gray-500 hidden sm:block">
                {user.name || user.email}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Multi-user tip */}
      <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 text-xs text-amber-800 text-center flex-shrink-0">
        💡 <strong>Multi-user:</strong> Open this page in a private/incognito window and log in as a different user to simulate collaboration.
        {lastPollAt && (
          <span className="ml-3 text-amber-600">
            Syncing every {POLL_INTERVAL_MS / 1000}s · last {lastPollAt.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden max-w-4xl w-full mx-auto px-4 py-3 gap-3">

        {/* Message feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {messages.length === 0 && !sending && (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">No messages yet. Start the conversation!</p>
                {node?.description && (
                  <p className="mt-2 text-xs text-gray-400 max-w-sm mx-auto italic">
                    &ldquo;{node.description}&rdquo;
                  </p>
                )}
              </div>
            )}
            {messages.map(msg => (
              <MessageBubble
                key={msg.id}
                message={msg}
                currentUserId={currentUserId}
              />
            ))}
            {sending && (
              <div className="flex gap-3 py-1 px-2">
                <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  AI
                </div>
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="mt-3 flex-shrink-0">
            <div className="flex gap-2 bg-white rounded-xl border shadow-sm p-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none text-sm text-gray-900 px-2 py-1.5 focus:outline-none disabled:opacity-60 placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors self-end flex-shrink-0"
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 ml-1">
              Sending as <strong>{displayName}</strong>
            </p>
          </form>
        </div>

        {/* Memory sidebar */}
        {showMemory && node && (
          <div className="w-72 flex-shrink-0 overflow-y-auto space-y-3">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Core Context
              </h3>
              <p className="text-xs text-gray-700 whitespace-pre-wrap">
                {node.memory?.coreContext || '—'}
              </p>
            </div>

            {(node.memory?.keyFacts?.length ?? 0) > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Key Facts ({node.memory.keyFacts.length})
                </h3>
                <ul className="space-y-1.5">
                  {node.memory.keyFacts.map((fact, i) => (
                    <li key={i} className="text-xs text-gray-700 flex gap-2">
                      <span className="text-indigo-400 flex-shrink-0">•</span>
                      <span>{typeof fact === 'string' ? fact : (fact as any).content ?? JSON.stringify(fact)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-white rounded-xl border shadow-sm p-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Working Memory
              </h3>
              <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-10">
                {node.memory?.workingMemory || '—'}
              </p>
            </div>

            <div className="bg-white rounded-xl border shadow-sm p-4 text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Messages</span>
                <span className="font-medium text-gray-700">{node.memory?.messageCount ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span>Version</span>
                <span className="font-medium text-gray-700">v{node.version}</span>
              </div>
              <div className="flex justify-between">
                <span>Last summary at</span>
                <span className="font-medium text-gray-700">{node.memory?.lastSummaryAt ?? '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
