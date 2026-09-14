import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMultipartUploadBody, uploadTranscriptToDrive, findOrCreateAppFolder } from '../src/lib/drive.js';

test('buildMultipartUploadBody embeds metadata and content between boundary markers', () => {
  const body = buildMultipartUploadBody('BOUNDARY', { name: 'a.txt', parents: ['f1'] }, 'hello', 'text/plain');
  assert.match(body, /--BOUNDARY\r\nContent-Type: application\/json/);
  assert.match(body, /"name":"a\.txt"/);
  assert.match(body, /Content-Type: text\/plain\r\n\r\nhello/);
  assert.match(body, /--BOUNDARY--$/);
});

test('uploadTranscriptToDrive posts to the Drive upload endpoint with the auth header', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ id: 'uploaded-file-id' }) };
  };

  const result = await uploadTranscriptToDrive({
    accessToken: 'token123',
    folderId: 'folder1',
    filename: 'transcript.txt',
    content: 'hola',
    fetchImpl: fakeFetch,
  });

  assert.equal(result.id, 'uploaded-file-id');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token123');
});

test('uploadTranscriptToDrive throws with the response body on failure', async () => {
  const fakeFetch = async () => ({ ok: false, status: 403, text: async () => 'insufficient permissions' });

  await assert.rejects(
    () => uploadTranscriptToDrive({
      accessToken: 'token123',
      folderId: 'folder1',
      filename: 'transcript.txt',
      content: 'hola',
      fetchImpl: fakeFetch,
    }),
    /Drive upload failed \(403\): insufficient permissions/
  );
});

test('findOrCreateAppFolder returns an existing folder without creating a new one', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ files: [{ id: 'existing-folder-id', name: 'Tab Transcripts' }] }) };
  };

  const folder = await findOrCreateAppFolder({
    accessToken: 'token123',
    folderName: 'Tab Transcripts',
    fetchImpl: fakeFetch,
  });

  assert.deepEqual(folder, { id: 'existing-folder-id', name: 'Tab Transcripts' });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/www\.googleapis\.com\/drive\/v3\/files\?/);
  assert.match(decodeURIComponent(calls[0].url), /name='Tab Transcripts'/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token123');
});

test('findOrCreateAppFolder creates a new folder when none exists', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return { ok: true, json: async () => ({ files: [] }) };
    }
    return { ok: true, json: async () => ({ id: 'new-folder-id', name: 'Tab Transcripts' }) };
  };

  const folder = await findOrCreateAppFolder({
    accessToken: 'token123',
    folderName: 'Tab Transcripts',
    fetchImpl: fakeFetch,
  });

  assert.deepEqual(folder, { id: 'new-folder-id', name: 'Tab Transcripts' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, 'https://www.googleapis.com/drive/v3/files?fields=id,name');
  assert.equal(calls[1].options.method, 'POST');
  const body = JSON.parse(calls[1].options.body);
  assert.deepEqual(body, { name: 'Tab Transcripts', mimeType: 'application/vnd.google-apps.folder' });
});

test('findOrCreateAppFolder throws with the response body when the lookup fails', async () => {
  const fakeFetch = async () => ({ ok: false, status: 401, text: async () => 'invalid credentials' });

  await assert.rejects(
    () => findOrCreateAppFolder({ accessToken: 'token123', folderName: 'Tab Transcripts', fetchImpl: fakeFetch }),
    /Drive folder lookup failed \(401\): invalid credentials/
  );
});
