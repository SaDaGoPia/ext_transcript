# Tab Transcript

A Chrome extension that records a tab's audio, transcribes it locally to
Spanish text (nothing leaves the browser), and lets you download the
transcript as a `.txt` file.

## Setup

1. `npm install`
2. `npm run build`
3. Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select `dist/`.

That's it — no accounts, no API keys.

## Development

- `npm test` — runs unit tests (`node --test tests/**/*.test.js`).
- `npm run build` — bundles the offscreen document and copies everything else into `dist/`.
- After any source change, `npm run build` and click the reload icon on the extension's card in `chrome://extensions`.

## Notes

- The first transcription ever run downloads the ~250MB `Xenova/whisper-small` model; it's cached by the browser afterward, so later runs start much faster.
