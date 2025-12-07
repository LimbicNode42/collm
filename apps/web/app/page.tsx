'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from '../types/api';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <p className="fixed left-0 top-0 flex w-full justify-center border-b border-gray-300 bg-gradient-to-b from-zinc-200 pb-6 pt-8 backdrop-blur-2xl dark:border-neutral-800 dark:bg-zinc-800/30 dark:from-inherit lg:static lg:w-auto  lg:rounded-xl lg:border lg:bg-gray-200 lg:p-4 lg:dark:bg-zinc-800/30">
          Collm - Collaborative LLM
        </p>
        <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-white via-white dark:from-black dark:via-black lg:static lg:h-auto lg:w-auto lg:bg-none">
          {user ? (
            <div className="flex gap-4 items-center">
              <span>Welcome, {user.name || user.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <Link
                href="/login"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex place-items-center before:absolute before:h-[300px] before:w-[480px] before:-translate-x-1/2 before:rounded-full before:bg-gradient-to-br before:from-transparent before:to-blue-700 before:opacity-10 after:absolute after:-z-20 after:h-[180px] after:w-[240px] after:translate-x-1/3 after:bg-gradient-to-t after:from-blue-900 after:via-blue-900 after:opacity-40 before:lg:h-[360px] z-[-1]">
        <h1 className="text-6xl font-bold">Collm</h1>
      </div>

      <div className="mt-16 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left gap-6">
        <Link
          href="/test"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            Test Features{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Comprehensive testing dashboard for all system features without remembering URLs.
          </p>
        </Link>

        <Link
          href="/debug/queue"
          className="group rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
        >
          <h2 className="mb-3 text-2xl font-semibold">
            Queue Debug{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className="m-0 max-w-[30ch] text-sm opacity-50">
            Debug message queue operations and processing.
          </p>
        </Link>

        <div className="group rounded-lg border border-transparent px-5 py-4">
          <h2 className="mb-3 text-2xl font-semibold">Features</h2>
          <ul className="m-0 max-w-[30ch] text-sm opacity-50 list-disc list-inside">
            <li>Multi-model LLM support</li>
            <li>Node-based conversations</li>
            <li>Real-time processing</li>
            <li>User management</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
