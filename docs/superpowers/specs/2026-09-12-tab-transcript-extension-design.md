# Tab Transcript Extension — Design Spec

Date: 2026-09-12

## Purpose

A Chrome (Manifest V3) extension that records a browser tab's audio,
transcribes it locally to Spanish text using an in-browser Whisper model
(nothing leaves the browser for transcription), and lets the user export
the transcript either as a downloaded `.txt` file (for manual import into
NotebookLM) or by uploading it directly to a configured Google Drive
folder.

## Non-goals

- No NotebookLM API integration — NotebookLM has no public API for the
  free tier, so getting the file from Drive into NotebookLM ("Add
  source") stays a manual click by the user.
- No live/incremental transcription while recording — transcription runs
  once, after the recording stops.
- No arbitrary Drive browsing — the extension only ever sees the one
  folder the user explicitly picks, via `drive.file` scope.
- No Firefox/Safari support — this design is Chrome-only, built on
  `chrome.tabCapture`, `chrome.offscreen`, and `chrome.identity`, which
  are Chrome/Chromium-specific APIs.

## Architecture

Four pieces, matching the standard MV3 pattern for tab audio capture
(service workers cannot touch media APIs directly, so an offscreen
document does the real work):

1. **Background service worker** — orchestration only. Obtains the
   capture stream ID via `chrome.tabCapture.getMediaStreamId`, creates
   and messages the offscreen document, relays status between the popup
   and the offscreen document, and holds the Drive OAuth token
   (`chrome.identity.getAuthToken`).
2. **Offscreen document** — the only context with real media/DOM APIs.
   Runs two jobs per recording cycle, in sequence:
   - **Recorder**: takes the stream ID, opens it with `getUserMedia`,
     and splits the resulting stream into two paths:
     - into a `MediaRecorder` instance, capturing to a Blob;
     - through a Web Audio `AudioContext` node back out to the
       system's audio output, so the user keeps hearing the tab while
       it records (audio passthrough).
   - **Transcriber**: once recording stops, feeds the recorded Blob
     into a Transformers.js pipeline running `Xenova/whisper-small`
     (the multilingual checkpoint — not `.en`), with the target
     language forced to Spanish rather than auto-detected, producing
     the transcript text.
3. **Popup** — the only interactive UI surface. Contains:
   - Start/Stop Recording button for the active tab.
   - Status line: `Recording…` → `Transcribing…` → `Done`.
   - Transcript preview once transcription finishes.
   - `Download .txt` and `Upload to Drive` buttons, usable
     independently, any number of times, once a transcript exists.
   - The configured Drive folder's name plus an "Open in Drive" link
     (once a folder is configured), so the user can see & jump to
     where uploads are going.
4. **Options page** — Drive connection and folder management:
   - "Connect Google Drive" triggers the `chrome.identity` OAuth flow
     with the `drive.file` scope.
   - "Choose folder" opens the Google Picker in folder-select mode, so
     the user visually picks the destination folder rather than
     pasting an ID or link.
   - The chosen folder's ID and display name are persisted in
     `chrome.storage.local`, and can be changed at any time by picking
     again.

## Data flow (one recording cycle)

1. User clicks **Start** in the popup.
2. Popup asks background to start capture for the active tab.
3. Background calls `chrome.tabCapture.getMediaStreamId({ targetTabId })`,
   creates the offscreen document if not already open, and forwards the
   stream ID to it.
4. Offscreen opens the stream, starts `MediaRecorder`, and wires up the
   `AudioContext` passthrough to speakers. Popup status → `Recording…`.
5. User clicks **Stop**. Offscreen stops `MediaRecorder`, finalizes the
   audio Blob, and tears down the stream and passthrough node.
6. Offscreen loads (or reuses the cached) `Xenova/whisper-small` model
   and runs transcription on the Blob, forcing Spanish as the output
   language. Popup status → `Transcribing…` (with a one-time
   `Downloading model…` sub-state the very first time the model isn't
   yet cached in IndexedDB).
7. Offscreen sends the resulting transcript text back through the
   background to the popup. Popup status → `Done`; transcript is shown
   in a preview area and cached in `chrome.storage.session` so it
   survives a popup close/reopen until the next recording starts.
8. User clicks **Download .txt** and/or **Upload to Drive**,
   independently, as many times as they like, without needing to
   re-record or re-transcribe.

### File naming

Both the downloaded file and the Drive upload use the same convention:

```
Transcript – <tab title, sanitized> – <YYYY-MM-DD HH-mm>.txt
```

### Drive upload

Background exchanges/reuses the cached OAuth token and calls the Drive
API's `files.create` (multipart upload, `text/plain` mime type) with
`parents: [configuredFolderId]`.

## Permissions & OAuth

- Manifest permissions: `tabCapture`, `offscreen`, `storage`, `identity`.
- Host permissions: `https://www.googleapis.com/*` (Drive API calls
  only).
- OAuth scope: `https://www.googleapis.com/auth/drive.file` only. This
  restricts the extension to files/folders it created or that the user
  explicitly selected through it — it cannot browse or read the rest of
  the user's Drive. This keeps the OAuth consent screen minimal and
  avoids Google's more invasive verification process for broader Drive
  scopes.
- The Google Picker's folder-select mode is used to grant access to a
  user-chosen folder under `drive.file` scope — Google's documented
  pattern for letting a narrowly-scoped app target an arbitrary
  user-picked folder without requesting broader access.

## Error handling

- **Capture denied / no active tab audio**: popup shows an inline error
  message; no silent failure, no retry loop.
- **Model not yet cached**: first transcription ever run shows a
  one-time "Downloading model (~250MB)…" progress state; Transformers.js
  caches the model in IndexedDB afterward, so this is a one-time cost
  per browser profile.
- **Drive upload failure** (expired token, network error, folder
  deleted/moved): popup surfaces the specific error and re-enables
  **Upload to Drive** so the user can retry without re-recording or
  re-transcribing — the transcript stays cached in
  `chrome.storage.session`.
- **No folder configured yet**: **Upload to Drive** is disabled with a
  prompt pointing to the Options page to connect Drive / pick a folder.

## Testing

This extension leans heavily on real browser/OS-level APIs (tab audio
capture, `MediaRecorder`, in-browser ML inference, OAuth) that don't
have meaningful automated test coverage in isolation. Testing strategy:

- **Unit tests** for pure logic that doesn't touch browser APIs:
  filename generation/sanitization, message-passing contracts between
  background/offscreen/popup, and `chrome.storage` read/write helpers.
- **Manual end-to-end verification** for everything else: record a tab
  with known Spanish speech, confirm audio passthrough is audible,
  confirm transcript accuracy is reasonable, confirm the Drive upload
  lands in the configured folder with the expected filename, and
  confirm error states (deny capture, disconnect Drive, delete the
  target folder mid-flow) behave as designed above.

This is called out explicitly rather than implying automated coverage
that isn't realistic for this class of extension.
