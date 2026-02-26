'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User } from '../types/api';

const MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
];

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [question, setQuestion] = useState('');
  const [model, setModel] = useState(MODELS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [matchInfo, setMatchInfo] = useState<{ topic: string; similarity: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      setUser(JSON.parse(stored));
      setAuthChecked(true);
      inputRef.current?.focus();
    } else {
      // No user — redirect to login
      router.replace('/login');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.replace('/login');
  };

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError('');
    setMatchInfo(null);

    try {
      const res = await fetch('/api/nodes/find-or-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, model }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to find or create conversation');
      }

      const data = await res.json();

      if (data.existingNode) {
        setMatchInfo({ topic: data.topic, similarity: data.similarity });
        await new Promise(r => setTimeout(r, 800));
      }

      router.push(`/nodes/${data.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk(e as any);
    }
  }

  // Don't render anything until auth check is done (avoids flash)
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col">
      {/* Top bar — relative + z-10 so it always sits above the form */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <span className="font-bold text-indigo-700 text-lg tracking-tight">Collm</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.name || user?.email}</span>
          <Link
            href="/nodes"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Conversations
          </Link>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl space-y-8">
          {/* Heading */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-gray-900">Ask anything</h1>
            <p className="text-gray-500 text-sm">
              Your question will find an existing conversation or start a new one.
            </p>
          </div>

          {/* Question form */}
          <form onSubmit={handleAsk} className="space-y-3">
            <div className="bg-white rounded-2xl border shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
              <textarea
                ref={inputRef}
                value={question}
                onChange={e => {
                  setQuestion(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="What would you like to explore? (Enter to send)"
                rows={2}
                disabled={loading}
                className="w-full resize-none text-base text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
              />
              <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100">
                <select
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  aria-label="Select AI model"
                  className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {matchInfo ? 'Found a match…' : 'Searching…'}
                    </>
                  ) : 'Ask →'}
                </button>
              </div>
            </div>

            {/* Match feedback */}
            {matchInfo && (
              <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 flex items-center gap-2">
                <span>✓</span>
                <span>
                  Found existing conversation: <strong>&ldquo;{matchInfo.topic}&rdquo;</strong>
                  {' '}
                  <span className="text-green-600 text-xs">({Math.round(matchInfo.similarity * 100)}% match)</span>
                </span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>

          {/* Browse link */}
          <div className="text-center">
            <Link
              href="/nodes"
              className="text-sm text-gray-400 hover:text-indigo-600 transition-colors"
            >
              Browse all conversations →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
