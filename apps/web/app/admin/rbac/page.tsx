'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User } from '../../../types/api';

const ROLES = ['VIEWER', 'CONTRIBUTOR', 'ADMIN'] as const;
type Role = typeof ROLES[number];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN:       'bg-red-100 text-red-700 border-red-200',
  CONTRIBUTOR: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  VIEWER:      'bg-gray-100 text-gray-600 border-gray-200',
};

// All gated features in the system with their current minimum required role
interface FeatureGate {
  id: string;
  name: string;
  description: string;
  service: string;
  endpoint: string;
  currentMinRole: Role;
}

const FEATURE_GATES: FeatureGate[] = [
  {
    id: 'delete_topic',
    name: 'Delete Topic',
    description: 'Permanently delete a topic node and all its contributions.',
    service: 'core-service',
    endpoint: 'DELETE /nodes/:id',
    currentMinRole: 'ADMIN',
  },
  {
    id: 'synthesize_topics',
    name: 'Synthesize Topics',
    description: 'Merge multiple topics into a new synthesized document.',
    service: 'core-service',
    endpoint: 'POST /nodes/synthesize-multiple',
    currentMinRole: 'ADMIN',
  },
  {
    id: 'create_topic',
    name: 'Create Topic',
    description: 'Create a new knowledge topic node.',
    service: 'core-service',
    endpoint: 'POST /nodes',
    currentMinRole: 'CONTRIBUTOR',
  },
  {
    id: 'contribute',
    name: 'Submit Contribution',
    description: 'Submit new knowledge contributions to a topic.',
    service: 'core-service',
    endpoint: 'POST /nodes/:id/evolve',
    currentMinRole: 'CONTRIBUTOR',
  },
  {
    id: 'vote',
    name: 'Vote on Contributions',
    description: 'Upvote or downvote contributions from other users.',
    service: 'core-service',
    endpoint: 'POST /nodes/:nodeId/messages/:messageId/vote',
    currentMinRole: 'VIEWER',
  },
  {
    id: 'chat',
    name: 'Chat with AI',
    description: 'Interact with the AI assistant on any topic.',
    service: 'core-service',
    endpoint: 'POST /llm/chat',
    currentMinRole: 'VIEWER',
  },
  {
    id: 'manage_users',
    name: 'Manage User Roles',
    description: 'Change roles for other users in the system.',
    service: 'user-service',
    endpoint: 'PATCH /users/:id/role',
    currentMinRole: 'ADMIN',
  },
];

