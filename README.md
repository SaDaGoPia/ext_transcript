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
   - Enable the **Google Drive API**.
   - Create an **OAuth 2.0 Client ID** of type "Chrome Extension", using the extension ID from step 4.
6. Put the OAuth client ID into `src/manifest.json`'s `oauth2.client_id`.
7. `npm run build` again, then reload the extension in `chrome://extensions`.
8. Open the extension's Options page and click "Connect Google Drive" — this creates (or reuses) a "Tab Transcripts" folder in your Drive automatically; there's no separate folder-picker step.

## Development

- `npm test` — runs unit tests (`node --test tests/**/*.test.js`).
- `npm run build` — bundles the offscreen document and copies everything else into `dist/`.
- After any source change, `npm run build` and click the reload icon on the extension's card in `chrome://extensions`.

## Notes

- The first transcription ever run downloads the ~250MB `Xenova/whisper-small` model; it's cached by the browser afterward, so later runs start much faster.
- There's no folder-picker UI: Manifest V3 blocks any remote script (including the Google Picker's loader) from running inside an extension page's CSP, so instead the extension always uploads to a folder named "Tab Transcripts" that it creates in your Drive on first connect (and reuses on later connects).
