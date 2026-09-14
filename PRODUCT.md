# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vanilla HTML/CSS/JS (no framework) — a Chrome Manifest V3 extension. esbuild bundles only the offscreen document (the one file with an npm dependency); every other surface (popup, background) is plain ES modules. Already established by the existing codebase, not a new decision.

## Users

A single Spanish-speaking user (the developer), for personal use — not building toward other users or a Chrome Web Store audience right now. The job: capture the spoken audio of an online lecture or course video playing in a browser tab and get a Spanish text transcript out of it, to use as source material in NotebookLM (or similar note-taking/study tools).

## Product Purpose

Records a browser tab's audio and transcribes it locally to Spanish text — nothing leaves the browser — so the user can download it as a `.txt` file. Success is a clean, accurate-enough transcript of a lecture/course session with minimal friction: start recording, keep listening normally, stop, download.

## Positioning

Fully local, in-browser transcription (Whisper via Transformers.js, running in an offscreen document) with no account, no server, and no audio or text ever leaving the device. This is the mechanism that distinguishes it from typical "record and transcribe" tools, which usually upload audio to a cloud service.

## Operating Context

Used while attending an online lecture/course in a Chrome tab: the user starts recording at the beginning, keeps hearing the audio normally throughout (passthrough), stops at the end, and downloads the transcript. A single short session per use, not a background/always-on tool. No team, no shared workflows — one person, one browser, one popup.

## Capabilities and Constraints

- Chrome MV3 extension. The toolbar popup (fixed small width, ~320–360px) is the only interactive surface — there is no options/settings page.
- Local Whisper model (`Xenova/whisper-small`, ~250MB) downloads once on first-ever transcription; this can take several minutes with no progress feedback today (a known, undesigned gap — see Product Principles).
- Transcription output is Spanish only — the language is forced, never auto-detected.
- No cloud/account integration of any kind right now (a prior Google Drive upload feature was deliberately removed) — `.txt` download is the only export.
- Must read correctly in both Chrome's light and dark toolbar themes (the popup should honor the browser/OS theme, not force one).

## Brand Commitments

Name is "Tab Transcript" — confirmed, keep as-is. No existing logo, icon, or visual identity: the current toolbar icons are blank placeholder PNGs needing real design from scratch.

## Evidence on Hand

None. This is a personal tool with no users, testimonials, press, or case studies to draw on — future work must not fabricate any.

## Product Principles

- **Privacy-first, and it should look it.** Nothing about the design should imply audio or text leaves the browser — no cloud iconography, no "syncing," no account chrome.
- **Utility over ornament.** A personal study tool used in short, repeated bursts (start → stop → download); clarity and speed beat decoration.
- **Calm confidence during long waits.** The first-run model download and transcription can take minutes; the design needs to make that wait feel expected and trustworthy, not broken or stalled.
- **Respect the small canvas.** The popup is a fixed small width — hierarchy and restraint matter more than density or cleverness.
