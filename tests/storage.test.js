import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveTranscript, loadTranscript, saveDriveFolder, loadDriveFolder } from '../src/lib/storage.js';

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

test('saveDriveFolder/loadDriveFolder round-trip through a storage area', async () => {
  const area = createFakeStorageArea();
  await saveDriveFolder({ id: 'folder123', name: 'Transcripts' }, area);
  assert.deepEqual(await loadDriveFolder(area), { id: 'folder123', name: 'Transcripts' });
});

test('loadDriveFolder returns null when nothing stored', async () => {
  assert.equal(await loadDriveFolder(createFakeStorageArea()), null);
});
