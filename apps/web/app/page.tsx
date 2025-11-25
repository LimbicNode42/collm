'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User } from '@collm/types';

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
    </main>
  );
}
