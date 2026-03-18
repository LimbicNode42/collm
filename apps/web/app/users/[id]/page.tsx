'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User } from '../../../types/api';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  CONTRIBUTOR: 'bg-indigo-100 text-indigo-700',
  VIEWER: 'bg-gray-100 text-gray-600',
};

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const isOwnProfile = !!(profile && currentUser && (
    currentUser.id === profile.id || currentUser.email === profile.email
  ));

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/login'); return; }
    setCurrentUser(JSON.parse(stored));
  }, [router]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const encodedId = encodeURIComponent(id);

    // Use /users/search?q= to avoid URL path encoding issues with @ in emails
    fetch(`/api/users/search?q=${encodedId}`)
      .then(async r => { if (!r.ok) return null; try { return await r.json(); } catch { return null; } })
      .then(async profileData => {
        setProfile(profileData ?? null);
        setEditName(profileData?.name ?? '');
        if (!profileData) { setStats(null); return; }
        // Always use the profile's email as canonical ID, add displayName for legacy contributions
        const emailEncoded = encodeURIComponent(profileData.email);
        const nameParam = profileData.name ? `?displayName=${encodeURIComponent(profileData.name)}` : '';
        const statsData = await fetch(`/api/nodes/user-stats/${emailEncoded}${nameParam}`)
          .then(r => r.ok ? r.json().catch(() => null) : null)
          .catch(() => null);
        setStats(statsData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !isOwnProfile) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(profile.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const updated = await res.json();
      setProfile(updated);
      // Update localStorage
      const stored = localStorage.getItem('user');
      if (stored) {
        const u = JSON.parse(stored);
        localStorage.setItem('user', JSON.stringify({ ...u, name: updated.name }));
        setCurrentUser(prev => prev ? { ...prev, name: updated.name } : prev);
      }
      setEditing(false);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="space-y-3 w-80 animate-pulse">
          <div className="h-20 bg-gray-200 rounded-2xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">User not found.</p>
          <Link href="/nodes" className="text-indigo-600 hover:underline text-sm">← Back to topics</Link>
        </div>
      </div>
    );
  }

  const displayName = profile.name || profile.email;
  const initials = (profile.name || profile.email || '?')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/nodes" className="text-gray-400 hover:text-gray-600 text-sm">← Topics</Link>
          <h1 className="font-bold text-gray-900">User Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Profile card */}
        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-700 font-bold text-2xl flex items-center justify-center flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              {editing ? (
                <form onSubmit={saveProfile} className="space-y-3">
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Display name"
                    className="w-full border rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  {saveError && <p className="text-xs text-red-600">{saveError}</p>}
                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={() => { setEditing(false); setEditName(profile.name ?? ''); }} className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
                    {profile.role && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[profile.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {profile.role}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
                  <p className="text-xs text-gray-400 mt-1">Member since {new Date(profile.createdAt).toLocaleDateString()}</p>
                  {isOwnProfile && (
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <button onClick={() => setEditing(true)} className="text-xs text-indigo-600 hover:underline">
                        ✏️ Edit profile
                      </button>
                      {profile.role === 'ADMIN' && (
                        <Link href="/admin/rbac" className="text-xs text-red-600 hover:underline font-medium">
                          🛡 Admin Panel
                        </Link>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-2xl font-bold text-indigo-600">{stats.totalContributions}</p>
              <p className="text-xs text-gray-500 mt-1">Contributions</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className={`text-2xl font-bold ${stats.netVotes >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {stats.netVotes > 0 ? `+${stats.netVotes}` : stats.netVotes}
              </p>
              <p className="text-xs text-gray-500 mt-1">Net Votes</p>
            </div>
            <div className="bg-white rounded-xl border p-4 text-center">
              <p className="text-2xl font-bold text-gray-700">{stats.topicBreakdown?.length ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Topics</p>
            </div>
          </div>
        )}

        {/* Topic breakdown */}
        {stats?.topicBreakdown?.length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Contributions by Topic</h3>
            <ul className="space-y-2">
              {stats.topicBreakdown.map((t: any) => (
                <li key={t.nodeId} className="flex items-center justify-between">
                  <Link href={`/nodes/${t.nodeId}`} className="text-sm text-indigo-600 hover:underline truncate flex-1 mr-2">
                    {t.topic}
                  </Link>
                  <span className="text-xs font-semibold text-gray-600 flex-shrink-0">
                    {t.count} contribution{t.count !== 1 ? 's' : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recent contributions */}
        {stats?.recentContributions?.length > 0 && (
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h3 className="font-semibold text-gray-800 mb-4">Recent Contributions</h3>
            <ul className="divide-y">
              {stats.recentContributions.map((c: any) => {
                const score = c.upvotes - c.downvotes;
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Link href={`/nodes/${c.nodeId}`} className="text-xs font-medium text-indigo-600 hover:underline">
                          {c.topic}
                        </Link>
                        <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{c.content}</p>
                        <p className="text-xs text-gray-400 mt-1">{timeAgo(c.createdAt)}</p>
                      </div>
                      {score !== 0 && (
                        <span className={`text-xs font-bold flex-shrink-0 ${score > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {score > 0 ? `+${score}` : score}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {stats?.totalContributions === 0 && (
          <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
            <p className="text-gray-400 text-sm">No contributions yet.</p>
          </div>
        )}
      </main>
    </div>
  );
}
