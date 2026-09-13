export function buildTabCaptureConstraints(streamId) {
  return {
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false,
  };
}

export class TabRecorder {
  constructor({
    getUserMedia = (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    MediaRecorderClass = MediaRecorder,
    AudioContextClass = AudioContext,
  } = {}) {
    this.getUserMedia = getUserMedia;
    this.MediaRecorderClass = MediaRecorderClass;
    this.AudioContextClass = AudioContextClass;
    this.state = 'idle';
    this.chunks = [];
    this.stream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
  }

  getState() {
    return this.state;
  }

  async start(streamId) {
    if (this.state !== 'idle') {
      throw new Error(`Cannot start recording from state "${this.state}"`);
    }

    this.stream = await this.getUserMedia(buildTabCaptureConstraints(streamId));
    this.chunks = [];
    this.mediaRecorder = new this.MediaRecorderClass(this.stream);
    this.mediaRecorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.mediaRecorder.start();

    this.audioContext = new this.AudioContextClass();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.audioContext.destination);

    this.state = 'recording';
  }

  async stop() {
    if (this.state !== 'recording') {
      throw new Error(`Cannot stop recording from state "${this.state}"`);
    }

    const stopped = new Promise((resolve) => {
      this.mediaRecorder.addEventListener('stop', resolve, { once: true });
    });
    this.mediaRecorder.stop();
    await stopped;

    this.stream.getTracks().forEach((track) => track.stop());
    await this.audioContext.close();

    this.state = 'idle';
    return new Blob(this.chunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
  }
}
