# Tab Transcript Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome MV3 extension that records a tab's audio, transcribes it locally to Spanish text with an in-browser Whisper model, and exports the transcript as a `.txt` download and/or an upload to a user-chosen Google Drive folder.

**Architecture:** Four extension surfaces — a background service worker (orchestration), an offscreen document (the only place with real media/DOM APIs, running both the recorder and the Transformers.js transcriber), a popup (start/stop, status, transcript, export actions), and an options page (Drive OAuth connect + folder picker). Shared pure logic (filenames, storage, messaging contracts, Drive upload) lives in `src/lib/` and is unit tested with Node's built-in test runner using dependency injection to avoid needing real browser APIs in tests.

**Tech Stack:** Vanilla JS (ES modules), `@xenova/transformers` (Whisper inference), `esbuild` (bundles only the offscreen entry, since it's the only file with npm dependencies), Node's built-in `node:test` + `node:assert/strict` for unit tests, Chrome MV3 APIs (`tabCapture`, `offscreen`, `identity`, `storage`, `downloads`), Google Picker API + Drive API v3.

**Spec:** [docs/superpowers/specs/2026-09-12-tab-transcript-extension-design.md](../specs/2026-09-12-tab-transcript-extension-design.md)

## Global Constraints

- OAuth scope is `https://www.googleapis.com/auth/drive.file` only — never request broader Drive scopes.
- Whisper model is the multilingual `Xenova/whisper-small` checkpoint (not `.en`), with the pipeline's `language` option forced to `'spanish'` — never auto-detect.
- Transcription runs once, after recording stops — no live/incremental transcription.
- Audio passthrough is required: the tab's audio must keep playing to the user's speakers while it's being captured.
- Export filename convention, used identically for the download and the Drive upload: `` Transcript – <tab title, sanitized> – <YYYY-MM-DD HH-mm>.txt `` (en dash `–`, not a hyphen).
- No NotebookLM API integration — getting the file from Drive into NotebookLM stays a manual "Add source" click.
- Chrome-only (MV3 `tabCapture`/`offscreen`/`identity` are Chromium-specific).
- The Google Picker's loader (`https://apis.google.com/js/api.js`) is the one piece of remotely-loaded script in this extension, per Google's documented pattern for using Picker inside a Chrome extension. Flag this for a Chrome Web Store policy re-check before publishing — it's an accepted, documented exception, but store policy should be re-verified at publish time since policies change.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `build.js`
- Create: `src/manifest.json`
- Create: `src/icons/icon16.png`, `src/icons/icon48.png`, `src/icons/icon128.png`
- Create: `src/offscreen/offscreen.html`
- Create: `src/offscreen/offscreen.js` (empty placeholder entry, filled in Task 8)

**Interfaces:**
- Produces: the `dist/` build output directory that every later manual-verification task loads as an unpacked extension.
- Produces: `npm test` (runs `node --test tests/`) and `npm run build` (runs `node build.js`), which every later task relies on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tab-transcript-extension",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.js",
    "test": "node --test tests/"
  },
  "dependencies": {
    "@xenova/transformers": "^2.17.2"
  },
  "devDependencies": {
    "esbuild": "^0.23.0"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 4: Create the manifest**

Create `src/manifest.json`:

```json
{
  "manifest_version": 3,
  "name": "Tab Transcript",
  "version": "0.1.0",
  "description": "Records a browser tab's audio, transcribes it to Spanish text locally, and exports it as a .txt file or to Google Drive.",
  "permissions": ["tabCapture", "offscreen", "storage", "identity", "downloads"],
  "host_permissions": ["https://www.googleapis.com/*"],
  "background": {
    "service_worker": "background/background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "oauth2": {
    "client_id": "REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["https://www.googleapis.com/auth/drive.file"]
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self' https://apis.google.com; object-src 'self';"
  }
}
```

- [ ] **Step 5: Add placeholder icons**

Create three flat-color PNGs at `src/icons/icon16.png`, `src/icons/icon48.png`, `src/icons/icon128.png` (16x16, 48x48, 128x128). Any placeholder image works — these get replaced later; their only job right now is to satisfy the manifest so Chrome doesn't warn about missing icons.

- [ ] **Step 6: Create the offscreen document shell**

Create `src/offscreen/offscreen.html`:

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body>
<script src="offscreen.js"></script>
</body>
</html>
```

Create `src/offscreen/offscreen.js` with a single line for now (real content lands in Task 8):

```js
console.log('Tab Transcript offscreen document loaded');
```

- [ ] **Step 7: Write `build.js`**

```js
import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SRC = 'src';
const DIST = 'dist';

async function copyStaticFiles() {
  const staticEntries = [
    'manifest.json',
    'icons',
    'background',
    'popup',
    'options',
    'lib',
    'offscreen/offscreen.html',
  ];
  for (const entry of staticEntries) {
    await cp(path.join(SRC, entry), path.join(DIST, entry), { recursive: true });
  }
}

async function bundleOffscreenScript() {
  await build({
    entryPoints: [path.join(SRC, 'offscreen/offscreen.js')],
    bundle: true,
    platform: 'browser',
    format: 'iife',
    outfile: path.join(DIST, 'offscreen/offscreen.bundle.js'),
  });
}

async function copyOnnxWasm() {
  const ortDistDir = path.join('node_modules', 'onnxruntime-web', 'dist');
  const destDir = path.join(DIST, 'offscreen', 'ort-wasm');
  await mkdir(destDir, { recursive: true });
  const wasmFiles = ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd.wasm', 'ort-wasm.wasm'];
  for (const file of wasmFiles) {
    await cp(path.join(ortDistDir, file), path.join(destDir, file));
  }
}

async function rewriteOffscreenHtmlScriptTag() {
  const htmlPath = path.join(DIST, 'offscreen/offscreen.html');
  let html = await readFile(htmlPath, 'utf8');
  html = html.replace('offscreen.js', 'offscreen.bundle.js');
  await writeFile(htmlPath, html);
}

async function main() {
  await mkdir(DIST, { recursive: true });
  await copyStaticFiles();
  await bundleOffscreenScript();
  await copyOnnxWasm();
  await rewriteOffscreenHtmlScriptTag();
  console.log('Build complete: dist/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Note: `copyStaticFiles` and `copyOnnxWasm` will fail until later tasks create `background/`, `popup/`, `options/`, `lib/` and until `@xenova/transformers` pulls in `onnxruntime-web` (it does, transitively, once installed in Step 3). For this task, temporarily comment out the `'background'`, `'popup'`, `'options'`, `'lib'` entries in `staticEntries` and the `copyOnnxWasm()` call in `main()` — uncomment `'lib'`/`'background'`/`'popup'`/`'options'` as each is created in later tasks, and uncomment `copyOnnxWasm()` in Task 7 once the transcriber needs it.

- [ ] **Step 8: Build and load the extension**

Run: `npm run build`
Expected: `dist/manifest.json`, `dist/icons/`, `dist/offscreen/offscreen.html`, `dist/offscreen/offscreen.bundle.js` exist.

Manual verification: open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select the `dist/` folder. Expected: extension loads with no manifest errors (the missing OAuth client ID is fine at this stage — Chrome only validates its format, not that it's real).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore build.js src/manifest.json src/icons src/offscreen
git commit -m "chore: scaffold extension project and build script"
```

---

### Task 2: `lib/filename.js` — transcript filename generation

**Files:**
- Create: `src/lib/filename.js`
- Test: `tests/filename.test.js`

**Interfaces:**
- Produces: `sanitizeForFilename(text: string): string`, `formatTimestamp(date: Date): string`, `buildTranscriptFilename(tabTitle: string, date?: Date): string` — used by `popup/popup.js` (Task 10) and `lib/drive.js` calls from `background/background.js` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `tests/filename.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeForFilename, formatTimestamp, buildTranscriptFilename } from '../src/lib/filename.js';

test('sanitizeForFilename strips characters illegal in filenames', () => {
  assert.equal(sanitizeForFilename('Meeting: Q3 / Planning?'), 'Meeting Q3  Planning');
});

test('sanitizeForFilename trims whitespace and caps length at 100', () => {
  const long = 'a'.repeat(150);
  assert.equal(sanitizeForFilename(`  ${long}  `).length, 100);
});

test('formatTimestamp pads single digits', () => {
  const date = new Date(2026, 0, 5, 9, 3);
  assert.equal(formatTimestamp(date), '2026-01-05 09-03');
});

test('buildTranscriptFilename combines sanitized title and timestamp', () => {
  const date = new Date(2026, 8, 12, 14, 30);
  assert.equal(
    buildTranscriptFilename('Weekly Sync', date),
    'Transcript – Weekly Sync – 2026-09-12 14-30.txt'
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/filename.test.js`
Expected: FAIL — `Cannot find module '../src/lib/filename.js'`

- [ ] **Step 3: Implement `src/lib/filename.js`**

```js
export function sanitizeForFilename(text) {
  return text.replace(/[\\/:*?"<>|]/g, '').trim().slice(0, 100);
}

export function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

export function buildTranscriptFilename(tabTitle, date = new Date()) {
  return `Transcript – ${sanitizeForFilename(tabTitle)} – ${formatTimestamp(date)}.txt`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/filename.test.js`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/filename.js tests/filename.test.js
git commit -m "feat: add transcript filename generation"
```

---

### Task 3: `lib/messaging.js` — message contracts

**Files:**
- Create: `src/lib/messaging.js`
- Test: `tests/messaging.test.js`

**Interfaces:**
- Produces: `MessageType` (frozen enum object), `createMessage(type: string, payload?: object): {type, payload, timestamp}`, `isMessageOfType(message, type: string): boolean` — used by `background/background.js` (Task 9), `offscreen/offscreen.js` (Task 8), and `popup/popup.js` (Task 10) as the only way messages are built and checked.

- [ ] **Step 1: Write the failing tests**

Create `tests/messaging.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MessageType, createMessage, isMessageOfType } from '../src/lib/messaging.js';

test('createMessage builds a valid envelope for a known type', () => {
  const message = createMessage(MessageType.START_RECORDING, { streamId: 'abc' });
  assert.equal(message.type, MessageType.START_RECORDING);
  assert.deepEqual(message.payload, { streamId: 'abc' });
  assert.equal(typeof message.timestamp, 'number');
});

test('createMessage defaults payload to an empty object', () => {
  const message = createMessage(MessageType.RECORDING_STARTED);
  assert.deepEqual(message.payload, {});
});

test('createMessage throws for an unknown type', () => {
  assert.throws(() => createMessage('NOT_A_REAL_TYPE'), /Unknown message type/);
});

test('isMessageOfType matches only the given type', () => {
  const message = createMessage(MessageType.ERROR, { message: 'boom' });
  assert.equal(isMessageOfType(message, MessageType.ERROR), true);
  assert.equal(isMessageOfType(message, MessageType.START_RECORDING), false);
});

test('isMessageOfType handles null/undefined safely', () => {
  assert.equal(isMessageOfType(null, MessageType.ERROR), false);
  assert.equal(isMessageOfType(undefined, MessageType.ERROR), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/messaging.test.js`
Expected: FAIL — `Cannot find module '../src/lib/messaging.js'`

- [ ] **Step 3: Implement `src/lib/messaging.js`**

```js
export const MessageType = Object.freeze({
  POPUP_START_RECORDING: 'POPUP_START_RECORDING',
  POPUP_STOP_RECORDING: 'POPUP_STOP_RECORDING',
  START_RECORDING: 'START_RECORDING',
  STOP_RECORDING: 'STOP_RECORDING',
  RECORDING_STARTED: 'RECORDING_STARTED',
  TRANSCRIPTION_DONE: 'TRANSCRIPTION_DONE',
  DRIVE_UPLOAD_REQUEST: 'DRIVE_UPLOAD_REQUEST',
  DRIVE_UPLOAD_DONE: 'DRIVE_UPLOAD_DONE',
  ERROR: 'ERROR',
});

export function createMessage(type, payload = {}) {
  if (!Object.values(MessageType).includes(type)) {
    throw new Error(`Unknown message type: ${type}`);
  }
  return { type, payload, timestamp: Date.now() };
}

export function isMessageOfType(message, type) {
  return Boolean(message) && message.type === type;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/messaging.test.js`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/messaging.js tests/messaging.test.js
git commit -m "feat: add message contracts for cross-context communication"
```

---

### Task 4: `lib/storage.js` — transcript cache and Drive folder settings

**Files:**
- Create: `src/lib/storage.js`
- Test: `tests/storage.test.js`
- Modify: `build.js` — uncomment `'lib'` in `staticEntries`

**Interfaces:**
- Consumes: nothing new.
- Produces: `saveTranscript({text, tabTitle}, storageArea?): Promise<void>`, `loadTranscript(storageArea?): Promise<{text, tabTitle} | null>`, `saveDriveFolder({id, name}, storageArea?): Promise<void>`, `loadDriveFolder(storageArea?): Promise<{id, name} | null>` — used by `popup/popup.js` (Task 10) and `options/options.js` (Task 11). Default `storageArea` is `chrome.storage.session` for transcripts and `chrome.storage.local` for the folder; tests always pass an explicit fake.

- [ ] **Step 1: Write the failing tests**

Create `tests/storage.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/storage.test.js`
Expected: FAIL — `Cannot find module '../src/lib/storage.js'`

- [ ] **Step 3: Implement `src/lib/storage.js`**

```js
const TRANSCRIPT_KEY = 'lastTranscript';
const FOLDER_KEY = 'driveFolder';

export async function saveTranscript(transcript, storageArea = chrome.storage.session) {
  await storageArea.set({ [TRANSCRIPT_KEY]: transcript });
}

export async function loadTranscript(storageArea = chrome.storage.session) {
  const result = await storageArea.get(TRANSCRIPT_KEY);
  return result[TRANSCRIPT_KEY] ?? null;
}

export async function saveDriveFolder(folder, storageArea = chrome.storage.local) {
  await storageArea.set({ [FOLDER_KEY]: folder });
}

export async function loadDriveFolder(storageArea = chrome.storage.local) {
  const result = await storageArea.get(FOLDER_KEY);
  return result[FOLDER_KEY] ?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/storage.test.js`
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Uncomment `'lib'` in `build.js`'s `staticEntries` and rebuild**

Run: `npm run build`
Expected: `dist/lib/storage.js` exists, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.js tests/storage.test.js build.js
git commit -m "feat: add transcript cache and Drive folder storage helpers"
```

---

### Task 5: `lib/drive.js` — Drive upload

**Files:**
- Create: `src/lib/drive.js`
- Test: `tests/drive.test.js`

**Interfaces:**
- Produces: `buildMultipartUploadBody(boundary: string, metadata: object, fileContent: string, mimeType: string): string`, `uploadTranscriptToDrive({accessToken, folderId, filename, content, fetchImpl?}): Promise<object>` — used by `background/background.js` (Task 9).

- [ ] **Step 1: Write the failing tests**

Create `tests/drive.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/drive.test.js`
Expected: FAIL — `Cannot find module '../src/lib/drive.js'`

- [ ] **Step 3: Implement `src/lib/drive.js`**

```js
export function buildMultipartUploadBody(boundary, metadata, fileContent, mimeType) {
  const delimiter = `--${boundary}\r\n`;
  const closeDelimiter = `--${boundary}--`;
  return (
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    '\r\n' +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    fileContent +
    '\r\n' +
    closeDelimiter
  );
}

export async function uploadTranscriptToDrive({ accessToken, folderId, filename, content, fetchImpl = fetch }) {
  const boundary = `tab_transcript_boundary_${Date.now()}`;
  const metadata = { name: filename, parents: [folderId], mimeType: 'text/plain' };
  const body = buildMultipartUploadBody(boundary, metadata, content, 'text/plain');

  const response = await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Drive upload failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/drive.test.js`
Expected: PASS — 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/drive.js tests/drive.test.js
git commit -m "feat: add Drive multipart upload helper"
```

---

### Task 6: `offscreen/recorder.js` — tab audio recording + passthrough

**Files:**
- Create: `src/offscreen/recorder.js`
- Test: `tests/recorder.test.js`

**Interfaces:**
- Produces: `buildTabCaptureConstraints(streamId: string): MediaStreamConstraints`, `class TabRecorder { constructor({getUserMedia?, MediaRecorderClass?, AudioContextClass?}); getState(): 'idle'|'recording'; start(streamId: string): Promise<void>; stop(): Promise<Blob> }` — used by `offscreen/offscreen.js` (Task 8). Real browser globals (`navigator.mediaDevices.getUserMedia`, `MediaRecorder`, `AudioContext`) are the defaults; tests inject fakes.

- [ ] **Step 1: Write the failing tests**

Create `tests/recorder.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/recorder.test.js`
Expected: FAIL — `Cannot find module '../src/offscreen/recorder.js'`

- [ ] **Step 3: Implement `src/offscreen/recorder.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/recorder.test.js`
Expected: PASS — 5 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/offscreen/recorder.js tests/recorder.test.js
git commit -m "feat: add tab audio recorder with speaker passthrough"
```

---

### Task 7: `offscreen/transcriber.js` — local Whisper transcription (Spanish)

**Files:**
- Create: `src/offscreen/transcriber.js`
- Test: `tests/transcriber.test.js`
- Modify: `build.js` — uncomment the `copyOnnxWasm()` call in `main()`

**Interfaces:**
- Produces: `transcribeAudioBlob(blob: Blob, {pipelineFactory?, decodeAudio?, language?}): Promise<string>`, `decodeBlobToFloat32Array(blob: Blob, audioContext?): Promise<Float32Array>` — used by `offscreen/offscreen.js` (Task 8). Defaults use the real `@xenova/transformers` pipeline (`Xenova/whisper-small`) and a real `AudioContext`; tests inject fakes for both, so the real model is never loaded during `npm test`.

- [ ] **Step 1: Write the failing tests**

Create `tests/transcriber.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/transcriber.test.js`
Expected: FAIL — `Cannot find module '../src/offscreen/transcriber.js'`

- [ ] **Step 3: Implement `src/offscreen/transcriber.js`**

```js
import { pipeline, env } from '@xenova/transformers';

let configured = false;
function configureEnvironment() {
  if (configured) return;
  env.allowLocalModels = false;
  if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
    env.backends.onnx.wasm.wasmPaths = chrome.runtime.getURL('offscreen/ort-wasm/');
  }
  configured = true;
}

let cachedPipelinePromise = null;
async function defaultPipelineFactory() {
  configureEnvironment();
  if (!cachedPipelinePromise) {
    cachedPipelinePromise = pipeline('automatic-speech-recognition', 'Xenova/whisper-small');
  }
  return cachedPipelinePromise;
}

export async function decodeBlobToFloat32Array(blob, audioContext = new AudioContext({ sampleRate: 16000 })) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  return audioBuffer.getChannelData(0);
}

export async function transcribeAudioBlob(blob, {
  pipelineFactory = defaultPipelineFactory,
  decodeAudio = decodeBlobToFloat32Array,
  language = 'spanish',
} = {}) {
  const audioData = await decodeAudio(blob);
  const transcriber = await pipelineFactory();
  const result = await transcriber(audioData, { language, task: 'transcribe' });
  return result.text;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/transcriber.test.js`
Expected: PASS — 2 tests passing (the real `@xenova/transformers` module is imported but never invoked — `pipelineFactory`/`decodeAudio` fakes are always passed explicitly, so no model download happens during tests).

- [ ] **Step 5: Uncomment `copyOnnxWasm()` in `build.js` and rebuild**

Run: `npm run build`
Expected: `dist/offscreen/ort-wasm/` contains the three `.wasm` files, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/offscreen/transcriber.js tests/transcriber.test.js build.js
git commit -m "feat: add local Spanish Whisper transcription"
```

---

### Task 8: `offscreen/offscreen.js` — wire recorder + transcriber to messages

**Files:**
- Modify: `src/offscreen/offscreen.js`

**Interfaces:**
- Consumes: `TabRecorder` from `./recorder.js` (Task 6), `transcribeAudioBlob` from `./transcriber.js` (Task 7), `MessageType`/`createMessage`/`isMessageOfType` from `../lib/messaging.js` (Task 3).
- Produces: the offscreen document's response to `MessageType.START_RECORDING` (payload `{streamId}`) → replies `RECORDING_STARTED` or `ERROR`; response to `MessageType.STOP_RECORDING` → replies `TRANSCRIPTION_DONE` (payload `{text}`) or `ERROR`. Consumed by `background/background.js` (Task 9).

This task is glue code over real browser APIs (`chrome.runtime.onMessage`) — it isn't unit-testable without a full Chrome API mock, so verification is manual, via the console once Task 9's background wiring can actually reach it.

- [ ] **Step 1: Replace `src/offscreen/offscreen.js`**

```js
import { TabRecorder } from './recorder.js';
import { transcribeAudioBlob } from './transcriber.js';
import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';

const recorder = new TabRecorder();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isMessageOfType(message, MessageType.START_RECORDING)) {
    recorder.start(message.payload.streamId)
      .then(() => sendResponse(createMessage(MessageType.RECORDING_STARTED)))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.STOP_RECORDING)) {
    recorder.stop()
      .then(async (blob) => {
        const text = await transcribeAudioBlob(blob);
        sendResponse(createMessage(MessageType.TRANSCRIPTION_DONE, { text }));
      })
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  return false;
});

console.log('Tab Transcript offscreen document ready');
```

- [ ] **Step 2: Rebuild**

Run: `npm run build`
Expected: `dist/offscreen/offscreen.bundle.js` rebuilt with no esbuild errors (relative imports to `recorder.js`, `transcriber.js`, and `../lib/messaging.js` resolve and get inlined by esbuild's bundler).

- [ ] **Step 3: Commit**

```bash
git add src/offscreen/offscreen.js
git commit -m "feat: wire offscreen document to recorder and transcriber"
```

---

### Task 9: `background/background.js` — capture orchestration + Drive trigger

**Files:**
- Create: `src/background/background.js`
- Modify: `build.js` — uncomment `'background'` in `staticEntries`

**Interfaces:**
- Consumes: `MessageType`/`createMessage`/`isMessageOfType` from `../lib/messaging.js` (Task 3), `loadDriveFolder` from `../lib/storage.js` (Task 4), `uploadTranscriptToDrive` from `../lib/drive.js` (Task 5).
- Produces: handles `MessageType.POPUP_START_RECORDING` (payload `{tabId}`), `MessageType.POPUP_STOP_RECORDING`, and `MessageType.DRIVE_UPLOAD_REQUEST` (payload `{filename, content}`) sent by `popup/popup.js` (Task 10).

This task is glue code over `chrome.tabCapture`/`chrome.offscreen`/`chrome.identity` — not unit-testable without a full Chrome API mock. Verified manually once the popup (Task 10) can drive it end-to-end.

- [ ] **Step 1: Create `src/background/background.js`**

```js
import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { loadDriveFolder } from '../lib/storage.js';
import { uploadTranscriptToDrive } from '../lib/drive.js';

const OFFSCREEN_DOCUMENT_PATH = 'offscreen/offscreen.html';

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Record and transcribe tab audio locally.',
  });
}

async function startRecording(tabId) {
  await ensureOffscreenDocument();
  const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  return chrome.runtime.sendMessage(createMessage(MessageType.START_RECORDING, { streamId }));
}

async function stopRecording() {
  return chrome.runtime.sendMessage(createMessage(MessageType.STOP_RECORDING));
}

async function uploadToDrive(filename, content) {
  const folder = await loadDriveFolder();
  if (!folder) {
    throw new Error('No Drive folder configured. Set one up in the extension options.');
  }
  const token = await chrome.identity.getAuthToken({ interactive: true });
  const accessToken = token.token ?? token;
  return uploadTranscriptToDrive({ accessToken, folderId: folder.id, filename, content });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (isMessageOfType(message, MessageType.POPUP_START_RECORDING)) {
    startRecording(message.payload.tabId)
      .then(() => sendResponse(createMessage(MessageType.RECORDING_STARTED)))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.POPUP_STOP_RECORDING)) {
    stopRecording()
      .then((response) => sendResponse(response))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  if (isMessageOfType(message, MessageType.DRIVE_UPLOAD_REQUEST)) {
    uploadToDrive(message.payload.filename, message.payload.content)
      .then(() => sendResponse(createMessage(MessageType.DRIVE_UPLOAD_DONE)))
      .catch((error) => sendResponse(createMessage(MessageType.ERROR, { message: error.message })));
    return true;
  }

  return false;
});
```

- [ ] **Step 2: Uncomment `'background'` in `build.js` and rebuild**

Run: `npm run build`
Expected: `dist/background/background.js` exists, build succeeds.

- [ ] **Step 3: Reload the extension and check for errors**

In `chrome://extensions`, click the reload icon on the Tab Transcript card, then click "service worker" under "Inspect views" to open its console. Expected: no errors on load (message handlers registered, no exceptions).

- [ ] **Step 4: Commit**

```bash
git add src/background/background.js build.js
git commit -m "feat: add background orchestration for capture and Drive upload"
```

---

### Task 10: Popup UI — start/stop, status, transcript, export actions

**Files:**
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/popup.js`
- Modify: `build.js` — uncomment `'popup'` in `staticEntries`

**Interfaces:**
- Consumes: `MessageType`/`createMessage`/`isMessageOfType` from `../lib/messaging.js` (Task 3), `loadDriveFolder`/`loadTranscript`/`saveTranscript` from `../lib/storage.js` (Task 4), `buildTranscriptFilename` from `../lib/filename.js` (Task 2). Sends `POPUP_START_RECORDING`/`POPUP_STOP_RECORDING`/`DRIVE_UPLOAD_REQUEST` to `background/background.js` (Task 9).

This is the primary user-facing surface — verified manually against the flow in the spec (record → stop → transcript appears → download / upload).

- [ ] **Step 1: Create `src/popup/popup.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="popup.css" />
</head>
<body>
  <div class="popup">
    <button id="start-stop">Start Recording</button>
    <p id="status">Idle</p>
    <textarea id="transcript" readonly placeholder="Transcript will appear here…"></textarea>
    <div class="actions">
      <button id="download" disabled>Download .txt</button>
      <button id="upload" disabled>Upload to Drive</button>
    </div>
    <p id="folder-info"></p>
  </div>
  <script type="module" src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `src/popup/popup.css`**

```css
body { width: 320px; font-family: system-ui, sans-serif; margin: 0; }
.popup { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
textarea { width: 100%; height: 120px; resize: vertical; box-sizing: border-box; }
.actions { display: flex; gap: 8px; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
#folder-info { font-size: 12px; color: #555; }
```

- [ ] **Step 3: Create `src/popup/popup.js`**

```js
import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { loadDriveFolder, loadTranscript, saveTranscript } from '../lib/storage.js';
import { buildTranscriptFilename } from '../lib/filename.js';

const startStopButton = document.getElementById('start-stop');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const downloadButton = document.getElementById('download');
const uploadButton = document.getElementById('upload');
const folderInfoEl = document.getElementById('folder-info');

let isRecording = false;
let lastTranscript = null;
let activeTabTitle = '';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshFolderInfo() {
  const folder = await loadDriveFolder();
  if (folder) {
    folderInfoEl.innerHTML = `Uploading to: <b>${folder.name}</b> · <a href="https://drive.google.com/drive/folders/${folder.id}" target="_blank" rel="noopener">Open in Drive</a>`;
  } else {
    folderInfoEl.textContent = 'No Drive folder configured (see Options).';
    uploadButton.disabled = true;
  }
}

async function restoreTranscript() {
  const cached = await loadTranscript();
  if (cached) {
    lastTranscript = cached.text;
    activeTabTitle = cached.tabTitle;
    transcriptEl.value = cached.text;
    downloadButton.disabled = false;
    uploadButton.disabled = false;
    statusEl.textContent = 'Done (restored)';
  }
}

startStopButton.addEventListener('click', async () => {
  if (!isRecording) {
    const tab = await getActiveTab();
    activeTabTitle = tab.title ?? 'transcript';
    statusEl.textContent = 'Recording…';
    startStopButton.textContent = 'Stop Recording';
    isRecording = true;

    const response = await chrome.runtime.sendMessage(
      createMessage(MessageType.POPUP_START_RECORDING, { tabId: tab.id })
    );
    if (isMessageOfType(response, MessageType.ERROR)) {
      statusEl.textContent = `Error: ${response.payload.message}`;
      isRecording = false;
      startStopButton.textContent = 'Start Recording';
    }
  } else {
    statusEl.textContent = 'Transcribing…';
    startStopButton.disabled = true;

    const response = await chrome.runtime.sendMessage(createMessage(MessageType.POPUP_STOP_RECORDING));

    startStopButton.disabled = false;
    startStopButton.textContent = 'Start Recording';
    isRecording = false;

    if (isMessageOfType(response, MessageType.ERROR)) {
      statusEl.textContent = `Error: ${response.payload.message}`;
      return;
    }

    lastTranscript = response.payload.text;
    statusEl.textContent = 'Done';
    transcriptEl.value = lastTranscript;
    downloadButton.disabled = false;
    uploadButton.disabled = false;
    await saveTranscript({ text: lastTranscript, tabTitle: activeTabTitle });
  }
});

downloadButton.addEventListener('click', () => {
  const filename = buildTranscriptFilename(activeTabTitle);
  const blob = new Blob([lastTranscript], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false });
});

uploadButton.addEventListener('click', async () => {
  uploadButton.disabled = true;
  statusEl.textContent = 'Uploading to Drive…';
  const filename = buildTranscriptFilename(activeTabTitle);

  const response = await chrome.runtime.sendMessage(
    createMessage(MessageType.DRIVE_UPLOAD_REQUEST, { filename, content: lastTranscript })
  );

  uploadButton.disabled = false;
  statusEl.textContent = isMessageOfType(response, MessageType.ERROR)
    ? `Upload failed: ${response.payload.message}`
    : 'Uploaded to Drive';
});

restoreTranscript();
refreshFolderInfo();
```

- [ ] **Step 4: Uncomment `'popup'` in `build.js` and rebuild**

Run: `npm run build`
Expected: `dist/popup/` contains `popup.html`, `popup.css`, `popup.js`.

- [ ] **Step 5: Manual verification — record and export**

Reload the extension, open a tab playing audio (e.g. a video), click the extension icon, click "Start Recording". Expected: tab audio keeps playing (passthrough works), status shows "Recording…". Click "Stop Recording". Expected: status moves to "Transcribing…" then "Done" (first run downloads the ~250MB model — expect a multi-minute wait and check the service worker/offscreen console for progress logs), and the transcript textarea fills in. Click "Download .txt" — expected a file appears in Downloads named per the filename convention. "Upload to Drive" should show "No Drive folder configured" until Task 11 is done — expected, not a bug at this point.

- [ ] **Step 6: Commit**

```bash
git add src/popup build.js
git commit -m "feat: add popup UI for recording, transcript preview, and export"
```

---

### Task 11: `lib/picker.js` + Options UI — Drive connect and folder selection

**Files:**
- Create: `src/lib/picker.js`
- Create: `src/options/options.html`
- Create: `src/options/options.css`
- Create: `src/options/options.js`
- Modify: `build.js` — uncomment `'options'` in `staticEntries`

**Interfaces:**
- Produces (`lib/picker.js`): `loadPickerApi(): Promise<void>`, `openFolderPicker({oauthToken, developerKey}): Promise<{id, name} | null>` — used by `options/options.js` in this task.
- Consumes (`options/options.js`): `loadDriveFolder`/`saveDriveFolder` from `../lib/storage.js` (Task 4).

The Picker/OAuth flow can't be exercised without a real Google account and a real Cloud Console project (client ID + API key), so this task is verified manually, after Task 12 fills in real credentials.

- [ ] **Step 1: Create `src/lib/picker.js`**

```js
const PICKER_API_SRC = 'https://apis.google.com/js/api.js';

let pickerApiLoadPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

export function loadPickerApi() {
  if (!pickerApiLoadPromise) {
    pickerApiLoadPromise = loadScript(PICKER_API_SRC).then(
      () => new Promise((resolve) => gapi.load('picker', resolve))
    );
  }
  return pickerApiLoadPromise;
}

export function openFolderPicker({ oauthToken, developerKey }) {
  return loadPickerApi().then(
    () =>
      new Promise((resolve) => {
        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
          .setSelectFolderEnabled(true)
          .setIncludeFolders(true);

        const picker = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(oauthToken)
          .setDeveloperKey(developerKey)
          .setCallback((data) => {
            if (data.action === google.picker.Action.PICKED) {
              const folder = data.docs[0];
              resolve({ id: folder.id, name: folder.name });
            } else if (data.action === google.picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .build();

        picker.setVisible(true);
      })
  );
}
```

- [ ] **Step 2: Create `src/options/options.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="stylesheet" href="options.css" />
</head>
<body>
  <h1>Tab Transcript — Settings</h1>
  <section>
    <button id="connect">Connect Google Drive</button>
    <button id="choose-folder" disabled>Choose destination folder</button>
    <p id="folder-status">Not connected.</p>
  </section>
  <script type="module" src="options.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `src/options/options.css`**

```css
body { font-family: system-ui, sans-serif; max-width: 480px; margin: 24px auto; }
button { margin-right: 8px; }
```

- [ ] **Step 4: Create `src/options/options.js`**

```js
import { loadDriveFolder, saveDriveFolder } from '../lib/storage.js';
import { openFolderPicker } from '../lib/picker.js';

const DEVELOPER_KEY = 'REPLACE_WITH_YOUR_GOOGLE_API_KEY';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const connectButton = document.getElementById('connect');
const chooseFolderButton = document.getElementById('choose-folder');
const folderStatusEl = document.getElementById('folder-status');

async function refreshFolderStatus() {
  const folder = await loadDriveFolder();
  folderStatusEl.textContent = folder ? `Current folder: ${folder.name}` : 'No folder selected yet.';
}

connectButton.addEventListener('click', async () => {
  const token = await chrome.identity.getAuthToken({ interactive: true, scopes: [DRIVE_SCOPE] });
  const accessToken = token.token ?? token;
  chooseFolderButton.disabled = false;
  chooseFolderButton.dataset.token = accessToken;
  folderStatusEl.textContent = 'Connected. Now choose a folder.';
});

chooseFolderButton.addEventListener('click', async () => {
  const oauthToken = chooseFolderButton.dataset.token;
  const folder = await openFolderPicker({ oauthToken, developerKey: DEVELOPER_KEY });
  if (folder) {
    await saveDriveFolder(folder);
    await refreshFolderStatus();
  }
});

refreshFolderStatus();
```

- [ ] **Step 5: Uncomment `'options'` in `build.js` and rebuild**

Run: `npm run build`
Expected: `dist/options/` contains `options.html`, `options.css`, `options.js`, `dist/lib/picker.js` exists.

- [ ] **Step 6: Commit**

```bash
git add src/lib/picker.js src/options build.js
git commit -m "feat: add Drive OAuth connect and folder picker in options page"
```

---

### Task 12: Real Google Cloud credentials + developer setup docs

**Files:**
- Create: `README.md`
- Modify: `src/manifest.json` (only if you want to commit real credentials locally — normally these stay as placeholders in git and are filled in per-developer)

**Interfaces:**
- No code interfaces — this task makes Tasks 10 and 11 actually usable end-to-end by providing real credentials.

- [ ] **Step 1: Create a Google Cloud Console project**

In the Google Cloud Console: create a project, enable the "Google Drive API" and the "Google Picker API", create an OAuth 2.0 Client ID of type "Chrome Extension" (it will ask for the extension's ID, visible on `chrome://extensions` once loaded unpacked), and create an API key (restricted to the Picker API) for the Picker's `developerKey`.

- [ ] **Step 2: Fill in real credentials**

Replace `REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com` in `src/manifest.json`'s `oauth2.client_id` with the real client ID, and `REPLACE_WITH_YOUR_GOOGLE_API_KEY` in `src/options/options.js`'s `DEVELOPER_KEY` with the real API key.

- [ ] **Step 3: Write `README.md`**

```markdown
# Tab Transcript

A Chrome extension that records a tab's audio, transcribes it locally to
Spanish text (nothing leaves the browser for transcription), and exports
the transcript as a `.txt` download or an upload to a Google Drive folder.

## Setup

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select `dist/`.
4. Note the extension's ID shown on its card.
5. In the [Google Cloud Console](https://console.cloud.google.com/):
   - Create a project (or reuse one).
   - Enable the **Google Drive API** and the **Google Picker API**.
   - Create an **OAuth 2.0 Client ID** of type "Chrome Extension", using the extension ID from step 4.
   - Create an **API key**, restricted to the Picker API.
6. Put the OAuth client ID into `src/manifest.json`'s `oauth2.client_id`, and the API key into `src/options/options.js`'s `DEVELOPER_KEY`.
7. `npm run build` again, then reload the extension in `chrome://extensions`.
8. Open the extension's Options page, click "Connect Google Drive", then "Choose destination folder".

## Development

- `npm test` — runs unit tests (`node --test tests/`).
- `npm run build` — bundles the offscreen document and copies everything else into `dist/`.
- After any source change, `npm run build` and click the reload icon on the extension's card in `chrome://extensions`.

## Notes

- The first transcription ever run downloads the ~250MB `Xenova/whisper-small` model; it's cached afterward in IndexedDB.
- The Google Picker loads `https://apis.google.com/js/api.js` at runtime — Google's documented pattern for using Picker inside an extension. Re-verify this against current Chrome Web Store policy before publishing.
```

- [ ] **Step 4: Rebuild and smoke-test the full Drive flow**

Run: `npm run build`, reload the extension, open Options, connect Drive, pick a folder. Expected: the folder's name appears in the options page's status text. Open the popup — expected: the folder name and an "Open in Drive" link now appear under the export buttons.

- [ ] **Step 5: Commit**

```bash
git add README.md src/manifest.json src/options/options.js
git commit -m "docs: add developer setup instructions for Drive OAuth and Picker"
```

(Only commit `src/manifest.json`/`options.js` here if you're comfortable with real credentials in git history — many teams instead keep the placeholders committed and apply real values via a local, gitignored override. If so, skip staging those two files and note the manual local-only edit in the README instead.)

---

### Task 13: End-to-end manual verification against the spec

**Files:** none — this task only exercises the built extension.

- [ ] **Step 1: Full happy path**

Record a tab playing clear Spanish speech (e.g., a Spanish-language video) for 30-60 seconds. Verify: audio keeps playing throughout (passthrough), status transitions Recording… → Transcribing… → Done, the transcript is reasonably accurate Spanish text, "Download .txt" produces a file named per the convention with correct content, and "Upload to Drive" lands a file with the same name and content in the configured folder (check by following the popup's "Open in Drive" link).

- [ ] **Step 2: Error states**

- Deny the tab capture permission if prompted (or capture a tab with no audio): expected an inline error in the popup, not a silent failure or a frozen UI.
- Click "Upload to Drive" before ever configuring a folder (on a fresh profile/reload with storage cleared): expected the button is disabled with the "No Drive folder configured" prompt.
- Revoke the extension's Drive access (Google Account → Security → Third-party access) and then click "Upload to Drive": expected the error surfaces in the popup's status line, and the button re-enables so the user can retry (e.g. after reconnecting in Options) without re-recording.
- Delete the configured target folder in Drive, then click "Upload to Drive": expected a clear error from the Drive API surfaces in the popup rather than a silent failure.

- [ ] **Step 3: Popup reopen persistence**

Record and transcribe, then close the popup without exporting, then reopen it. Expected: the transcript is still there ("Done (restored)"), and both export buttons are still enabled.

- [ ] **Step 4: Record final verification notes**

If all steps pass, the implementation satisfies the spec's Testing section. If anything fails, fix it and re-run the specific failing step before moving on — do not batch fixes without re-verifying each one.
