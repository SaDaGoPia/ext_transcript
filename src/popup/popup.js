import { MessageType, createMessage, isMessageOfType } from '../lib/messaging.js';
import { loadRecordingState, loadTranscript, saveTranscript } from '../lib/storage.js';
import { buildTranscriptFilename } from '../lib/filename.js';

const startStopButton = document.getElementById('start-stop');
const buttonLabel = document.getElementById('start-stop-label');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const downloadButton = document.getElementById('download');

let isRecording = false;
let lastTranscript = null;
let activeTabTitle = '';
let elapsedTimerId = null;

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

// 'default' | 'recording' | 'error' — keeps text and styling in sync so a
// status message is never left with a stale color/weight from a prior state.
function setStatus(text, variant = 'default') {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-recording', variant === 'recording');
  statusEl.classList.toggle('is-error', variant === 'error');
}

// A live timer during recording answers "is this actually still working?"
// without the user having to guess through a long, silent wait.
function startElapsedTimer(startedAt) {
  stopElapsedTimer();
  const tick = () => setStatus(`Recording… ${formatElapsed(Date.now() - startedAt)}`, 'recording');
  tick();
  elapsedTimerId = setInterval(tick, 1000);
}

function stopElapsedTimer() {
  if (elapsedTimerId !== null) {
    clearInterval(elapsedTimerId);
    elapsedTimerId = null;
  }
}

function setButtonState(state) {
  // state: 'idle' | 'recording' | 'transcribing'
  isRecording = state === 'recording';
  startStopButton.classList.toggle('is-recording', state === 'recording');
  startStopButton.classList.toggle('is-transcribing', state === 'transcribing');
  startStopButton.disabled = state === 'transcribing';
  buttonLabel.textContent = state === 'transcribing' ? 'Transcribing…' : 'Start Recording';
  if (state === 'recording') buttonLabel.textContent = 'Stop Recording';
}

async function restoreTranscript() {
  const cached = await loadTranscript();
  if (!cached) return false;

  lastTranscript = cached.text;
  activeTabTitle = cached.tabTitle;
  transcriptEl.value = cached.text;
  downloadButton.disabled = false;
  setStatus('Done — restored from your last recording');
  return true;
}

// The popup closes on blur, so it can be reopened while the offscreen document
// is still recording. Without this, the button would read "Start Recording" and
// clicking it would throw `Cannot start recording from state "recording"`.
async function restoreRecordingState() {
  const state = await loadRecordingState();
  if (!state?.inProgress) return false;

  activeTabTitle = state.tabTitle ?? activeTabTitle;
  setButtonState('recording');
  startElapsedTimer(state.startedAt ?? Date.now());
  return true;
}

startStopButton.addEventListener('click', async () => {
  if (!isRecording) {
    const tab = await getActiveTab();
    activeTabTitle = tab.title ?? 'transcript';
    setButtonState('recording');
    startElapsedTimer(Date.now());

    try {
      const response = await chrome.runtime.sendMessage(
        createMessage(MessageType.POPUP_START_RECORDING, { tabId: tab.id, tabTitle: activeTabTitle })
      );
      if (isMessageOfType(response, MessageType.ERROR)) {
        stopElapsedTimer();
        setButtonState('idle');
        setStatus(`Couldn't start recording — ${response.payload.message}`, 'error');
      }
    } catch (error) {
      stopElapsedTimer();
      setButtonState('idle');
      setStatus(`Couldn't start recording — ${error.message}`, 'error');
    }
  } else {
    stopElapsedTimer();
    setButtonState('transcribing');
    setStatus('This can take a few minutes the first time');

    try {
      const response = await chrome.runtime.sendMessage(
        createMessage(MessageType.POPUP_STOP_RECORDING, { tabTitle: activeTabTitle })
      );

      setButtonState('idle');

      if (isMessageOfType(response, MessageType.ERROR)) {
        setStatus(`Couldn't transcribe — ${response.payload.message}`, 'error');
        return;
      }

      lastTranscript = response.payload.text;
      setStatus('Done');
      transcriptEl.value = lastTranscript;
      downloadButton.disabled = false;
      // The offscreen document already saved this; re-saving the same data is
      // harmless and keeps this path working on its own if that ever changes.
      await saveTranscript({ text: lastTranscript, tabTitle: activeTabTitle });
    } catch (error) {
      setButtonState('idle');
      setStatus(`Couldn't transcribe — ${error.message}`, 'error');
    }
  }
});

downloadButton.addEventListener('click', () => {
  const filename = buildTranscriptFilename(activeTabTitle);
  const blob = new Blob([lastTranscript], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({ url, filename, saveAs: false });
});

async function init() {
  const hasTranscript = await restoreTranscript();
  // Last, so an in-progress recording's status wins over "Done — restored…".
  const isRecordingNow = await restoreRecordingState();
  if (!hasTranscript && !isRecordingNow) {
    setStatus('Ready when you are');
  }
}

init().catch((error) => {
  setStatus(`Error: ${error.message}`, 'error');
});
