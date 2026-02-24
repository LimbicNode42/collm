/**
 * Auth Performance Benchmarks
 *
 * bcrypt's cost is intentional — these benchmarks document the per-request
 * latency so you can detect if salt rounds are accidentally changed.
 *
 * Run: npm run bench:run
 */
import { bench, describe } from 'vitest';
import { hash, compare } from 'bcryptjs';

const PLAIN_PASSWORD = 'BenchmarkPassword123!';
let cachedHash: string;

describe('bcrypt cost (rounds = 10, production default)', () => {
  bench('hash — cost of one registration', async () => {
    cachedHash = await hash(PLAIN_PASSWORD, 10);
  });

  bench('compare (match) — cost of one successful login', async () => {
    if (!cachedHash) cachedHash = await hash(PLAIN_PASSWORD, 10);
    await compare(PLAIN_PASSWORD, cachedHash);
  });

  bench('compare (no match) — cost of one failed login', async () => {
    if (!cachedHash) cachedHash = await hash(PLAIN_PASSWORD, 10);
    await compare('wrong-password', cachedHash);
  });
});
