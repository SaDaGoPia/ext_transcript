import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TabRecorder, buildTabCaptureConstraints } from '../src/offscreen/recorder.js';

test('buildTabCaptureConstraints targets the given stream as tab audio', () => {
  assert.deepEqual(buildTabCaptureConstraints('stream-42'), {
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: 'stream-42' } },
    video: false,
  });
});

function createFakes() {
  const trackStopCalls = [];
  const fakeStream = { getTracks: () => [{ stop: () => trackStopCalls.push('stopped') }] };

  class FakeMediaRecorder {
    constructor(stream) {
      this.stream = stream;
      this.listeners = {};
      this.mimeType = 'audio/webm';
    }
    addEventListener(type, cb) { this.listeners[type] = cb; }
    start() {}
    stop() {
      this.listeners.dataavailable?.({ data: new Blob(['fake-bytes']) });
      this.listeners.stop?.();
    }
  }

  let audioContextClosed = false;
  let connectedDestination = null;
  class FakeAudioContext {
    constructor() { this.destination = { id: 'destination' }; }
    createMediaStreamSource() {
      return { connect: (dest) => { connectedDestination = dest; } };
    }
    async close() { audioContextClosed = true; }
  }

  const getUserMediaCalls = [];
  const getUserMedia = async (constraints) => {
    getUserMediaCalls.push(constraints);
    return fakeStream;
  };

  return {
    getUserMedia,
    MediaRecorderClass: FakeMediaRecorder,
    AudioContextClass: FakeAudioContext,
    getUserMediaCalls,
    trackStopCalls,
    isAudioContextClosed: () => audioContextClosed,
    getConnectedDestination: () => connectedDestination,
  };
}

test('start() requests the tab stream, records, and wires passthrough to speakers', async () => {
  const fakes = createFakes();
  const recorder = new TabRecorder(fakes);

  await recorder.start('stream-42');

  assert.equal(recorder.getState(), 'recording');
  assert.deepEqual(fakes.getUserMediaCalls[0], buildTabCaptureConstraints('stream-42'));
  assert.deepEqual(fakes.getConnectedDestination(), { id: 'destination' });
});

test('start() throws if already recording', async () => {
  const fakes = createFakes();
  const recorder = new TabRecorder(fakes);
  await recorder.start('stream-42');

  await assert.rejects(() => recorder.start('stream-42'), /Cannot start recording/);
});

test('stop() throws if not recording', async () => {
  await assert.rejects(() => new TabRecorder(createFakes()).stop(), /Cannot stop recording/);
});

test('stop() returns a Blob, stops tracks, closes the audio context, and resets state', async () => {
  const fakes = createFakes();
  const recorder = new TabRecorder(fakes);
  await recorder.start('stream-42');

  const blob = await recorder.stop();

  assert.ok(blob instanceof Blob);
  assert.equal(recorder.getState(), 'idle');
  assert.deepEqual(fakes.trackStopCalls, ['stopped']);
  assert.equal(fakes.isAudioContextClosed(), true);
});
