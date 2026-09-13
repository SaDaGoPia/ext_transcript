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
   - Note the **project number** — it's on the dashboard's "Project info" card (a number, not the project ID).
6. Fill in the three values:
   - OAuth client ID → `src/manifest.json`'s `oauth2.client_id`
   - API key → `src/options/options.js`'s `DEVELOPER_KEY`
   - Project number → `src/options/options.js`'s `APP_ID` (the Picker needs it to grant this app access to the folder you pick)
7. `npm run build` again, then reload the extension in `chrome://extensions`.
8. Open the extension's Options page, click "Connect Google Drive", then "Choose destination folder".

## Development

- `npm test` — runs unit tests (`node --test tests/**/*.test.js`).
- `npm run build` — bundles the offscreen document and copies everything else into `dist/`.
- After any source change, `npm run build` and click the reload icon on the extension's card in `chrome://extensions`.

## Notes

- The first transcription ever run downloads the ~250MB `Xenova/whisper-small` model; it's cached by the browser afterward, so later runs start much faster.
- The Google Picker loads `https://apis.google.com/js/api.js` at runtime — Google's documented pattern for using Picker inside an extension. Re-verify this against current Chrome Web Store policy before publishing.
