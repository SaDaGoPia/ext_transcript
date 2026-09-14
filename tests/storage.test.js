import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  saveTranscript,
  loadTranscript,
  saveRecordingState,
  loadRecordingState,
  clearRecordingState,
} from '../src/lib/storage.js';

function createFakeStorageArea() {
  const data = {};
  return {
    async set(items) { Object.assign(data, items); },
    async get(key) { return { [key]: data[key] }; },
  };
}

test('saveTranscript/loadTranscript round-trip through a storage area', async () => {
  const area = createFakeStorageArea();
  await saveTranscript({ text: 'hola mundo', tabTitle: 'Demo' }, area);
  assert.deepEqual(await loadTranscript(area), { text: 'hola mundo', tabTitle: 'Demo' });
});

test('loadTranscript returns null when nothing stored', async () => {
  assert.equal(await loadTranscript(createFakeStorageArea()), null);
});

test('saveRecordingState/loadRecordingState round-trip through a storage area', async () => {
  const area = createFakeStorageArea();
  await saveRecordingState({ inProgress: true, tabTitle: 'Demo' }, area);
  assert.deepEqual(await loadRecordingState(area), { inProgress: true, tabTitle: 'Demo' });
});

test('loadRecordingState returns null when nothing stored', async () => {
  assert.equal(await loadRecordingState(createFakeStorageArea()), null);
});

test('clearRecordingState resets a previously saved state to null', async () => {
  const area = createFakeStorageArea();
  await saveRecordingState({ inProgress: true, tabTitle: 'Demo' }, area);
  await clearRecordingState(area);
  assert.equal(await loadRecordingState(area), null);
});
