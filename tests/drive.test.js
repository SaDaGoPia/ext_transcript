import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMultipartUploadBody, uploadTranscriptToDrive } from '../src/lib/drive.js';

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
