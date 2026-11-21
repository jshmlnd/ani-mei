import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
const memory = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
globalThis.localStorage = memory;
const { recordEpisode, progressFor, recentShows, readProgress } = await import('./progress.js');

test('records opened episodes per show, newest show first', () => {
  store.clear();
  recordEpisode('ani-1', { episode: 3, total: 12 });
  recordEpisode('ani-1', { episode: 1, total: 12 });
  assert.deepEqual(progressFor('ani-1').seen, [1, 3]);
  assert.equal(progressFor('ani-1').episode, 1);
  assert.equal(recentShows()[0].id, 'ani-1');
});

test('caps the store at 40 shows', () => {
  store.clear();
  for (let i = 0; i < 45; i++) recordEpisode(`s${i}`, { episode: 1 });
  assert.equal(Object.keys(readProgress()).length, 40);
});

test('never throws when storage is corrupt or blocked', () => {
  store.set('animei-progress', 'not json');
  assert.deepEqual(readProgress(), {});
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(progressFor('ani-1'), null);
  assert.doesNotThrow(() => recordEpisode('ani-2', { episode: 1 }));
  globalThis.localStorage = memory;
});
