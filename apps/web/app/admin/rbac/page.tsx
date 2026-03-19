'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User } from '../../../types/api';

// ─── Types ────────────────────────────────────────────────────────────────────
const ROLES = ['VIEWER', 'CONTRIBUTOR', 'ADMIN'] as const;
type Role = typeof ROLES[number];

const ROLE_COLORS: Record<Role, string> = {
  ADMIN:       'bg-red-100 text-red-700 border-red-200',
  CONTRIBUTOR: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  VIEWER:      'bg-gray-100 text-gray-600 border-gray-200',
};

const ROLE_ICONS: Record<Role, string> = {
  ADMIN: '🛡',
  CONTRIBUTOR: '✏️',
  VIEWER: '👁',
};

interface FeatureGate {
  id: string;
  name: string;
  description: string;
  service: string;
  endpoint: string;
  minRole: Role;
  enforced: boolean;
}

// Feature gates — defined here, enforced in backend service code
const FEATURE_GATES: FeatureGate[] = [
  { id: 'chat',             name: 'Chat with AI',           description: 'Interact with the AI assistant on any topic.',                     service: 'core-service',  endpoint: 'POST /llm/chat',                              minRole: 'VIEWER',      enforced: true  },
  { id: 'vote',             name: 'Vote on Contributions',  description: 'Upvote or downvote contributions from other users.',               service: 'core-service',  endpoint: 'POST /nodes/:nodeId/messages/:msgId/vote',    minRole: 'VIEWER',      enforced: true  },
  { id: 'view_nodes',       name: 'View Topics',            description: 'Browse knowledge topics and their content.',                       service: 'core-service',  endpoint: 'GET /nodes',                                  minRole: 'VIEWER',      enforced: false },
  { id: 'contribute',       name: 'Submit Contribution',    description: 'Submit new knowledge contributions to a topic.',                   service: 'core-service',  endpoint: 'POST /nodes/:id/evolve',                      minRole: 'CONTRIBUTOR', enforced: true  },
  { id: 'create_topic',     name: 'Create Topic',           description: 'Create a new knowledge topic node.',                               service: 'core-service',  endpoint: 'POST /nodes',                                 minRole: 'CONTRIBUTOR', enforced: true  },
  { id: 'synthesize',       name: 'Synthesize Topics',      description: 'Merge multiple topics into a synthesized document.',               service: 'core-service',  endpoint: 'POST /nodes/synthesize-multiple',             minRole: 'ADMIN',       enforced: true  },
  { id: 'delete_topic',     name: 'Delete Topic',           description: 'Permanently delete a topic node and all contributions.',           service: 'core-service',  endpoint: 'DELETE /nodes/:id',                           minRole: 'ADMIN',       enforced: true  },
  { id: 'manage_roles',     name: 'Manage User Roles',      description: 'Change the role of any user account.',                             service: 'user-service',  endpoint: 'PATCH /users/:id/role',                       minRole: 'ADMIN',       enforced: true  },
  { id: 'delete_users',     name: 'Delete Users',           description: 'Permanently delete a user account from the system.',               service: 'user-service',  endpoint: 'DELETE /users/:id',                           minRole: 'ADMIN',       enforced: true  },
  { id: 'create_users',     name: 'Admin Create Users',     description: 'Create new user accounts with assigned roles.',                    service: 'user-service',  endpoint: 'POST /admin/users',                           minRole: 'ADMIN',       enforced: true  },
  { id: 'reset_passwords',  name: 'Reset Passwords',        description: 'Reset any user\'s password without knowing the current one.',       service: 'user-service',  endpoint: 'POST /users/:id/reset-password',              minRole: 'ADMIN',       enforced: true  },
];

// Role capability matrix for overview tab
const ROLE_CAPABILITIES = [
  { category: 'Content',      name: 'View topics & leaderboard',   VIEWER: true,  CONTRIBUTOR: true,  ADMIN: true  },
  { category: 'Content',      name: 'Chat with AI on any topic',   VIEWER: true,  CONTRIBUTOR: true,  ADMIN: true  },
  { category: 'Content',      name: 'Vote on contributions',        VIEWER: true,  CONTRIBUTOR: true,  ADMIN: true  },
  { category: 'Content',      name: 'Submit contributions',         VIEWER: false, CONTRIBUTOR: true,  ADMIN: true  },
  { category: 'Content',      name: 'Create new topics',            VIEWER: false, CONTRIBUTOR: true,  ADMIN: true  },
  { category: 'Admin',        name: 'Synthesize/merge topics',      VIEWER: false, CONTRIBUTOR: false, ADMIN: true  },
  { category: 'Admin',        name: 'Delete topics',                VIEWER: false, CONTRIBUTOR: false, ADMIN: true  },
  { category: 'User Mgmt',    name: 'View all users',               VIEWER: false, CONTRIBUTOR: false, ADMIN: true  },
  { category: 'User Mgmt',    name: 'Change user roles',            VIEWER: false, CONTRIBUTOR: false, ADMIN: true  },
  { category: 'User Mgmt',    name: 'Create user accounts',         VIEWER: false, CONTRIBUTOR: false, ADMIN: true  },
  { category: 'User Mgmt',    name: 'Delete user accounts',         VIEWER: false, CONTRIBUTOR: false, ADMIN: true  },
  { category: 'User Mgmt',    name: 'Reset user passwords',         VIEWER: false, CONTRIBUTOR: false, ADMIN: true  },
];

