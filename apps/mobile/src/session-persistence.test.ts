import { expect, it, vi } from 'vitest';
import { orderedSessionWriter } from './session-persistence';

it('finishes an old secure write before clearing storage on logout', async () => {
  let stored: string | null = null,
    generation = 1;
  let release!: () => void;
  const barrier = new Promise<void>((resolve) => {
    release = resolve;
  });
  const write = vi.fn(async (value: string | null) => {
    if (value === 'old-token') await barrier;
    stored = value;
  });
  const save = orderedSessionWriter(write);
  const old = save('old-token', () => generation === 1);
  await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
  generation = 2;
  const logout = save(null, () => generation === 2);
  release();
  await Promise.all([old, logout]);
  expect(stored).toBeNull();
});

it('does not restore a queued stale token and still clears after a failed write', async () => {
  let stored: string | null = null;
  const write = vi.fn(async (value: string | null) => {
    if (value === 'failed') throw new Error('storage unavailable');
    stored = value;
  });
  const save = orderedSessionWriter(write);
  await expect(save('failed', () => true)).rejects.toThrow('storage unavailable');
  await save('stale-token', () => false);
  await save(null, () => true);
  expect(stored).toBeNull();
  expect(write.mock.calls.map((call) => call[0])).toEqual(['failed', null]);
});