export default function AdminRbacPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingRole, setSavingRole] = useState<string | null>(null); // userId being updated
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Check admin auth
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/login'); return; }
    const user: User = JSON.parse(stored);
    if (user.role !== 'ADMIN') { router.replace('/nodes'); return; }
    setCurrentUser(user);
  }, [router]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'ADMIN') loadUsers();
  }, [currentUser, loadUsers]);

  async function handleRoleChange(targetUser: User, newRole: Role) {
    if (!currentUser) return;
    if (newRole === targetUser.role) return;
    if (targetUser.id === currentUser.id && newRole !== 'ADMIN') {
      if (!confirm("You're about to remove your own ADMIN role. Are you sure?")) return;
    }

    setSavingRole(targetUser.id);
    setRoleSuccess(null);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(targetUser.id)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole, requestedBy: currentUser.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to update role');
      }
      const updated = await res.json();
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));

      // If changed own role, update localStorage
      if (updated.id === currentUser.id) {
        const stored = localStorage.getItem('user');
        if (stored) {
          localStorage.setItem('user', JSON.stringify({ ...JSON.parse(stored), role: updated.role }));
          setCurrentUser(prev => prev ? { ...prev, role: updated.role } : prev);
        }
      }

      setRoleSuccess(targetUser.id);
      setTimeout(() => setRoleSuccess(null), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    } finally {
      setSavingRole(null);
    }
  }

  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return !q || (u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q));
  });

  if (loading && !currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse space-y-3 w-96">
          <div className="h-8 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/nodes" className="text-gray-400 hover:text-gray-600 text-sm">← Topics</Link>
          <div className="flex-1" />
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
            🛡 Admin Panel
          </span>
          <h1 className="font-bold text-gray-900">RBAC Management</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── Section 1: User Role Management ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900">User Roles</h2>
              <p className="text-sm text-gray-500 mt-0.5">Manage the role assigned to each user account.</p>
            </div>
            <button
              onClick={loadUsers}
              disabled={loading}
              className="text-xs text-indigo-600 hover:underline disabled:opacity-40"
            >
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          {/* Search */}
          <div className="mb-3">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users by name, email or role…"
              className="w-full border rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-400 text-sm animate-pulse">Loading users…</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No users found.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Email</th>
                    <th className="text-left px-4 py-3">Current Role</th>
                    <th className="text-left px-4 py-3">Change Role</th>
                    <th className="text-left px-4 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredUsers.map(u => {
                    const isYou = u.id === currentUser?.id;
                    const isSaving = savingRole === u.id;
                    const isSuccess = roleSuccess === u.id;
                    return (
                      <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${isYou ? 'bg-indigo-50/50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            <Link href={`/users/${encodeURIComponent(u.id)}`} className="hover:text-indigo-600 hover:underline">
                              {u.name || <span className="text-gray-400 italic">No name</span>}
                            </Link>
                            {isYou && <span className="text-xs text-indigo-500 font-normal">(you)</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[(u.role as Role) ?? 'VIEWER']}`}>
                            {u.role ?? 'VIEWER'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isSaving ? (
                            <span className="text-xs text-gray-400 animate-pulse">Saving…</span>
                          ) : isSuccess ? (
                            <span className="text-xs text-green-600 font-medium">✓ Updated</span>
                          ) : (
                            <select
                              value={u.role ?? 'VIEWER'}
                              onChange={e => handleRoleChange(u, e.target.value as Role)}
                              className="border rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                            >
                              {ROLES.map(r => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Role legend */}
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200 font-semibold">VIEWER</span>
              <span>Can view topics, chat, and vote</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold">CONTRIBUTOR</span>
              <span>Can create topics and submit contributions</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200 font-semibold">ADMIN</span>
              <span>Full access: delete topics, synthesize, manage users</span>
            </div>
          </div>
        </section>

        {/* ── Section 2: Feature Permissions ── */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900">Feature Permissions</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Current minimum role required for each feature across all services.
            </p>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Feature</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Service</th>
                  <th className="text-left px-4 py-3">Endpoint</th>
                  <th className="text-left px-4 py-3">Min. Role</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {FEATURE_GATES.map(feat => (
                  <tr key={feat.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{feat.name}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs">{feat.description}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-mono border border-blue-100">
                        {feat.service}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{feat.endpoint}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[feat.currentMinRole]}`}>
                        {feat.currentMinRole}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-xs text-amber-700">
              <strong>Note:</strong> Feature role requirements are currently defined in the service code.
              To change a feature's minimum role, update the relevant service endpoint in{' '}
              <code className="bg-amber-100 px-1 rounded">apps/core-service/src/index.ts</code> and{' '}
              <code className="bg-amber-100 px-1 rounded">apps/user-service/src/app.ts</code>.
            </p>
          </div>
        </section>

        {/* ── Section 3: Quick Stats ── */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">User Statistics</h2>
          <div className="grid grid-cols-3 gap-4">
            {ROLES.map(role => {
              const count = users.filter(u => (u.role ?? 'VIEWER') === role).length;
              return (
                <div key={role} className="bg-white rounded-xl border shadow-sm p-5 text-center">
                  <p className={`text-3xl font-bold`}>{count}</p>
                  <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[role]}`}>
                    {role}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">{count === 1 ? 'user' : 'users'}</p>
                </div>
              );
            })}
          </div>
        </section>

      </main>
    </div>
  );
}