type Tab = 'users' | 'create' | 'permissions' | 'overview';

// ─── Modal helpers ─────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function AdminRbacPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('users');

  // User list state
  const [search, setSearch] = useState('');
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [roleSuccess, setRoleSuccess] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');

  // Create user form
  const [createForm, setCreateForm] = useState({ email: '', name: '', role: 'CONTRIBUTOR' as Role, password: '', confirmPassword: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // ── Auth check ──
  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.replace('/login'); return; }
    const user: User = JSON.parse(stored);
    if (user.role !== 'ADMIN') { router.replace('/nodes'); return; }
    setCurrentUser(user);
  }, [router]);

  // ── Load users ──
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

  // ── Role change ──
  async function handleRoleChange(targetUser: User, newRole: Role) {
    if (!currentUser || newRole === targetUser.role) return;
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
      if (updated.id === currentUser.id) {
        const stored = localStorage.getItem('user');
        if (stored) {
          localStorage.setItem('user', JSON.stringify({ ...JSON.parse(stored), role: updated.role }));
          setCurrentUser(prev => prev ? { ...prev, role: updated.role } : prev);
        }
      }
      setRoleSuccess(targetUser.id);
      setTimeout(() => setRoleSuccess(null), 2500);
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    } finally {
      setSavingRole(null);
    }
  }

  // ── Delete user ──
  async function handleDelete() {
    if (!deleteTarget || !currentUser) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/users/${encodeURIComponent(deleteTarget.id)}?requestedBy=${encodeURIComponent(currentUser.id)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete user');
      }
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  }

  // ── Reset password ──
  async function handleResetPassword() {
    if (!resetTarget || !currentUser) return;
    setResetError('');
    if (newPassword.length < 8) { setResetError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setResetError('Passwords do not match'); return; }
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(resetTarget.id)}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, requestedBy: currentUser.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to reset password');
      }
      setResetTarget(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  }

  // ── Create user ──
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;
    setCreateError('');
    setCreateSuccess('');
    if (!createForm.email.trim()) { setCreateError('Email is required'); return; }
    if (createForm.password.length < 8) { setCreateError('Password must be at least 8 characters'); return; }
    if (createForm.password !== createForm.confirmPassword) { setCreateError('Passwords do not match'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email.trim(),
          name: createForm.name.trim() || undefined,
          role: createForm.role,
          password: createForm.password,
          requestedBy: currentUser.id,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create user');
      }
      const data = await res.json();
      setCreateSuccess(`User ${data.user?.email} created successfully with role ${createForm.role}.`);
      setCreateForm({ email: '', name: '', role: 'CONTRIBUTOR', password: '', confirmPassword: '' });
      loadUsers(); // refresh list
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  }

  // ── Filtered users ──
  const filteredUsers = users.filter(u => {
    const q = search.toLowerCase();
    return !q || u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q);
  });

  const stats = ROLES.map(r => ({ role: r, count: users.filter(u => (u.role ?? 'VIEWER') === r).length }));

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

      {/* ── Header ── */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/nodes" className="text-gray-400 hover:text-gray-600 text-sm">← Topics</Link>
          <div className="flex-1" />
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
            🛡 Admin Panel
          </span>
          <h1 className="font-bold text-gray-900 text-sm">RBAC Management</h1>
          {currentUser && (
            <span className="text-xs text-gray-400 hidden sm:block">{currentUser.email}</span>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-3 gap-4">
          {stats.map(({ role, count }) => (
            <div key={role} className="bg-white rounded-xl border shadow-sm px-4 py-3 flex items-center gap-3">
              <span className="text-2xl">{ROLE_ICONS[role]}</span>
              <div>
                <p className="text-2xl font-bold text-gray-900 leading-none">{count}</p>
                <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${ROLE_COLORS[role]}`}>{role}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tab nav ── */}
        <div className="flex border-b">
          {([
            { id: 'users',       label: '👥 Users',             desc: 'Manage all user accounts' },
            { id: 'create',      label: '➕ Create User',        desc: 'Add new account' },
            { id: 'permissions', label: '🔒 Feature Permissions', desc: 'What each role can do' },
            { id: 'overview',    label: '📊 Role Overview',      desc: 'Capabilities matrix' },
          ] as { id: Tab; label: string; desc: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: USERS                                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'users' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-gray-500">
                {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
              </p>
              <button onClick={loadUsers} disabled={loading} className="text-xs text-indigo-600 hover:underline disabled:opacity-40">
                {loading ? 'Loading…' : '↻ Refresh'}
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
            )}

            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or role…"
              className="w-full mb-3 border rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

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
                      <th className="text-left px-4 py-3">Role</th>
                      <th className="text-left px-4 py-3">Change Role</th>
                      <th className="text-left px-4 py-3">Joined</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUsers.map(u => {
                      const isYou = u.id === currentUser?.id;
                      const isSaving = savingRole === u.id;
                      const isSuccess = roleSuccess === u.id;
                      const userRole = (u.role ?? 'VIEWER') as Role;
                      return (
                        <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${isYou ? 'bg-indigo-50/40' : ''}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${ROLE_COLORS[userRole]}`}>
                                {(u.name || u.email || '?')[0].toUpperCase()}
                              </div>
                              <div>
                                <Link href={`/users/${encodeURIComponent(u.id)}`} className="hover:text-indigo-600 hover:underline text-gray-900">
                                  {u.name || <span className="text-gray-400 italic text-xs">No name</span>}
                                </Link>
                                {isYou && <span className="ml-1 text-xs text-indigo-400">(you)</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[userRole]}`}>
                              {ROLE_ICONS[userRole]} {userRole}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {isSaving ? (
                              <span className="text-xs text-gray-400 animate-pulse">Saving…</span>
                            ) : isSuccess ? (
                              <span className="text-xs text-green-600 font-medium">✓ Updated</span>
                            ) : (
                              <select
                                value={userRole}
                                onChange={e => handleRoleChange(u, e.target.value as Role)}
                                className="border rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                              >
                                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setResetTarget(u); setNewPassword(''); setConfirmPassword(''); setResetError(''); }}
                                className="text-xs text-amber-600 hover:text-amber-800 hover:underline"
                                title="Reset password"
                              >
                                🔑 Reset
                              </button>
                              {!isYou && (
                                <button
                                  onClick={() => setDeleteTarget(u)}
                                  className="text-xs text-red-500 hover:text-red-700 hover:underline"
                                  title="Delete user"
                                >
                                  🗑 Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Role legend */}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
              {ROLES.map(r => (
                <div key={r} className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded-full font-semibold border ${ROLE_COLORS[r]}`}>{ROLE_ICONS[r]} {r}</span>
                  <span>
                    {r === 'VIEWER' && 'View, chat, vote'}
                    {r === 'CONTRIBUTOR' && 'Create topics & contribute'}
                    {r === 'ADMIN' && 'Full access + user management'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: CREATE USER                                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'create' && (
          <section>
            <div className="max-w-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Create User Account</h2>
              <p className="text-sm text-gray-500 mb-6">
                Create a new user account and assign a role immediately. The user can log in with these credentials and change their password later.
              </p>

              {createSuccess && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                  <span>✅</span> {createSuccess}
                </div>
              )}
              {createError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{createError}</div>
              )}

              <form onSubmit={handleCreateUser} className="bg-white rounded-2xl border shadow-sm p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email address <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    required
                    value={createForm.email}
                    onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Jane Smith (optional)"
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
                  <div className="flex gap-3">
                    {ROLES.map(r => (
                      <label
                        key={r}
                        className={`flex-1 flex flex-col items-center gap-1 border-2 rounded-xl px-3 py-3 cursor-pointer transition-colors ${
                          createForm.role === r ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={r}
                          checked={createForm.role === r}
                          onChange={() => setCreateForm(f => ({ ...f, role: r }))}
                          className="sr-only"
                        />
                        <span className="text-xl">{ROLE_ICONS[r]}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_COLORS[r]}`}>{r}</span>
                        <span className="text-xs text-gray-400 text-center leading-snug">
                          {r === 'VIEWER' && 'Read only'}
                          {r === 'CONTRIBUTOR' && 'Can create & contribute'}
                          {r === 'ADMIN' && 'Full access'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="Minimum 8 characters"
                    className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password <span className="text-red-500">*</span></label>
                  <input
                    type="password"
                    required
                    value={createForm.confirmPassword}
                    onChange={e => setCreateForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Repeat password"
                    className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      createForm.confirmPassword && createForm.password !== createForm.confirmPassword ? 'border-red-400' : ''
                    }`}
                  />
                  {createForm.confirmPassword && createForm.password !== createForm.confirmPassword && (
                    <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating…' : 'Create User Account'}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: FEATURE PERMISSIONS                                         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'permissions' && (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Feature Permissions</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Minimum role required for each feature. Enforced features are locked in backend service code.
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
                    <th className="text-left px-4 py-3">Enforced</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {FEATURE_GATES.map(feat => (
                    <tr key={feat.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{feat.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-xs">{feat.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-mono border ${
                          feat.service === 'core-service'
                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                            : 'bg-purple-50 text-purple-700 border-purple-100'
                        }`}>
                          {feat.service}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{feat.endpoint}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_COLORS[feat.minRole]}`}>
                          {ROLE_ICONS[feat.minRole]} {feat.minRole}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {feat.enforced ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">✓ Enforced</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">UI only</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> To change a feature's minimum role, update the relevant guard in{' '}
                <code className="bg-amber-100 px-1 rounded font-mono">apps/core-service/src/index.ts</code> or{' '}
                <code className="bg-amber-100 px-1 rounded font-mono">apps/user-service/src/app.ts</code>.
              </p>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TAB: ROLE OVERVIEW                                               */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {tab === 'overview' && (
          <section>
            <div className="mb-4">
              <h2 className="text-lg font-bold text-gray-900">Role Capabilities Matrix</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                A complete view of what each role can and cannot do across the system.
              </p>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 w-24">Category</th>
                    <th className="text-left px-4 py-3">Capability</th>
                    {ROLES.map(r => (
                      <th key={r} className="text-center px-4 py-3 min-w-[100px]">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${ROLE_COLORS[r]}`}>
                          {ROLE_ICONS[r]} {r}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(() => {
                    let prevCategory = '';
                    return ROLE_CAPABILITIES.map((cap, i) => {
                      const showCategory = cap.category !== prevCategory;
                      prevCategory = cap.category;
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-xs text-gray-400 font-medium">
                            {showCategory ? cap.category : ''}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">{cap.name}</td>
                          {ROLES.map(r => (
                            <td key={r} className="px-4 py-2.5 text-center">
                              {cap[r] ? (
                                <span className="text-green-500 font-bold text-base">✓</span>
                              ) : (
                                <span className="text-gray-200 font-bold text-base">✕</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Role cards */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              {ROLES.map(r => {
                const caps = ROLE_CAPABILITIES.filter(c => c[r]);
                const count = users.filter(u => (u.role ?? 'VIEWER') === r).length;
                return (
                  <div key={r} className={`rounded-2xl border-2 p-5 ${
                    r === 'ADMIN' ? 'border-red-200 bg-red-50' :
                    r === 'CONTRIBUTOR' ? 'border-indigo-200 bg-indigo-50' :
                    'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{ROLE_ICONS[r]}</span>
                      <div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${ROLE_COLORS[r]}`}>{r}</span>
                        <p className="text-xs text-gray-500 mt-0.5">{count} user{count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {caps.slice(0, 6).map((c, i) => (
                        <li key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
                          <span className="text-green-500 font-bold">✓</span> {c.name}
                        </li>
                      ))}
                      {caps.length > 6 && (
                        <li className="text-xs text-gray-400">+{caps.length - 6} more…</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

      </main>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <Modal title="Delete User" onClose={() => setDeleteTarget(null)}>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm text-red-700">
                <strong>This action is permanent.</strong> Deleting{' '}
                <span className="font-mono">{deleteTarget.email}</span> will remove their account,
                and they will no longer be able to log in. Their contributions will remain.
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteTarget.name || deleteTarget.email}</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete User'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Reset password modal ── */}
      {resetTarget && (
        <Modal title={`Reset Password — ${resetTarget.name || resetTarget.email}`} onClose={() => setResetTarget(null)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Set a new password for this user. They will need to use this password on their next login.
            </p>
            {resetError && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{resetError}</div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  confirmPassword && newPassword !== confirmPassword ? 'border-red-400' : ''
                }`}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || !newPassword || !confirmPassword}
                className="flex-1 bg-amber-500 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
              >
                {resetting ? 'Resetting…' : '🔑 Reset Password'}
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
