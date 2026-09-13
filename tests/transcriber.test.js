import { test } from 'node:test';
import assert from 'node:assert/strict';
import { transcribeAudioBlob } from '../src/offscreen/transcriber.js';

test('transcribeAudioBlob decodes audio, runs the pipeline in Spanish, and returns the text', async () => {
  const fakeBlob = new Blob(['fake-audio']);
  const fakeFloat32 = new Float32Array([0.1, 0.2]);
  const pipelineCalls = [];

  const decodeAudio = async (blob) => {
    assert.equal(blob, fakeBlob);
    return fakeFloat32;
  };

  const fakePipeline = async (audioData, options) => {
    pipelineCalls.push({ audioData, options });
    return { text: 'hola mundo' };
  };
  const pipelineFactory = async () => fakePipeline;

  const text = await transcribeAudioBlob(fakeBlob, { pipelineFactory, decodeAudio });

  assert.equal(text, 'hola mundo');
  assert.equal(pipelineCalls[0].audioData, fakeFloat32);
  assert.deepEqual(pipelineCalls[0].options, { language: 'spanish', task: 'transcribe' });
});

test('transcribeAudioBlob allows overriding the language', async () => {
  const fakePipeline = async (_audioData, options) => ({ text: options.language });
  const pipelineFactory = async () => fakePipeline;
  const decodeAudio = async () => new Float32Array();

  const text = await transcribeAudioBlob(new Blob([]), { pipelineFactory, decodeAudio, language: 'english' });

  assert.equal(text, 'english');
});
